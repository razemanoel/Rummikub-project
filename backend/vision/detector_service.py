import os
import threading
from pathlib import Path
from typing import Any

import numpy as np
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
LATEST_FINETUNED_DETECTOR_PATH = MODELS_DIR / "detector_finetuned_dataset_xml.pt"
FINETUNED_DETECTOR_PATH = MODELS_DIR / "detector_finetuned.pt"
DEFAULT_DETECTOR_PATH = MODELS_DIR / "detector_best.pt"

DEFAULT_CONFIDENCE = 0.4


_detector_model = None
_detector_lock = threading.Lock()


def get_detector_path() -> Path:
    configured_path = os.getenv("VISION_DETECTOR_MODEL_PATH")
    if configured_path:
        return Path(configured_path).expanduser().resolve()

    if LATEST_FINETUNED_DETECTOR_PATH.exists():
        return LATEST_FINETUNED_DETECTOR_PATH

    if FINETUNED_DETECTOR_PATH.exists():
        return FINETUNED_DETECTOR_PATH

    return DEFAULT_DETECTOR_PATH


DETECTOR_PATH = get_detector_path()


def get_detector_model() -> YOLO:
    global _detector_model

    if _detector_model is None:
        detector_path = get_detector_path()
        if not detector_path.exists():
            raise FileNotFoundError(
                f"Detector model not found at: {detector_path}"
            )

        _detector_model = YOLO(str(detector_path))

    return _detector_model


def preload_detector_model() -> YOLO:
    return get_detector_model()


def _extract_detections(results: list[Any]) -> list[dict[str, Any]]:
    detections: list[dict[str, Any]] = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detector_confidence = float(box.conf[0])

            detections.append(
                {
                    "bbox": {
                        "x1": round(float(x1), 2),
                        "y1": round(float(y1), 2),
                        "x2": round(float(x2), 2),
                        "y2": round(float(y2), 2),
                    },
                    "detector_confidence": round(detector_confidence, 4),
                }
            )

    detections.sort(
        key=lambda detection: (
            detection["bbox"]["y1"],
            detection["bbox"]["x1"],
        )
    )

    return detections


def detect_tiles_from_array(
    image_array: np.ndarray,
    confidence: float = DEFAULT_CONFIDENCE,
) -> list[dict[str, Any]]:
    detector = get_detector_model()

    with _detector_lock:
        results = detector.predict(
            source=image_array,
            conf=confidence,
            verbose=False,
        )

    return _extract_detections(results)


def detect_tiles(image_path: str, confidence: float = DEFAULT_CONFIDENCE) -> list[dict[str, Any]]:
    """
    Detect Rummikub tiles in an image.

    Args:
        image_path: Path to the input image.
        confidence: YOLO confidence threshold.

    Returns:
        A list of detections sorted roughly top-to-bottom, left-to-right.
    """
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    detector = get_detector_model()

    with _detector_lock:
        results = detector.predict(
            source=str(image_file),
            conf=confidence,
            verbose=False,
        )

    return _extract_detections(results)