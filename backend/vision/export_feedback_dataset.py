"""
Export training data from raw feedback cases collected by the vision pipeline.

Each raw case is a pair of files saved by feedback_service.py:
  feedback_dataset/raw/<uuid>.jpg   — original image
  feedback_dataset/raw/<uuid>.json  — corrections + detections + metadata

Classifier output  (crops per correction bbox, labeled by correctedTile):
  exported_feedback_dataset/classification/<color_value>/<uuid>_<tileIndex>.jpg

Detector output  (full image + YOLO label file from finalImageDetections):
  exported_feedback_dataset/detection/images/<uuid>.jpg
  exported_feedback_dataset/detection/labels/<uuid>.txt

Usage:
  python export_feedback_dataset.py
  python export_feedback_dataset.py --reviewed-only --mark-used
  python export_feedback_dataset.py --classifier-only
  python export_feedback_dataset.py --detector-only
"""

import argparse
import json
import math
import os
import shutil
from pathlib import Path

from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
RAW_CASES_DIR = BASE_DIR / "feedback_dataset" / "raw"
DEFAULT_CLASSIFICATION_DIR = BASE_DIR / "exported_feedback_dataset" / "classification"
DEFAULT_DETECTION_DIR = BASE_DIR / "exported_feedback_dataset" / "detection"

# Only these correction types imply a classifier error worth cropping
CLASSIFIER_CORRECTION_TYPES = {"wrong_class", "wrong_bbox", "both"}


# ---------------------------------------------------------------------------
# Raw case loading
# ---------------------------------------------------------------------------

def load_raw_cases(cases_dir: Path) -> list[tuple[Path, dict]]:
    cases = []
    for json_file in sorted(cases_dir.glob("*.json")):
        image_file = json_file.with_suffix(".jpg")
        if not image_file.exists():
            continue
        try:
            case_data = json.loads(json_file.read_text(encoding="utf-8"))
            cases.append((image_file, case_data))
        except (json.JSONDecodeError, OSError):
            print(f"  Warning: could not read {json_file.name}, skipping")
    return cases


# ---------------------------------------------------------------------------
# MongoDB helpers (only imported when a filtering flag is active)
# ---------------------------------------------------------------------------

def _mongo_collection(mongo_uri: str):
    from pymongo import MongoClient  # type: ignore[import]
    client = MongoClient(mongo_uri)
    return client, client.get_default_database()["vision_feedback"]


def get_reviewed_hashes(mongo_uri: str) -> set[str]:
    client, collection = _mongo_collection(mongo_uri)
    hashes = {r["feedbackHash"] for r in collection.find({"reviewed": True}, {"feedbackHash": 1})}
    client.close()
    return hashes


def get_used_hashes(mongo_uri: str) -> set[str]:
    client, collection = _mongo_collection(mongo_uri)
    hashes = {r["feedbackHash"] for r in collection.find({"usedForTraining": True}, {"feedbackHash": 1})}
    client.close()
    return hashes


def mark_hashes_used(mongo_uri: str, hashes: list[str]) -> None:
    client, collection = _mongo_collection(mongo_uri)
    collection.update_many(
        {"feedbackHash": {"$in": hashes}},
        {"$set": {"usedForTraining": True}},
    )
    client.close()


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def clamp_bbox(
    x: float,
    y: float,
    width: float,
    height: float,
    image_width: int,
    image_height: int,
    min_side: int = 8,
) -> tuple[int, int, int, int] | None:
    x1 = max(0, min(image_width, math.floor(x)))
    y1 = max(0, min(image_height, math.floor(y)))
    x2 = max(0, min(image_width, math.ceil(x + width)))
    y2 = max(0, min(image_height, math.ceil(y + height)))
    if x2 - x1 < min_side or y2 - y1 < min_side:
        return None
    return x1, y1, x2, y2


def normalize_yolo_bbox(
    bbox: tuple[int, int, int, int],
    image_width: int,
    image_height: int,
) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = bbox
    w = x2 - x1
    h = y2 - y1
    return (
        (x1 + w / 2) / image_width,
        (y1 + h / 2) / image_height,
        w / image_width,
        h / image_height,
    )


def build_class_name(tile: dict) -> str:
    if tile.get("is_joker"):
        return "joker"
    return f"{tile.get('color')}_{tile.get('value')}"


# ---------------------------------------------------------------------------
# Per-case export
# ---------------------------------------------------------------------------

def export_classifier_samples(
    image: Image.Image,
    case_id: str,
    corrections: list[dict],
    output_dir: Path,
) -> list[dict]:
    """Crop each correction bbox and save under its correctedTile class name."""
    image_width, image_height = image.size
    exported = []

    for correction in corrections:
        if correction.get("correctionType") not in CLASSIFIER_CORRECTION_TYPES:
            continue

        bbox_raw = correction.get("bbox")
        if not bbox_raw:
            continue

        bbox = clamp_bbox(
            bbox_raw["x"], bbox_raw["y"],
            bbox_raw["width"], bbox_raw["height"],
            image_width, image_height,
        )
        if bbox is None:
            continue

        class_name = build_class_name(correction.get("correctedTile", {}))
        target_dir = output_dir / class_name
        target_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{case_id}_{correction['tileIndex']}.jpg"
        target_path = target_dir / filename
        image.crop(bbox).save(target_path, format="JPEG", quality=95)

        exported.append({
            "tileIndex": correction["tileIndex"],
            "correctionType": correction.get("correctionType"),
            "class_name": class_name,
            "image_path": target_path.relative_to(output_dir.parent).as_posix(),
        })

    return exported


