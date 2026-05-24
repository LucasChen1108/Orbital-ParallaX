from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import video

app = FastAPI(
    title="ParallaX API",
    description="CV-powered projectile motion analysis",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-deployed-frontend.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router, prefix="/api/v1/video", tags=["video"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "parallax-backend"}