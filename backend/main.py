import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

pythonpath = os.getenv("PYTHONPATH")
if pythonpath:
    sys.path.insert(0, pythonpath)
else:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import video

app = FastAPI(
    title="ParallaX API",
    description="CV-powered projectile motion analysis",
    version="0.1.0",
)

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router, prefix="/api/v1/video", tags=["video"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "parallax-backend"}
