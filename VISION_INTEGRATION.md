# Vision Server Integration Guide

## Overview
The mobile app now sends uploaded photos to the Vision server (FastAPI) for tile detection and classification. This guide explains how the integration works and how to use it.

## Architecture

### Components
1. **Mobile App** (React Native/Expo)
   - Captures/selects photos from camera or gallery
   - Sends images to Vision server via HTTP multipart requests
   - Displays tile detection results

2. **Vision Server** (FastAPI on port 8000)
   - Receives images via `/classify-tiles` endpoint
   - Performs tile color and number detection
   - Returns results with tile information

3. **API Server** (Express on port 3000)
   - Handles authentication
   - Manages user data
   - (Future) Stores analysis history

## How Image Upload Works

### Flow Diagram
```
User selects photo → Mobile stores URI → User clicks "Analyze Photos"
    ↓
Mobile app sends image to Vision server
    ↓
Vision server processes image (detect colors, numbers, regions)
    ↓
Returns JSON with detected tiles
    ↓
Mobile app displays results with tile cards
```

### File: `mobile/services/vision.ts`
This service handles all communication with the Vision server:

```typescript
// Send image for tile classification
const result = await visionService.classifyTiles(imageUri);

// Response structure
{
  status: "success",
  message: "Classified X tiles",
  tiles: [
    {
      tile_number: 5,
      tile_color: "red",
      confidence: 0.95
    },
    ...
  ]
}
```

### File: `mobile/app/(main)/(tabs)/index.tsx`
Updated with:
- `isAnalyzing` state to track processing
- `analysisResults` state to store response
- `handleAnalyzePhotos()` function that:
  1. Validates images exist
  2. Sends first image to Vision server
  3. Displays results or error
  
### File: `mobile/.env.local`
Added Vision server URL:
```
EXPO_PUBLIC_VISION_URL=http://192.168.200.230:8000
```

## Key API Endpoints

### Vision Server Endpoints

#### POST `/classify-tiles`
Detects and classifies tiles in an image.
- **Input:** Multipart form with `file` field (image)
- **Output:** `ClassifyTilesResponse`
```json
{
  "status": "success",
  "message": "Classified 12 tiles",
  "tiles": [
    {
      "tile_number": 5,
      "tile_color": "red",
      "confidence": 0.92
    }
  ]
}
```

#### POST `/detect-board`
Detects tile regions in an image (returns bounding boxes).
- **Input:** Multipart form with `file` field (image)
- **Output:** `DetectBoardResponse`
```json
{
  "status": "success",
  "message": "Detected 12 tiles",
  "regions": [
    {
      "x": 100,
      "y": 50,
      "width": 80,
      "height": 120
    }
  ]
}
```

#### GET `/health`
Check Vision server status.
- **Output:** `{ "status": "ok" }`

## Using the Integration

### For Mobile Users
1. Take/upload photos of your Rummikub board
2. Click the "Analyze Photos" button
3. Wait for processing (shows loading indicator)
4. View detected tiles with:
   - Tile number (1-13 or joker indicator)
   - Tile color (red, blue, yellow, black)
   - Confidence percentage

### For Developers

#### To test locally:
```bash
# Terminal 1: Start Vision server
cd backend/vision
python -m uvicorn main:app --port 8000

# Terminal 2: Start API server
cd backend/api
npm run dev

# Terminal 3: Start mobile app
cd mobile
npx expo start
```

#### To modify image processing logic:
Edit `backend/vision/vision.py`:
- `detect_tile_color()` - Adjusts HSV thresholds for color detection
- `detect_tile_value()` - Template matching for number recognition
- `classify_free_tiles()` - Main processing pipeline

## Environment Setup

### Mobile App (.env.local)
```
EXPO_PUBLIC_API_URL=http://192.168.200.230:3000/api
EXPO_PUBLIC_VISION_URL=http://192.168.200.230:8000
```

**Note:** Replace `192.168.200.230` with your local machine's IP address if testing on physical device or different network.

## Troubleshooting

### "Vision server connection failed"
- Verify Vision server is running: `http://VISION_URL:8000/health`
- Check network connectivity between mobile device and server
- Ensure correct IP in `.env.local`

### "Analysis returned no tiles"
- Image quality may be poor
- Tiles may be too small or out of frame
- Lighting conditions might be inadequate
- Server may need template image recalibration

### Images taking too long to process
- Vision server timeout is 30 seconds
- Large images take longer to process
- Consider compressing images in quality settings

## Future Enhancements

1. **Multi-image processing** - Process all uploaded images at once
2. **Result storage** - Save analysis history per user
3. **Real-time detection** - Live camera preview with detection overlay
4. **Board validation** - Check if detected tiles form valid Rummikub sets
5. **Solution suggestions** - Return optimal move recommendations

## File Structure
```
mobile/
├── services/
│   ├── api.ts         # API server communication
│   └── vision.ts      # Vision server communication (NEW)
├── app/(main)/(tabs)/
│   └── index.tsx      # Home screen (UPDATED)
└── .env.local         # Environment variables (UPDATED)

backend/
├── api/               # Express server (port 3000)
└── vision/            # FastAPI server (port 8000)
    ├── main.py        # FastAPI app with endpoints
    ├── vision.py      # Image processing logic
    ├── models.py      # Pydantic models
    ├── logic.py       # Game logic validation
    ├── requirements.txt
    └── templates/     # Tile template images (1-13.png)
```

## Notes
- All images are sent via HTTPS in production (currently HTTP for local development)
- Images are processed server-side; no sensitive data stored on mobile
- Tile detection uses template matching + color detection
- Color thresholds may need tuning for different lighting conditions
