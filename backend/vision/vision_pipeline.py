import os
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from backend.vision.detector_service import detect_tiles_from_array
from backend.vision.classifier_service import classify_tile_crops
from backend.logic.models import Tile, TileColor
from backend.vision.rack_region import detect_rack_region


DEFAULT_MAX_IMAGE_SIDE = 2560


def crop_image_by_bbox(image: Image.Image, bbox: dict[str, float]) -> Image.Image:
    return image.crop(
        (
            bbox["x1"],
            bbox["y1"],
            bbox["x2"],
            bbox["y2"],
        )
    )


def load_image_rgb(image_file: Path) -> Image.Image:
    with Image.open(image_file) as source_image:
        return ImageOps.exif_transpose(source_image).convert("RGB")


def get_max_image_side() -> int:
    configured_value = os.getenv("VISION_MAX_IMAGE_SIDE")
    if configured_value is None:
        return DEFAULT_MAX_IMAGE_SIDE

    try:
        parsed_value = int(configured_value)
    except ValueError as error:
        raise ValueError("VISION_MAX_IMAGE_SIDE must be an integer") from error

    if parsed_value <= 0:
        raise ValueError("VISION_MAX_IMAGE_SIDE must be greater than 0")

    return parsed_value


def prepare_image_for_detection(
    image: Image.Image,
    source: str = "unknown",
) -> tuple[Image.Image, dict[str, float | int | bool]]:
    original_width, original_height = image.size
    max_image_side = get_max_image_side()
    longest_side = max(original_width, original_height)

    if source == "rack":
        return image, {
            "original_width": original_width,
            "original_height": original_height,
            "inference_width": original_width,
            "inference_height": original_height,
            "scale_x": 1.0,
            "scale_y": 1.0,
            "resized": False,
            "max_image_side": max_image_side,
        }

    if longest_side <= max_image_side:
        return image, {
            "original_width": original_width,
            "original_height": original_height,
            "inference_width": original_width,
            "inference_height": original_height,
            "scale_x": 1.0,
            "scale_y": 1.0,
            "resized": False,
            "max_image_side": max_image_side,
        }

    scale = max_image_side / float(longest_side)
    resized_width = max(1, int(round(original_width * scale)))
    resized_height = max(1, int(round(original_height * scale)))
    resized_image = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    return resized_image, {
        "original_width": original_width,
        "original_height": original_height,
        "inference_width": resized_width,
        "inference_height": resized_height,
        "scale_x": resized_width / float(original_width),
        "scale_y": resized_height / float(original_height),
        "resized": True,
        "max_image_side": max_image_side,
    }


def remap_detections_to_original_size(
    detections: list[dict[str, Any]],
    scale_x: float,
    scale_y: float,
) -> list[dict[str, Any]]:
    if scale_x == 1.0 and scale_y == 1.0:
        return detections

    remapped_detections: list[dict[str, Any]] = []
    inverse_scale_x = 1.0 / scale_x
    inverse_scale_y = 1.0 / scale_y

    for detection in detections:
        bbox = detection["bbox"]
        remapped_detections.append(
            {
                **detection,
                "bbox": {
                    "x1": round(float(bbox["x1"] * inverse_scale_x), 2),
                    "y1": round(float(bbox["y1"] * inverse_scale_y), 2),
                    "x2": round(float(bbox["x2"] * inverse_scale_x), 2),
                    "y2": round(float(bbox["y2"] * inverse_scale_y), 2),
                },
            }
        )

    return remapped_detections


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


def bbox_width(bbox: dict[str, float]) -> float:
    return max(0.0, bbox["x2"] - bbox["x1"])


def bbox_height(bbox: dict[str, float]) -> float:
    return max(0.0, bbox["y2"] - bbox["y1"])


def bbox_center(bbox: dict[str, float]) -> tuple[float, float]:
    return (
        (bbox["x1"] + bbox["x2"]) / 2.0,
        (bbox["y1"] + bbox["y2"]) / 2.0,
    )


def similarity_ratio(left: float, right: float) -> float:
    larger = max(left, right)
    if larger <= 0:
        return 0.0
    return min(left, right) / larger


def containment_ratio(left_bbox: dict[str, float], right_bbox: dict[str, float]) -> float:
    intersection_x1 = max(left_bbox["x1"], right_bbox["x1"])
    intersection_y1 = max(left_bbox["y1"], right_bbox["y1"])
    intersection_x2 = min(left_bbox["x2"], right_bbox["x2"])
    intersection_y2 = min(left_bbox["y2"], right_bbox["y2"])

    intersection_width = max(0.0, intersection_x2 - intersection_x1)
    intersection_height = max(0.0, intersection_y2 - intersection_y1)
    intersection_area = intersection_width * intersection_height
    if intersection_area <= 0:
        return 0.0

    smaller_area = min(bbox_area(left_bbox), bbox_area(right_bbox))
    if smaller_area <= 0:
        return 0.0

    return intersection_area / smaller_area


