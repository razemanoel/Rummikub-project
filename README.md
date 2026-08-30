# Rummikub Solver

An AI-powered mobile assistant that finds the optimal move in a Rummikub game from a photo.

Take a picture of your rack and the shared board — the app detects every tile, lets you fix any mistakes, then solves the board and shows you exactly what to play.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Setup and Running](#setup-and-running)
- [Application Flow](#application-flow)

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
git clone https://github.com/razemanoel/rummikub-project.git
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

### API Documentation (Swagger)

Both backend services expose interactive OpenAPI/Swagger docs once running:

| Service | Swagger UI | Raw OpenAPI JSON |
|---|---|---|
| Node API gateway (auth, vision, solver, solutions) | `http://localhost:3000/api/docs` | `http://localhost:3000/api/docs.json` |
| Python vision/solver service | `http://localhost:8000/docs` | `http://localhost:8000/openapi.json` |

Protected endpoints on the Node API require a JWT: log in via `/api/auth/login` in the docs page, then click **Authorize** and paste the token (`Bearer <token>` is added automatically).

---

### Optional — Cloud storage for vision feedback (AWS S3)

When you correct a tile detection in the review/edit screens, the app saves the photo and the correction as a training example ("vision feedback"), so the models can be retrained later. By default these are saved to local disk (`backend/vision/feedback_dataset/raw/`). They can be stored in **Amazon S3** instead:

1. Create an S3 bucket with **Block all public access** enabled, and an IAM user/policy scoped to just that bucket (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on that one bucket's ARN — never broader).
2. Copy `backend/.env.example` to `backend/.env` and fill in the IAM user's access key, secret key, region, and bucket name. `backend/.env` is git-ignored — never commit real AWS credentials.
3. `docker compose up --build` — the Python service picks up S3 automatically once `S3_BUCKET_NAME` is set.
4. Check `http://localhost:8000/storage-status` — it reports `{"backend": "s3", "bucket": "..."}` when wired up correctly, or `{"backend": "local-disk", "bucket": null}` otherwise.

If `backend/.env` is missing or any of the AWS variables are unset, the app falls back to local disk automatically — no AWS account is required to run the project.

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

<br><br>

---

## Application Flow

A step-by-step walkthrough of the user journey from login to solution.

---

### Step 1 — Authentication

Create a new account or log in with an existing one to access the solver.

<img src="https://i.imgur.com/Q4ESpCN.jpeg" width="220"> <img src="https://i.imgur.com/LmqoL0D.jpeg" width="220">

---

### Step 2 — Upload Photos

Snap a photo of your tile rack and the shared board, then tap **Analyze Photos** to send them for detection.

<img src="https://i.imgur.com/tKqSx4V.jpeg" width="220"> <img src="https://i.imgur.com/KIiJ558.jpeg" width="220">

---

### Step 3 — Detection Review

Review a summary of all detected tiles and board sets before solving — tap **Edit** to correct errors or **Solve** to proceed.

<img src="https://i.imgur.com/MeDyN6F.jpeg" width="220">

---

### Step 4 — Review and Edit Tiles

Inspect every detected tile individually; tap any tile to correct it, add tiles the model missed, or reorganize board sets.

<img src="https://i.imgur.com/7JunOJV.jpeg" width="220"> <img src="https://i.imgur.com/UZMBlns.jpeg" width="220">

---

### Step 5 — Optimal Solution

The ILP solver returns the best possible move — tiles to play, sets to rearrange, and full joker usage explained.

<img src="https://i.imgur.com/eghm6io.jpeg" width="220"> <img src="https://i.imgur.com/mayghI1.jpeg" width="220"> <img src="https://i.imgur.com/V7XIBc4.jpeg" width="220">

---

### Step 6 — Step-by-Step Simulation

Follow the move one action at a time, with the rack and board updated live at each step.

<img src="https://i.imgur.com/86dqs2d.jpeg" width="220"> <img src="https://i.imgur.com/4X5uWLU.jpeg" width="220"> <img src="https://i.imgur.com/GtgPD3b.jpeg" width="220"> <img src="https://i.imgur.com/Ddtlxq8.jpeg" width="220">

---

### Step 7 — History

Browse all previously solved games with timestamps and tile counts, and revisit any past solution.

<img src="https://i.imgur.com/ssaR8J1.jpeg" width="220">
