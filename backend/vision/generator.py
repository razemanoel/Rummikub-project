from itertools import combinations
from typing import List, Set, Tuple

from backend.vision.models import Tile, TileSet, GameState, GeneratedMove, MoveAction
from backend.vision.logic import validate_set


def generate_possible_moves(game_state: GameState) -> List[GeneratedMove]:
    moves = []

    moves.extend(generate_new_sets_from_rack(game_state))
    moves.extend(generate_multiple_new_sets_from_rack(game_state))
    moves.extend(generate_add_to_existing_sets(game_state.rack, game_state.board))
    moves.extend(generate_multi_add_to_existing_sets(game_state.rack, game_state.board))
    moves.extend(generate_combined_add_and_create_sets(game_state))

    return deduplicate_moves(moves)


def generate_new_sets_from_rack(game_state: GameState) -> List[GeneratedMove]:
    rack = game_state.rack
    board = game_state.board
    moves = []

    for size in range(3, len(rack) + 1):
        for combo in combinations(rack, size):
            tiles = list(combo)
            is_valid, _ = validate_set(tiles)

            if is_valid:
                new_board = board + [TileSet(tiles=sort_tiles_in_set(tiles))]

                moves.append(
                    GeneratedMove(
                        move_type="create_new_set",
                        tiles_used_count=len(tiles),
                        tiles_used=tiles,
                        actions=[
                            MoveAction(
                                type="create_new_set",
                                description=f"Create new set from rack: {format_tiles(tiles)}",
                                source="rack",
                                target_set_index=None,
                                tiles=tiles,
                            )
                        ],
                        remaining_rack=remove_tiles_from_rack(rack, tiles),
                        new_board=new_board,
                    )
                )

    return moves


def generate_multiple_new_sets_from_rack(game_state: GameState) -> List[GeneratedMove]:
    rack = game_state.rack
    board = game_state.board
    valid_sets = find_valid_sets_from_rack(rack)
    moves = []

    def backtrack(
        start_index: int,
        used_indices: Set[int],
        selected_sets: List[Tuple[Set[int], List[Tile]]],
    ):
        if len(selected_sets) >= 2:
            tiles_used = []
            actions = []
            new_board = board.copy()

            for _, tiles in selected_sets:
                sorted_tiles = sort_tiles_in_set(tiles)
                tiles_used.extend(tiles)
                new_board.append(TileSet(tiles=sorted_tiles))

                actions.append(
                    MoveAction(
                        type="create_new_set",
                        description=f"Create new set from rack: {format_tiles(sorted_tiles)}",
                        source="rack",
                        target_set_index=None,
                        tiles=sorted_tiles,
                    )
                )

            moves.append(
                GeneratedMove(
                    move_type="create_multiple_new_sets",
                    tiles_used_count=len(tiles_used),
                    tiles_used=tiles_used,
                    actions=actions,
                    remaining_rack=remaining_rack_after_using_indices(rack, used_indices),
                    new_board=new_board,
                )
            )

        for i in range(start_index, len(valid_sets)):
            indices, tiles = valid_sets[i]

            if used_indices.isdisjoint(indices):
                backtrack(
                    i + 1,
                    used_indices | indices,
                    selected_sets + [(indices, tiles)],
                )

    backtrack(0, set(), [])
    return moves


def generate_add_to_existing_sets(
    rack: List[Tile],
    board: List[TileSet],
) -> List[GeneratedMove]:
    moves = []

    for tile in rack:
        for set_index, board_set in enumerate(board):
            new_tiles = board_set.tiles + [tile]
            is_valid, _ = validate_set(new_tiles)

            if is_valid:
                sorted_new_tiles = sort_tiles_in_set(new_tiles)

                new_board = board.copy()
                new_board[set_index] = TileSet(tiles=sorted_new_tiles)

                moves.append(
                    GeneratedMove(
                        move_type="add_tile_to_existing_set",
                        tiles_used_count=1,
                        tiles_used=[tile],
                        actions=[
                            MoveAction(
                                type="add_tile_to_existing_set",
                                description=f"Add {format_tile(tile)} to board set #{set_index}",
                                source="rack",
                                target_set_index=set_index,
                                tiles=[tile],
                            )
                        ],
                        remaining_rack=remove_tiles_from_rack(rack, [tile]),
                        new_board=new_board,
                    )
                )

    return moves


