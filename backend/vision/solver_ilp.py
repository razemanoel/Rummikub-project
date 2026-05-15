from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional
from itertools import combinations
import time

import pulp
from backend.vision.explainer import explain_solution, build_structured_steps
from backend.vision.models import Tile, TileSet, GameState


ALL_COLORS = ["red", "blue", "yellow", "black"]
MAX_JOKERS_IN_GAME = 2


@dataclass
class TileInstance:
    id: str
    tile: Tile
    source: str  # "board" or "rack"


@dataclass
class CandidateSet:
    id: str
    tile_ids: List[str]
    tiles: List[Tile]
    joker_count: int = 0
    joker_assignments: List[Dict] = field(default_factory=list)


def solve_max_rack_tiles_ilp(game_state: GameState):
    start_time = time.time()

    board_joker_count = count_jokers_in_board(game_state)
    rack_joker_count = count_jokers_in_rack(game_state)
    total_jokers_available = board_joker_count + rack_joker_count

    if total_jokers_available > MAX_JOKERS_IN_GAME:
        return {
            "status": "error",
            "message": "Invalid input: Rummikub has at most 2 jokers",
            "solver_status": "Invalid input",
            "candidate_count": 0,
            "solve_time_seconds": round(time.time() - start_time, 4),
            "tiles_used_count": 0,
            "remaining_rack": game_state.rack,
            "new_board": game_state.board,
        }

    tile_instances = build_real_tile_instances(game_state)
    candidate_sets = generate_candidate_sets(tile_instances, total_jokers_available)

    if not candidate_sets:
        return {
            "status": "error",
            "message": "No legal candidate sets found",
            "solver_status": "No candidates",
            "candidate_count": 0,
            "solve_time_seconds": round(time.time() - start_time, 4),
            "tiles_used_count": 0,
            "remaining_rack": game_state.rack,
            "new_board": game_state.board,
        }

    problem = pulp.LpProblem("Rummikub_Max_Rack_Tiles", pulp.LpMaximize)

    x = {
        candidate.id: pulp.LpVariable(candidate.id, cat="Binary")
        for candidate in candidate_sets
    }

    tile_by_id = {tile.id: tile for tile in tile_instances}

    # Every real board tile must appear exactly once.
    # Every real rack tile may appear at most once.
    for tile in tile_instances:
        containing_sets = [
            candidate for candidate in candidate_sets
            if tile.id in candidate.tile_ids
        ]

        if tile.source == "board":
            problem += (
                pulp.lpSum(x[candidate.id] for candidate in containing_sets) == 1,
                f"board_tile_{tile.id}_must_be_used_once",
            )
        else:
            problem += (
                pulp.lpSum(x[candidate.id] for candidate in containing_sets) <= 1,
                f"rack_tile_{tile.id}_used_at_most_once",
            )

    total_jokers_used = pulp.lpSum(
        x[candidate.id] * candidate.joker_count
        for candidate in candidate_sets
    )

    # Board jokers must stay on the board.
    # Rack jokers may be used, but total jokers cannot exceed the real amount in the game.
    problem += total_jokers_used >= board_joker_count, "all_board_jokers_must_be_used"
    problem += total_jokers_used <= total_jokers_available, "cannot_use_more_jokers_than_available"

    # Objective:
    # maximize real rack tiles used + jokers used.
    # Board jokers are a constant lower bound, so maximizing total_jokers_used also maximizes rack jokers used.
    problem += pulp.lpSum(
        x[candidate.id] * (
            count_rack_real_tiles(candidate, tile_by_id) + candidate.joker_count
        )
        for candidate in candidate_sets
    )

    problem.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=3))

    solver_status = pulp.LpStatus[problem.status]

    if solver_status != "Optimal":
        return {
            "status": "error",
            "message": f"No optimal solution found: {solver_status}",
            "solver_status": solver_status,
            "candidate_count": len(candidate_sets),
            "solve_time_seconds": round(time.time() - start_time, 4),
            "tiles_used_count": 0,
            "remaining_rack": game_state.rack,
            "new_board": game_state.board,
        }

    chosen_sets = [
        candidate
        for candidate in candidate_sets
        if pulp.value(x[candidate.id]) == 1
    ]

    used_rack_real_tile_ids: Set[str] = set()
    new_board = []
    chosen_joker_assignments = []
    used_joker_count = 0

    for candidate in chosen_sets:
        new_board.append(TileSet(tiles=sort_tiles(candidate.tiles)))
        used_joker_count += candidate.joker_count
        chosen_joker_assignments.extend(candidate.joker_assignments)

        for tile_id in candidate.tile_ids:
            instance = tile_by_id[tile_id]
            if instance.source == "rack":
                used_rack_real_tile_ids.add(tile_id)

    rack_jokers_used = max(0, used_joker_count - board_joker_count)

    remaining_rack = []

    for tile_index, tile in enumerate(game_state.rack):
        if tile.is_joker:
            continue

        tile_id = f"rack_{tile_index}"
        if tile_id not in used_rack_real_tile_ids:
            remaining_rack.append(tile)

    rack_jokers_remaining = rack_joker_count - rack_jokers_used
    for tile in game_state.rack:
        if tile.is_joker and rack_jokers_remaining > 0:
            remaining_rack.append(tile)
            rack_jokers_remaining -= 1

    tiles_used_count = len(used_rack_real_tile_ids) + rack_jokers_used

    result = {
        "status": "success",
        "message": "ILP solved successfully",
        "solver_status": solver_status,
        "candidate_count": len(candidate_sets),
        "solve_time_seconds": round(time.time() - start_time, 4),
        "tiles_used_count": tiles_used_count,
        "remaining_rack": remaining_rack,
        "new_board": new_board,
        "joker_assignments": chosen_joker_assignments,
    }

    result["steps"] = explain_solution(game_state, result)
    result["structured_steps"] = build_structured_steps(game_state, result)

    return result


