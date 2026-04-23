# Rummikub Project Architecture - Refactored

## Overview

The Rummikub application now follows a proper **three-tier microservices architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App                              │
│                 (React Native / Expo)                        │
│                                                              │
│  - Captures/selects photos via camera or gallery            │
│  - Sends images via JWT-authenticated API calls             │
│  - Displays analysis results                                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST (JWT Auth)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js API Layer (Port 3000)                  │
│          (Express.js + TypeScript)                          │
│                                                              │
│  ✓ Authentication & JWT management                         │
│  ✓ User management                                         │
│  ✓ Vision request orchestration                            │
│  ✓ Image upload handling (multipart/form-data)             │
│  ✓ Response formatting & error handling                    │
│  ✓ CORS & security middleware                              │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST (internal)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Python Vision Service (Port 8000)                   │
│            (FastAPI + OpenCV)                               │
│                                                              │
│  - Receives image uploads from API                         │
│  - Performs tile detection (color + number)                │
│  - Returns JSON results                                    │
│  - No authentication (internal only)                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Image Analysis Request

```
1. User takes/selects photo in mobile app
2. Mobile stores image URI locally
3. User clicks "Analyze Photos"
4. Mobile POST /api/vision/analyze (multipart/form-data)
   - Includes JWT token in Authorization header
   - Sends myBoard and/or sharedBoard images
   
5. API receives request
   - Validates JWT token (auth middleware)
   - Validates file types & sizes (multer)
   - Extracts file buffers
   
6. API forwards to Vision Service
   - Posts multipart/form-data to localhost:8000/classify-tiles
   - Waits for response
   
7. Vision Service processes image
   - Detects tile colors via HSV analysis
   - Detects tile numbers via template matching
   - Returns array of detected tiles with confidence
   
8. API formats response
   - Wraps Vision response with metadata
   - Returns success/data structure to mobile
   
9. Mobile displays results
   - Shows tiles organized by board type
   - Renders color-coded boxes with numbers & confidence
```

## Project Structure

```
backend/
├── api/                        # Express.js API Server
│   ├── src/
│   │   ├── index.ts            # Main application entry
│   │   ├── config/
│   │   │   ├── database.ts     # MongoDB configuration
│   │   │   └── jwt.ts          # JWT utilities
│   │   ├── controllers/
│   │   │   ├── AuthController.ts
│   │   │   └── visionController.ts    # NEW: Handles vision requests
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT validation, file handling
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── visionRoutes.ts         # NEW: Vision endpoints
│   │   ├── services/
│   │   │   ├── emailService.ts
│   │   │   └── visionService.ts        # NEW: Calls Vision server
│   │   └── models/
│   │       └── User.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
└── vision/                     # FastAPI Vision Service
    ├── main.py                 # FastAPI app & endpoints
    ├── vision.py               # Image processing logic
    ├── models.py               # Pydantic data models
    ├── logic.py                # Game logic
    ├── requirements.txt
    └── templates/              # Tile PNG templates (1-13)

mobile/                        # React Native / Expo
├── app/
│   └── (main)/(tabs)/
│       └── index.tsx           # Home screen - UPDATED
├── services/
│   ├── api.ts                  # UPDATED: Added analyzeBoards()
│   └── vision.ts               # DEPRECATED: No longer used
├── components/
│   └── upload-card.tsx
├── context/
│   └── AuthContext.tsx
├── constants/
│   └── theme.ts
├── types/
│   └── auth.ts
└── .env.local                  # UPDATED: Removed VISION_URL
```

## Key Files & Their Roles

### Backend API - New Vision Integration

#### `backend/api/src/services/visionService.ts`
- **Purpose**: Communicates with Python Vision server
- **Key Methods**:
  - `healthCheck()`: Verifies Vision server is running
  - `classifyTiles(buffer, filename)`: Sends single image for analysis
  - `analyzeBoards(myBoard, sharedBoard)`: Processes both board types in parallel
- **Handles**: FormData construction, axios HTTP requests, error handling

#### `backend/api/src/controllers/visionController.ts`
- **Purpose**: Request/response handling for vision endpoints
- **Key Methods**:
  - `analyzeBoards(req, res)`: Main endpoint handler
  - `healthCheck(req, res)`: Returns Vision service status
- **Validates**: User authentication, file presence, delegates to service

#### `backend/api/src/routes/visionRoutes.ts`
- **Purpose**: Route definitions and multer middleware
- **Endpoints**:
  - `POST /analyze` - Analyze board images (requires auth)
  - `GET /health` - Check vision service availability
