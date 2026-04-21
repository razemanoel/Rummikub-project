from fastapi import FastAPI
from backend.models import (
    BoardValidationRequest,
    BoardValidationResponse,
    GameState,
    GameStateValidationResponse
)
from backend.logic import validate_board, validate_game_state

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