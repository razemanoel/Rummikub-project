import json
import argparse
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms, models
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

DETECTOR_PATH = BASE_DIR.parent.parent / "runs" / "detect" / "rummikub_tile_detector-3" / "weights" / "best.pt"
CLASSIFIER_PATH = BASE_DIR / "tile_classifier.pth"
CLASS_NAMES_PATH = BASE_DIR / "class_names.json"

IMAGE_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


classifier_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


def load_classifier():
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(class_names))

    model.load_state_dict(torch.load(CLASSIFIER_PATH, map_location=DEVICE))
    model.to(DEVICE)
    model.eval()

    return model, class_names


def classify_crop(crop, classifier, class_names):
    crop_tensor = classifier_transform(crop).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = classifier(crop_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)

    class_name = class_names[predicted_idx.item()]
    confidence = confidence.item()

    return class_name, confidence


def parse_tile_class(class_name):
    if class_name == "joker":
        return {
            "type": "joker",
            "color": None,
            "number": None
        }

    color, number = class_name.rsplit("_", 1)

    return {
        "type": "tile",
        "color": color,
        "number": int(number)
    }


def predict_board(image_path, detector_conf=0.4):
    image_path = Path(image_path)

    detector = YOLO(str(DETECTOR_PATH))
    classifier, class_names = load_classifier()

    image = Image.open(image_path).convert("RGB")

    results = detector.predict(
        source=str(image_path),
        conf=detector_conf,
        verbose=False
    )

    detected_tiles = []

    for result in results:
        boxes = result.boxes

        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detector_confidence = float(box.conf[0])

            crop = image.crop((x1, y1, x2, y2))

            class_name, classifier_confidence = classify_crop(
                crop,
                classifier,
                class_names
            )

            tile_data = parse_tile_class(class_name)

            detected_tiles.append({
                "class_name": class_name,
                "type": tile_data["type"],
                "color": tile_data["color"],
                "number": tile_data["number"],
                "bbox": {
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                },
                "detector_confidence": round(detector_confidence, 4),
                "classifier_confidence": round(classifier_confidence, 4),
            })

    return detected_tiles


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="Path to board image")
    parser.add_argument("--conf", type=float, default=0.4, help="Detector confidence threshold")
    args = parser.parse_args()

    tiles = predict_board(args.image, detector_conf=args.conf)

    print(json.dumps(tiles, indent=2, ensure_ascii=False))
    print(f"\nDetected tiles: {len(tiles)}")


if __name__ == "__main__":
    main()