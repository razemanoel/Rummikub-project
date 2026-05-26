import json
import random
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
BASE_DATASET_DIR = BASE_DIR / "classification_dataset"
FEEDBACK_DATASET_DIR = BASE_DIR / "feedback_dataset" / "classification"

MODEL_INPUT_PATH = MODELS_DIR / "tile_classifier.pth"
MODEL_OUTPUT_PATH = MODELS_DIR / "tile_classifier_feedback.pth"
CLASS_NAMES_OUTPUT_PATH = MODELS_DIR / "class_names_feedback.json"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 5
LEARNING_RATE = 0.0001
VALIDATION_SPLIT = 0.2
RANDOM_SEED = 42

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class IndexedTileDataset(Dataset):
    def __init__(
        self,
        samples: list[tuple[Path, int]],
        indices: list[int],
        transform,
    ):
        self.samples = samples
        self.indices = indices
        self.transform = transform

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, index: int):
        sample_index = self.indices[index]
        image_path, class_index = self.samples[sample_index]
        image = Image.open(image_path).convert("RGB")

        if self.transform is not None:
            image = self.transform(image)

        return image, class_index


def list_class_names(dataset_roots: list[Path]) -> list[str]:
    class_names = set()

    for root in dataset_roots:
        if not root.exists():
            continue

        for child in root.iterdir():
            if child.is_dir():
                class_names.add(child.name)

    return sorted(class_names)


def collect_samples(dataset_roots: list[Path], class_to_index: dict[str, int]) -> list[tuple[Path, int]]:
    samples: list[tuple[Path, int]] = []

    for root in dataset_roots:
        if not root.exists():
            continue

        for class_name, class_index in class_to_index.items():
            class_dir = root / class_name
            if not class_dir.exists():
                continue

            for image_path in class_dir.rglob("*"):
                if image_path.is_file() and image_path.suffix.lower() in IMAGE_EXTENSIONS:
                    samples.append((image_path, class_index))

    return samples


def build_datasets() -> tuple[Dataset, Dataset, list[str]]:
    dataset_roots = [BASE_DATASET_DIR, FEEDBACK_DATASET_DIR]
    class_names = list_class_names(dataset_roots)

    if not class_names:
        raise RuntimeError("No classification classes were found in the base or feedback datasets")

    class_to_index = {name: index for index, name in enumerate(class_names)}
    samples = collect_samples(dataset_roots, class_to_index)

    if not samples:
        raise RuntimeError("No training samples were found in the base or feedback datasets")

    random.Random(RANDOM_SEED).shuffle(samples)

    train_transforms = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomRotation(360),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.2),
        transforms.RandomAffine(degrees=0, translate=(0.05, 0.05), scale=(0.9, 1.1)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    val_transforms = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    val_size = max(1, int(len(samples) * VALIDATION_SPLIT))
    train_size = len(samples) - val_size

    if train_size <= 0:
        raise RuntimeError("Not enough samples to build train/validation splits")

    indices = list(range(len(samples)))
    random.Random(RANDOM_SEED).shuffle(indices)

    train_indices = indices[:train_size]
    val_indices = indices[train_size:]

    train_dataset = IndexedTileDataset(samples, train_indices, train_transforms)
    val_dataset = IndexedTileDataset(samples, val_indices, val_transforms)

    return train_dataset, val_dataset, class_names


def build_model(num_classes: int) -> nn.Module:
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, num_classes)

    if MODEL_INPUT_PATH.exists():
        try:
            model.load_state_dict(torch.load(MODEL_INPUT_PATH, map_location=DEVICE))
            print(f"Loaded base classifier weights from {MODEL_INPUT_PATH}")
        except RuntimeError as error:
            print("Base classifier weights could not be loaded directly; training from ImageNet weights instead.")
            print(error)

    return model.to(DEVICE)


def evaluate(model: nn.Module, loader: DataLoader) -> float:
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            outputs = model(images)
            _, predicted = torch.max(outputs, 1)

            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    return 100 * correct / max(total, 1)


def main() -> None:
    train_dataset, val_dataset, class_names = build_datasets()

    with CLASS_NAMES_OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(class_names, file, ensure_ascii=True, indent=2)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = build_model(len(class_names))
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    best_accuracy = 0.0

    print(f"Using device: {DEVICE}")
    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")
    print(f"Classes: {len(class_names)}")

    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0

        for images, labels in train_loader:
            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()

        val_accuracy = evaluate(model, val_loader)
        train_loss = running_loss / max(len(train_loader), 1)

        print(f"Epoch {epoch + 1}/{EPOCHS}")
        print(f"Train Loss: {train_loss:.4f}")
        print(f"Validation Accuracy: {val_accuracy:.2f}%")

        if val_accuracy > best_accuracy:
            best_accuracy = val_accuracy
            torch.save(model.state_dict(), MODEL_OUTPUT_PATH)
            print(f"Saved improved feedback model to {MODEL_OUTPUT_PATH}")

    print(f"Best validation accuracy: {best_accuracy:.2f}%")
    print(f"Saved classes: {CLASS_NAMES_OUTPUT_PATH}")


if __name__ == "__main__":
    main()