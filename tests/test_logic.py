"""
Unit tests for the pure game logic in backend/logic.

Unlike tests/test_api_integration.py, these need no running stack, no Docker,
no torch and no model weights: only pydantic and pulp. They run in about a
second, so they are safe to run on every push / pull request in CI.

Run from the project root:
    pip install pydantic pulp pytest
    pytest tests/test_logic.py -v
"""

import pytest

from backend.logic.logic import validate_set, validate_game_state
from backend.logic.models import GameState, Tile, TileSet
from backend.logic.solver_ilp import solve_max_rack_tiles_ilp


# ---------- helpers ----------

def t(value, color):
    """Shorthand for a normal tile, e.g. t(5, "red")."""
    return Tile(value=value, color=color)


def joker():
    return Tile(is_joker=True)


# ---------- validate_set: legal sets ----------

def test_valid_run():
    ok, reason = validate_set([t(5, "red"), t(6, "red"), t(7, "red")])
    assert ok, reason
    assert reason == "Valid run"


def test_valid_group():
    ok, reason = validate_set([t(8, "red"), t(8, "blue"), t(8, "black")])
    assert ok, reason
    assert reason == "Valid group"


def test_run_with_joker_filling_a_gap():
    # 5 _ 7 in red: the joker stands in for red 6
    ok, reason = validate_set([t(5, "red"), joker(), t(7, "red")])
    assert ok, reason


def test_run_order_does_not_matter():
    # The detector returns tiles in image order, not sorted order
    ok, _ = validate_set([t(7, "blue"), t(5, "blue"), t(6, "blue")])
    assert ok


# ---------- validate_set: illegal sets ----------

def test_set_with_two_tiles_is_illegal():
    ok, reason = validate_set([t(5, "red"), t(6, "red")])
    assert not ok
    assert "at least 3" in reason


def test_group_with_duplicate_color_is_illegal():
    ok, _ = validate_set([t(8, "red"), t(8, "red"), t(8, "blue")])
    assert not ok


def test_run_with_mixed_colors_is_illegal():
    ok, _ = validate_set([t(5, "red"), t(6, "blue"), t(7, "red")])
    assert not ok


def test_group_of_five_is_illegal():
    # Only 4 colors exist, so a joker cannot make a 5-tile group
    ok, _ = validate_set(
        [t(9, "red"), t(9, "blue"), t(9, "black"), t(9, "yellow"), joker()]
    )
    assert not ok


# ---------- edge cases ----------

def test_run_does_not_wrap_from_13_to_1():
    # Standard Rummikub rules: 1 is never "after" 13
    ok, _ = validate_set([t(12, "yellow"), t(13, "yellow"), t(1, "yellow")])
    assert not ok


def test_jokers_can_extend_a_run_only_inside_1_to_13():
    # 13 + two jokers -> the jokers become 11 and 12: legal
    ok, _ = validate_set([t(13, "red"), joker(), joker()])
    assert ok
    # A full 1..13 run has no free slot, so one more joker is illegal
    full_run = [t(v, "red") for v in range(1, 14)]
    ok, _ = validate_set(full_run + [joker()])
    assert not ok


@pytest.mark.parametrize("bad_value", [0, 14])
def test_tile_value_must_be_between_1_and_13(bad_value):
    with pytest.raises(ValueError):
        Tile(value=bad_value, color="red")


# ---------- game state & solver ----------

def test_three_identical_tiles_in_game_is_invalid():
    # A real Rummikub set has only 2 copies of each tile
    state = GameState(
        rack=[t(5, "red")],
        board=[TileSet(tiles=[t(5, "red"), t(5, "blue"), t(5, "black")]),
               TileSet(tiles=[t(5, "red"), t(6, "red"), t(7, "red")])],
    )
    ok, _ = validate_game_state(state)
    assert not ok


def test_solver_plays_a_run_from_an_empty_board():
    state = GameState(
        rack=[t(5, "red"), t(6, "red"), t(7, "red")],
        board=[],
    )
    result = solve_max_rack_tiles_ilp(state)
    assert result["status"] == "success"
    assert result["tiles_used_count"] == 3
    assert result["remaining_rack"] == []
