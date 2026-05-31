from pathlib import Path
import tempfile
from typing import Any

import numpy as np
from PIL import Image

from backend.vision.detector_service import detect_tiles
from backend.vision.classifier_service import classify_tile_crop
from backend.logic.models import Tile, TileColor
from backend.vision.rack_region import detect_rack_region


def crop_image_by_bbox(image: Image.Image, bbox: dict[str, float]) -> Image.Image:
    return image.crop(
        (
            bbox["x1"],
            bbox["y1"],
            bbox["x2"],
            bbox["y2"],
        )
    )


def detection_to_tile(classification: dict[str, Any]) -> Tile:
    if classification["is_joker"]:
        return Tile(
            value=None,
            color=None,
            is_joker=True,
        )

    return Tile(
        value=classification["value"],
        color=TileColor(classification["color"]),
        is_joker=False,
    )


def offset_bbox(
    bbox: dict[str, float],
    offset_x: float,
    offset_y: float,
) -> dict[str, float]:
    return {
        "x1": round(float(bbox["x1"] + offset_x), 2),
        "y1": round(float(bbox["y1"] + offset_y), 2),
        "x2": round(float(bbox["x2"] + offset_x), 2),
        "y2": round(float(bbox["y2"] + offset_y), 2),
    }


def bbox_area(bbox: dict[str, float]) -> float:
    return max(0.0, bbox["x2"] - bbox["x1"]) * max(0.0, bbox["y2"] - bbox["y1"])


def bbox_iou(left_bbox: dict[str, float], right_bbox: dict[str, float]) -> float:
    intersection_x1 = max(left_bbox["x1"], right_bbox["x1"])
    intersection_y1 = max(left_bbox["y1"], right_bbox["y1"])
    intersection_x2 = min(left_bbox["x2"], right_bbox["x2"])
    intersection_y2 = min(left_bbox["y2"], right_bbox["y2"])

    intersection_width = max(0.0, intersection_x2 - intersection_x1)
    intersection_height = max(0.0, intersection_y2 - intersection_y1)
    intersection_area = intersection_width * intersection_height

    if intersection_area <= 0:
        return 0.0

    union_area = bbox_area(left_bbox) + bbox_area(right_bbox) - intersection_area
    if union_area <= 0:
        return 0.0

    return intersection_area / union_area


def deduplicate_detections(
    detections: list[dict[str, Any]],
    iou_threshold: float = 0.65,
) -> tuple[list[dict[str, Any]], dict[int, dict[str, Any]]]:
    kept_with_indices: list[tuple[int, dict[str, Any]]] = []
    suppression_log: dict[int, dict[str, Any]] = {}

    ranked_detections = sorted(
        enumerate(detections),
        key=lambda item: item[1]["detector_confidence"],
        reverse=True,
    )

    for raw_index, detection in ranked_detections:
        duplicate_of: int | None = None
        duplicate_iou = 0.0

        for kept_index, kept_detection in kept_with_indices:
            overlap = bbox_iou(detection["bbox"], kept_detection["bbox"])
            if overlap >= iou_threshold:
                duplicate_of = kept_index
                duplicate_iou = overlap
                break

        if duplicate_of is not None:
            suppression_log[raw_index] = {
                "duplicate_of": duplicate_of,
                "iou": round(duplicate_iou, 4),
            }
            continue

        kept_with_indices.append((raw_index, detection))

    kept_with_indices.sort(key=lambda item: (item[1]["bbox"]["y1"], item[1]["bbox"]["x1"]))

    return [item[1] for item in kept_with_indices], suppression_log


def merge_overlapping_detections(
    detections: list[dict[str, Any]],
    iou_threshold: float,
) -> list[dict[str, Any]]:
    merged_detections: list[dict[str, Any]] = []

    for detection in sorted(
        detections,
        key=lambda item: item["detector_confidence"],
        reverse=True,
    ):
        merged_into_existing = False

        for existing in merged_detections:
            if bbox_iou(detection["bbox"], existing["bbox"]) < iou_threshold:
                continue

            existing_bbox = existing["bbox"]
            detection_bbox = detection["bbox"]
            existing["bbox"] = {
                "x1": round(min(existing_bbox["x1"], detection_bbox["x1"]), 2),
                "y1": round(min(existing_bbox["y1"], detection_bbox["y1"]), 2),
                "x2": round(max(existing_bbox["x2"], detection_bbox["x2"]), 2),
                "y2": round(max(existing_bbox["y2"], detection_bbox["y2"]), 2),
            }
            existing["detector_confidence"] = round(
                max(existing["detector_confidence"], detection["detector_confidence"]),
                4,
            )
            merged_into_existing = True
            break

        if not merged_into_existing:
            merged_detections.append(
                {
                    "bbox": dict(detection["bbox"]),
                    "detector_confidence": detection["detector_confidence"],
                }
            )

    merged_detections.sort(key=lambda item: (item["bbox"]["y1"], item["bbox"]["x1"]))
    return merged_detections


