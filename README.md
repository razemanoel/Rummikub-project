# Rummikub Solver

An AI-powered mobile assistant that finds the optimal move in a Rummikub game from a photo.

Take a picture of your rack and the shared board — the app detects every tile, lets you fix any mistakes, then solves the board and shows you exactly what to play.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Setup and Running](#setup-and-running)

---

## Overview

Rummikub requires analyzing a complex, constantly changing board and figuring out how to rearrange existing sets to play as many of your own tiles as possible. This is a hard combinatorial problem.

This app solves it by:

1. Taking photos of the board and your rack
2. Detecting and classifying every tile using computer vision (YOLOv8 + ResNet18)
3. Letting you review and correct any detection errors
4. Running an ILP solver to find the move that plays the maximum number of tiles from your rack
5. Walking you through the move step by step with an interactive simulation

---

## Features

**Vision and Detection**
- Photo-based tile detection using a fine-tuned YOLOv8 model
- Tile classification into 53 classes (4 colors x 13 values + joker) using ResNet18
- Automatic rack region detection using HSV color segmentation
- Duplicate detection filtering via IoU

**Review and Editing**
- Read-only review screen showing the detected rack and board
- Full tile editor — change color, number, or type (regular/joker)
- Add tiles the model missed
- Remove false positive detections
- Merge two board sets or move a tile between sets
- Vision overlay editor — tap bounding boxes directly on the original photo to edit
- Undo support for all edits

**Game Logic and Validation**
- Real-time board validation (runs, groups, joker handling)
- Duplicate tile detection (max 2 copies of any tile, max 2 jokers)
- Full joker support in validation and solving

**Solver**
- ILP solver maximizing the number of rack tiles played
- Board rearrangement — existing sets can be split and recombined freely
- Step-by-step interactive simulation with live rack and board updates

**App**
- User authentication
- Solution history — view any previously solved game
- Cross-platform mobile app (iOS and Android via Expo Go)

---

## Project Structure

```
rummikub-project/
├── backend/              # Python FastAPI — vision + logic
│   ├── main.py
│   ├── logic/            # Solver, validation, explainer
│   └── vision/           # Detection, classification, rack region, feedback
│
├── api/                  # Node.js Express API gateway
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── models/
│       └── middleware/
│
├── mobile/               # React Native + Expo
│   ├── app/
│   │   ├── (auth)/       # Login, signup
│   │   └── (main)/       # Home, review, editor, solution, simulation, history
│   ├── components/
│   ├── services/
│   └── context/
│
└── docker-compose.yml
```

---

## Setup and Running

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Expo Go](https://expo.dev/go) installed on your mobile device
- Your phone and computer on the **same Wi-Fi network**

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-username/rummikub-project.git
cd rummikub-project
```

---

### Step 2 — Find your local IP address

**Windows:**
```powershell
ipconfig
```

Look for the IPv4 address on your Wi-Fi adapter, e.g. `10.100.102.11`.

---

### Step 3 — Set your local IP in two places

Create the mobile environment file:

```bash
touch mobile/.env
```

Open `mobile/.env` in your editor and paste:

```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

Then open `docker-compose.yml` and replace:

```yaml
- REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_IP
```
---

### Step 4 — Run

**First run:**
```bash
docker compose up --build
```

**Subsequent runs:**
```bash
docker compose up
```

This starts 4 containers:

| Container | Port | Description |
|---|---|---|
| `rummikub-mongo` | 27017 | MongoDB |
| `rummikub-python-backend` | 8000 | Vision and logic server |
| `rummikub-node-api` | 3000 | REST API gateway |
| `rummikub-mobile` | 8081, 19000-19002 | Expo dev server |

All dependencies install automatically inside Docker — no manual `pip install` or `npm install` needed.

---

### Step 5 — Connect your phone

1. Wait for the Expo QR code to appear in the terminal
2. Open Expo Go on your phone
3. Scan the QR code

---

### Stopping

```bash
docker compose down
```
