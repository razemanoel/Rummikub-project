from fastapi import FastAPI, UploadFile, File
from backend.models import (
    BoardValidationRequest,
    BoardValidationResponse,
    GameState,
    GameStateValidationResponse,
    DetectBoardResponse
)
from backend.logic import validate_board, validate_game_state
from backend.vision import (
    load_image_from_upload,
    detect_tile_regions,
    sort_regions_left_to_right,
    remove_contained_regions
)
from backend.models import ClassifyFreeTilesResponse
from backend.vision import classify_free_tiles

app = FastAPI(title="Rummikub Backend", version="0.2.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/validate-board", response_model=BoardValidationResponse)
def validate_board_endpoint(data: BoardValidationRequest):
    is_valid, invalid_sets = validate_board(data.board)

    if not is_valid:
        return BoardValidationResponse(
            status="error",
            message="Some sets on the board are illegal",
            invalid_sets=invalid_sets
        )

    return BoardValidationResponse(
        status="success",
        message="All sets on the board are valid",
        invalid_sets=[]
    )


@app.post("/validate-game-state", response_model=GameStateValidationResponse)
def validate_game_state_endpoint(data: GameState):
    is_valid, invalid_sets = validate_game_state(data)

    if not is_valid:
        return GameStateValidationResponse(
            status="error",
            message="Game state is invalid",
            invalid_sets=invalid_sets
        )

    return GameStateValidationResponse(
        status="success",
        message="Game state is valid",
        invalid_sets=[]
    )


@app.post("/detect-board", response_model=DetectBoardResponse)
async def detect_board(file: UploadFile = File(...)):
    image = await load_image_from_upload(file)
    regions = detect_tile_regions(image)
    regions = remove_contained_regions(regions)
    regions = sort_regions_left_to_right(regions)

    return DetectBoardResponse(
        status="success",
        tile_count=len(regions),
        regions=regions
    )

@app.post("/classify-free-tiles", response_model=ClassifyFreeTilesResponse)
async def classify_free_tiles_endpoint(file: UploadFile = File(...)):
    image = await load_image_from_upload(file)

    regions = detect_tile_regions(image)
    regions = remove_contained_regions(regions)
    regions = sort_regions_left_to_right(regions)

    tiles = classify_free_tiles(image, regions)

    return ClassifyFreeTilesResponse(
        status="success",
        tile_count=len(tiles),
        tiles=tiles
    )