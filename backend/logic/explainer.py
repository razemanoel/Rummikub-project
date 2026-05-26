from collections import Counter
from typing import List, Dict, Any, Tuple

from backend.logic.models import Tile, GameState


def explain_solution(game_state: GameState, solver_result: Dict[str, Any]) -> List[str]:
    """
    Build human-readable explanation steps from:
    - original board/rack
    - ILP new_board result
    """

    old_board = game_state.board
    rack = game_state.rack
    new_board = solver_result.get("new_board", [])
    remaining_rack = solver_result.get("remaining_rack", [])
    joker_assignments = solver_result.get("joker_assignments", [])

    steps = []

    used_old_sets = set()
    used_new_sets = set()

    # 1. Exact unchanged sets
    unchanged_sets = []

    for old_index, old_set in enumerate(old_board):
        for new_index, new_set in enumerate(new_board):
            if new_index in used_new_sets:
                continue

            if same_tile_multiset(old_set.tiles, new_set.tiles):
                unchanged_sets.append(
                    (old_index, new_set.tiles)
                )

                used_old_sets.add(old_index)
                used_new_sets.add(new_index)
                break

    if unchanged_sets:
        steps.append("Keep these board sets unchanged:")

        for old_index, tiles in unchanged_sets:
            steps.append(
                f"- Board set #{old_index}: {format_tiles(tiles)}"
            )
    # 2. Extended existing sets
    for old_index, old_set in enumerate(old_board):
        if old_index in used_old_sets:
            continue

        for new_index, new_set in enumerate(new_board):
            if new_index in used_new_sets:
                continue

            if is_subset_tiles(old_set.tiles, new_set.tiles):
                added_tiles = subtract_tiles(new_set.tiles, old_set.tiles)

                steps.append(
                    f"Add {format_tiles(added_tiles)} to board set #{old_index}: "
                    f"{format_tiles(old_set.tiles)} -> {format_tiles(new_set.tiles)}"
                )

                used_old_sets.add(old_index)
                used_new_sets.add(new_index)
                break

    # 3. New sets built only from rack tiles
    rack_used_tiles = subtract_tiles(rack, remaining_rack)

    for new_index, new_set in enumerate(new_board):
        if new_index in used_new_sets:
            continue

        if is_subset_tiles(new_set.tiles, rack_used_tiles):
            steps.append(
                f"Create a new set from your rack: {format_tiles(new_set.tiles)}"
            )
            used_new_sets.add(new_index)

    # 4. Rebuild / broken sets
    broken_old_sets = [
        index for index in range(len(old_board))
        if index not in used_old_sets
    ]

    rebuilt_new_sets = [
        index for index in range(len(new_board))
        if index not in used_new_sets
    ]

    broken_board_tiles = []
    for index in broken_old_sets:
        broken_board_tiles.extend(old_board[index].tiles)

    if broken_old_sets:
        steps.append("Break/rearrange these board sets:")

        for index in broken_old_sets:
            steps.append(
                f"- Board set #{index}: {format_tiles(old_board[index].tiles)}"
            )

    for index in rebuilt_new_sets:
        new_set = new_board[index]
        new_tiles = new_set.tiles

        can_use_only_rack = is_subset_tiles(new_tiles, rack_used_tiles)
        can_use_only_board = is_subset_tiles(new_tiles, broken_board_tiles)

        if can_use_only_rack:
            steps.append(
                f"Create a new set from your rack: {format_tiles(new_tiles)}"
            )

        elif can_use_only_board:
            board_sources = find_tiles_sources_from_broken_sets(
                required_tiles=new_tiles,
                old_board=old_board,
                broken_old_sets=broken_old_sets,
            )

            steps.append(
                f"Create a new set using tiles from broken board sets: {format_tiles(new_tiles)}"
            )

            for old_set_index, tiles in board_sources.items():
                steps.append(
                    f"- Take {format_tiles(tiles)} from broken board set #{old_set_index}"
                )

            steps.append(
                f"- Build new set: {format_tiles(new_tiles)}"
            )

        else:
            rack_part, remaining_needed = take_available_tiles(new_tiles, rack_used_tiles)

            board_sources = find_tiles_sources_from_broken_sets(
                required_tiles=remaining_needed,
                old_board=old_board,
                broken_old_sets=broken_old_sets,
            )

            steps.append(
                f"Create a new mixed set: {format_tiles(new_tiles)}"
            )

            if rack_part:
                steps.append(
                    f"- Take from your rack: {format_tiles(rack_part)}"
                )

            for old_set_index, tiles in board_sources.items():
                steps.append(
                    f"- Take {format_tiles(tiles)} from broken board set #{old_set_index}"
                )

            steps.append(
                f"- Build new set: {format_tiles(new_tiles)}"
            )

    # 5. Joker explanation
    if joker_assignments:
        steps.append("Joker usage:")

        for assignment in joker_assignments:
            value = assignment.get("value")
            color = assignment.get("color")
            usage_type = assignment.get("type")

            steps.append(
                f"- Use a joker as {value} {color} in a {usage_type}"
            )

    # 6. Remaining rack
    if remaining_rack:
        steps.append(
            f"Tiles left in your rack: {format_tiles(remaining_rack)}"
        )
    else:
        steps.append("No tiles remain in your rack.")

    return steps


