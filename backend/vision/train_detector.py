import argparse
from pathlib import Path

from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DEFAULT_WEIGHTS_PATH = MODELS_DIR / "detector_best.pt"
FALLBACK_WEIGHTS_PATH = BASE_DIR / "yolov8n.pt"
DEFAULT_DATA_PATH = BASE_DIR / "detector_dataset_merged" / "data.yaml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train or fine-tune the tile detector")
    parser.add_argument(
        "--data",
        default=str(DEFAULT_DATA_PATH),
        help="Path to the YOLO data.yaml file for a prepared single-class detector dataset",
    )
    parser.add_argument(
        "--weights",
        default=str(DEFAULT_WEIGHTS_PATH if DEFAULT_WEIGHTS_PATH.exists() else FALLBACK_WEIGHTS_PATH),
        help="Starting weights for training. Defaults to detector_best.pt when available.",
    )
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=416)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--device", default="0")
    parser.add_argument("--name", default="rummikub_tile_detector")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_path = Path(args.data).resolve()

    if not data_path.exists():
        raise FileNotFoundError(
            f"Detector data YAML not found: {data_path}. "
            "Prepare a converted detector dataset first."
        )

    model = YOLO(str(Path(args.weights)))
    model.train(
        data=str(data_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        name=args.name,
    )


if __name__ == "__main__":
    main()