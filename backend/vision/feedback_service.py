import json
import math
from pathlib import Path
from uuid import uuid4

from PIL import Image
from pydantic import ValidationError

from backend.vision.classifier_service import CLASSIFIER_PATH
from backend.vision.detector_service import DETECTOR_PATH
from backend.logic.models import (
    FeedbackArtifactCorrection,
    FeedbackArtifactRequest,
    FeedbackArtifactResult,
    Tile,
)


BASE_DIR = Path(__file__).resolve().parent
CLASSIFICATION_FEEDBACK_DIR = BASE_DIR / "feedback_dataset" / "classification"
DETECTION_IMAGES_DIR = BASE_DIR / "feedback_dataset" / "detection" / "images"
DETECTION_LABELS_DIR = BASE_DIR / "feedback_dataset" / "detection" / "labels"
MIN_CROP_DIMENSION = 16


def get_model_versions() -> dict[str, str]:
    return {
        "detectorModelVersion": DETECTOR_PATH.name,
        "classifierModelVersion": CLASSIFIER_PATH.name,
    }


def parse_feedback_artifact_request(raw_feedback: str) -> FeedbackArtifactRequest:
    try:
        payload = json.loads(raw_feedback)
    except json.JSONDecodeError as error:
        raise ValueError("Feedback payload must be valid JSON") from error

    try:
        return FeedbackArtifactRequest.model_validate(payload)
    except ValidationError as error:
        raise ValueError("Feedback payload failed validation") from error


def tile_to_class_name(tile: Tile) -> str:
    if tile.is_joker:
        return "joker"

    return f"{tile.color}_{tile.value}"


def clamp_bbox(
    x: float,
    y: float,
    width: float,
    height: float,
    image_width: int,
    image_height: int,
) -> tuple[int, int, int, int] | None:
    x1 = max(0, min(image_width, math.floor(x)))
    y1 = max(0, min(image_height, math.floor(y)))
    x2 = max(0, min(image_width, math.ceil(x + width)))
    y2 = max(0, min(image_height, math.ceil(y + height)))

    if x2 <= x1 or y2 <= y1:
        return None

    if (x2 - x1) < MIN_CROP_DIMENSION or (y2 - y1) < MIN_CROP_DIMENSION:
        return None

    return x1, y1, x2, y2


def save_feedback_crop_for_correction(
    image_path: str,
    correction: FeedbackArtifactCorrection,
) -> str | None:
    image = Image.open(image_path).convert("RGB")
    image_width, image_height = image.size
    bbox = clamp_bbox(
        x=correction.bbox.x,
        y=correction.bbox.y,
        width=correction.bbox.width,
        height=correction.bbox.height,
        image_width=image_width,
        image_height=image_height,
    )

    if bbox is None:
        return None

    crop = image.crop(bbox)
    class_name = tile_to_class_name(correction.correctedTile)
    output_dir = CLASSIFICATION_FEEDBACK_DIR / class_name
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}.jpg"
    output_path = output_dir / filename
    crop.save(output_path, format="JPEG", quality=95)

    return output_path.relative_to(BASE_DIR).as_posix()


def normalize_yolo_bbox(
    bbox: tuple[int, int, int, int],
    image_width: int,
    image_height: int,
) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    x_center = x1 + (width / 2)
    y_center = y1 + (height / 2)

    return (
        x_center / image_width,
        y_center / image_height,
        width / image_width,
        height / image_height,
    )


def save_detection_artifacts_for_source(
    image_path: str,
    detections: list,
) -> tuple[str | None, str | None]:
    if not detections:
        return None, None

    image = Image.open(image_path).convert("RGB")
    image_width, image_height = image.size

    normalized_boxes: list[tuple[float, float, float, float]] = []

    for detection in detections:
        bbox = clamp_bbox(
            x=detection.bbox.x,
            y=detection.bbox.y,
            width=detection.bbox.width,
            height=detection.bbox.height,
            image_width=image_width,
            image_height=image_height,
        )

        if bbox is None:
            continue

        normalized_boxes.append(normalize_yolo_bbox(bbox, image_width, image_height))

    if not normalized_boxes:
        return None, None

    DETECTION_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    DETECTION_LABELS_DIR.mkdir(parents=True, exist_ok=True)

    sample_id = uuid4().hex
    image_output_path = DETECTION_IMAGES_DIR / f"{sample_id}.jpg"
    label_output_path = DETECTION_LABELS_DIR / f"{sample_id}.txt"

    image.save(image_output_path, format="JPEG", quality=95)

    with label_output_path.open("w", encoding="utf-8") as label_file:
        for x_center, y_center, width, height in normalized_boxes:
            label_file.write(
                f"0 {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n"
            )

    return (
        image_output_path.relative_to(BASE_DIR).as_posix(),
        label_output_path.relative_to(BASE_DIR).as_posix(),
    )


def generate_feedback_artifacts(
    feedback_request: FeedbackArtifactRequest,
    rack_image_path: str | None,
    board_image_path: str | None,
) -> list[FeedbackArtifactResult]:
    image_paths = {
        "rack": rack_image_path,
        "board": board_image_path,
    }
    artifacts: list[FeedbackArtifactResult] = []

    for source in ("rack", "board"):
        source_corrections = [
            item for item in feedback_request.corrections if item.source == source
        ]

        if not source_corrections:
            continue

        image_path = image_paths[source]
        detection_image_path = None
        yolo_label_path = None
        final_image_detections = getattr(feedback_request.finalImageDetections, source)

        if image_path and any(item.affectsDetector for item in source_corrections):
            detection_image_path, yolo_label_path = save_detection_artifacts_for_source(
                image_path,
                final_image_detections,
            )

        for correction in source_corrections:
            image_crop_path = None

            if image_path and correction.affectsClassifier:
                image_crop_path = save_feedback_crop_for_correction(
                    image_path,
                    correction,
                )

            artifacts.append(
                FeedbackArtifactResult(
                    feedbackHash=correction.feedbackHash,
                    tileIndex=correction.tileIndex,
                    source=correction.source,
                    imageCropPath=image_crop_path,
                    fullImagePath=detection_image_path if correction.affectsDetector else None,
                    yoloLabelPath=yolo_label_path if correction.affectsDetector else None,
                )
            )

    return artifacts