def find_tiles_sources_from_broken_sets(
    required_tiles: List[Tile],
    old_board,
    broken_old_sets: List[int],
) -> Dict[int, List[Tile]]:
    """
    Try to explain which broken board set provides each required tile.

    This is multiset-based, not exact physical tile tracking.
    If duplicate tiles exist, any valid explanation is acceptable.
    """
    remaining_required = required_tiles.copy()
    sources: Dict[int, List[Tile]] = {}

    for old_set_index in broken_old_sets:
        available_tiles = old_board[old_set_index].tiles.copy()
        taken_from_this_set = []

        still_required = []

        for required_tile in remaining_required:
            match_index = find_matching_tile_index(required_tile, available_tiles)

            if match_index is not None:
                taken_tile = available_tiles.pop(match_index)
                taken_from_this_set.append(taken_tile)
            else:
                still_required.append(required_tile)

        if taken_from_this_set:
            sources[old_set_index] = taken_from_this_set

        remaining_required = still_required

        if not remaining_required:
            break

    return sources


def take_available_tiles(
    required_tiles: List[Tile],
    available_tiles: List[Tile],
) -> Tuple[List[Tile], List[Tile]]:
    """
    Split required_tiles into:
    - tiles that can be explained as coming from available_tiles
    - tiles still needed from somewhere else
    """
    remaining_available = available_tiles.copy()
    taken = []
    still_needed = []

    for required_tile in required_tiles:
        match_index = find_matching_tile_index(required_tile, remaining_available)

        if match_index is not None:
            taken.append(required_tile)
            remaining_available.pop(match_index)
        else:
            still_needed.append(required_tile)

    return taken, still_needed


def find_matching_tile_index(required_tile: Tile, available_tiles: List[Tile]) -> int | None:
    for index, available_tile in enumerate(available_tiles):
        if is_tile_match_available(required_tile, available_tile):
            return index

    return None


def tile_key(tile: Tile) -> tuple:
    """
    Key for comparing tiles.
    For joker output, we include the represented value/color because ILP returns it that way.
    """
    return (
        tile.value,
        tile.color.value if tile.color else None,
        tile.is_joker,
    )


def tile_counter(tiles: List[Tile]) -> Counter:
    return Counter(tile_key(tile) for tile in tiles)


def same_tile_multiset(a: List[Tile], b: List[Tile]) -> bool:
    return tile_counter(a) == tile_counter(b)


