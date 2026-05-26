from pathlib import Path
from typing import Any

from PIL import Image

from backend.vision.detector_service import detect_tiles
from backend.vision.classifier_service import classify_tile_crop
from backend.logic.models import Tile, TileColor


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


def analyze_image(image_path: str, detector_confidence: float = 0.4) -> list[dict[str, Any]]:
    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = Image.open(image_file).convert("RGB")

    detections = detect_tiles(
        image_path=str(image_file),
        confidence=detector_confidence,
    )

    analyzed_tiles: list[dict[str, Any]] = []

    for index, detection in enumerate(detections):
        bbox = detection["bbox"]
        crop = crop_image_by_bbox(image, bbox)
        classification = classify_tile_crop(crop)
        tile = detection_to_tile(classification)

        analyzed_tiles.append(
            {
                "index": index,
                "tile": tile.model_dump(mode="json"),
                "class_name": classification["class_name"],
                "bbox": bbox,
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