import asyncio
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from backend.logic.models import (
    BoardValidationRequest,
    BoardValidationResponse,
    FeedbackArtifactResponse,
    GameState,
    GameStateValidationResponse,
)
from backend.logic.logic import validate_board, validate_game_state
from backend.logic.solver_ilp import solve_max_rack_tiles_ilp
from backend.vision.classifier_service import preload_classifier_model
from backend.vision.vision_pipeline import analyze_image, analyze_rack_image
from backend.vision.detector_service import preload_detector_model
from backend.vision.feedback_service import (
    generate_feedback_artifacts,
    get_model_versions,
    parse_feedback_artifact_request,
)
from backend.vision.board_reconstructor import (
    build_game_state,
    sort_rack_detections,
    group_detections_into_rows,
)


app = FastAPI(title="Rummikub Vision Service", version="0.4.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def preload_vision_models() -> None:
    await asyncio.to_thread(preload_detector_model)

    await asyncio.to_thread(preload_classifier_model)


_DEBUG_SAVE_DIR = (
    Path(__file__).resolve().parent / "vision" / "feedback_dataset" / "debug_images"
    if os.getenv("VISION_DEBUG_SAVE_IMAGES")
    else None
)


def _debug_save_board_image(src_path: str) -> None:
    if _DEBUG_SAVE_DIR is None:
        return
    _DEBUG_SAVE_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    dest = _DEBUG_SAVE_DIR / f"{ts}_{uuid4().hex[:8]}.jpg"
    shutil.copy2(src_path, dest)


def save_upload_to_temp_file(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(upload.file.read())
        return temp_file.name


def xyxy_to_bbox(bbox: dict[str, float]) -> dict[str, float]:
    return {
        "x": round(float(bbox["x1"]), 2),
        "y": round(float(bbox["y1"]), 2),
        "width": round(float(bbox["x2"] - bbox["x1"]), 2),
        "height": round(float(bbox["y2"] - bbox["y1"]), 2),
    }


def to_review_detection(detection: dict, source: str) -> dict:
    return {
        "index": detection["index"],
        "source": source,
        "tile": detection["tile"],
        "originalPrediction": detection["tile"],
        "confidence": detection["combined_confidence"],
        "bbox": xyxy_to_bbox(detection["bbox"]),
    }


def run_rack_analysis(image_path: str) -> tuple[list[dict], list[list[dict]]]:
    rack_detections = analyze_rack_image(
        image_path,
        source="rack",
    )
    rack_detections = sort_rack_detections(rack_detections)
    rack_rows = group_detections_into_rows(
        rack_detections,
        row_tolerance_ratio=0.45,
    )
    return rack_detections, rack_rows


def run_board_analysis(image_path: str) -> list[dict]:
    board_detections = analyze_image(
        image_path,
        source="board",
    )
    return board_detections


@app.post("/classify-tiles")
async def classify_tiles_endpoint(file: UploadFile = File(...)):
    image_path = save_upload_to_temp_file(file)

    try:
        detections = analyze_image(image_path)

        return {
            "status": "success",
            "message": "Tiles classified successfully",
            "tiles": [
                {
                    "tile_number": detection["tile"]["value"],
                    "tile_color": detection["tile"]["color"],
                    "is_joker": detection["tile"]["is_joker"],
                    "confidence": detection["combined_confidence"],
                    "class_name": detection["class_name"],
                    "bbox": detection["bbox"],
                    "detector_confidence": detection["detector_confidence"],
                    "classifier_confidence": detection["classifier_confidence"],
                }
                for detection in detections
            ],
        }
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


@app.post("/analyze")
async def analyze_endpoint(
    myBoard: Optional[UploadFile] = File(None),
    sharedBoard: Optional[UploadFile] = File(None),
):
    rack_detections = []
    board_detections = []
    rack_rows = []

    temp_files = []

    try:
        rack_task = None
        board_task = None

        if myBoard is not None:
            my_board_path = save_upload_to_temp_file(myBoard)
            temp_files.append(my_board_path)
            rack_task = asyncio.to_thread(
                run_rack_analysis,
                my_board_path,
            )

        if sharedBoard is not None:
            shared_board_path = save_upload_to_temp_file(sharedBoard)
            temp_files.append(shared_board_path)
            _debug_save_board_image(shared_board_path)
            board_task = asyncio.to_thread(
                run_board_analysis,
                shared_board_path,
            )

        if rack_task is not None and board_task is not None:
            (rack_detections, rack_rows), board_detections = await asyncio.gather(
                rack_task,
                board_task,
            )
        elif rack_task is not None:
            rack_detections, rack_rows = await rack_task
        elif board_task is not None:
            board_detections = await board_task

        game_state = build_game_state(
            rack_detections=rack_detections,
            board_detections=board_detections,
        )

        is_valid, invalid_sets = validate_game_state(game_state)

        return {
            "status": "success",
            "message": "Images analyzed successfully",
            **get_model_versions(),

            "rackDetections": [
                to_review_detection(detection, "rack")
                for detection in rack_detections
            ],

            "rackRows": [
                [
                    {
                        "tile": detection["tile"],
                        "class_name": detection["class_name"],
                        "bbox": xyxy_to_bbox(detection["bbox"]),
                        "confidence": detection["combined_confidence"],
                    }
                    for detection in row
                ]
                for row in rack_rows
            ],

            "boardDetections": [
                to_review_detection(detection, "board")
                for detection in board_detections
            ],

            "gameState": game_state.model_dump(mode="json"),

            "validation": {
                "status": "success" if is_valid else "error",
                "invalid_sets": [
                    item.model_dump(mode="json")
                    for item in invalid_sets
                ],
            },
        }

    finally:
        for path in temp_files:
            if os.path.exists(path):
                os.remove(path)


@app.post("/feedback/artifacts", response_model=FeedbackArtifactResponse)
async def feedback_artifacts_endpoint(
    feedback: str = Form(...),
    rackImage: Optional[UploadFile] = File(None),
    boardImage: Optional[UploadFile] = File(None),
):
    temp_files = []

    try:
        try:
            feedback_request = parse_feedback_artifact_request(feedback)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        rack_image_path = None
        board_image_path = None

        if rackImage is not None:
            rack_image_path = save_upload_to_temp_file(rackImage)
            temp_files.append(rack_image_path)

        if boardImage is not None:
            board_image_path = save_upload_to_temp_file(boardImage)
            temp_files.append(board_image_path)

        artifacts = generate_feedback_artifacts(
            feedback_request,
            rack_image_path=rack_image_path,
            board_image_path=board_image_path,
        )

        return FeedbackArtifactResponse(
            status="success",
            message="Feedback artifacts processed successfully",
            artifacts=artifacts,
        )
    finally:
        for path in temp_files:
            if os.path.exists(path):
                os.remove(path)


@app.post("/validate-board", response_model=BoardValidationResponse)
def validate_board_endpoint(data: BoardValidationRequest):
    is_valid, invalid_sets = validate_board(data.board)

    if not is_valid:
        return BoardValidationResponse(
            status="error",
            message="Some sets on the board are illegal",
            invalid_sets=invalid_sets,
        )

    return BoardValidationResponse(
        status="success",
        message="All sets on the board are valid",
        invalid_sets=[],
    )


@app.post("/validate-game-state", response_model=GameStateValidationResponse)
def validate_game_state_endpoint(data: GameState):
    is_valid, invalid_sets = validate_game_state(data)

    if not is_valid:
        return GameStateValidationResponse(
            status="error",
            message="Some sets on the board are illegal",
            invalid_sets=invalid_sets,
        )

    return GameStateValidationResponse(
        status="success",
        message="All sets on the board are valid",
        invalid_sets=[],
    )

    
@app.post("/solve-ilp")
def solve_ilp_endpoint(data: GameState):
    return solve_max_rack_tiles_ilp(data)