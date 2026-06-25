from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, situations, feed

app = FastAPI(title="PathParallel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # required so the httpOnly auth cookie is sent
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(situations.router)
app.include_router(feed.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