def generate_multi_add_to_existing_sets(
    rack: List[Tile],
    board: List[TileSet],
) -> List[GeneratedMove]:
    moves = []

    for set_index, board_set in enumerate(board):
        for size in range(2, len(rack) + 1):
            for combo in combinations(rack, size):
                tiles_to_add = list(combo)
                new_set_tiles = board_set.tiles + tiles_to_add
                is_valid, _ = validate_set(new_set_tiles)

                if not is_valid:
                    continue

                sorted_new_set_tiles = sort_tiles_in_set(new_set_tiles)

                new_board = board.copy()
                new_board[set_index] = TileSet(tiles=sorted_new_set_tiles)

                moves.append(
                    GeneratedMove(
                        move_type="add_multiple_tiles_to_existing_set",
                        tiles_used_count=len(tiles_to_add),
                        tiles_used=tiles_to_add,
                        actions=[
                            MoveAction(
                                type="add_multiple_tiles_to_existing_set",
                                description=(
                                    f"Add {format_tiles(tiles_to_add)} "
                                    f"to board set #{set_index}"
                                ),
                                source="rack",
                                target_set_index=set_index,
                                tiles=tiles_to_add,
                            )
                        ],
                        remaining_rack=remove_tiles_from_rack(rack, tiles_to_add),
                        new_board=new_board,
                    )
                )

    return moves


def generate_combined_add_and_create_sets(game_state: GameState) -> List[GeneratedMove]:
    """
    Generate combined moves:
    - first add one or more rack tiles to an existing board set
    - then create one or more new sets from the remaining rack tiles
    """
    moves = []

    add_moves = []
    add_moves.extend(generate_add_to_existing_sets(game_state.rack, game_state.board))
    add_moves.extend(generate_multi_add_to_existing_sets(game_state.rack, game_state.board))

    for add_move in add_moves:
        remaining_rack = add_move.remaining_rack
        valid_sets = find_valid_sets_from_rack(remaining_rack)

        def backtrack(
            start_index: int,
            used_indices: Set[int],
            selected_sets: List[Tuple[Set[int], List[Tile]]],
        ):
            if selected_sets:
                tiles_used = list(add_move.tiles_used)
                actions = list(add_move.actions)
                new_board = list(add_move.new_board)

                for _, tiles in selected_sets:
                    sorted_tiles = sort_tiles_in_set(tiles)
                    tiles_used.extend(tiles)
                    new_board.append(TileSet(tiles=sorted_tiles))

                    actions.append(
                        MoveAction(
                            type="create_new_set",
                            description=f"Create new set from rack: {format_tiles(sorted_tiles)}",
                            source="rack",
                            target_set_index=None,
                            tiles=sorted_tiles,
                        )
                    )

                moves.append(
                    GeneratedMove(
                        move_type="combined_add_and_create_sets",
                        tiles_used_count=len(tiles_used),
                        tiles_used=tiles_used,
                        actions=actions,
                        remaining_rack=remaining_rack_after_using_indices(
                            remaining_rack,
                            used_indices,
                        ),
                        new_board=new_board,
                    )
                )

            for i in range(start_index, len(valid_sets)):
                indices, tiles = valid_sets[i]

                if used_indices.isdisjoint(indices):
                    backtrack(
                        i + 1,
                        used_indices | indices,
                        selected_sets + [(indices, tiles)],
                    )

        backtrack(0, set(), [])

    return moves


def find_valid_sets_from_rack(rack: List[Tile]) -> List[Tuple[Set[int], List[Tile]]]:
    valid_sets = []

    for size in range(3, len(rack) + 1):
        for index_combo in combinations(range(len(rack)), size):
            tiles = [rack[i] for i in index_combo]
            is_valid, _ = validate_set(tiles)

            if is_valid:
                valid_sets.append((set(index_combo), tiles))

    return valid_sets


def remove_tiles_from_rack(rack: List[Tile], tiles_to_remove: List[Tile]) -> List[Tile]:
    remaining = rack.copy()

    for tile in tiles_to_remove:
        for index, rack_tile in enumerate(remaining):
            if rack_tile == tile:
                remaining.pop(index)
                break

    return remaining


def remaining_rack_after_using_indices(rack: List[Tile], used_indices: Set[int]) -> List[Tile]:
    return [tile for index, tile in enumerate(rack) if index not in used_indices]


def sort_tiles_in_set(tiles: List[Tile]) -> List[Tile]:
    non_jokers = [tile for tile in tiles if not tile.is_joker]
    jokers = [tile for tile in tiles if tile.is_joker]

    if not non_jokers:
        return tiles

    same_color = all(tile.color == non_jokers[0].color for tile in non_jokers)
    same_value = all(tile.value == non_jokers[0].value for tile in non_jokers)

    if same_color:
        return sorted(non_jokers, key=lambda tile: tile.value) + jokers

    if same_value:
        return sorted(non_jokers, key=lambda tile: tile.color.value) + jokers

    return tiles


def format_tile(tile: Tile) -> str:
    if tile.is_joker:
        return "joker"

    return f"{tile.value} {tile.color.value}"


def format_tiles(tiles: List[Tile]) -> str:
    return ", ".join(format_tile(tile) for tile in tiles)


def deduplicate_moves(moves: List[GeneratedMove]) -> List[GeneratedMove]:
    seen = set()
    unique_moves = []

    for move in moves:
        key = move.model_dump_json()

        if key not in seen:
            seen.add(key)
            unique_moves.append(move)

    return sorted(unique_moves, key=lambda move: move.tiles_used_count, reverse=True)