import argparse
import json
import os
import shutil
from pathlib import Path

from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = BASE_DIR / "exported_feedback_dataset" / "classification"
DEFAULT_DETECTION_OUTPUT_DIR = BASE_DIR / "exported_feedback_dataset" / "detection"


def build_query(reviewed_only: bool, unused_only: bool) -> dict:
    query: dict = {}

    if reviewed_only:
        query["reviewed"] = True

    if unused_only:
        query["usedForTraining"] = False

    return query


def build_class_name(record: dict) -> str:
    corrected_tile = record.get("correctedTile", {})

    if corrected_tile.get("is_joker"):
        return "joker"

    return f"{corrected_tile.get('color')}_{corrected_tile.get('value')}"


def copy_classification_artifact(record: dict, output_dir: Path) -> dict | None:
    image_crop_path = record.get("imageCropPath")

    if not image_crop_path:
        return None

    source_path = BASE_DIR / image_crop_path
    if not source_path.exists():
        return None

    class_name = build_class_name(record)
    target_dir = output_dir / class_name
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / source_path.name
    shutil.copy2(source_path, target_path)

    return {
        "class_name": class_name,
        "image_path": target_path.relative_to(output_dir.parent).as_posix(),
    }


def copy_detection_artifacts(
    record: dict,
    output_dir: Path,
    exported_detection_paths: set[str],
) -> dict | None:
    full_image_path = record.get("fullImagePath")
    yolo_label_path = record.get("yoloLabelPath")

    if not full_image_path or not yolo_label_path:
        return None

    source_image_path = BASE_DIR / full_image_path
    source_label_path = BASE_DIR / yolo_label_path

    if not source_image_path.exists() or not source_label_path.exists():
        return None

    images_dir = output_dir / "images"
    labels_dir = output_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    target_image_path = images_dir / source_image_path.name
    target_label_path = labels_dir / source_label_path.name

    if full_image_path not in exported_detection_paths:
        shutil.copy2(source_image_path, target_image_path)
        exported_detection_paths.add(full_image_path)

    if yolo_label_path not in exported_detection_paths:
        shutil.copy2(source_label_path, target_label_path)
        exported_detection_paths.add(yolo_label_path)

    return {
        "image_path": target_image_path.relative_to(output_dir).as_posix(),
        "label_path": target_label_path.relative_to(output_dir).as_posix(),
    }


def export_feedback_dataset(args: argparse.Namespace) -> None:
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/rummikub")
    classification_output_dir = Path(args.output_dir).resolve()
    detection_output_dir = Path(args.detection_output_dir).resolve()
    classification_output_dir.mkdir(parents=True, exist_ok=True)
    detection_output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = classification_output_dir.parent / "manifest.jsonl"

    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    collection = db["vision_feedback"]

    query = build_query(args.reviewed_only, args.unused_only)
    records = list(collection.find(query).sort("createdAt", 1))

    exported_ids: list = []
    exported_classifier_count = 0
    exported_detector_count = 0
    exported_detection_paths: set[str] = set()

    with manifest_path.open("w", encoding="utf-8") as manifest_file:
        for record in records:
            exported_classifier = None
            exported_detection = None

            if not args.detector_only:
                exported_classifier = copy_classification_artifact(record, classification_output_dir)

            if not args.classifier_only:
                exported_detection = copy_detection_artifacts(
                    record,
                    detection_output_dir,
                    exported_detection_paths,
                )

            if not exported_classifier and not exported_detection:
                continue

            manifest_file.write(
                json.dumps(
                    {
                        "id": str(record.get("_id")),
                        "feedbackHash": record.get("feedbackHash"),
                        "source": record.get("source"),
                        "correctionType": record.get("correctionType"),
                        "affectsClassifier": record.get("affectsClassifier", False),
                        "affectsDetector": record.get("affectsDetector", False),
                        "classifierModelVersion": record.get("classifierModelVersion"),
                        "detectorModelVersion": record.get("detectorModelVersion"),
                        "classification": exported_classifier,
                        "detection": exported_detection,
                        "createdAt": record.get("createdAt").isoformat() if record.get("createdAt") else None,
                    },
                    ensure_ascii=True,
                )
                + "\n"
            )

            exported_ids.append(record["_id"])
            if exported_classifier:
                exported_classifier_count += 1
            if exported_detection:
                exported_detector_count += 1

    if args.mark_used and exported_ids:
        collection.update_many(
            {"_id": {"$in": exported_ids}},
            {"$set": {"usedForTraining": True}},
        )

    client.close()

    print(
        f"Exported {exported_classifier_count} classifier samples to {classification_output_dir}"
    )
    print(
        f"Exported {exported_detector_count} detector samples to {detection_output_dir}"
    )
    print(f"Manifest written to {manifest_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export reviewed Rummikub feedback crops")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory where the exported classification dataset will be written",
    )
    parser.add_argument(
        "--detection-output-dir",
        default=str(DEFAULT_DETECTION_OUTPUT_DIR),
        help="Directory where detector images and YOLO labels will be written",
    )
    parser.add_argument(
        "--classifier-only",
        action="store_true",
        help="Export only classifier feedback samples",
    )
    parser.add_argument(
        "--detector-only",
        action="store_true",
        help="Export only detector feedback samples",
    )
    parser.add_argument(
        "--reviewed-only",
        action="store_true",
        help="Export only feedback that has already been manually reviewed",
    )
    parser.add_argument(
        "--unused-only",
        action="store_true",
        help="Export only feedback samples that have not been marked usedForTraining",
    )
    parser.add_argument(
        "--mark-used",
        action="store_true",
        help="Mark exported feedback records as usedForTraining in MongoDB",
    )
    return parser.parse_args()


if __name__ == "__main__":
    export_feedback_dataset(parse_args())