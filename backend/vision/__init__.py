"""
Rummikub Vision Service
Computer vision module for tile detection and classification
"""

from .models import (
    TileColor,
    Tile,
    TileSet,
    GameState,
    BoardValidationRequest,
    BoardValidationResponse,
    InvalidSetInfo,
    GameStateValidationResponse,
    TileRegion,
    DetectBoardResponse,
    FreeTileDetection,
    ClassifyFreeTilesResponse,
)

from .vision import (
    load_image_from_upload,
    detect_tile_regions,
    sort_regions_left_to_right,
    remove_contained_regions,
    crop_tile,
    detect_tile_color,
    classify_free_tiles,
    detect_tile_value,
)

from .logic import (
    validate_set,
    validate_board,
    validate_game_state,
)

__all__ = [
    # Models
    "TileColor",
    "Tile",
    "TileSet",
    "GameState",
    "BoardValidationRequest",
    "BoardValidationResponse",
    "InvalidSetInfo",
    "GameStateValidationResponse",
    "TileRegion",
    "DetectBoardResponse",
    "FreeTileDetection",
    "ClassifyFreeTilesResponse",
    # Vision functions
    "load_image_from_upload",
    "detect_tile_regions",
    "sort_regions_left_to_right",
    "remove_contained_regions",
    "crop_tile",
    "detect_tile_color",
    "classify_free_tiles",
    "detect_tile_value",
    # Logic functions
    "validate_set",
    "validate_board",
    "validate_game_state",
]
