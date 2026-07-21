# ArcLab — Projectile Motion Analyser

A web application that uses computer vision to analyse projectile motion from uploaded videos. Upload a video, click the ball, set calibration points, and get real physics data.

**Live app:** [your-vercel-url-here] · **API:** [your-railway-url-here]

## Project Structure

```
Orbital-ParallaX/
├── backend/
│   ├── physics_engine/   ← CV tracking + physics calculations
│   ├── routers/
│   ├── models/
│   └── services/
└── frontend/              ← Next.js web interface
```

## Prerequisites

Make sure you have these installed:
- Python 3.11+
- Node.js 18+
- npm

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

# Install dependencies (includes physics_engine's requirements)
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

`physics_engine` now lives inside `backend/` as a subpackage — one virtual environment covers both, no separate install step needed.

### 3. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

By default the frontend points at `http://localhost:8000` for the API. To point it at a different backend, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (see `.env.example`).

## Deployment

- **Frontend:** deployed on Vercel
- **Backend:** deployed on Railway

**Known limitation:** Railway's filesystem is ephemeral — uploaded videos in `backend/uploads/` are cleared on every redeploy or restart. This is fine for demo/single-session use (upload → analyse → results all work normally within a session) but videos won't persist long-term. Adding persistent storage (S3 or a Railway volume) is a possible future improvement beyond M3 scope.

## How to Use

1. **Upload a video** — MP4, MOV, AVI, or WebM (max 200MB)
2. **Select frame interval** — drag sliders to choose the motion segment
3. **Choose tracking method** — YOLOv8 (automatic) or HSV colour (click the ball manually)
4. **Set calibration** — click 2 points whose real-world distance you know, enter the distance in metres
5. **Analyse** — click Analyse Video to get physics results
6. **Results** — view estimated gravity, initial velocity, launch angle, and full trajectory data; export as PDF or CSV

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest physics_engine/tests/ -v
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11, Uvicorn |
| CV & Physics | OpenCV, NumPy, SciPy, YOLOv8 |
| Testing | pytest, Playwright |
| CI/CD | GitHub Actions |
| Deployment | Vercel (frontend), Railway (backend) |

## Team

- Chen Letao (Lucas)
- Liu Keming (Andy)

NUS Orbital 2026 — Apollo 11
