# ArcLab — Projectile Motion Analyser

A web application that uses computer vision to analyse projectile motion from uploaded videos.
Upload a video, click the ball, set calibration points, and get real physics data.

---

## Project Structure
``` text
Orbital-ParallaX/
├── backend/          ← FastAPI REST API
├── physics_engine/   ← CV tracking + physics calculations
└── frontend/         ← Next.js web interface
```
---

## Prerequisites

Make sure you have these installed:
- Python 3.11+
- Node.js 18+
- npm

---

## Setup & Run

### 1. Clone the repo

```bash
git clone https://github.com/LucasChen1108/Orbital-ParallaX.git
cd Orbital-ParallaX
```

### 2. Start the backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 3. Install physics engine dependencies

Open a new terminal:

```bash
cd physics_engine

python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

### 4. Start the frontend

Open another new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## How to Use

1. **Upload a video** — MP4, MOV, AVI, or WebM (max 200MB)
2. **Select frame interval** — drag sliders to choose the motion segment
3. **Click the ball** — click directly on the ball in the first frame
4. **Set calibration** — click 2 points whose real-world distance you know, enter the distance in metres
5. **Analyse** — click Analyse Video to get physics results
6. **Results** — view estimated gravity, initial velocity, launch angle, and full trajectory data

---

## Running Tests

```bash
cd physics_engine
source venv/bin/activate
pytest tests/ -v
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11, Uvicorn |
| CV & Physics | OpenCV, NumPy, SciPy |
| Testing | pytest |

---

## Team

- Lucas Chen Letao
- Liu Keming

NUS Orbital 2026 — Apollo
