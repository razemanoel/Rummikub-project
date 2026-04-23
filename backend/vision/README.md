# Rummikub Vision Service

FastAPI + Python computer vision module for tile detection and classification using OpenCV.

## Features

- **Tile Detection**: Detect tile regions in board images using contour detection
- **Tile Classification**: Identify tile numbers and colors using template matching
- **Board Validation**: Validate game rules (runs, groups, jokers)
- **Game State Analysis**: Check if game state follows Rummikub rules

## Prerequisites

- Python 3.8+
- pip or conda
- OpenCV libraries (usually installed via opencv-python)

## Installation

```bash
pip install -r requirements.txt
```

## Project Structure

```
vision/
├── main.py              # FastAPI application and endpoints
├── models.py            # Pydantic data models
├── vision.py            # Computer vision functions
├── logic.py             # Game logic and validation
├── __init__.py          # Package initialization
├── requirements.txt     # Python dependencies
├── templates/           # Number template images (1-13.png)
└── README.md           # This file
```

## API Endpoints

### Health Check

- `GET /health` - Service health status

### Validation

- `POST /validate-board` - Validate board sets
- `POST /validate-game-state` - Validate full game state

### Image Processing

- `POST /detect-board` - Detect tiles in board image
- `POST /classify-tiles` - Classify detected tiles (number + color)

## Request/Response Examples

### Detect Board
```
POST /detect-board
Content-Type: multipart/form-data
file: <image_file>

Response:
{
  "status": "success",
  "message": "Detected 12 tiles",
  "regions": [
    {"x": 100, "y": 50, "width": 80, "height": 120},
    ...
  ]
}
```

### Validate Board
```
POST /validate-board
{
  "board": [
    {
      "tiles": [
        {"value": 1, "color": "red"},
        {"value": 2, "color": "red"},
        {"value": 3, "color": "red"}
      ]
    }
  ]
}

Response:
{
  "status": "success",
  "message": "All sets on the board are valid",
  "invalid_sets": []
}
```

## Running the Service

### Development

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service will start on `http://localhost:8000`
API documentation available at `http://localhost:8000/docs`

## Computer Vision Pipeline

### 1. Image Upload & Preprocessing
- Load image from upload
- Convert to grayscale
- Apply Gaussian blur
- Edge detection (Canny)

### 2. Tile Detection
- Find contours
- Filter by size and aspect ratio
- Sort tiles left-to-right
- Remove duplicate/contained regions

### 3. Tile Classification
- Crop individual tiles
- Detect tile color using HSV
- Extract number region
- Match against templates
- Return tile value + color + confidence

### 4. Game Logic
- Validate individual sets
- Check for runs (consecutive same color)
- Check for groups (same value different colors)
- Verify joker usage

## Game Rules Implemented

### Valid Set - Run
- 3+ consecutive numbers
- Same color
- Jokers can fill gaps
- Values must stay within 1-13

### Valid Set - Group
- 3-4 tiles
- Same number
- Different colors
- Jokers can substitute

### Invalid Cases
- Duplicate colors in group
- Duplicate values in run
- Wrong number of tiles
- Insufficient jokers for gaps

## Template Matching

Tile numbers are recognized using template images (1-13.png) stored in `templates/` folder.

Each template should show the number clearly for accurate matching.

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **pydantic**: Data validation
- **opencv-python**: Computer vision
- **numpy**: Numerical operations
- **python-multipart**: File upload handling

## Troubleshooting

- **Import errors**: Run `pip install -r requirements.txt`
- **No templates found**: Ensure template images are in `templates/` folder
- **Poor tile detection**: Check image quality and lighting
- **Wrong tile classification**: Verify template images are clear and properly labeled

## Performance Tips

- Use clear, well-lit board images
- Ensure tiles are clearly visible
- Use consistent image formats (JPG/PNG)
- Template images should have good contrast

## Future Improvements

- [ ] Deep learning model for tile recognition
- [ ] Multi-board support
- [ ] Real-time video processing
- [ ] Confidence scoring for detections
- [ ] Board state history tracking

## License

ISC