def detect_tiles_in_memory(
    image: Image.Image,
    detector_confidence: float = 0.4,
) -> list[dict[str, Any]]:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / "vision-input.png"
        image.save(temp_path, format="PNG")
        return detect_tiles(
            image_path=str(temp_path),
            confidence=detector_confidence,
        )


def board_detection_windows(image: Image.Image) -> list[tuple[float, float, float, float]]:
    image_width, image_height = image.size

    return [
        (0.0, 0.0, float(image_width), float(image_height)),
        (0.0, 0.0, float(image_width * 0.62), float(image_height)),
        (float(image_width * 0.38), 0.0, float(image_width), float(image_height)),
        (0.0, 0.0, float(image_width), float(image_height * 0.72)),
        (0.0, float(image_height * 0.28), float(image_width), float(image_height)),
        (
            float(image_width * 0.10),
            float(image_height * 0.45),
            float(image_width * 0.55),
            float(image_height),
        ),
        (
            float(image_width * 0.58),
            float(image_height * 0.42),
            float(image_width),
            float(image_height * 0.78),
        ),
    ]


def collect_board_raw_detections(
    image: Image.Image,
    detector_confidence: float,
) -> list[dict[str, Any]]:
    collected_detections: list[dict[str, Any]] = []

    for x1, y1, x2, y2 in board_detection_windows(image):
        window_bbox = {
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
        }
        window_image = crop_image_by_bbox(image, window_bbox)
        window_detections = detect_tiles_in_memory(
            image=window_image,
            detector_confidence=detector_confidence,
        )

        for detection in window_detections:
            collected_detections.append(
                {
                    **detection,
                    "bbox": offset_bbox(detection["bbox"], x1, y1),
                }
            )

    merged_detections = merge_overlapping_detections(
        collected_detections,
        iou_threshold=0.35,
    )
    return merged_detections


