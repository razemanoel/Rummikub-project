import json
import threading
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from backend.logic.models import TileColor


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

CLASSIFIER_PATH = MODELS_DIR / "tile_classifier.pth"
CLASS_NAMES_PATH = MODELS_DIR / "class_names.json"

IMAGE_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


_classifier_model = None
_class_names = None
_classifier_lock = threading.Lock()


classifier_transform = transforms.Compose(
    [
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


def load_class_names() -> list[str]:
    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(f"Class names file not found: {CLASS_NAMES_PATH}")

    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def get_classifier_model():
    global _classifier_model, _class_names

    if _classifier_model is None:
        if not CLASSIFIER_PATH.exists():
            raise FileNotFoundError(f"Classifier model not found: {CLASSIFIER_PATH}")

        _class_names = load_class_names()

        model = models.resnet18(weights=None)
        model.fc = nn.Linear(model.fc.in_features, len(_class_names))

        model.load_state_dict(torch.load(CLASSIFIER_PATH, map_location=DEVICE))
        model.to(DEVICE)
        model.eval()

        _classifier_model = model

    return _classifier_model, _class_names


def preload_classifier_model():
    return get_classifier_model()


def parse_class_name(class_name: str) -> dict[str, Any]:
    if class_name == "joker":
        return {
            "class_name": class_name,
            "value": None,
            "color": None,
            "is_joker": True,
        }

    try:
        color_name, value_text = class_name.rsplit("_", 1)
        value = int(value_text)
        TileColor(color_name)
    except Exception as error:
        raise ValueError(f"Invalid classifier class name: {class_name}") from error

    return {
        "class_name": class_name,
        "value": value,
        "color": color_name,
        "is_joker": False,
    }


def classify_tile_crops(crops: list[Image.Image]) -> list[dict[str, Any]]:
    if not crops:
        return []

    model, class_names = get_classifier_model()

    crop_tensor = torch.stack(
        [classifier_transform(crop.convert("RGB")) for crop in crops]
    ).to(DEVICE)

    with _classifier_lock:
        with torch.no_grad():
            outputs = model(crop_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        confidences, predicted_indices = torch.max(probabilities, 1)

    results: list[dict[str, Any]] = []

    for confidence, predicted_index in zip(confidences, predicted_indices):
        class_name = class_names[predicted_index.item()]
        parsed = parse_class_name(class_name)
        results.append(
            {
                **parsed,
                "classifier_confidence": round(float(confidence.item()), 4),
            }
        )

    return results