def count_jokers_in_board(game_state: GameState) -> int:
    return sum(
        1
        for tile_set in game_state.board
        for tile in tile_set.tiles
        if tile.is_joker
    )


def count_jokers_in_rack(game_state: GameState) -> int:
    return sum(1 for tile in game_state.rack if tile.is_joker)


def build_real_tile_instances(game_state: GameState) -> List[TileInstance]:
    instances = []

    for set_index, tile_set in enumerate(game_state.board):
        for tile_index, tile in enumerate(tile_set.tiles):
            if tile.is_joker:
                continue

            instances.append(
                TileInstance(
                    id=f"board_{set_index}_{tile_index}",
                    tile=tile,
                    source="board",
                )
            )

    for tile_index, tile in enumerate(game_state.rack):
        if tile.is_joker:
            continue

        instances.append(
            TileInstance(
                id=f"rack_{tile_index}",
                tile=tile,
                source="rack",
            )
        )

    return instances


def generate_candidate_sets(
    tile_instances: List[TileInstance],
    total_jokers_available: int,
) -> List[CandidateSet]:
    candidates = []
    candidates.extend(generate_group_candidates(tile_instances, total_jokers_available))
    candidates.extend(generate_run_candidates(tile_instances, total_jokers_available))
    return candidates


def generate_group_candidates(
    tile_instances: List[TileInstance],
    total_jokers_available: int,
) -> List[CandidateSet]:
    candidates = []
    counter = 0

    by_value_color: Dict[tuple[int, str], List[TileInstance]] = {}

    for instance in tile_instances:
        key = (instance.tile.value, instance.tile.color.value)
        by_value_color.setdefault(key, []).append(instance)

    for value in range(1, 14):
        for group_size in [3, 4]:
            for target_colors in combinations(ALL_COLORS, group_size):
                options_per_color = []

                for color in target_colors:
                    real_options = by_value_color.get((value, color), [])
                    options = list(real_options)

                    if total_jokers_available > 0:
                        options.append(None)

                    if not options:
                        break

                    options_per_color.append((color, options))

                if len(options_per_color) != group_size:
                    continue

                option_lists = [options for _, options in options_per_color]

                for combo in cartesian_product(option_lists):
                    real_instances = [item for item in combo if item is not None]
                    joker_count = sum(1 for item in combo if item is None)

                    if joker_count > total_jokers_available:
                        continue

                    if joker_count == 0 and len(real_instances) != group_size:
                        continue

                    if not has_unique_tile_ids(real_instances):
                        continue

                    tiles = []
                    tile_ids = []
                    joker_assignments = []

                    for index, selected in enumerate(combo):
                        color = target_colors[index]

                        if selected is None:
                            joker_tile = Tile(
                                value=value,
                                color=color,
                                is_joker=True,
                            )
                            tiles.append(joker_tile)
                            joker_assignments.append(
                                {
                                    "value": value,
                                    "color": color,
                                    "type": "group",
                                }
                            )
                        else:
                            tiles.append(selected.tile)
                            tile_ids.append(selected.id)

                    candidates.append(
                        CandidateSet(
                            id=f"group_{counter}",
                            tile_ids=tile_ids,
                            tiles=tiles,
                            joker_count=joker_count,
                            joker_assignments=joker_assignments,
                        )
                    )
                    counter += 1

    return candidates


