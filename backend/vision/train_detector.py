from ultralytics import YOLO

model = YOLO("yolov8n.pt")

model.train(
    data="detection_dataset/data.yaml",
    epochs=50,
    imgsz=416,
    batch=2,
    workers=0,
    device=0,
    name="rummikub_tile_detector"
)