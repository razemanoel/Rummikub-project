"""
Integration tests for the Rummikub Assistant REST API.

These tests mirror the "Sample Test Code for User Stories" section of the
architecture document (docs/ProjectArchitecureDocument-B7.md) one-to-one, but
are written as real, runnable pytest tests against the actual running stack,
instead of the standalone illustrative snippets shown in the document.

How to run:

    docker compose up                          # from the project root
    pip install requests pytest --break-system-packages
    pytest tests/test_api_integration.py -v -s

Two real Rummikub photos are provided under tests/fixtures/ (rack.jpg, table.jpg)
so the upload tests can run out of the box and exercise genuine detections.

Covers (see docs/ProjectArchitecureDocument-B7.md, section 4, "User Stories"):
    - User Story 1  (User Login)
    - User Story 2  (Upload Game State Images)
    - User Story 5  (Manual Correction of Detected Tiles)
    - User Story 8/9 (Get Recommended Move)
"""

import json
import os

import pytest
import requests

BASE_URL = "http://localhost:3000"
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

DEMO_EMAIL = "player@example.com"
DEMO_PASSWORD = "123456"


@pytest.fixture(scope="module", autouse=True)
def ensure_demo_account():
    """
    Creates the demo account used by the tests below.

    Idempotent: returns 201 the first time it runs and 409 ("Email already
    registered") on every run after that -- both are fine, so we don't assert
    on the status code here.
    """
    requests.post(
        f"{BASE_URL}/api/auth/signup",
        json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "confirmPassword": DEMO_PASSWORD,
        },
    )


@pytest.fixture(scope="module")
def token():
    """Logs in the demo account and returns a JWT, for tests that need auth."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["data"]["token"]


@pytest.fixture
def game_state():
    """
    A minimal but valid GameState: an empty board and a rack that already
    contains one legal run (red 5-6-7), so the solver has something to find.
    Matches backend/logic/models.py (GameState / Tile / TileSet).
    """
    return {
        "rack": [
            {"value": 5, "color": "red", "is_joker": False},
            {"value": 6, "color": "red", "is_joker": False},
            {"value": 7, "color": "red", "is_joker": False},
        ],
        "board": [],
    }


# ---------------------------------------------------------------------------
# User Story 1: User Login
# ---------------------------------------------------------------------------
def test_user_login():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "player@example.com",
        "password": "123456"
    })
    assert response.status_code == 200
    assert "token" in response.json()["data"]


# ---------------------------------------------------------------------------
# User Story 2: Upload Game State Images
# ---------------------------------------------------------------------------
def test_upload_game_images(token):
    files = {
        "myBoard": open(os.path.join(FIXTURES_DIR, "rack.jpg"), "rb"),
        "sharedBoard": open(os.path.join(FIXTURES_DIR, "table.jpg"), "rb"),
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/api/vision/analyze",
        files=files,
        headers=headers,
    )
    assert response.status_code == 200
    assert "gameState" in response.json()["data"]


# ---------------------------------------------------------------------------
# User Story 5: Manual Correction of Detected Tiles
# ---------------------------------------------------------------------------
def test_submit_vision_feedback(token):
    files = {
        "rackImage": open(os.path.join(FIXTURES_DIR, "rack.jpg"), "rb"),
        "boardImage": open(os.path.join(FIXTURES_DIR, "table.jpg"), "rb"),
    }
    feedback_payload = {
        "corrections": [
            {
                "tileIndex": 12,
                "source": "rack",
                "correctionType": "wrong_class",
                "originalPrediction": {"value": 9, "color": "blue", "is_joker": False},
                "correctedTile": {"value": 7, "color": "red", "is_joker": False},
                "confidence": 0.62,
                "bbox": {"x": 120.0, "y": 45.0, "width": 60.0, "height": 90.0},
            }
        ]
    }
    data = {"feedback": json.dumps(feedback_payload)}
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/api/vision/feedback",
        files=files,
        data=data,
        headers=headers,
    )    
    assert response.status_code == 201
    assert response.json()["success"] is True


# ---------------------------------------------------------------------------
# User Story 8/9: Get Recommended Move
# ---------------------------------------------------------------------------
def test_solve_game_state(token, game_state):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/api/solver/solve",
        json=game_state,
        headers=headers,
    )
    assert response.status_code == 200
    assert "tiles_used_count" in response.json()["data"]
    assert "new_board" in response.json()["data"]


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "-s"]))
