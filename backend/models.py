from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class TileColor(str, Enum):
    red = "red"
    blue = "blue"
    yellow = "yellow"
    black = "black"


class Tile(BaseModel):
    value: Optional[int] = Field(default=None, ge=1, le=13)
    color: Optional[TileColor] = None
    is_joker: bool = False

    @model_validator(mode="after")
    def validate_tile(self):
        if self.is_joker:
            return self

        if self.value is None:
            raise ValueError("Non-joker tile must have a value")

        if self.color is None:
            raise ValueError("Non-joker tile must have a color")

        return self


class TileSet(BaseModel):
    tiles: List[Tile]


class GameState(BaseModel):
    rack: List[Tile]
    board: List[TileSet]


class BoardValidationRequest(BaseModel):
    board: List[TileSet]


class InvalidSetInfo(BaseModel):
    index: int
    reason: str


class BoardValidationResponse(BaseModel):
    status: str
    message: str
    invalid_sets: List[InvalidSetInfo]


class GameStateValidationResponse(BaseModel):
    status: str
    message: str
    invalid_sets: List[InvalidSetInfo]

class TileRegion(BaseModel):
    x: int
    y: int
    width: int
    height: int


class DetectBoardResponse(BaseModel):
    status: str
    tile_count: int
    regions: List[TileRegion]


class FreeTileDetection(BaseModel):
    x: int
    y: int
    width: int
    height: int
    color: Optional[str] = None
    value: Optional[int] = None


class ClassifyFreeTilesResponse(BaseModel):
    status: str
    tile_count: int
    tiles: List[FreeTileDetection]