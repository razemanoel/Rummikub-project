import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

from backend.vision.detector_dataset_utils import prepare_detector_dataset, summarize_sources


BASE_DIR = Path(__file__).resolve().parent
BASE_DATASET_DIR = BASE_DIR / "detector_dataset"
FEEDBACK_DATASET_DIR = BASE_DIR / "feedback_dataset" / "detection"
MODELS_DIR = BASE_DIR / "models"
MODEL_OUTPUT_PATH = MODELS_DIR / "detector_finetuned.pt"
PREPARED_DATASET_DIR = BASE_DIR / "detector_dataset_merged"
DEFAULT_WEIGHTS_PATH = MODELS_DIR / "detector_best.pt"
FALLBACK_WEIGHTS_PATH = BASE_DIR / "yolov8n.pt"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare and fine-tune the YOLO tile detector with merged datasets"
    )
    parser.add_argument(
        "--base-dataset-dir",
        default=str(BASE_DATASET_DIR),
        help="Directory containing the baseline detector training dataset",
    )
    parser.add_argument(
        "--extra-dataset-dir",
        action="append",
        default=[],
        help=(
            "Additional detector datasets to merge. "
            "Each dataset may use YOLO boxes or YOLO segmentation polygons."
        ),
    )
    parser.add_argument(
        "--feedback-dataset-dir",
        default=str(FEEDBACK_DATASET_DIR),
        help="Directory containing exported feedback detector images and labels",
    )
    parser.add_argument(
        "--prepared-dataset-dir",
        default=str(PREPARED_DATASET_DIR),
        help="Directory where the merged single-class detector dataset will be written",
    )
    parser.add_argument(
        "--weights",
        default=str(DEFAULT_WEIGHTS_PATH if DEFAULT_WEIGHTS_PATH.exists() else FALLBACK_WEIGHTS_PATH),
        help="Starting checkpoint for fine-tuning. Defaults to detector_best.pt when available.",
    )
    parser.add_argument(
        "--output-model",
        default=str(MODEL_OUTPUT_PATH),
        help="Path where the fine-tuned detector checkpoint should be copied",
    )
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=416)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--device", default="0")
    parser.add_argument("--run-name", default="rummikub_tile_detector_finetune")
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Only build the merged detector dataset without running YOLO training",
    )
    parser.add_argument(
        "--skip-feedback",
        action="store_true",
        help="Do not merge backend/vision/feedback_dataset/detection even if it exists",
    )
    parser.add_argument(
        "--overwrite-prepared",
        action="store_true",
        help="Delete and rebuild the prepared dataset directory if it already exists",
    )
    return parser.parse_args()


def build_source_datasets(args: argparse.Namespace) -> list[tuple[str, Path]]:
    source_datasets: list[tuple[str, Path]] = [("base", Path(args.base_dataset_dir))]

    for index, extra_dataset_dir in enumerate(args.extra_dataset_dir, start=1):
        extra_path = Path(extra_dataset_dir)
        source_datasets.append((f"extra_{index}_{extra_path.name}", extra_path))

    feedback_path = Path(args.feedback_dataset_dir)
    if not args.skip_feedback and feedback_path.exists():
        source_datasets.append(("feedback", feedback_path))

    return source_datasets


def copy_best_checkpoint(trained_model: YOLO, output_model_path: Path) -> Path:
    best_path = Path(trained_model.trainer.best)
    if not best_path.exists():
        raise FileNotFoundError(f"Training finished, but best checkpoint was not found: {best_path}")

    output_model_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_path, output_model_path)
    return output_model_path


def main() -> None:
    args = parse_args()
    prepared_dataset_dir = Path(args.prepared_dataset_dir).resolve()
    source_datasets = build_source_datasets(args)

    print("Preparing merged detector dataset from:")
    for source_line in summarize_sources(source_datasets):
        print(f"- {source_line}")

    summary = prepare_detector_dataset(
        source_datasets=source_datasets,
        output_dir=prepared_dataset_dir,
        overwrite=args.overwrite_prepared,
    )

    print(f"Prepared dataset: {prepared_dataset_dir}")
    for split_name, split_summary in summary.items():
        print(
            f"- {split_name}: "
            f"images={split_summary['images']} "
            f"labels={split_summary['labels']} "
            f"annotations={split_summary['annotations']}"
        )

    if args.prepare_only:
        print("Dataset preparation complete. Skipping YOLO fine-tuning because --prepare-only was set.")
        return

    model = YOLO(str(Path(args.weights).resolve()))
    model.train(
        data=str(prepared_dataset_dir / "data.yaml"),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        name=args.run_name,
    )

    output_model_path = copy_best_checkpoint(model, Path(args.output_model).resolve())
    print(f"Fine-tuned detector copied to: {output_model_path}")


if __name__ == "__main__":
    main()
