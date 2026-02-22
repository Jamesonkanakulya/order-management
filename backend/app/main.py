from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from .database import engine, Base
from .routers import orders, settings, webhooks, stats
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Order Management API", lifespan=lifespan)

app.include_router(orders.router)
app.include_router(settings.router)
app.include_router(webhooks.router)
app.include_router(stats.router)

app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": "2026-02-22"}

static_path = os.path.join(os.path.dirname(__file__), "../static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        index_path = os.path.join(static_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return FileResponse(os.path.join(static_path, "index.html"))