def generate_run_candidates(
    tile_instances: List[TileInstance],
    total_jokers_available: int,
) -> List[CandidateSet]:
    candidates = []
    counter = 0

    by_color_value: Dict[tuple[str, int], List[TileInstance]] = {}

    for instance in tile_instances:
        key = (instance.tile.color.value, instance.tile.value)
        by_color_value.setdefault(key, []).append(instance)

    for color in ALL_COLORS:
        for start in range(1, 14):
            for end in range(start + 2, 14):
                run_values = list(range(start, end + 1))
                options_per_value = []

                for value in run_values:
                    real_options = by_color_value.get((color, value), [])
                    options = list(real_options)

                    if total_jokers_available > 0:
                        options.append(None)

                    if not options:
                        break

                    options_per_value.append((value, options))

                if len(options_per_value) != len(run_values):
                    continue

                option_lists = [options for _, options in options_per_value]

                for combo in cartesian_product(option_lists):
                    real_instances = [item for item in combo if item is not None]
                    joker_count = sum(1 for item in combo if item is None)

                    if joker_count > total_jokers_available:
                        continue

                    if not has_unique_tile_ids(real_instances):
                        continue

                    tiles = []
                    tile_ids = []
                    joker_assignments = []

                    for index, selected in enumerate(combo):
                        value = run_values[index]

                        if selected is None:
                            joker_tile = Tile(
                                value=value,
                                color=color,
                                is_joker=True,
                            )
                            tiles.append(joker_tile)
                            joker_assignments.append(
                                {
                                    "value": value,
                                    "color": color,
                                    "type": "run",
                                }
                            )
                        else:
                            tiles.append(selected.tile)
                            tile_ids.append(selected.id)

                    candidates.append(
                        CandidateSet(
                            id=f"run_{counter}",
                            tile_ids=tile_ids,
                            tiles=tiles,
                            joker_count=joker_count,
                            joker_assignments=joker_assignments,
                        )
                    )
                    counter += 1

    return candidates


def has_unique_tile_ids(instances: List[TileInstance]) -> bool:
    ids = [instance.id for instance in instances]
    return len(ids) == len(set(ids))


def cartesian_product(lists):
    if not lists:
        return [[]]

    result = [[]]

    for current_list in lists:
        new_result = []

        for prefix in result:
            for item in current_list:
                new_result.append(prefix + [item])

        result = new_result

    return result


def count_rack_real_tiles(
    candidate: CandidateSet,
    tile_by_id: Dict[str, TileInstance],
) -> int:
    return sum(
        1
        for tile_id in candidate.tile_ids
        if tile_by_id[tile_id].source == "rack"
    )


def sort_tiles(tiles: List[Tile]) -> List[Tile]:
    if not tiles:
        return tiles

    same_color = all(tile.color == tiles[0].color for tile in tiles)
    same_value = all(tile.value == tiles[0].value for tile in tiles)

    if same_color:
        return sorted(tiles, key=lambda tile: tile.value)

    if same_value:
        return sorted(tiles, key=lambda tile: tile.color.value)

    return tiles