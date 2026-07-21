import os
from dotenv import load_dotenv

load_dotenv()

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
