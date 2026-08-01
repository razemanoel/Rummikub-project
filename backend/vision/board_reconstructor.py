from typing import Any

import numpy as np

from backend.logic.models import Tile, TileSet, GameState, TileColor
from backend.logic.logic import validate_set, is_group, is_run


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def dict_to_tile(tile_data: dict[str, Any]) -> Tile:
    if tile_data.get("is_joker"):
        return Tile(value=None, color=None, is_joker=True)

    return Tile(
        value=tile_data["value"],
        color=TileColor(tile_data["color"]),
        is_joker=False,
    )


def bbox_center_y(detection: dict[str, Any]) -> float:
    bbox = detection["bbox"]
    return (bbox["y1"] + bbox["y2"]) / 2


def bbox_center_x(detection: dict[str, Any]) -> float:
    bbox = detection["bbox"]
    return (bbox["x1"] + bbox["x2"]) / 2


def bbox_width(detection: dict[str, Any]) -> float:
    bbox = detection["bbox"]
    return bbox["x2"] - bbox["x1"]


def bbox_height(detection: dict[str, Any]) -> float:
    bbox = detection["bbox"]
    return bbox["y2"] - bbox["y1"]


def bbox_gap_distance(
    left: dict[str, Any],
    right: dict[str, Any],
) -> float:
    left_bbox = left["bbox"]
    right_bbox = right["bbox"]

    horizontal_gap = max(
        right_bbox["x1"] - left_bbox["x2"],
        left_bbox["x1"] - right_bbox["x2"],
        0.0,
    )
    vertical_gap = max(
        right_bbox["y1"] - left_bbox["y2"],
        left_bbox["y1"] - right_bbox["y2"],
        0.0,
    )

    return (horizontal_gap ** 2 + vertical_gap ** 2) ** 0.5


# ---------------------------------------------------------------------------
# Row grouping (used for both rack and board)
# ---------------------------------------------------------------------------

def group_detections_into_rows(
    detections: list[dict[str, Any]],
    row_tolerance_ratio: float = 0.6,
) -> list[list[dict[str, Any]]]:
    if not detections:
        return []

    sorted_detections = sorted(detections, key=bbox_center_y)

    heights = [
        detection["bbox"]["y2"] - detection["bbox"]["y1"]
        for detection in sorted_detections
    ]

    average_height = sum(heights) / len(heights)
    row_tolerance = average_height * row_tolerance_ratio

    rows: list[list[dict[str, Any]]] = []

    for detection in sorted_detections:
        detection_y = bbox_center_y(detection)

        placed = False

        for row in rows:
            row_center = sum(bbox_center_y(item) for item in row) / len(row)

            if abs(detection_y - row_center) <= row_tolerance:
                row.append(detection)
                placed = True
                break

        if not placed:
            rows.append([detection])

    for row in rows:
        row.sort(key=bbox_center_x)

    rows.sort(key=lambda row: sum(bbox_center_y(item) for item in row) / len(row))

    return rows


# ---------------------------------------------------------------------------
# Rummikub validation helpers
# ---------------------------------------------------------------------------

def _dets_to_tiles(dets: list[dict[str, Any]]) -> list[Tile]:
    return [dict_to_tile(d["tile"]) for d in dets]


def _validate_group(dets: list[dict[str, Any]]) -> tuple[bool, str]:
    if len(dets) < 2:
        return False, "too few tiles"
    try:
        return validate_set(_dets_to_tiles(dets))
    except Exception as exc:
        return False, str(exc)


def _score(groups: list[list[dict[str, Any]]]) -> tuple[int, int, int, int]:
    """Return (legal, single, illegal, -total) — higher is better for first 3 comparisons."""
    legal = illegal = single = 0
    for g in groups:
        if len(g) == 1:
            single += 1
        elif len(g) == 2:
            illegal += 1
        else:
            ok, _ = _validate_group(g)
            if ok:
                legal += 1
            else:
                illegal += 1
    total = sum(len(g) for g in groups)
    return legal, single, illegal, total


