# Rummikub Project

A full-stack Rummikub assistant application that combines image recognition, game validation, optimal move solving, and mobile gameplay support.

The project includes:

* Python FastAPI Vision & Logic Server
* Node.js REST API
* MongoDB Database
* React Native / Expo Mobile Application
* Docker Compose Integration

---

# Requirements

Before running the project, make sure the following are installed:

* Docker Desktop
* Expo Go application on your mobile device

---

# Clone the Repository

```bash
git clone <https://github.com/razemanoel/Rummikub-projectl>
```

---

# Find Your Local IP Address

On Windows, run:

```powershell
ipconfig
```

Find your Wi-Fi IPv4 address.

Example:

```text
10.100.102.11
```

---

# Update Mobile API URL

Open:

```text
mobile/.env
```

Replace the existing value with your own IP address:

```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

Example:

```env
EXPO_PUBLIC_API_URL=http://10.100.102.11:3000/api
```

---

# Update Expo Host IP

Open:

```text
docker-compose.yml
```

Find:

```yaml
REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_IP
```

Replace it with your own IP address.

Example:

```yaml
REACT_NATIVE_PACKAGER_HOSTNAME=10.100.102.11
```

---

# Run the Project

From the root project directory:

## First Run

```bash
docker compose up --build
```

## Future Runs

```bash
docker compose up
```

---

# Stop All Containers

```bash
docker compose down
```

---

# Connect the Mobile App

1. Wait for the QR code to appear in the terminal
2. Open Expo Go on your phone
3. Scan the QR code
4. The app should connect automatically

---

# Notes

Docker Compose automatically handles:

* Python dependencies installation
* Node.js dependencies installation
* MongoDB setup
* Backend startup
* Vision server startup
* Expo startup

No manual setup is required for:

* pip install
* npm install
* MongoDB installation
* uvicorn
* npm run build
* npm start

---

# Project Structure

```text
Rummikub-project/
├── backend/
│   ├── api/          # Node.js REST API
│   ├── logic/        # Game validation & solver logic
│   ├── vision/       # Image recognition pipeline
│   ├── Dockerfile
│   └── requirements.txt
│
├── mobile/           # Expo / React Native application
│
├── docker-compose.yml
└── README.md
```
