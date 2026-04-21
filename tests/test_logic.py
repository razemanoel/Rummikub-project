from backend.logic import validate_set, validate_board, validate_game_state
from backend.models import Tile, TileColor, TileSet, GameState


def test_valid_group():
    tiles = [
        Tile(value=8, color=TileColor.red),
        Tile(value=8, color=TileColor.blue),
        Tile(value=8, color=TileColor.black),
    ]
    is_valid, _ = validate_set(tiles)
    assert is_valid


def test_invalid_group_duplicate_color():
    tiles = [
        Tile(value=8, color=TileColor.red),
        Tile(value=8, color=TileColor.red),
        Tile(value=8, color=TileColor.black),
    ]
    is_valid, _ = validate_set(tiles)
    assert not is_valid


def test_valid_run():
    tiles = [
        Tile(value=3, color=TileColor.red),
        Tile(value=4, color=TileColor.red),
        Tile(value=5, color=TileColor.red),
    ]
    is_valid, _ = validate_set(tiles)
    assert is_valid


def test_invalid_run_different_colors():
    tiles = [
        Tile(value=3, color=TileColor.red),
        Tile(value=4, color=TileColor.blue),
        Tile(value=5, color=TileColor.red),
    ]
    is_valid, _ = validate_set(tiles)
    assert not is_valid


def test_valid_run_with_joker():
    tiles = [
        Tile(value=3, color=TileColor.red),
        Tile(is_joker=True),
        Tile(value=5, color=TileColor.red),
    ]
    is_valid, _ = validate_set(tiles)
    assert is_valid


def test_invalid_set_too_short():
    tiles = [
        Tile(value=3, color=TileColor.red),
        Tile(value=4, color=TileColor.red),
    ]
    is_valid, _ = validate_set(tiles)
    assert not is_valid


def test_invalid_run_duplicate_values():
    tiles = [
        Tile(value=7, color=TileColor.blue),
        Tile(value=7, color=TileColor.blue),
        Tile(value=8, color=TileColor.blue),
    ]
    is_valid, _ = validate_set(tiles)
    assert not is_valid


def test_validate_board_all_valid():
    board = [
        TileSet(
            tiles=[
                Tile(value=3, color=TileColor.red),
                Tile(value=4, color=TileColor.red),
                Tile(value=5, color=TileColor.red),
            ]
        ),
        TileSet(
            tiles=[
                Tile(value=8, color=TileColor.red),
                Tile(value=8, color=TileColor.blue),
                Tile(value=8, color=TileColor.black),
            ]
        ),
    ]

    is_valid, invalid_sets = validate_board(board)

    assert is_valid
    assert invalid_sets == []


def test_validate_board_with_invalid_set():
    board = [
        TileSet(
            tiles=[
                Tile(value=3, color=TileColor.red),
                Tile(value=4, color=TileColor.red),
                Tile(value=5, color=TileColor.red),
            ]
        ),
        TileSet(
            tiles=[
                Tile(value=8, color=TileColor.red),
                Tile(value=8, color=TileColor.red),
                Tile(value=8, color=TileColor.black),
            ]
        ),
    ]

    is_valid, invalid_sets = validate_board(board)

    assert not is_valid
    assert len(invalid_sets) == 1
    assert invalid_sets[0].index == 1


def test_validate_game_state_valid():
    game_state = GameState(
        rack=[
            Tile(value=1, color=TileColor.red),
            Tile(value=9, color=TileColor.blue),
        ],
        board=[
            TileSet(
                tiles=[
                    Tile(value=10, color=TileColor.yellow),
                    Tile(value=11, color=TileColor.yellow),
                    Tile(value=12, color=TileColor.yellow),
                ]
            )
        ]
    )

    is_valid, invalid_sets = validate_game_state(game_state)

    assert is_valid
    assert invalid_sets == []


def test_validate_game_state_invalid_board():
    game_state = GameState(
        rack=[
            Tile(value=1, color=TileColor.red),
        ],
        board=[
            TileSet(
                tiles=[
                    Tile(value=6, color=TileColor.black),
                    Tile(value=6, color=TileColor.black),
                    Tile(value=6, color=TileColor.red),
                ]
            )
        ]
    )

    is_valid, invalid_sets = validate_game_state(game_state)

    assert not is_valid
    assert len(invalid_sets) == 1
    assert invalid_sets[0].index == 0