def _is_perfect(groups: list[list[dict[str, Any]]]) -> bool:
    legal, single, illegal, _ = _score(groups)
    return single == 0 and illegal == 0


# ---------------------------------------------------------------------------
# Board set grouping (geometry only, row-aware)
# ---------------------------------------------------------------------------

def _split_row_into_sets(
    row: list[dict[str, Any]],
    gap_ratio: float = 1.2,
) -> list[list[dict[str, Any]]]:
    """
    Split a sorted row of detections into physical sets by x-gap.

    gap_ratio: a gap >= gap_ratio * median_tile_width triggers a set boundary.
    """
    if not row:
        return []
    if len(row) == 1:
        return [row]

    widths = [bbox_width(d) for d in row]
    median_w = float(np.median(widths))
    gap_threshold = median_w * gap_ratio

    sets: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = [row[0]]

    for det in row[1:]:
        gap = det["bbox"]["x1"] - current[-1]["bbox"]["x2"]
        if gap > gap_threshold:
            sets.append(current)
            current = [det]
        else:
            current.append(det)

    sets.append(current)
    return sets


def _group_board_geometric(
    detections: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:
    """
    Adaptive proximity clustering for board tiles.

    For dense boards (>= DENSE_THRESHOLD tiles) we use a stricter row-first
    strategy: tiles are first separated into horizontal rows, each row is then
    split into sets by x-gap, and only after that are vertically-aligned sets
    across rows merged.  This prevents the flood-fill from building a chain
    across physically separate sets that happen to be spatially close.

    For sparse boards (< DENSE_THRESHOLD tiles) the original single-pass
    flood-fill is used unchanged, so existing behaviour is preserved.
    """
    if not detections:
        return []

    # Switch to strict row-first mode when the board is dense.
    DENSE_THRESHOLD = 45

    # ------------------------------------------------------------------ #
    # Compute global median tile dimensions (used by both modes)           #
    # ------------------------------------------------------------------ #
    all_w = [bbox_width(d) for d in detections]
    all_h = [bbox_height(d) for d in detections]
    med_w = float(np.median(all_w))
    med_h = float(np.median(all_h))

    # ------------------------------------------------------------------ #
    # Adjacency helper (shared by sparse mode)                            #
    # ------------------------------------------------------------------ #
    def _adjacent(a: dict[str, Any], b: dict[str, Any], x_ratio: float = 0.5, y_ratio: float = 0.6) -> bool:
        ab, bb = a["bbox"], b["bbox"]
        h_gap = max(bb["x1"] - ab["x2"], ab["x1"] - bb["x2"], 0.0)
        v_gap = max(bb["y1"] - ab["y2"], ab["y1"] - bb["y2"], 0.0)
        avg_w = (abs(ab["x2"] - ab["x1"]) + abs(bb["x2"] - bb["x1"])) / 2.0
        avg_h = (abs(ab["y2"] - ab["y1"]) + abs(bb["y2"] - bb["y1"])) / 2.0

        ay_c = (ab["y1"] + ab["y2"]) / 2.0
        by_c = (bb["y1"] + bb["y2"]) / 2.0
        y_center_dist = abs(ay_c - by_c)

        ax_c = (ab["x1"] + ab["x2"]) / 2.0
        bx_c = (bb["x1"] + bb["x2"]) / 2.0
        x_center_dist = abs(ax_c - bx_c)

        # Horizontal set: side-by-side in same row
        if h_gap <= x_ratio * avg_w and y_center_dist <= 0.4 * avg_h:
            return True

        # Vertical set: stacked in same column
        if v_gap <= y_ratio * avg_h and x_center_dist <= 0.5 * avg_w and y_center_dist <= 1.1 * avg_h:
            return True

        return False

    # ------------------------------------------------------------------ #
    # Flood-fill (used for all board sizes)                               #
    # ------------------------------------------------------------------ #
    # For dense boards use tighter thresholds so nearby-but-separate sets
    # are not chained together through intermediary tiles.
    if len(detections) >= DENSE_THRESHOLD:
        x_ratio = 0.35   # tighter: gap must be < 0.35x tile-width
        y_ratio = 0.45   # tighter: gap must be < 0.45x tile-height
    else:
        x_ratio = 0.5
        y_ratio = 0.6

    remaining = list(detections)
    clusters: list[list[dict[str, Any]]] = []

    while remaining:
        seed = remaining.pop(0)
        cluster = [seed]
        frontier = [seed]

        while frontier:
            current = frontier.pop()
            next_remaining = []
            for candidate in remaining:
                if _adjacent(current, candidate, x_ratio=x_ratio, y_ratio=y_ratio):
                    cluster.append(candidate)
                    frontier.append(candidate)
                else:
                    next_remaining.append(candidate)
            remaining = next_remaining

        cluster.sort(key=lambda d: (bbox_center_y(d), bbox_center_x(d)))
        clusters.append(cluster)

    clusters.sort(key=lambda c: (bbox_center_y(c[0]), bbox_center_x(c[0])))

    # ------------------------------------------------------------------ #
    # DENSE MODE post-pass: split oversized clusters by x-gap             #
    # ------------------------------------------------------------------ #
    # Even with tighter adjacency, long horizontal chains can still form on
    # very dense boards. Any cluster larger than 13 tiles (max legal set)
    # is split at the largest x-gap within each detected row inside it.
    if len(detections) < DENSE_THRESHOLD:
        return clusters

    final: list[list[dict[str, Any]]] = []
    for cluster in clusters:
        if len(cluster) <= 13:
            final.append(cluster)
            continue

        # Split oversized cluster row-by-row at gaps > 1.0 * med_w
        row_tol = med_h * 0.45
        sorted_c = sorted(cluster, key=bbox_center_y)
        rows_c: list[list[dict[str, Any]]] = []
        for det in sorted_c:
            cy = bbox_center_y(det)
            placed = False
            for row in rows_c:
                row_cy = sum(bbox_center_y(r) for r in row) / len(row)
                if abs(cy - row_cy) <= row_tol:
                    row.append(det)
                    placed = True
                    break
            if not placed:
                rows_c.append([det])

        gap_thresh = med_w * 1.0
        sub_sets: list[list[dict[str, Any]]] = []
        for row in rows_c:
            row.sort(key=bbox_center_x)
            cur: list[dict[str, Any]] = [row[0]]
            for det in row[1:]:
                gap = det["bbox"]["x1"] - cur[-1]["bbox"]["x2"]
                if gap > gap_thresh:
                    sub_sets.append(cur)
                    cur = [det]
                else:
                    cur.append(det)
            sub_sets.append(cur)

        # Re-merge vertically-aligned narrow sub-sets (true column sets)
        v_gap_thresh = med_h * 0.6
        v_merged = True
        while v_merged:
            v_merged = False
            for i in range(len(sub_sets)):
                for j in range(i + 1, len(sub_sets)):
                    si, sj = sub_sets[i], sub_sets[j]
                    if len(si) + len(sj) > 13:
                        continue
                    # ensure si is above sj
                    if bbox_center_y(si[0]) > bbox_center_y(sj[0]):
                        si, sj = sj, si
                    bot = max(d["bbox"]["y2"] for d in si)
                    top = min(d["bbox"]["y1"] for d in sj)
                    if top - bot > v_gap_thresh:
                        continue
                    si_cx = sum((d["bbox"]["x1"]+d["bbox"]["x2"])/2 for d in si) / len(si)
                    sj_cx = sum((d["bbox"]["x1"]+d["bbox"]["x2"])/2 for d in sj) / len(sj)
                    if abs(si_cx - sj_cx) > med_w * 0.6:
                        continue
                    si_w = max(d["bbox"]["x2"] for d in si) - min(d["bbox"]["x1"] for d in si)
                    sj_w = max(d["bbox"]["x2"] for d in sj) - min(d["bbox"]["x1"] for d in sj)
                    if si_w > med_w * 1.5 or sj_w > med_w * 1.5:
                        continue
                    combined = si + sj
                    combined.sort(key=lambda d: (bbox_center_y(d), bbox_center_x(d)))
                    sub_sets = [s for k, s in enumerate(sub_sets) if k not in (i, j)]
                    sub_sets.append(combined)
                    v_merged = True
                    break
                if v_merged:
                    break

        for s in sub_sets:
            s.sort(key=lambda d: (bbox_center_y(d), bbox_center_x(d)))
        final.extend(sub_sets)

    final.sort(key=lambda c: (bbox_center_y(c[0]), bbox_center_x(c[0])))
    return final


# ---------------------------------------------------------------------------
# Repair phase
# ---------------------------------------------------------------------------

def _try_merge_neighbors(
    groups: list[list[dict[str, Any]]],
) -> list[list[dict[str, Any]]]:
    """Merge any two groups if the merge produces a legal set.

    Tries all pairs (not just adjacent i, i+1) so that groups separated
    by index after a split can still be reunited.  Prefers merging smaller
    groups first (fewest tiles combined) to avoid over-merging.
    """
    improved = True
    while improved:
        improved = False
        n = len(groups)
        # Iterate pairs ordered by combined size (smallest first)
        pairs = sorted(
            ((i, j) for i in range(n) for j in range(i + 1, n)),
            key=lambda p: len(groups[p[0]]) + len(groups[p[1]]),
        )
        for i, j in pairs:
            merged = groups[i] + groups[j]
            if len(merged) > 13:
                continue
            ok, _ = _validate_group(merged)
            if ok:
                # Only merge if at least one of the two groups was not already legal
                if _validate_group(groups[i])[0] and _validate_group(groups[j])[0]:
                    continue
                remaining = [g for k, g in enumerate(groups) if k != i and k != j]
                groups = remaining[:i] + [merged] + remaining[i:]
                improved = True
                break
    return groups


def _try_split_illegal(
    groups: list[list[dict[str, Any]]],
) -> list[list[dict[str, Any]]]:
    """Split illegal groups, trying contiguous cuts first then non-contiguous partitions.

    Contiguous path: try every linear cut, pick the one yielding most legal pieces.
    Non-contiguous path: for clusters of size <= _NC_SPLIT_MAX_SIZE (13), enumerate
    all subsets via backtracking anchored to the lowest remaining index, maximising
    legal set count.  2^13 = 8192 worst-case iterations, well under 1 ms.
    A DEBUG log line is emitted when the non-contiguous path fires so regressions
    are visible in logs.
    """
    import logging as _logging
    from itertools import combinations as _comb
    _log = _logging.getLogger(__name__)

    _NC_SPLIT_MAX_SIZE = 13

    def _best_contiguous(group):
        """(best_legal_count, [part, part]) from linear cuts, or (0, None)."""
        best_legal = 0
        best_split = None
        for cut in range(1, len(group)):
            left, right = group[:cut], group[cut:]
            n = int(_validate_group(left)[0]) + int(_validate_group(right)[0])
            if n > best_legal:
                best_legal, best_split = n, (left, right)
        return best_legal, best_split

    def _best_noncontiguous(group):
        """Backtracking partition of group into valid sets, maximising legal count.

        Always anchors to the lowest remaining index to avoid duplicate enumerations.
        Tiles that cannot join any legal set are left as singletons (not counted).
        Returns (legal_count, [part, ...]) or (0, None).
        """
        n = len(group)
        best = [0, None]  # [legal_count, partition_as_list_of_lists]

        def backtrack(remaining, cur_parts, cur_legal):
            if not remaining:
                if cur_legal > best[0]:
                    best[0] = cur_legal
                    best[1] = [list(p) for p in cur_parts]
                return
            # Upper-bound prune: remaining tiles can contribute at most
            # len(remaining)//3 more legal sets (minimum set size is 3).
            if cur_legal + len(remaining) // 3 <= best[0]:
                return
            first = remaining[0]
            rest  = remaining[1:]
            # Try all subsets of size >= 3 that include `first`.
            found_legal = False
            for size in range(3, len(remaining) + 1):
                for chosen in _comb(rest, size - 1):
                    idxs   = [first] + list(chosen)
                    subset = [group[i] for i in idxs]
                    if _validate_group(subset)[0]:
                        found_legal = True
                        new_rem = [i for i in remaining if i not in idxs]
                        cur_parts.append(subset)
                        backtrack(new_rem, cur_parts, cur_legal + 1)
                        cur_parts.pop()
            # Also explore leaving `first` as a singleton and moving on,
            # so we don't dead-end if no legal subset anchors to first.
            cur_parts.append([group[first]])
            backtrack(rest, cur_parts, cur_legal)
            cur_parts.pop()

        backtrack(list(range(n)), [], 0)
        return best[0], best[1]

    changed = True
    while changed:
        changed = False
        for i, group in enumerate(groups):
            ok, _ = _validate_group(group)
            if ok or len(group) < 4:
                continue

            # --- 1. contiguous cuts (fast path) ---
            best_legal, best_split = _best_contiguous(group)
            if best_legal > 0:
                groups = groups[:i] + [s for s in best_split if s] + groups[i + 1:]
                changed = True
                break

            # --- 2. non-contiguous partition (bounded search) ---
            if len(group) <= _NC_SPLIT_MAX_SIZE:
                nc_legal, nc_parts = _best_noncontiguous(group)
                if nc_legal > 0 and nc_parts is not None:
                    def _ts(d):
                        t = d["tile"]
                        return "JKR" if t.get("is_joker") else f"{t.get('value','?')}{(t.get('color') or '?')[0].upper()}"
                    _log.debug(
                        "non-contiguous split applied: cluster sz=%d -> %d legal parts: %s",
                        len(group), nc_legal,
                        [[_ts(d) for d in p] for p in nc_parts],
                    )
                    groups = groups[:i] + [p for p in nc_parts if p] + groups[i + 1:]
                    changed = True
                    break

    return groups


def _try_shift_boundary(
    groups: list[list[dict[str, Any]]],
) -> list[list[dict[str, Any]]]:
    """
    Try moving the last tile of group[i] to the front of group[i+1], or the first tile of
    group[i+1] to the end of group[i]. Accept if the number of legal sets doesn't decrease
    and illegal+single count improves.
    """
    before_score = _score(groups)
    improved = True
    while improved:
        improved = False
        for i in range(len(groups) - 1):
            g0, g1 = groups[i], groups[i + 1]
            # direction: move tail of g0 → head of g1
            if g0:
                candidate_a = [g0[:-1], [g0[-1]] + g1]
                # direction: move head of g1 → tail of g0
            if g1:
                candidate_b = [g0 + [g1[0]], g1[1:]]

            for cands in ([candidate_a] if g0 else []) + ([candidate_b] if g1 else []):
                # Filter out empty groups that were non-empty before
                new_groups = (
                    groups[:i]
                    + [c for c in cands if c]
                    + groups[i + 2:]
                )
                new_score = _score(new_groups)
                # Accept if: legal increases OR (legal same and illegal+single decreases)
                old_legal, old_single, old_ill, _ = _score(groups)
                new_legal, new_single, new_ill, _ = new_score
                if new_legal > old_legal or (
                    new_legal >= old_legal
                    and (new_ill + new_single) < (old_ill + old_single)
                ):
                    groups = new_groups
                    improved = True
                    break
            if improved:
                break

    return groups


def repair_board_groups(
    groups: list[list[dict[str, Any]]],
    debug: bool = False,
) -> tuple[list[list[dict[str, Any]]], list[str]]:
    """
    Apply repair passes in order:
      1. split illegal groups
      2. merge adjacent groups that form a legal set
      3. shift single boundary tile between neighbors

    Returns (repaired_groups, list_of_ops_applied).
    Stops early if board becomes valid.
    """
    ops: list[str] = []

    if _is_perfect(groups):
        return groups, ops

    before = _score(groups)

    groups = _try_split_illegal(groups)
    after_split = _score(groups)
    if after_split != before:
        ops.append(f"split: {before} -> {after_split}")
    if _is_perfect(groups):
        return groups, ops

    groups = _try_merge_neighbors(groups)
    after_merge = _score(groups)
    if after_merge != after_split:
        ops.append(f"merge: {after_split} -> {after_merge}")
    if _is_perfect(groups):
        return groups, ops

    groups = _try_shift_boundary(groups)
    after_shift = _score(groups)
    if after_shift != after_merge:
        ops.append(f"shift: {after_merge} -> {after_shift}")

    return groups, ops


# ---------------------------------------------------------------------------
# Public board grouping entry point
# ---------------------------------------------------------------------------

def cluster_board_detections(
    detections: list[dict[str, Any]],
    max_gap_ratio: float = 0.28,
) -> list[list[dict[str, Any]]]:
    """
    Legacy flood-fill clustering, kept for rack use.
    Board code now uses group_board_detections_into_sets().
    """
    if not detections:
        return []

    average_dimension = sum(
        max(bbox_width(detection), bbox_height(detection))
        for detection in detections
    ) / len(detections)
    max_gap = average_dimension * max_gap_ratio

    clusters: list[list[dict[str, Any]]] = []
    remaining = list(detections)

    while remaining:
        seed = remaining.pop(0)
        cluster = [seed]
        pending = [seed]

        while pending:
            current = pending.pop()
            adjacent = [
                candidate
                for candidate in remaining
                if bbox_gap_distance(current, candidate) <= max_gap
            ]

            if not adjacent:
                continue

            pending.extend(adjacent)
            cluster.extend(adjacent)
            remaining = [
                candidate
                for candidate in remaining
                if candidate not in adjacent
            ]

        cluster.sort(key=lambda detection: (bbox_center_x(detection), bbox_center_y(detection)))
        clusters.append(cluster)

    clusters.sort(key=lambda cluster: (bbox_center_y(cluster[0]), bbox_center_x(cluster[0])))

    return clusters


def group_board_detections_into_sets(
    detections: list[dict[str, Any]],
    debug: bool = False,
) -> tuple[list[list[dict[str, Any]]], dict[str, Any]]:
    """
    Convert a flat list of board detections into physical Rummikub sets.

    Returns:
        groups   — list of detection-lists, one per set
        debug_info — dict with intermediate state for inspection
    """
    if not detections:
        return [], {"detections": 0, "initial_groups": 0, "final_groups": 0, "ops": []}

    # 1. Geometry-only grouping
    initial_groups = _group_board_geometric(detections)

    if debug:
        print(f"\n[board_reconstructor] {len(detections)} detections -> {len(initial_groups)} initial groups")
        for gi, g in enumerate(initial_groups):
            valid, reason = _validate_group(g)
            tiles_str = " ".join(
                "JKR" if d["tile"].get("is_joker") else f"{d['tile'].get('value','?')}{(d['tile'].get('color') or '?')[0].upper()}"
                for d in g
            )
            print(f"  G{gi:02d} ({len(g):2d} tiles) {'OK  ' if valid else 'BAD '} [{tiles_str}]")
            if not valid:
                print(f"        reason: {reason}")

    # 2. Repair
    repaired_groups, ops = repair_board_groups(initial_groups, debug=debug)

    if debug and ops:
        print(f"\n[board_reconstructor] repair ops: {ops}")
        print(f"  Final: {len(repaired_groups)} groups")
        for gi, g in enumerate(repaired_groups):
            valid, reason = _validate_group(g)
            tiles_str = " ".join(
                "JKR" if d["tile"].get("is_joker") else f"{d['tile'].get('value','?')}{(d['tile'].get('color') or '?')[0].upper()}"
                for d in g
            )
            print(f"  G{gi:02d} ({len(g):2d} tiles) {'OK  ' if valid else 'BAD '} [{tiles_str}]")

    return repaired_groups, {
        "detections": len(detections),
        "initial_groups": len(initial_groups),
        "final_groups": len(repaired_groups),
        "ops": ops,
    }


# ---------------------------------------------------------------------------
# Rack helpers (unchanged)
# ---------------------------------------------------------------------------

def sort_rack_detections(
    detections: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = group_detections_into_rows(
        detections,
        row_tolerance_ratio=0.45,
    )

    sorted_detections: list[dict[str, Any]] = []

    for row in rows:
        sorted_detections.extend(row)

    return sorted_detections


def build_rack_from_detections(detections: list[dict[str, Any]]) -> list[Tile]:
    sorted_detections = sort_rack_detections(detections)

    return [
        dict_to_tile(detection["tile"])
        for detection in sorted_detections
    ]


# ---------------------------------------------------------------------------
# Canonical display ordering
# ---------------------------------------------------------------------------

_GROUP_COLOR_ORDER = {
    TileColor.black: 0,
    TileColor.blue: 1,
    TileColor.red: 2,
    TileColor.yellow: 3,
}


def _order_tiles_for_display(tiles: list[Tile]) -> list[Tile]:
    """
    Reorder a validated set's tiles into a consistent, human-readable order,
    independent of the (arbitrary) geometric detection order.

    - Run (same color, consecutive values): ascending by value, with jokers
      placed in whichever gap they are standing in for.
    - Group (same value, different colors): fixed color order.
    - Anything that doesn't cleanly validate as either (e.g. all-joker sets,
      or sets currently invalid) is left in its original order.
    """
    jokers = [t for t in tiles if t.is_joker]
    normals = [t for t in tiles if not t.is_joker]

    if not normals:
        return tiles

    is_group_valid, _ = is_group(normals, len(jokers))
    if is_group_valid:
        ordered_normals = sorted(normals, key=lambda t: _GROUP_COLOR_ORDER.get(t.color, 99))
        return ordered_normals + jokers

    is_run_valid, _ = is_run(normals, len(jokers))
    if is_run_valid:
        ordered_normals = sorted(normals, key=lambda t: t.value)
        values_present = {t.value for t in ordered_normals}
        min_val, max_val = ordered_normals[0].value, ordered_normals[-1].value

        gaps = [v for v in range(min_val, max_val + 1) if v not in values_present]
        remaining_jokers = len(jokers) - len(gaps)

        result: list[Tile] = []
        normal_iter = iter(ordered_normals)
        next_normal = next(normal_iter, None)
        for v in range(min_val, max_val + 1):
            if next_normal is not None and next_normal.value == v:
                result.append(next_normal)
                next_normal = next(normal_iter, None)
            else:
                result.append(jokers.pop())

        # Any leftover jokers (extending the run beyond the detected values)
        # are appended/prepended arbitrarily but consistently at the end.
        result.extend(jokers[:remaining_jokers] if remaining_jokers > 0 else [])
        return result

    return tiles


# ---------------------------------------------------------------------------
# Board builders
# ---------------------------------------------------------------------------

def build_board_from_detections(
    detections: list[dict[str, Any]],
) -> list[TileSet]:
    groups, _ = group_board_detections_into_sets(detections)

    board_sets: list[TileSet] = []
    for group in groups:
        tiles = [dict_to_tile(d["tile"]) for d in group]
        tiles = _order_tiles_for_display(tiles)
        if tiles:
            board_sets.append(TileSet(tiles=tiles))

    return board_sets


def build_game_state(
    rack_detections: list[dict[str, Any]] | None,
    board_detections: list[dict[str, Any]] | None,
) -> GameState:
    rack = build_rack_from_detections(rack_detections or [])
    board = build_board_from_detections(board_detections or [])

    return GameState(
        rack=rack,
        board=board,
    )
