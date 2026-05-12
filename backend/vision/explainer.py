from collections import Counter
from typing import List, Dict, Any

from backend.vision.models import Tile, TileSet, GameState


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
    for old_index, old_set in enumerate(old_board):
        for new_index, new_set in enumerate(new_board):
            if new_index in used_new_sets:
                continue

            if same_tile_multiset(old_set.tiles, new_set.tiles):
                steps.append(
                    f"Keep board set #{old_index} unchanged: {format_tiles(new_set.tiles)}"
                )
                used_old_sets.add(old_index)
                used_new_sets.add(new_index)
                break

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
    original_rack_used = subtract_tiles(rack, remaining_rack)

    for new_index, new_set in enumerate(new_board):
        if new_index in used_new_sets:
            continue

        if is_subset_tiles(new_set.tiles, original_rack_used):
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

    rack_used_tiles = subtract_tiles(rack, remaining_rack)

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
            steps.append(
                f"Create a new set from tiles taken from broken board sets: {format_tiles(new_tiles)}"
            )
        else:
            steps.append(
                f"Create a new mixed set using rack tiles and tiles from broken board sets: {format_tiles(new_tiles)}"
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
        found_index = None

        for index, available_tile in enumerate(remaining_big):
            if is_tile_match_available(required_tile, available_tile):
                found_index = index
                break

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
        found_index = None

        for index, remove_tile in enumerate(remaining_remove):
            if is_tile_match_available(remove_tile, base_tile):
                found_index = index
                break

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