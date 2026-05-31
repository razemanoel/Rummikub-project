from typing import Any

from backend.logic.models import Tile, TileSet, GameState, TileColor


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


def cluster_board_detections(
    detections: list[dict[str, Any]],
    max_gap_ratio: float = 0.28,
) -> list[list[dict[str, Any]]]:
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

def split_row_into_sets(
    row: list[dict[str, Any]],
    gap_ratio: float = 1.3,
) -> list[list[dict[str, Any]]]:
    if not row:
        return []

    if len(row) == 1:
        return [row]

    average_width = sum(bbox_width(item) for item in row) / len(row)
    max_same_set_gap = average_width * gap_ratio

    sets: list[list[dict[str, Any]]] = []
    current_set = [row[0]]

    for previous, current in zip(row, row[1:]):
        previous_right = previous["bbox"]["x2"]
        current_left = current["bbox"]["x1"]
        gap = current_left - previous_right

        if gap > max_same_set_gap:
            sets.append(current_set)
            current_set = [current]
        else:
            current_set.append(current)

    sets.append(current_set)

    return sets


def build_rack_from_detections(detections: list[dict[str, Any]]) -> list[Tile]:
    sorted_detections = sort_rack_detections(detections)

    return [
        dict_to_tile(detection["tile"])
        for detection in sorted_detections
    ]


def build_board_from_detections(
    detections: list[dict[str, Any]],
) -> list[TileSet]:
    board_sets: list[TileSet] = []

    for detected_set in cluster_board_detections(detections):
        tiles = [
            dict_to_tile(detection["tile"])
            for detection in detected_set
        ]

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