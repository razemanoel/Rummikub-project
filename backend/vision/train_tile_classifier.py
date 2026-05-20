import os
import json
import torch
import torch.nn as nn
import torch.optim as optim

from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader, random_split, Subset

# =========================
# CONFIG
# =========================

DATASET_PATH = "classification_dataset"

BATCH_SIZE = 32
EPOCHS = 5
LEARNING_RATE = 0.0001
IMAGE_SIZE = 224

MODEL_PATH = "tile_classifier.pth"
CLASS_NAMES_PATH = "class_names.json"

FINE_TUNE_FROM_EXISTING_MODEL = True

DEVICE = torch.device("cpu")

print(f"Using device: {DEVICE}")

# =========================
# TRANSFORMS
# =========================

train_transforms = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.RandomRotation(360),

    transforms.ColorJitter(
        brightness=0.25,
        contrast=0.25,
        saturation=0.2
    ),

    transforms.RandomAffine(
        degrees=0,
        translate=(0.05, 0.05),
        scale=(0.9, 1.1)
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

val_transforms = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])
# =========================
# DATASET
# =========================

TRAIN_DATASET_PATH = "classification_dataset_split/train"
VAL_DATASET_PATH = "classification_dataset_split/val"

train_dataset = datasets.ImageFolder(
    root=TRAIN_DATASET_PATH,
    transform=train_transforms
)

val_dataset = datasets.ImageFolder(
    root=VAL_DATASET_PATH,
    transform=val_transforms
)

class_names = train_dataset.classes
num_classes = len(class_names)

with open(CLASS_NAMES_PATH, "w", encoding="utf-8") as f:
    json.dump(class_names, f, ensure_ascii=False, indent=2)

print("\nClasses:")
for idx, name in enumerate(class_names):
    print(f"{idx}: {name}")

print(f"\nTotal classes: {num_classes}")
print(f"Train images: {len(train_dataset)}")
print(f"Validation images: {len(val_dataset)}")

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False
)

# =========================
# MODEL
# =========================

model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

model.fc = nn.Linear(
    model.fc.in_features,
    num_classes
)

if FINE_TUNE_FROM_EXISTING_MODEL and os.path.exists(MODEL_PATH):
    print(f"\nLoading existing model from {MODEL_PATH} for fine-tuning...")

    try:
        model.load_state_dict(
            torch.load(MODEL_PATH, map_location=DEVICE)
        )
        print("Existing model loaded successfully.")
    except RuntimeError as e:
        print("\nCould not load existing model.")
        print("This usually happens if the number/order of classes changed.")
        print("Training from ImageNet weights instead.")
        print(e)

model = model.to(DEVICE)

# =========================
# LOSS + OPTIMIZER
# =========================

criterion = nn.CrossEntropyLoss()

optimizer = optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE
)

# =========================
# TRAIN LOOP
# =========================

best_accuracy = 0.0

for epoch in range(EPOCHS):

    print(f"\nEpoch {epoch + 1}/{EPOCHS}")

    # ================= TRAIN =================

    model.train()

    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:

        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad()

        outputs = model(images)

        loss = criterion(outputs, labels)

        loss.backward()

        optimizer.step()

        running_loss += loss.item()

        _, predicted = torch.max(outputs, 1)

        total += labels.size(0)
        correct += (predicted == labels).sum().item()

    train_accuracy = 100 * correct / total
    train_loss = running_loss / len(train_loader)

    # ================= VALIDATION =================

    model.eval()

    correct = 0
    total = 0

    with torch.no_grad():

        for images, labels in val_loader:

            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            outputs = model(images)

            _, predicted = torch.max(outputs, 1)

            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    val_accuracy = 100 * correct / total

    print(f"Train Loss: {train_loss:.4f}")
    print(f"Train Accuracy: {train_accuracy:.2f}%")
    print(f"Validation Accuracy: {val_accuracy:.2f}%")

    # save best model
    if val_accuracy > best_accuracy:

        best_accuracy = val_accuracy

        torch.save(
            model.state_dict(),
            MODEL_PATH
        )

        print("Best model saved!")

print("\nTraining complete!")
print(f"Best Validation Accuracy: {best_accuracy:.2f}%")
print(f"Saved model: {MODEL_PATH}")
print(f"Saved classes: {CLASS_NAMES_PATH}")