def export_detector_sample(
    image_file: Path,
    case_id: str,
    detections: list[dict],
    image_width: int,
    image_height: int,
    output_dir: Path,
) -> dict | None:
    """Save full image + YOLO label file using finalImageDetections as ground truth."""
    if not detections:
        return None

    label_lines = []
    for detection in detections:
        bbox_raw = detection.get("bbox", {})
        bbox = clamp_bbox(
            bbox_raw.get("x", 0), bbox_raw.get("y", 0),
            bbox_raw.get("width", 0), bbox_raw.get("height", 0),
            image_width, image_height,
        )
        if bbox is None:
            continue
        x_c, y_c, w, h = normalize_yolo_bbox(bbox, image_width, image_height)
        label_lines.append(f"0 {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}")

    if not label_lines:
        return None

    images_dir = output_dir / "images"
    labels_dir = output_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    target_image = images_dir / f"{case_id}.jpg"
    target_label = labels_dir / f"{case_id}.txt"

    shutil.copy2(image_file, target_image)
    target_label.write_text("\n".join(label_lines) + "\n", encoding="utf-8")

    return {
        "image_path": target_image.relative_to(output_dir).as_posix(),
        "label_path": target_label.relative_to(output_dir).as_posix(),
        "tile_count": len(label_lines),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def export_feedback_dataset(args: argparse.Namespace) -> None:
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/rummikub")
    classification_output_dir = Path(args.output_dir).resolve()
    detection_output_dir = Path(args.detection_output_dir).resolve()
    manifest_path = classification_output_dir.parent / "manifest.jsonl"
    classification_output_dir.mkdir(parents=True, exist_ok=True)
    detection_output_dir.mkdir(parents=True, exist_ok=True)

    reviewed_hashes: set[str] | None = None
    used_hashes: set[str] = set()

    if args.reviewed_only:
        reviewed_hashes = get_reviewed_hashes(mongo_uri)
        print(f"Found {len(reviewed_hashes)} reviewed feedback hashes in MongoDB")

    if args.unused_only or args.mark_used:
        used_hashes = get_used_hashes(mongo_uri)

    raw_cases = load_raw_cases(RAW_CASES_DIR)
    print(f"Found {len(raw_cases)} raw cases in {RAW_CASES_DIR}")

    if not raw_cases:
        return

    exported_classifier_count = 0
    exported_detector_count = 0
    exported_hashes: list[str] = []
    skipped_count = 0

    with manifest_path.open("w", encoding="utf-8") as manifest_file:
        for image_file, case_data in raw_cases:
            case_id = image_file.stem
            corrections = case_data.get("corrections", [])
            detections = case_data.get("detections", [])
            source = case_data.get("source", "unknown")
            model_versions = case_data.get("model_versions", {})
            case_hashes = [c["feedbackHash"] for c in corrections if "feedbackHash" in c]

            if reviewed_hashes is not None and not all(h in reviewed_hashes for h in case_hashes):
                skipped_count += 1
                continue

            if args.unused_only and all(h in used_hashes for h in case_hashes):
                skipped_count += 1
                continue

            image = Image.open(image_file).convert("RGB")
            image_width, image_height = image.size

            exported_classifier = None
            exported_detection = None

            if not args.detector_only:
                samples = export_classifier_samples(image, case_id, corrections, classification_output_dir)
                if samples:
                    exported_classifier = samples
                    exported_classifier_count += len(samples)

            if not args.classifier_only:
                result = export_detector_sample(
                    image_file, case_id, detections,
                    image_width, image_height, detection_output_dir,
                )
                if result:
                    exported_detection = result
                    exported_detector_count += 1

            if not exported_classifier and not exported_detection:
                continue

            manifest_file.write(
                json.dumps(
                    {
                        "case_id": case_id,
                        "source": source,
                        "model_versions": model_versions,
                        "feedback_hashes": case_hashes,
                        "correction_types": sorted({
                            c.get("correctionType") for c in corrections if c.get("correctionType")
                        }),
                        "timestamp": case_data.get("timestamp"),
                        "classification": exported_classifier,
                        "detection": exported_detection,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

            exported_hashes.extend(case_hashes)

    if args.mark_used and exported_hashes:
        mark_hashes_used(mongo_uri, exported_hashes)
        print(f"Marked {len(exported_hashes)} feedback records as usedForTraining in MongoDB")

    print(f"Skipped {skipped_count} cases")
    print(f"Exported {exported_classifier_count} classifier crops to {classification_output_dir}")
    print(f"Exported {exported_detector_count} detector label sets to {detection_output_dir}")
    print(f"Manifest written to {manifest_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export training data from raw feedback cases.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_CLASSIFICATION_DIR),
        help="Output directory for classifier crop images (default: %(default)s)",
    )
    parser.add_argument(
        "--detection-output-dir",
        default=str(DEFAULT_DETECTION_DIR),
        help="Output directory for detector images and YOLO labels (default: %(default)s)",
    )
    parser.add_argument(
        "--classifier-only",
        action="store_true",
        help="Export only classifier crops, skip detector labels",
    )
    parser.add_argument(
        "--detector-only",
        action="store_true",
        help="Export only detector YOLO labels, skip classifier crops",
    )
    parser.add_argument(
        "--reviewed-only",
        action="store_true",
        help="Export only cases where all corrections are marked reviewed=true in MongoDB",
    )
    parser.add_argument(
        "--unused-only",
        action="store_true",
        help="Export only cases not yet fully marked usedForTraining in MongoDB",
    )
    parser.add_argument(
        "--mark-used",
        action="store_true",
        help="Mark exported feedback records as usedForTraining in MongoDB after export",
    )
    return parser.parse_args()


if __name__ == "__main__":
    export_feedback_dataset(parse_args())