def board_duplicate_metrics(
    left_detection: dict[str, Any],
    right_detection: dict[str, Any],
) -> dict[str, float]:
    left_bbox = left_detection["bbox"]
    right_bbox = right_detection["bbox"]
    left_center_x, left_center_y = bbox_center(left_bbox)
    right_center_x, right_center_y = bbox_center(right_bbox)
    center_distance = float(np.hypot(left_center_x - right_center_x, left_center_y - right_center_y))
    left_diagonal = float(np.hypot(bbox_width(left_bbox), bbox_height(left_bbox)))
    right_diagonal = float(np.hypot(bbox_width(right_bbox), bbox_height(right_bbox)))
    average_diagonal = max((left_diagonal + right_diagonal) / 2.0, 1.0)

    return {
        "iou": round(bbox_iou(left_bbox, right_bbox), 4),
        "center_distance": round(center_distance, 4),
        "normalized_center_distance": round(center_distance / average_diagonal, 4),
        "containment_ratio": round(containment_ratio(left_bbox, right_bbox), 4),
        "width_similarity": round(similarity_ratio(bbox_width(left_bbox), bbox_width(right_bbox)), 4),
        "height_similarity": round(similarity_ratio(bbox_height(left_bbox), bbox_height(right_bbox)), 4),
        "area_similarity": round(similarity_ratio(bbox_area(left_bbox), bbox_area(right_bbox)), 4),
    }


def board_duplicate_reason(metrics: dict[str, float]) -> str | None:
    if metrics["iou"] >= 0.72:
        return "high_iou"

    if (
        metrics["normalized_center_distance"] <= 0.16
        and metrics["width_similarity"] >= 0.78
        and metrics["height_similarity"] >= 0.78
        and metrics["area_similarity"] >= 0.65
    ):
        return "center_size_match"

    if (
        metrics["containment_ratio"] >= 0.84
        and metrics["normalized_center_distance"] <= 0.22
        and metrics["area_similarity"] >= 0.55
    ):
        return "containment_match"

    if (
        metrics["iou"] >= 0.38
        and metrics["normalized_center_distance"] <= 0.14
        and metrics["width_similarity"] >= 0.72
        and metrics["height_similarity"] >= 0.72
        and metrics["area_similarity"] >= 0.58
    ):
        return "hybrid_match"

    return None


def serialize_detection(detection: dict[str, Any]) -> dict[str, Any]:
    return {
        "bbox": detection["bbox"],
        "detector_confidence": round(float(detection["detector_confidence"]), 4),
    }


def suppress_board_duplicate_detections(
    detections: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    kept_with_indices: list[tuple[int, dict[str, Any]]] = []
    suppression_events: list[dict[str, Any]] = []
    reason_counts = {
        "high_iou": 0,
        "center_size_match": 0,
        "containment_match": 0,
        "hybrid_match": 0,
    }

    ranked_detections = sorted(
        enumerate(detections),
        key=lambda item: item[1]["detector_confidence"],
        reverse=True,
    )

    for raw_index, detection in ranked_detections:
        suppressed = False

        for kept_index, kept_detection in kept_with_indices:
            metrics = board_duplicate_metrics(detection, kept_detection)
            reason = board_duplicate_reason(metrics)
            if reason is None:
                continue

            reason_counts[reason] += 1
            suppression_events.append(
                {
                    "reason": reason,
                    "kept_detection": {
                        "raw_index": kept_index,
                        **serialize_detection(kept_detection),
                    },
                    "suppressed_detection": {
                        "raw_index": raw_index,
                        **serialize_detection(detection),
                    },
                    **metrics,
                    "kept_detector_confidence": round(float(kept_detection["detector_confidence"]), 4),
                    "suppressed_detector_confidence": round(float(detection["detector_confidence"]), 4),
                }
            )
            suppressed = True
            break

        if not suppressed:
            kept_with_indices.append((raw_index, detection))

    kept_detections = [item[1] for item in kept_with_indices]
    kept_detections.sort(key=lambda item: (item["bbox"]["y1"], item["bbox"]["x1"]))

    return kept_detections, suppression_events, reason_counts


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
    source: str = "unknown",
) -> list[dict[str, Any]]:
    prepared_image, preparation_metadata = prepare_image_for_detection(
        image,
        source=source,
    )
    detections = detect_tiles_from_array(
        np.array(prepared_image.convert("RGB")),
        confidence=detector_confidence,
    )

    remapped_detections = remap_detections_to_original_size(
        detections,
        scale_x=float(preparation_metadata["scale_x"]),
        scale_y=float(preparation_metadata["scale_y"]),
    )

    return remapped_detections


