from pathlib import Path
from typing import Any

from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DETECTOR_PATH = MODELS_DIR / "detector_best.pt"

DEFAULT_CONFIDENCE = 0.4


_detector_model = None


def get_detector_model() -> YOLO:
    global _detector_model

    if _detector_model is None:
        if not DETECTOR_PATH.exists():
            raise FileNotFoundError(
                f"Detector model not found at: {DETECTOR_PATH}"
            )

        _detector_model = YOLO(str(DETECTOR_PATH))

    return _detector_model


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

    results = detector.predict(
        source=str(image_file),
        conf=confidence,
        verbose=False,
    )

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