def is_subset_tiles(small: List[Tile], big: List[Tile]) -> bool:
    """
    Checks whether all tiles in 'small' can be provided by tiles in 'big'.

    Special case:
    - joker as 11 blue can be matched by a plain joker from rack.
    """
    remaining_big = big.copy()

    for required_tile in small:
        found_index = find_matching_tile_index(required_tile, remaining_big)

        if found_index is None:
            return False

        remaining_big.pop(found_index)

    return True


def subtract_tiles(base: List[Tile], to_remove: List[Tile]) -> List[Tile]:
    """
    Return tiles in base after removing tiles in to_remove.

    Supports joker matching:
    - plain joker can match joker as X.
    """
    remaining_remove = to_remove.copy()
    result = []

    for base_tile in base:
        found_index = find_matching_tile_index(base_tile, remaining_remove)

        if found_index is not None:
            remaining_remove.pop(found_index)
        else:
            result.append(base_tile)

    return result


def format_tile(tile: Tile) -> str:
    if tile.is_joker:
        if tile.value is not None and tile.color is not None:
            return f"joker as {tile.value} {tile.color.value}"
        return "joker"

    return f"{tile.value} {tile.color.value}"


def format_tiles(tiles: List[Tile]) -> str:
    return ", ".join(format_tile(tile) for tile in tiles)


def is_tile_match_available(required_tile: Tile, available_tile: Tile) -> bool:
    """
    Checks if available_tile can satisfy required_tile.
    A plain joker can satisfy any joker-as-value tile.
    """
    if available_tile.is_joker:
        return required_tile.is_joker

    return tile_key(required_tile) == tile_key(available_tile)

