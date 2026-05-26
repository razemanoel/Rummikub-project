import argparse
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
BASE_DATASET_DIR = BASE_DIR / "detection_dataset"
FEEDBACK_DATASET_DIR = BASE_DIR / "feedback_dataset" / "detection"
MODELS_DIR = BASE_DIR / "models"
MODEL_OUTPUT_PATH = MODELS_DIR / "detector_feedback.pt"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare manual YOLO detector retraining with offline feedback data"
    )
    parser.add_argument(
        "--base-dataset-dir",
        default=str(BASE_DATASET_DIR),
        help="Directory containing the baseline detector training dataset",
    )
    parser.add_argument(
        "--feedback-dataset-dir",
        default=str(FEEDBACK_DATASET_DIR),
        help="Directory containing exported feedback detector images and labels",
    )
    parser.add_argument(
        "--output-model",
        default=str(MODEL_OUTPUT_PATH),
        help="Path where a newly trained detector should be saved",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    print("Detector retraining is intentionally offline and manual.")
    print(f"Base dataset: {Path(args.base_dataset_dir).resolve()}")
    print(f"Feedback dataset: {Path(args.feedback_dataset_dir).resolve()}")
    print(f"Output model: {Path(args.output_model).resolve()}")
    print()
    print("TODO:")
    print("1. Merge the baseline detector dataset with exported feedback images and YOLO labels.")
    print("2. Generate or update the YOLO dataset YAML file for the merged dataset.")
    print("3. Train a new detector model and save it to the output path above.")
    print("4. Validate the new model separately before promoting it to production.")


if __name__ == "__main__":
    main()
