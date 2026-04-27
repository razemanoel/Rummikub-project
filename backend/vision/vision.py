import cv2
import numpy as np
from fastapi import UploadFile
from backend.vision.models import TileRegion, FreeTileDetection
from pathlib import Path

async def load_image_from_upload(file: UploadFile):
    """
    Reads an uploaded image file and converts it into an OpenCV image.
    """
    contents = await file.read()
    np_array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    return image


def detect_tile_regions(image) -> list[TileRegion]:
    """
    Detect rectangular regions that may represent Rummikub tiles.
    This is a basic first version based on contours and size filtering.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        # Ignore very small shapes (noise)
        if w < 150 or h < 220:
            continue

        # Basic tile-like aspect ratio check
        ratio = h / w
        if ratio < 1.1 or ratio > 1.8:
            continue

        regions.append(TileRegion(x=x, y=y, width=w, height=h))

    return regions


def sort_regions_left_to_right(regions: list[TileRegion]) -> list[TileRegion]:
    """
    Sort detected tile regions from left to right.
    """
    return sorted(regions, key=lambda r: r.x)

def is_contained(inner: TileRegion, outer: TileRegion, margin: int = 10) -> bool:
    return (
        inner.x >= outer.x - margin and
        inner.y >= outer.y - margin and
        inner.x + inner.width <= outer.x + outer.width + margin and
        inner.y + inner.height <= outer.y + outer.height + margin
    )


def remove_contained_regions(regions: list[TileRegion]) -> list[TileRegion]:
    filtered = []

    for i, region in enumerate(regions):
        contained = False

        for j, other in enumerate(regions):
            if i == j:
                continue

            # אם region כמעט כולו בתוך other, נשמיט אותו
            if is_contained(region, other) and (
                region.width * region.height < other.width * other.height
            ):
                contained = True
                break

        if not contained:
            filtered.append(region)

    return filtered

def crop_tile(image, region: TileRegion):
    """
    Crop a single tile region from the full image.
    """
    x, y, w, h = region.x, region.y, region.width, region.height
    return image[y:y + h, x:x + w]

def detect_tile_color(tile_image) -> str:
    """
    Detect tile number color using only the number area
    (top-center region of the tile).
    """
    h, w = tile_image.shape[:2]

    # Crop area where the number usually appears
    roi = tile_image[
        int(h * 0.10):int(h * 0.55),
        int(w * 0.20):int(w * 0.80)
    ]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Red
    red_mask_1 = cv2.inRange(hsv, np.array([0, 70, 50]), np.array([10, 255, 255]))
    red_mask_2 = cv2.inRange(hsv, np.array([170, 70, 50]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red_mask_1, red_mask_2)

    # Blue
    blue_mask = cv2.inRange(hsv, np.array([90, 70, 50]), np.array([130, 255, 255]))

    # Yellow
    yellow_mask = cv2.inRange(hsv, np.array([15, 70, 50]), np.array([40, 255, 255]))

    # Black
    black_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 60]))

    scores = {
        "red": int(cv2.countNonZero(red_mask)),
        "blue": int(cv2.countNonZero(blue_mask)),
        "yellow": int(cv2.countNonZero(yellow_mask)),
        "black": int(cv2.countNonZero(black_mask)),
    }

    best_color = max(scores, key=scores.get)
    return best_color

def classify_free_tiles(image, regions: list[TileRegion]) -> list[FreeTileDetection]:
    """
    For each detected tile region:
    - crop tile
    - detect tile color
    - detect tile value
    - return enriched detection
    """
    results = []
    templates = load_number_templates()

    for region in regions:
        tile_crop = crop_tile(image, region)
        color = detect_tile_color(tile_crop)
        value = detect_tile_value(tile_crop, templates)

        results.append(
            FreeTileDetection(
                tile_number=value,
                tile_color=color,
                confidence=0.9  # Placeholder confidence
            )
        )

    return results

def extract_number_roi(tile_image):
    """
    Extract the area where the number usually appears on the tile.
    """
    h, w = tile_image.shape[:2]
    return tile_image[
        int(h * 0.10):int(h * 0.55),
        int(w * 0.20):int(w * 0.80)
    ]


def preprocess_number_image(image):
    """
    Convert number region to a clean binary image for template matching.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Invert threshold so the number becomes white on black
    _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

    return thresh


def load_number_templates():
    """
    Load all number templates from vision/templates/.
    Returns dict like {1: image, 2: image, ...}
    """
    templates = {}
    templates_dir = Path(__file__).parent / "templates"

    for value in range(1, 14):
        template_path = templates_dir / f"{value}.png"

        if not template_path.exists():
            continue

        template = cv2.imread(str(template_path))
        if template is None:
            continue

        template_processed = preprocess_number_image(template)
        templates[value] = template_processed

    return templates


def match_number_template(number_image, templates: dict[int, np.ndarray]) -> int | None:
    """
    Compare a processed number image against all templates.
    Return the best matching value.
    """
    if not templates:
        return None

    best_value = None
    best_score = -1

    for value, template in templates.items():
        resized_input = cv2.resize(number_image, (template.shape[1], template.shape[0]))

        result = cv2.matchTemplate(resized_input, template, cv2.TM_CCOEFF_NORMED)
        score = result[0][0]

        if score > best_score:
            best_score = score
            best_value = value

    return best_value


def detect_tile_value(tile_image, templates: dict[int, np.ndarray]) -> int | None:
    """
    Detect the tile number using template matching.
    """
    roi = extract_number_roi(tile_image)
    processed_roi = preprocess_number_image(roi)
    return match_number_template(processed_roi, templates)
