# Rummikub Backend

Microservices architecture with two independent services:

1. **API Service** (Node.js + TypeScript) - Authentication & Orchestration
2. **Vision Service** (Python + FastAPI) - Image Processing & Game Logic

## Project Structure

```
backend/
├── api/                    # Node.js/TypeScript Service
│   ├── src/
│   │   ├── config/        # Database, JWT configuration
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, error handling
│   │   ├── models/        # Data models (User, etc)
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic (email, etc)
│   │   └── index.ts       # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   ├── .gitignore
│   └── README.md
│
├── vision/                 # Python FastAPI Service
│   ├── main.py           # FastAPI app & endpoints
│   ├── models.py         # Pydantic data models
│   ├── vision.py         # Computer vision functions
│   ├── logic.py          # Game validation logic
│   ├── __init__.py       # Package initialization
│   ├── templates/        # Number template images
│   ├── requirements.txt
│   └── README.md
│
└── README.md             # This file
```

## Services Overview

### API Service (Port 3000)

**Responsibility**: Authentication, user management, request orchestration

**Key Features**:
- ✅ User signup/login/password reset
- ✅ JWT token generation and validation
- ✅ Email verification
- ✅ MongoDB integration
- ✅ CORS-enabled for frontend

**Tech Stack**: Express.js, TypeScript, MongoDB, Nodemailer

**Documentation**: See [api/README.md](api/README.md)

### Vision Service (Port 8000)

**Responsibility**: Image processing, tile detection, game logic

**Key Features**:
- ✅ Tile detection from board images
- ✅ Tile classification (number + color)
- ✅ Game rule validation
- ✅ Board state analysis

**Tech Stack**: FastAPI, Python, OpenCV, Pydantic

**Documentation**: See [vision/README.md](vision/README.md)

## Getting Started

### Quick Start (Both Services)

#### 1. API Service Setup

```bash
cd api
npm install
cp .env.example .env
npm run dev  # or npm start for production
```

Server runs on: `http://localhost:3000`

#### 2. Vision Service Setup

```bash
cd vision
pip install -r requirements.txt
uvicorn main:app --reload  # or uvicorn main:app for production
```

Service runs on: `http://localhost:8000`

## API Endpoints

### API Service (Express)
```
POST   /api/auth/signup           - Create account
POST   /api/auth/login            - Login
POST   /api/auth/forgot-password  - Request password reset
POST   /api/auth/reset-password   - Reset password
GET    /api/auth/profile          - Get user profile (protected)
GET    /health                    - Health check
```

### Vision Service (FastAPI)
```
GET    /health                    - Health check
POST   /validate-board            - Validate sets
POST   /validate-game-state       - Validate game
POST   /detect-board              - Detect tiles
POST   /classify-tiles            - Classify tiles
```

## Development

### Run Both Services in Development

**Terminal 1 - API Service**:
```bash
cd backend/api
npm run dev
```

**Terminal 2 - Vision Service**:
```bash
cd backend/vision
uvicorn main:app --reload
```

## Security

✅ Password hashing (bcryptjs)
✅ JWT token authentication
✅ Email verification
✅ Rate limiting
✅ CORS configuration
✅ Input validation

## Database Setup

### Option 1: Local MongoDB (Recommended for Development)

#### Windows:
1. **Download MongoDB Community Edition**
   - Visit: https://www.mongodb.com/try/download/community
   - Select Windows, MSI package
   - Run installer and follow prompts

2. **Start MongoDB:**
   ```bash
   # MongoDB starts as a service automatically after installation
   # Or manually start:
   net start MongoDB
   ```

3. **Verify installation:**
   ```bash
   mongo --version
   # Or MongoDB Compass (GUI tool - included in installer)
   ```

#### macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux (Ubuntu):
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Option 2: MongoDB Atlas (Cloud - for Production)

1. **Create account:** https://www.mongodb.com/cloud/atlas
2. **Create a cluster** (free tier available)
3. **Get connection string** from Connect button
4. **Update `.env` file:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rummikub
   ```

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Create .env file:**
```bash
cp .env.example .env
```

3. **Configure .env:**
```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/rummikub

# JWT Configuration
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRE=7d

# Server Configuration
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://localhost:8081,exp://localhost:8081

# Email Configuration (Optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

4. **Verify MongoDB is running:**
```bash
# For local MongoDB, test connection with:
mongo  # or mongosh for newer versions
# Then type: exit
```

## Development

**Requirements:**
- MongoDB running locally on `localhost:27017`
- OR a valid `MONGODB_URI` in `.env`

Start the dev server with hot reload:
```bash
npm run dev
```

The server will:
1. Connect to MongoDB
2. Create collections automatically
3. Run on http://localhost:3000

## Build & Production

Build TypeScript to JavaScript:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset (sends code to email)
- `POST /api/auth/reset-password` - Reset password with code
- `GET /api/auth/profile` - Get user profile (requires token)

### Health Check
- `GET /health` - Server status

## Request Examples

### Sign Up
```json
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### Login
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Forgot Password
```json
POST /api/auth/forgot-password
{
  "email": "user@example.com"
}
```

### Verify Reset Code
```json
POST /api/auth/reset-password
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

## Database

MongoDB collections:
- `users` - User accounts
  - Indexes: email (unique), username (unique, sparse)
  - Fields: _id, email, password, username, created_at, updated_at

- `verification_codes` - Email verification codes (auto-deleted after 15 min)
  - TTL Index: expires_at
  - Fields: _id, email, code, expires_at, attempts, created_at

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:**
- Ensure MongoDB is running
- Windows: `net start MongoDB` or check Services
- macOS: `brew services start mongodb-community`
- Linux: `sudo systemctl start mongod`

### Port 27017 Already in Use
```
Address already in use
```
**Solution:**
- Stop existing MongoDB: `net stop MongoDB` (Windows)
- Or use different port in `.env`: `MONGODB_URI=mongodb://localhost:27018/rummikub`

### Database Doesn't Exist
MongoDB creates databases automatically when you first write to them. This is normal.

### Check Database with MongoDB Compass
1. Download: https://www.mongodb.com/products/compass
2. Connect to: `mongodb://localhost:27017`
3. View collections and documents visually

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database & JWT config
│   ├── controllers/     # API handlers
│   ├── middleware/      # Auth middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   └── index.ts         # Entry point
├── .env                 # Environment variables
└── package.json
```

## For Final Project Presentation

**What to emphasize:**
✅ Local MongoDB for development (shows technical setup knowledge)
✅ Can scale to MongoDB Atlas for production
✅ TypeScript for type safety
✅ Proper authentication with JWT
✅ Email verification for security
✅ RESTful API design

**Deployment options:**
- Deploy backend to Heroku, Railway, or AWS
- Use MongoDB Atlas for production database
- Update CORS_ORIGIN for production domain