def collect_board_raw_detections(
    image: Image.Image,
    detector_confidence: float,
    source: str,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    collected_detections = detect_tiles_in_memory(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
    )

    merged_detections = merge_overlapping_detections(
        collected_detections,
        iou_threshold=0.35,
    )
    return merged_detections, {
        "raw_detection_count": len(collected_detections),
        "merged_detection_count": len(merged_detections),
    }


def classify_detections(
    image: Image.Image,
    raw_detections: list[dict[str, Any]],
    bbox_offset: tuple[float, float] = (0.0, 0.0),
    require_dark_support: bool = False,
    rack_support_mask: np.ndarray | None = None,
    source: str = "unknown",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    analyzed_tiles: list[dict[str, Any]] = []
    offset_x, offset_y = bbox_offset
    image_array = np.array(image.convert("RGB")) if require_dark_support else None
    filter_log: list[dict[str, Any]] = []
    pending_detections: list[tuple[dict[str, Any], dict[str, Any]]] = []
    crops: list[Image.Image] = []

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

        if rack_support_mask is not None and not has_rack_support_overlap(rack_support_mask, bbox):
            debug_item["dropped_reasons"].append("outside_rack_region")
            filter_log.append(debug_item)
            continue

        pending_detections.append((detection, debug_item))
        crops.append(crop_image_by_bbox(image, bbox))

    classifications = classify_tile_crops(crops)

    for (detection, debug_item), classification in zip(pending_detections, classifications):
        bbox = detection["bbox"]
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


def has_rack_support_overlap(support_mask: np.ndarray, bbox: dict[str, float]) -> bool:
    image_height, image_width = support_mask.shape[:2]
    x1 = max(0, min(image_width - 1, int(round(bbox["x1"]))))
    y1 = max(0, min(image_height - 1, int(round(bbox["y1"]))))
    x2 = max(x1 + 1, min(image_width, int(round(bbox["x2"]))))
    y2 = max(y1 + 1, min(image_height, int(round(bbox["y2"]))))

    bottom_band_height = max(int(round((y2 - y1) * 0.28)), 2)
    band_y1 = max(y1, y2 - bottom_band_height)
    band = support_mask[band_y1:y2, x1:x2] > 0
    if band.size == 0:
        return False

    overlap_ratio = float(np.mean(band))
    center_x = min(image_width - 1, max(0, int(round((x1 + x2) / 2))))
    center_y = min(image_height - 1, max(0, y2 - 1))
    bottom_center_supported = bool(support_mask[center_y, center_x] > 0)

    column_band = support_mask[:, x1:x2] > 0
    supported_rows = np.where(np.any(column_band, axis=1))[0]
    if supported_rows.size == 0:
        return False

    local_front_edge_y = int(supported_rows.max())
    bbox_height = max(y2 - y1, 1)
    max_vertical_gap = max(int(round(bbox_height * 0.08)), 3)
    bottom_gap = local_front_edge_y - (y2 - 1)

    if bottom_gap > max_vertical_gap:
        return False

    return bottom_center_supported or overlap_ratio >= 0.12


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
    rack_support_mask: np.ndarray | None = None,
    source: str = "unknown",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    raw_detections = detect_tiles_in_memory(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
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
        rack_support_mask=rack_support_mask,
        source=source,
    )
    filter_log.extend(classification_log)

    return analyzed_tiles, raw_detections, filter_log


def analyze_image(
    image_path: str,
    detector_confidence: float = 0.4,
    source: str = "board",
) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = load_image_rgb(image_file)

    merged_detections, board_detection_stats = collect_board_raw_detections(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
    )
    suppressed_detections, suppression_events, suppression_reason_counts = suppress_board_duplicate_detections(
        merged_detections,
    )

    analyzed_tiles, _ = classify_detections(
        image=image,
        raw_detections=suppressed_detections,
        source=source,
    )
    return analyzed_tiles


def analyze_rack_image(
    image_path: str,
    detector_confidence: float = 0.4,
    source: str = "rack",
) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = load_image_rgb(image_file)
    rack_region = detect_rack_region(image)
    rack_bbox = rack_region.bbox if rack_region is not None else None

    if rack_bbox is None:
        rack_bbox = build_fallback_rack_bbox(image)

    rack_support_mask = None
    if rack_region is not None:
        x1 = max(0, int(round(rack_bbox["x1"])))
        y1 = max(0, int(round(rack_bbox["y1"])))
        x2 = min(rack_region.front_support_mask.shape[1], int(round(rack_bbox["x2"])))
        y2 = min(rack_region.front_support_mask.shape[0], int(round(rack_bbox["y2"])))
        rack_support_mask = rack_region.front_support_mask[y1:y2, x1:x2]

    rack_crop = crop_image_by_bbox(image, rack_bbox)
    analyzed_tiles, raw_detections, filter_log = analyze_loaded_image(
        image=rack_crop,
        detector_confidence=detector_confidence,
        bbox_offset=(rack_bbox["x1"], rack_bbox["y1"]),
        require_dark_support=rack_region is not None,
        rack_support_mask=rack_support_mask,
        source=source,
    )

    dropped_reason_counts: dict[str, int] = {}
    kept_count = 0

    for item in filter_log:
        dropped_reasons = item.get("dropped_reasons", [])
        if dropped_reasons:
            for reason in dropped_reasons:
                dropped_reason_counts[reason] = dropped_reason_counts.get(reason, 0) + 1
            continue

        if item.get("status") == "kept":
            kept_count += 1

    return analyzed_tiles
