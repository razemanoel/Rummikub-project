# Rummikub API Service

Express.js + TypeScript backend API for authentication, user management, and game orchestration.

## Features

- **Authentication**: Signup, Login, Forgot Password, Reset Password
- **User Management**: Profile retrieval, JWT token generation
- **Security**: Rate limiting, email verification codes, secure password handling
- **Database**: MongoDB integration with proper collections and indexes
- **Email Service**: Nodemailer integration for verification codes

## Prerequisites

- Node.js 16+
- npm or yarn
- MongoDB (local or Atlas)
- Mailtrap or similar SMTP service (for email)

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following variables:

```
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secret_key
MONGODB_URI=mongodb://localhost:27017/rummikub
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASSWORD=your_mailtrap_password
CORS_ORIGIN=*
```

## Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with hot-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch TypeScript files and recompile

## Project Structure

```
src/
├── config/          # Configuration files (database, JWT)
├── controllers/     # Route controllers (AuthController)
├── middleware/      # Express middleware (auth, error handling)
├── models/          # Data models (User, VerificationCode)
├── routes/          # API routes (auth routes)
├── services/        # Services (email service)
└── index.ts         # Server entry point

dist/               # Compiled JavaScript (generated)
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/verify-code` - Verify reset code
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/profile` - Get user profile (requires auth token)

### Health Check

- `GET /health` - Server health status

## Request/Response Examples

### Signup
```json
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "secure_password",
  "confirmPassword": "secure_password"
}

Response:
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "token": "eyJ...",
    "user": {
      "id": "...",
      "email": "user@example.com"
    }
  }
}
```

## Security Features

- ✅ Password hashing with bcryptjs
- ✅ JWT token authentication
- ✅ Email verification codes
- ✅ Rate limiting on password resets
- ✅ IP-based tracking for suspicious activities
- ✅ CORS configuration for frontend access
- ✅ Secure email verification flow

## Database Collections

- **users** - User accounts with emails and hashed passwords
- **verification_codes** - Time-limited codes for password resets (15 min TTL)
- **failed_reset_attempts** - Track password reset attempts for security

## Development

Run the development server:

```bash
npm run dev
```

The server will start on `http://localhost:3000` with auto-reload enabled.

## Production Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Set environment to production:
   ```bash
   NODE_ENV=production
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Troubleshooting

- **Connection refused**: Ensure MongoDB is running
- **Email not sending**: Check SMTP credentials in `.env`
- **CORS errors**: Verify `CORS_ORIGIN` setting for your frontend URL

## License

ISC
