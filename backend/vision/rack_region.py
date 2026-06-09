from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass(slots=True)
class RackRegion:
    bbox: dict[str, float]
    support_mask: np.ndarray
    front_support_mask: np.ndarray


def _image_to_bgr(image: Image.Image) -> np.ndarray:
    rgb_image = image.convert("RGB")
    return cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)


def _extend_rack_mask_downward(
    dark_mask: np.ndarray,
    rack_mask: np.ndarray,
    bbox: dict[str, float],
) -> np.ndarray:
    image_height, image_width = dark_mask.shape[:2]
    x1 = max(0, min(image_width, int(round(bbox["x1"]))))
    y1 = max(0, min(image_height, int(round(bbox["y1"]))))
    x2 = max(x1 + 1, min(image_width, int(round(bbox["x2"]))))
    y2 = max(y1 + 1, min(image_height, int(round(bbox["y2"]))))

    extension_limit = min(image_height, y2 + max(int(round(image_height * 0.12)), 1))
    base_band = rack_mask[max(y2 - 12, y1):y2, x1:x2] > 0
    if base_band.size == 0:
        return rack_mask

    active_columns = np.mean(base_band, axis=0) >= 0.18
    if not np.any(active_columns):
        active_columns = np.ones(x2 - x1, dtype=bool)

    min_dark_pixels = max(int(np.count_nonzero(active_columns) * 0.22), 1)
    quiet_rows = 0

    for row in range(y2, extension_limit):
        row_dark = dark_mask[row, x1:x2] > 0
        supported_columns = active_columns & row_dark

        if int(np.count_nonzero(supported_columns)) < min_dark_pixels:
            quiet_rows += 1
            if quiet_rows >= 6:
                break
            continue

        rack_mask[row, x1:x2][supported_columns] = 255
        quiet_rows = 0

    return rack_mask


def _add_front_support_region(
    rack_mask: np.ndarray,
    bbox: dict[str, float],
) -> np.ndarray:
    image_height, image_width = rack_mask.shape[:2]
    bbox_width = max(float(bbox["x2"] - bbox["x1"]), 1.0)
    bbox_height = max(float(bbox["y2"] - bbox["y1"]), 1.0)

    front_height = max(int(round(bbox_height * 0.42)), 10)
    front_height = min(front_height, max(int(round(image_height * 0.16)), 12))

    top_y = max(0, min(image_height - 1, int(round(bbox["y2"] - (bbox_height * 0.04)))))
    bottom_y = max(top_y + 1, min(image_height, top_y + front_height))

    top_left_x = max(0, min(image_width - 1, int(round(bbox["x1"] + (bbox_width * 0.08)))))
    top_right_x = max(top_left_x + 1, min(image_width - 1, int(round(bbox["x2"] - (bbox_width * 0.08)))))
    bottom_left_x = max(0, min(image_width - 1, int(round(bbox["x1"] + (bbox_width * 0.02)))))
    bottom_right_x = max(bottom_left_x + 1, min(image_width - 1, int(round(bbox["x2"] - (bbox_width * 0.02)))))

    front_polygon = np.array(
        [
            [top_left_x, top_y],
            [top_right_x, top_y],
            [bottom_right_x, bottom_y],
            [bottom_left_x, bottom_y],
        ],
        dtype=np.int32,
    )

    front_mask = np.zeros_like(rack_mask)
    cv2.fillConvexPoly(front_mask, front_polygon, 255)
    cv2.fillConvexPoly(rack_mask, front_polygon, 255)

    return front_mask


def detect_rack_region(image: Image.Image) -> RackRegion | None:
    bgr_image = _image_to_bgr(image)
    image_height, image_width = bgr_image.shape[:2]

    hsv_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)

    dark_mask = cv2.inRange(
        hsv_image,
        np.array([0, 0, 0], dtype=np.uint8),
        np.array([180, 120, 90], dtype=np.uint8),
    )

    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    open_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, close_kernel)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, open_kernel)

    bright_mask = cv2.inRange(
        hsv_image,
        np.array([0, 0, 120], dtype=np.uint8),
        np.array([180, 110, 255], dtype=np.uint8),
    )

    contours, _ = cv2.findContours(
        dark_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if not contours:
        return None

    image_area = float(image_width * image_height)
    best_candidate: tuple[float, dict[str, float], np.ndarray] | None = None

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)

        area = float(width * height)
        area_ratio = area / image_area
        width_ratio = width / image_width
        height_ratio = height / image_height
        aspect_ratio = width / max(height, 1)
        center_y_ratio = (y + (height / 2)) / image_height
        region_bright_ratio = float(
            np.count_nonzero(bright_mask[y:y + height, x:x + width])
        ) / max(area, 1.0)

        if area_ratio < 0.04 or area_ratio > 0.85:
            continue

        if width_ratio < 0.35 or height_ratio < 0.10:
            continue

        if not 2.0 <= aspect_ratio <= 8.5:
            continue

        if center_y_ratio < 0.48:
            continue

        if region_bright_ratio < 0.05 or region_bright_ratio > 0.65:
            continue

        score = (
            (area_ratio * 1.8)
            + width_ratio
            + (center_y_ratio * 1.4)
            + (region_bright_ratio * 2.8)
        )

        candidate = {
            "x1": float(x),
            "y1": float(y),
            "x2": float(x + width),
            "y2": float(y + height),
        }

        candidate_mask = np.zeros((image_height, image_width), dtype=np.uint8)
        cv2.drawContours(candidate_mask, [contour], -1, 255, thickness=cv2.FILLED)

        if best_candidate is None or score > best_candidate[0]:
            best_candidate = (score, candidate, candidate_mask)

    if best_candidate is None:
        return None

    bbox = best_candidate[1]
    rack_mask = _extend_rack_mask_downward(
        dark_mask=dark_mask,
        rack_mask=best_candidate[2],
        bbox=bbox,
    )
    front_support_mask = _add_front_support_region(
        rack_mask=rack_mask,
        bbox=bbox,
    )

    support_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 19))
    support_mask = cv2.dilate(rack_mask, support_kernel, iterations=1)
    front_support_mask = cv2.dilate(front_support_mask, support_kernel, iterations=1)

    support_points = cv2.findNonZero(support_mask)
    if support_points is None:
        return None

    support_x, support_y, support_width, support_height = cv2.boundingRect(support_points)
    padding_x = image_width * 0.015
    top_padding_y = image_height * 0.015
    bottom_padding_y = image_height * 0.06

    return RackRegion(
        bbox={
            "x1": max(0.0, float(support_x) - padding_x),
            "y1": max(0.0, float(support_y) - top_padding_y),
            "x2": min(float(image_width), float(support_x + support_width) + padding_x),
            "y2": min(float(image_height), float(support_y + support_height) + bottom_padding_y),
        },
        support_mask=support_mask,
        front_support_mask=front_support_mask,
    )