def build_structured_steps(game_state: GameState, solver_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    old_board = game_state.board
    rack = game_state.rack
    new_board = solver_result.get("new_board", [])
    remaining_rack = solver_result.get("remaining_rack", [])

    structured_steps = []

    used_old_sets = set()
    used_new_sets = set()

    rack_used_tiles = subtract_tiles(rack, remaining_rack)
    rack_available = rack_used_tiles.copy()
    board_available_by_set = {
        index: old_board[index].tiles.copy()
        for index in range(len(old_board))
    }
    # 1. Keep unchanged sets
    # לא צריך להציג בסימולציה כצעד פעיל, אבל כן צריך לסמן אותם כמשומשים
    for old_index, old_set in enumerate(old_board):
        for new_index, new_set in enumerate(new_board):
            if new_index in used_new_sets:
                continue

            if same_tile_multiset(old_set.tiles, new_set.tiles):
                structured_steps.append({
                    "type": "keep_set",
                    "description": (
                        f"Keep board set #{old_index} unchanged: "
                        f"{format_tiles(new_set.tiles)}"
                    ),
                    "target_board_set_index": old_index,
                    "take_from_rack": [],
                    "take_from_board": [
                        {
                            "set_index": old_index,
                            "tiles": [tile_to_dict(tile) for tile in old_set.tiles],
                        }
                    ],
                    "result_set": {
                        "tiles": [tile_to_dict(tile) for tile in new_set.tiles]
                    }
                })

                used_old_sets.add(old_index)
                used_new_sets.add(new_index)
                break

    # 2. Extended existing board sets
    for old_index, old_set in enumerate(old_board):
        if old_index in used_old_sets:
            continue

        for new_index, new_set in enumerate(new_board):
            if new_index in used_new_sets:
                continue

            if is_subset_tiles(old_set.tiles, new_set.tiles):
                added_tiles = subtract_tiles(new_set.tiles, old_set.tiles)

                rack_part, remaining_needed = take_available_tiles(
                    added_tiles,
                    rack_used_tiles
                )

                board_sources = find_tiles_sources_from_broken_sets(
                    required_tiles=remaining_needed,
                    old_board=old_board,
                    broken_old_sets=[
                        i for i in range(len(old_board))
                        if i != old_index and i not in used_old_sets
                    ],
                )

                structured_steps.append({
                    "type": "extend_set",
                    "description": (
                        f"Add {format_tiles(added_tiles)} to board set #{old_index}: "
                        f"{format_tiles(old_set.tiles)} -> {format_tiles(new_set.tiles)}"
                    ),
                    "target_board_set_index": old_index,
                    "take_from_rack": [tile_to_dict(tile) for tile in rack_part],
                    "take_from_board": (
                        [
                            {
                                "set_index": old_index,
                                "tiles": [tile_to_dict(tile) for tile in old_set.tiles],
                            }
                        ]
                        +
                        [
                            {
                                "set_index": source_index,
                                "tiles": [tile_to_dict(tile) for tile in tiles],
                            }
                            for source_index, tiles in board_sources.items()
                        ]
                    ),
                    "result_set": {
                        "tiles": [tile_to_dict(tile) for tile in new_set.tiles]
                    }
                })

                used_old_sets.add(old_index)
                used_new_sets.add(new_index)
                break

    # 3. New sets built only from rack
    for new_index, new_set in enumerate(new_board):
        if new_index in used_new_sets:
            continue

        if is_subset_tiles(new_set.tiles, rack_used_tiles):
            structured_steps.append({
                "type": "create_from_rack",
                "description": f"Create a new set from your rack: {format_tiles(new_set.tiles)}",
                "take_from_rack": [tile_to_dict(tile) for tile in new_set.tiles],
                "take_from_board": [],
                "result_set": {
                    "tiles": [tile_to_dict(tile) for tile in new_set.tiles]
                }
            })

            used_new_sets.add(new_index)

    # 4. Rebuild / mixed sets
    broken_old_sets = [
        index for index in range(len(old_board))
        if index not in used_old_sets
    ]

    rebuilt_new_sets = [
        index for index in range(len(new_board))
        if index not in used_new_sets
    ]

    for new_index in rebuilt_new_sets:
        new_set = new_board[new_index]
        new_tiles = new_set.tiles

        remaining_needed = new_tiles.copy()
        board_sources = {}

        # First consume available tiles from broken board sets
        for old_set_index in broken_old_sets:
            available_tiles = board_available_by_set[old_set_index]

            taken_from_this_set = []
            still_needed = []

            for needed_tile in remaining_needed:
                match_index = find_matching_tile_index(needed_tile, available_tiles)

                if match_index is not None:
                    taken_from_this_set.append(available_tiles.pop(match_index))
                else:
                    still_needed.append(needed_tile)

            if taken_from_this_set:
                board_sources[old_set_index] = taken_from_this_set

            remaining_needed = still_needed

            if not remaining_needed:
                break

        # Then consume missing tiles from rack
        rack_part = consume_tiles(rack_available, remaining_needed)

        structured_steps.append({
            "type": "rebuild_set",
            "description": f"Create a new set: {format_tiles(new_tiles)}",
            "take_from_rack": [tile_to_dict(tile) for tile in rack_part],
            "take_from_board": [
                {
                    "set_index": source_index,
                    "tiles": [tile_to_dict(tile) for tile in tiles],
                }
                for source_index, tiles in board_sources.items()
            ],
            "result_set": {
                "tiles": [tile_to_dict(tile) for tile in new_tiles]
            }
        })

    return structured_steps


def tile_to_dict(tile: Tile) -> Dict[str, Any]:
    return {
        "value": tile.value,
        "color": tile.color.value if tile.color else None,
        "is_joker": tile.is_joker,
    }

def consume_tiles(source_tiles: List[Tile], tiles_to_consume: List[Tile]) -> List[Tile]:
    """
    Remove consumed tiles from source_tiles and return the actual consumed tiles.
    This prevents the same tile from being explained as used twice.
    """
    consumed = []

    for needed_tile in tiles_to_consume:
        match_index = find_matching_tile_index(needed_tile, source_tiles)

        if match_index is not None:
            consumed.append(source_tiles.pop(match_index))

    return consumed