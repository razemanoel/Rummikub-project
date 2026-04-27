from fastapi import FastAPI, UploadFile, File
from backend.vision.models import (
    BoardValidationRequest,
    BoardValidationResponse,
    GameState,
    GameStateValidationResponse,
    DetectBoardResponse,
    ClassifyFreeTilesResponse,
    GenerateMovesResponse,
)
from backend.vision.logic import validate_board, validate_game_state
from backend.vision.generator import generate_possible_moves
from backend.vision.vision import (
    load_image_from_upload,
    detect_tile_regions,
    sort_regions_left_to_right,
    remove_contained_regions,
    classify_free_tiles,
)

app = FastAPI(title="Rummikub Vision Service", version="0.3.0")


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


@app.post("/possible-moves", response_model=GenerateMovesResponse)
def possible_moves_endpoint(data: GameState):
    moves = generate_possible_moves(data)

    return GenerateMovesResponse(
        status="success",
        message=f"Generated {len(moves)} possible moves",
        move_count=len(moves),
        moves=moves,
    )


@app.post("/detect-board", response_model=DetectBoardResponse)
async def detect_board_endpoint(file: UploadFile = File(...)):
    try:
        image = await load_image_from_upload(file)

        regions = detect_tile_regions(image)
        regions = sort_regions_left_to_right(regions)
        regions = remove_contained_regions(regions)

        return DetectBoardResponse(
            status="success",
            message=f"Detected {len(regions)} tiles",
            regions=regions,
        )
    except Exception as e:
        return DetectBoardResponse(
            status="error",
            message=f"Error detecting board: {str(e)}",
            regions=None,
        )


@app.post("/classify-tiles", response_model=ClassifyFreeTilesResponse)
async def classify_tiles_endpoint(file: UploadFile = File(...)):
    try:
        image = await load_image_from_upload(file)

        regions = detect_tile_regions(image)
        regions = sort_regions_left_to_right(regions)
        regions = remove_contained_regions(regions)

        tiles = classify_free_tiles(image, regions)

        return ClassifyFreeTilesResponse(
            status="success",
            message=f"Classified {len(tiles)} tiles",
            tiles=tiles,
        )
    except Exception as e:
        return ClassifyFreeTilesResponse(
            status="error",
            message=f"Error classifying tiles: {str(e)}",
            tiles=None,
        )