from typing import List, Tuple
from backend.vision.models import Tile, TileSet, GameState, InvalidSetInfo


def validate_set(tiles: List[Tile]) -> Tuple[bool, str]:
    """
    A legal set must contain at least 3 tiles and be either:
    - Group: same value, different colors
    - Run: consecutive values, same color
    Jokers may substitute missing tiles.
    """
    if len(tiles) < 3:
        return False, "A set must contain at least 3 tiles"

    jokers = [t for t in tiles if t.is_joker]
    normals = [t for t in tiles if not t.is_joker]

    if not normals:
        return True, "Valid all-joker set"

    is_group_valid, group_reason = is_group(normals, len(jokers))
    if is_group_valid:
        return True, "Valid group"

    is_run_valid, run_reason = is_run(normals, len(jokers))
    if is_run_valid:
        return True, "Valid run"

    return (
        False,
        f"Illegal set: not a valid group ({group_reason}) and not a valid run ({run_reason})"
    )


def is_group(normals: List[Tile], num_jokers: int) -> Tuple[bool, str]:
    total_tiles = len(normals) + num_jokers

    if total_tiles < 3:
        return False, "A group must contain at least 3 tiles"

    if total_tiles > 4:
        return False, "A group cannot contain more than 4 tiles"

    first_value = normals[0].value
    if not all(t.value == first_value for t in normals):
        return False, "All non-joker tiles in a group must have the same value"

    colors = [t.color for t in normals]
    if len(set(colors)) != len(colors):
        return False, "A group cannot contain duplicate colors"

    return True, "Valid group"


def is_run(normals: List[Tile], num_jokers: int) -> Tuple[bool, str]:
    total_tiles = len(normals) + num_jokers

    if total_tiles < 3:
        return False, "A run must contain at least 3 tiles"

    run_color = normals[0].color
    if not all(t.color == run_color for t in normals):
        return False, "All non-joker tiles in a run must have the same color"

    values = sorted(t.value for t in normals)

    if len(set(values)) != len(values):
        return False, "A run cannot contain duplicate values"

    min_val = values[0]
    max_val = values[-1]

    if min_val < 1 or max_val > 13:
        return False, "Run values must stay within 1 to 13"

    total_slots_in_range = max_val - min_val + 1
    missing_tiles_in_range = total_slots_in_range - len(normals)

    if missing_tiles_in_range > num_jokers:
        return False, "Not enough jokers to complete the gaps in the run"

    extra_jokers = num_jokers - missing_tiles_in_range

    available_left = min_val - 1
    available_right = 13 - max_val

    if extra_jokers > (available_left + available_right):
        return False, "Too many jokers to extend the run within 1 to 13"

    return True, "Valid run"


def validate_board(board: List[TileSet]) -> Tuple[bool, List[InvalidSetInfo]]:
    """
    Validate all sets currently on the board.
    Returns:
    - overall validity
    - list of invalid sets with index and reason
    """
    invalid_sets: List[InvalidSetInfo] = []

    for index, tile_set in enumerate(board):
        is_valid, reason = validate_set(tile_set.tiles)
        if not is_valid:
            invalid_sets.append(
                InvalidSetInfo(
                    index=index,
                    reason=reason
                )
            )

    return len(invalid_sets) == 0, invalid_sets


def validate_game_state(game_state: GameState) -> Tuple[bool, List[InvalidSetInfo]]:
    """
    For now, a valid game state means:
    - every set on the board is valid

    Later this function can be extended to check:
    - rack constraints
    - opening move
    - move legality
    """
    return validate_board(game_state.board)
