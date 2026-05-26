from enum import Enum
from typing import List, Literal, Optional
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
    message: str
    regions: Optional[List[TileRegion]] = None


class FreeTileDetection(BaseModel):
    tile_number: Optional[int]
    tile_color: Optional[TileColor]
    confidence: float


class ClassifyFreeTilesResponse(BaseModel):
    status: str
    message: str
    tiles: Optional[List[FreeTileDetection]] = None


class FeedbackBBox(BaseModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class VisionFeedbackCorrectionType(str, Enum):
    wrong_class = "wrong_class"
    wrong_bbox = "wrong_bbox"
    missing_tile = "missing_tile"
    false_positive = "false_positive"
    added_tile = "added_tile"
    removed_tile = "removed_tile"
    both = "both"


class FeedbackFinalImageDetection(BaseModel):
    tileIndex: int = Field(ge=0)
    bbox: FeedbackBBox
    correctedTile: Tile


class FeedbackArtifactCorrection(BaseModel):
    feedbackHash: str = Field(min_length=16, max_length=128)
    tileIndex: int = Field(ge=0)
    source: Literal["rack", "board"]
    correctionType: VisionFeedbackCorrectionType
    affectsClassifier: bool
    affectsDetector: bool
    correctedTile: Tile
    bbox: FeedbackBBox


class FeedbackSourceDetections(BaseModel):
    rack: List[FeedbackFinalImageDetection] = Field(default_factory=list)
    board: List[FeedbackFinalImageDetection] = Field(default_factory=list)


class FeedbackArtifactRequest(BaseModel):
    corrections: List[FeedbackArtifactCorrection]
    finalImageDetections: FeedbackSourceDetections = Field(default_factory=FeedbackSourceDetections)


class FeedbackArtifactResult(BaseModel):
    feedbackHash: str
    tileIndex: int
    source: Literal["rack", "board"]
    imageCropPath: Optional[str] = None
    fullImagePath: Optional[str] = None
    yoloLabelPath: Optional[str] = None


class FeedbackArtifactResponse(BaseModel):
    status: str
    message: str
    artifacts: List[FeedbackArtifactResult]