def classify_detections(
    image: Image.Image,
    raw_detections: list[dict[str, Any]],
    bbox_offset: tuple[float, float] = (0.0, 0.0),
    require_dark_support: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    analyzed_tiles: list[dict[str, Any]] = []
    offset_x, offset_y = bbox_offset
    image_array = np.array(image.convert("RGB")) if require_dark_support else None
    filter_log: list[dict[str, Any]] = []

    for raw_index, detection in enumerate(raw_detections):
        bbox = detection["bbox"]
        debug_item: dict[str, Any] = {
            "raw_index": raw_index,
            "bbox": bbox,
            "detector_confidence": detection["detector_confidence"],
            "dropped_reasons": [],
        }

        if require_dark_support and image_array is not None and not has_dark_rack_support(image_array, bbox):
            debug_item["dropped_reasons"].append("no_dark_rack_support")
            filter_log.append(debug_item)
            continue

        crop = crop_image_by_bbox(image, bbox)

        classification = classify_tile_crop(crop)
        tile = detection_to_tile(classification)
        debug_item["class_name"] = classification["class_name"]
        debug_item["classifier_confidence"] = classification["classifier_confidence"]
        debug_item["tile"] = tile.model_dump(mode="json")
        debug_item["status"] = "kept"

        analyzed_tiles.append(
            {
                "index": len(analyzed_tiles),
                "tile": tile.model_dump(mode="json"),
                "class_name": classification["class_name"],
                "bbox": offset_bbox(bbox, offset_x, offset_y),
                "detector_confidence": detection["detector_confidence"],
                "classifier_confidence": classification["classifier_confidence"],
                "combined_confidence": round(
                    detection["detector_confidence"]
                    * classification["classifier_confidence"],
                    4,
                ),
            }
        )
        filter_log.append(debug_item)

    return analyzed_tiles, filter_log


def build_fallback_rack_bbox(image: Image.Image) -> dict[str, float]:
    image_width, image_height = image.size

    return {
        "x1": float(image_width * 0.04),
        "y1": float(image_height * 0.34),
        "x2": float(image_width * 0.96),
        "y2": float(image_height * 0.98),
    }


def has_dark_rack_support(image_array: np.ndarray, bbox: dict[str, float]) -> bool:
    image_height, image_width = image_array.shape[:2]
    bbox_width = max(int(round(bbox["x2"] - bbox["x1"])), 1)
    bbox_height = max(int(round(bbox["y2"] - bbox["y1"])), 1)

    support_x1 = max(int(round(bbox["x1"] - (bbox_width * 0.08))), 0)
    support_x2 = min(int(round(bbox["x2"] + (bbox_width * 0.08))), image_width)
    support_y1 = max(int(round(bbox["y2"] - (bbox_height * 0.08))), 0)
    support_y2 = min(int(round(bbox["y2"] + (bbox_height * 0.24))), image_height)

    if support_x2 <= support_x1 or support_y2 <= support_y1:
        return False

    support_region = image_array[support_y1:support_y2, support_x1:support_x2]
    if support_region.size == 0:
        return False

    luminance = (
        (0.299 * support_region[:, :, 0])
        + (0.587 * support_region[:, :, 1])
        + (0.114 * support_region[:, :, 2])
    )
    dark_ratio = float(np.mean(luminance < 85))

    return dark_ratio >= 0.2


def looks_like_rummikub_tile_crop(crop: Image.Image) -> bool:
    crop_array = np.array(crop.convert("RGB"))
    if crop_array.size == 0:
        return False

    luminance = (
        (0.299 * crop_array[:, :, 0])
        + (0.587 * crop_array[:, :, 1])
        + (0.114 * crop_array[:, :, 2])
    )
    color_spread = (
        crop_array.max(axis=2).astype(np.float32)
        - crop_array.min(axis=2).astype(np.float32)
    )

    neutral_bright_mask = (luminance >= 150) & (color_spread <= 60)
    neutral_bright_ratio = float(np.mean(neutral_bright_mask))

    crop_height, crop_width = crop_array.shape[:2]
    center_y1 = int(crop_height * 0.18)
    center_y2 = max(center_y1 + 1, int(crop_height * 0.82))
    center_x1 = int(crop_width * 0.12)
    center_x2 = max(center_x1 + 1, int(crop_width * 0.88))
    center_region = crop_array[center_y1:center_y2, center_x1:center_x2]

    if center_region.size == 0:
        return False

    center_luminance = (
        (0.299 * center_region[:, :, 0])
        + (0.587 * center_region[:, :, 1])
        + (0.114 * center_region[:, :, 2])
    )
    center_spread = (
        center_region.max(axis=2).astype(np.float32)
        - center_region.min(axis=2).astype(np.float32)
    )
    center_neutral_ratio = float(np.mean((center_luminance >= 155) & (center_spread <= 55)))

    return neutral_bright_ratio >= 0.16 and center_neutral_ratio >= 0.22


def analyze_loaded_image(
    image: Image.Image,
    detector_confidence: float = 0.4,
    bbox_offset: tuple[float, float] = (0.0, 0.0),
    require_dark_support: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    raw_detections = detect_tiles_in_memory(
        image=image,
        detector_confidence=detector_confidence,
    )
    detections, suppression_log = deduplicate_detections(raw_detections)
    filter_log: list[dict[str, Any]] = []

    for raw_index, raw_detection in enumerate(raw_detections):
        if raw_index in suppression_log:
            filter_log.append(
                {
                    "raw_index": raw_index,
                    "bbox": raw_detection["bbox"],
                    "detector_confidence": raw_detection["detector_confidence"],
                    "dropped_reasons": ["duplicate_bbox"],
                    "duplicate_of": suppression_log[raw_index]["duplicate_of"],
                    "duplicate_iou": suppression_log[raw_index]["iou"],
                }
            )

    analyzed_tiles, classification_log = classify_detections(
        image=image,
        raw_detections=detections,
        bbox_offset=bbox_offset,
        require_dark_support=require_dark_support,
    )
    filter_log.extend(classification_log)

    return analyzed_tiles, raw_detections, filter_log


def analyze_image(image_path: str, detector_confidence: float = 0.4) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = Image.open(image_file).convert("RGB")

    raw_detections = collect_board_raw_detections(
        image=image,
        detector_confidence=detector_confidence,
    )
    analyzed_tiles, _ = classify_detections(
        image=image,
        raw_detections=raw_detections,
    )
    return analyzed_tiles


def analyze_rack_image(
    image_path: str,
    detector_confidence: float = 0.4,
) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = Image.open(image_file).convert("RGB")
    rack_bbox = detect_rack_region(image)

    if rack_bbox is None:
        rack_bbox = build_fallback_rack_bbox(image)

    rack_crop = crop_image_by_bbox(image, rack_bbox)
    analyzed_tiles, raw_detections, filter_log = analyze_loaded_image(
        image=rack_crop,
        detector_confidence=detector_confidence,
        bbox_offset=(rack_bbox["x1"], rack_bbox["y1"]),
        require_dark_support=True,
    )

    return analyzed_tiles
