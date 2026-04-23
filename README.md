# Rummikub Mobile Project

Full-stack Rummikub mobile application with React Native (Expo), Express backend, and authentication.

## Project Structure

```
Rummikub-project/
├── mobile/           (React Native/Expo app)
├── backend/          (Node.js/Express API)
└── README.md
```

## Quick Start

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

Server will run on `http://localhost:3000`

### Mobile Setup

1. Navigate to mobile folder:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Start Expo development server:
```bash
npm start
```

5. Scan QR code with iPhone Camera or Expo Go app

## Features

### Authentication
- ✅ Sign Up with email & password
- ✅ Login
- ✅ Forgot Password (3-step flow)
- ✅ Secure token storage (expo-secure-store)
- ✅ Auto-login on app launch
- ✅ Protected routes

### Architecture
- **Frontend**: React Native with Expo Router
- **Backend**: Node.js + Express + SQLite
- **State Management**: React Context API
- **API Communication**: Axios with interceptors
- **Authentication**: JWT tokens
- **Security**: bcryptjs password hashing

## API Endpoints

See [backend/README.md](./backend/README.md) for complete API documentation

## Development

### Run Both Simultaneously

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Mobile:**
```bash
cd mobile
npm start
```

### Configuration

Update API URL if needed in `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

## Tech Stack

### Frontend
- React Native 0.81.5
- Expo 54.0.33
- TypeScript 5.9.2
- Expo Router for navigation
- React Context for state management

### Backend
- Express 4.18.2
- TypeScript 4.9.4
- SQLite for database
- JWT for authentication
- bcryptjs for password hashing

## Security Notes

- Never commit `.env` files
- Change `JWT_SECRET` in production
- Use HTTPS in production
- Enable CORS only for trusted domains
- Store tokens securely on device

## Next Steps

1. Implement game logic
2. Add multiplayer features
3. Create game board UI
4. Add scoring system
5. Deploy to production