- **Middleware**: JWT auth, multer file upload handling

#### `backend/api/src/middleware/auth.ts`
- **Updated**: Extended `AuthRequest` interface to include `files` property
- **Purpose**: Combines JWT validation with file upload support

### Mobile - API Integration

#### `mobile/services/api.ts`
- **New Methods**:
  - `analyzeBoards(myBoardUri, sharedBoardUri)`: Sends images to `/api/vision/analyze`
  - `checkVisionHealth()`: Calls `/api/vision/health` endpoint
- **Features**: Multipart form data construction, JWT token injection, error handling

#### `mobile/app/(main)/(tabs)/index.tsx`
- **Updated**: Home screen refactored
- **Changes**:
  - Import `apiService` instead of `visionService`
  - `handleAnalyzePhotos()` calls `apiService.analyzeBoards()`
  - Results display updated for new response structure
  - Shows separate My Board / Shared Board results

## API Contracts

### Request: POST /api/vision/analyze

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Body (multipart/form-data):**
```
- myBoard: [image file, optional]
- sharedBoard: [image file, optional]
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/vision/analyze \
  -H "Authorization: Bearer your_jwt_token" \
  -F "myBoard=@photo1.jpg" \
  -F "sharedBoard=@photo2.jpg"
```

### Response: POST /api/vision/analyze

**Success (200):**
```json
{
  "success": true,
  "message": "Boards analyzed successfully",
  "data": {
    "myBoardDetections": [
      {
        "tile_number": 5,
        "tile_color": "red",
        "confidence": 0.94
      },
      ...
    ],
    "sharedBoardDetections": [
      ...
    ]
  }
}
```

**Error (400/500):**
```json
{
  "success": false,
  "message": "Error description"
}
```

### Response: GET /api/vision/health

```json
{
  "success": true,
  "message": "Vision service is available"
}
```

## Environment Configuration

### Backend API (`backend/api/.env`)
```
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRE=7d
CORS_ORIGIN=*
DATABASE_PATH=./data/rummikub.db
VISION_SERVER_URL=http://localhost:8000
```

### Mobile App (`mobile/.env.local`)
```
EXPO_PUBLIC_API_URL=http://192.168.200.230:3000/api
```

**Note:** Replace `192.168.200.230` with your machine's IP for physical device testing.

## Security Model

### Authentication
- Mobile sends JWT token in Authorization header: `Bearer <token>`
- API validates token using `authMiddleware`
- Vision service **does not** validate tokens (internal only)

### Authorization
- Only authenticated users can access `/api/vision/analyze`
- User email extracted from JWT and logged for auditing

### File Validation
- Multer checks:
  - File type: Only JPEG/PNG accepted
  - File size: Max 10MB per file
- API validates at least one image is provided

## Deployment Notes

### Local Development
```bash
# Terminal 1: Start Vision Service
cd backend/vision
python -m uvicorn main:app --port 8000

# Terminal 2: Start API Server
cd backend/api
npm run dev

# Terminal 3: Start Mobile App
cd mobile
npx expo start
```

### Production Changes Needed
1. Update `VISION_SERVER_URL` to point to Vision service IP/domain
2. Use HTTPS with proper SSL certificates
3. Implement rate limiting on API endpoints
4. Add request logging and monitoring
5. Use environment-specific JWT secrets
6. Consider API gateway for additional security

## Benefits of This Architecture

✅ **Separation of Concerns**: Each service has single responsibility
✅ **Authentication Centralized**: Only API handles JWT validation
✅ **Scalability**: Services can be scaled independently
✅ **Security**: Vision service is internal, not exposed directly
✅ **Flexibility**: Can swap image processing engine without mobile changes
✅ **Error Handling**: Consistent error responses from API layer
✅ **Monitoring**: Central API logs all vision requests with user context
✅ **Future-Proof**: Easy to add more internal services

## Troubleshooting

### "Unauthorized - valid token required"
- Mobile app not sending JWT token
- Token has expired
- Check `Authorization` header in request

### "Vision server is not responding"
- Vision service not running on port 8000
- Network connectivity issue between API and Vision service
- Check `VISION_SERVER_URL` in API .env

### "Only JPEG and PNG images are allowed"
- File type validation failed
- Ensure image is actually JPEG/PNG (check file extension and MIME type)

### "At least one board image is required"
- No files were submitted
- Multer didn't extract files properly
- Check mobile app is sending both fields in FormData
