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


def suppress_board_duplicate_detections(
    detections: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []

    for detection in sorted(detections, key=lambda item: item["detector_confidence"], reverse=True):
        if not any(board_duplicate_reason(board_duplicate_metrics(detection, kept_detection)) is not None for kept_detection in kept):
            kept.append(detection)

    kept.sort(key=lambda item: (item["bbox"]["y1"], item["bbox"]["x1"]))
    return kept


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
) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []

    for detection in sorted(detections, key=lambda item: item["detector_confidence"], reverse=True):
        if not any(bbox_iou(detection["bbox"], kept_detection["bbox"]) >= iou_threshold for kept_detection in kept):
            kept.append(detection)

    kept.sort(key=lambda item: (item["bbox"]["y1"], item["bbox"]["x1"]))
    return kept


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
) -> list[dict[str, Any]]:
    collected_detections = detect_tiles_in_memory(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
    )
    # TODO: iou_threshold=0.35 may be aggressive for tightly spaced board tiles — revisit if adjacent tiles get merged
    return merge_overlapping_detections(collected_detections, iou_threshold=0.35)


def classify_detections(
    image: Image.Image,
    raw_detections: list[dict[str, Any]],
    bbox_offset: tuple[float, float] = (0.0, 0.0),
    require_dark_support: bool = False,
    rack_support_mask: np.ndarray | None = None,
    min_classifier_confidence: float = 0.2,
) -> list[dict[str, Any]]:
    analyzed_tiles: list[dict[str, Any]] = []
    offset_x, offset_y = bbox_offset
    image_array = np.array(image.convert("RGB")) if require_dark_support else None
    pending_detections: list[dict[str, Any]] = []
    crops: list[Image.Image] = []

    for detection in raw_detections:
        bbox = detection["bbox"]

        dark_support_confirmed = False
        if require_dark_support and image_array is not None:
            dark_support_confirmed = has_dark_rack_support(image_array, bbox)

        if rack_support_mask is not None and not dark_support_confirmed and not has_rack_support_overlap(rack_support_mask, bbox):
            continue

        pending_detections.append(detection)
        crops.append(crop_image_by_bbox(image, bbox))

    classifications = classify_tile_crops(crops)

    for detection, classification in zip(pending_detections, classifications):
        if classification["classifier_confidence"] < min_classifier_confidence:
            continue

        bbox = detection["bbox"]
        tile = detection_to_tile(classification)
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

    return analyzed_tiles


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


def analyze_loaded_image(
    image: Image.Image,
    detector_confidence: float = 0.4,
    bbox_offset: tuple[float, float] = (0.0, 0.0),
    require_dark_support: bool = False,
    rack_support_mask: np.ndarray | None = None,
    source: str = "unknown",
) -> list[dict[str, Any]]:
    raw_detections = detect_tiles_in_memory(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
    )
    detections = deduplicate_detections(raw_detections)
    return classify_detections(
        image=image,
        raw_detections=detections,
        bbox_offset=bbox_offset,
        require_dark_support=require_dark_support,
        rack_support_mask=rack_support_mask,
    )


def analyze_image(
    image_path: str,
    detector_confidence: float = 0.4,
    source: str = "board",
) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = load_image_rgb(image_file)

    merged_detections = collect_board_raw_detections(
        image=image,
        detector_confidence=detector_confidence,
        source=source,
    )
    suppressed_detections = suppress_board_duplicate_detections(merged_detections)
    return classify_detections(image=image, raw_detections=suppressed_detections)


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

    if rack_region is not None:
        rack_bbox = rack_region.bbox
        _, original_height = image.size
        crop_height = rack_bbox["y2"] - rack_bbox["y1"]
        mask = rack_region.front_support_mask
        active_ratio = float(np.count_nonzero(mask)) / max(mask.size, 1)

        crop_unreliable = crop_height < original_height * 0.25 or active_ratio < 0.015
        if crop_unreliable:
            original_width, _ = image.size
            expanded_y1 = max(0.0, rack_bbox["y2"] - int(0.60 * original_height))
            print(
                f"[rack] Suspicious crop (height={crop_height:.0f}px "
                f"mask={active_ratio:.1%}) — expanding to full width, "
                f"y1 {rack_bbox['y1']:.0f} → {expanded_y1:.0f}"
            )
            rack_bbox = {
                "x1": 0.0,
                "y1": expanded_y1,
                "x2": float(original_width),
                "y2": rack_bbox["y2"],
            }

        rack_crop = crop_image_by_bbox(image, rack_bbox)
        bbox_offset = (rack_bbox["x1"], rack_bbox["y1"])
    else:
        rack_crop = image
        bbox_offset = (0.0, 0.0)

    return analyze_loaded_image(
        image=rack_crop,
        detector_confidence=detector_confidence,
        bbox_offset=bbox_offset,
        require_dark_support=True,
        source=source,
    )
