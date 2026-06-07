import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from PIL import Image
from pydantic import ValidationError

from backend.vision.classifier_service import CLASSIFIER_PATH
from backend.vision.detector_service import DETECTOR_PATH
from backend.logic.models import (
    FeedbackArtifactRequest,
    FeedbackArtifactResult,
)


BASE_DIR = Path(__file__).resolve().parent
RAW_CASES_DIR = BASE_DIR / "feedback_dataset" / "raw"


def get_model_versions() -> dict[str, str]:
    return {
        "detectorModelVersion": DETECTOR_PATH.name,
        "classifierModelVersion": CLASSIFIER_PATH.name,
    }


def parse_feedback_artifact_request(raw_feedback: str) -> FeedbackArtifactRequest:
    try:
        payload = json.loads(raw_feedback)
    except json.JSONDecodeError as error:
        raise ValueError("Feedback payload must be valid JSON") from error

    try:
        return FeedbackArtifactRequest.model_validate(payload)
    except ValidationError as error:
        raise ValueError("Feedback payload failed validation") from error


def generate_feedback_artifacts(
    feedback_request: FeedbackArtifactRequest,
    rack_image_path: str | None,
    board_image_path: str | None,
) -> list[FeedbackArtifactResult]:
    image_paths = {"rack": rack_image_path, "board": board_image_path}
    model_versions = get_model_versions()
    artifacts: list[FeedbackArtifactResult] = []

    for source in ("rack", "board"):
        source_corrections = [c for c in feedback_request.corrections if c.source == source]
        if not source_corrections:
            continue

        image_path = image_paths[source]
        saved_image_path: str | None = None

        if image_path:
            case_id = uuid4().hex
            RAW_CASES_DIR.mkdir(parents=True, exist_ok=True)

            image = Image.open(image_path).convert("RGB")
            image_file = RAW_CASES_DIR / f"{case_id}.jpg"
            image.save(image_file, format="JPEG", quality=95)

            source_detections = getattr(feedback_request.finalImageDetections, source)
            case_data = {
                "source": source,
                "model_versions": model_versions,
                "corrections": [
                    {
                        "feedbackHash": c.feedbackHash,
                        "tileIndex": c.tileIndex,
                        "correctionType": c.correctionType.value,
                        "correctedTile": c.correctedTile.model_dump(mode="json"),
                        "bbox": c.bbox.model_dump() if c.bbox else None,
                    }
                    for c in source_corrections
                ],
                "detections": [
                    {
                        "tileIndex": d.tileIndex,
                        "bbox": d.bbox.model_dump(),
                        "correctedTile": d.correctedTile.model_dump(mode="json"),
                    }
                    for d in source_detections
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            json_file = RAW_CASES_DIR / f"{case_id}.json"
            json_file.write_text(json.dumps(case_data, indent=2, ensure_ascii=False), encoding="utf-8")
            saved_image_path = image_file.relative_to(BASE_DIR).as_posix()

        for correction in source_corrections:
            artifacts.append(
                FeedbackArtifactResult(
                    feedbackHash=correction.feedbackHash,
                    source=source,
                    savedImagePath=saved_image_path,
                )
            )

    return artifacts
