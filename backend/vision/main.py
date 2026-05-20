import os
import tempfile
from typing import Optional

from fastapi import FastAPI, File, UploadFile

from backend.vision.models import (
    BoardValidationRequest,
    BoardValidationResponse,
    GameState,
    GameStateValidationResponse,
)
from backend.vision.logic import validate_board, validate_game_state
from backend.vision.solver_ilp import solve_max_rack_tiles_ilp
from backend.vision.vision_pipeline import analyze_image
from backend.vision.board_reconstructor import (
    build_game_state,
    sort_rack_detections,
    group_detections_into_rows,
)


app = FastAPI(title="Rummikub Vision Service", version="0.4.0")


@app.get("/health")
def health():
    return {"status": "ok"}


def save_upload_to_temp_file(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(upload.file.read())
        return temp_file.name


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
        if myBoard is not None:
            my_board_path = save_upload_to_temp_file(myBoard)
            temp_files.append(my_board_path)

            rack_detections = analyze_image(my_board_path)
            rack_detections = sort_rack_detections(rack_detections)

            rack_rows = group_detections_into_rows(
                rack_detections,
                row_tolerance_ratio=0.45,
            )

        if sharedBoard is not None:
            shared_board_path = save_upload_to_temp_file(sharedBoard)
            temp_files.append(shared_board_path)

            board_detections = analyze_image(shared_board_path)

        game_state = build_game_state(
            rack_detections=rack_detections,
            board_detections=board_detections,
        )

        is_valid, invalid_sets = validate_game_state(game_state)

        return {
            "status": "success",
            "message": "Images analyzed successfully",

            "rackDetections": rack_detections,

            "rackRows": [
                [
                    {
                        "tile": detection["tile"],
                        "class_name": detection["class_name"],
                        "bbox": detection["bbox"],
                        "confidence": detection["combined_confidence"],
                    }
                    for detection in row
                ]
                for row in rack_rows
            ],

            "boardDetections": board_detections,

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