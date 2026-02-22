from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from .database import engine, Base
from .routers import orders, settings, webhooks, stats
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up - creating tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Database error: {e}")
    yield
    logger.info("Shutting down...")


app = FastAPI(title="Order Management API", lifespan=lifespan)

app.include_router(orders.router)
app.include_router(settings.router)
app.include_router(webhooks.router)
app.include_router(stats.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": "2026-02-22"}


@app.get("/api/debug")
async def debug():
    static_path = os.path.join(os.path.dirname(__file__), "../static")
    return {
        "static_path": static_path,
        "static_exists": os.path.exists(static_path),
        "files": os.listdir(static_path) if os.path.exists(static_path) else []
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "path": str(request.url)}
    )


static_path = os.path.join(os.path.dirname(__file__), "../static")
logger.info(f"Static path: {static_path}")

if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")
    logger.info(f"Mounted static files from {static_path}")


@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    static_path = os.path.join(os.path.dirname(__file__), "../static")
    index_path = os.path.join(static_path, "index.html")
    logger.info(f"Serving: {full_path}, index exists: {os.path.exists(index_path)}")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return FileResponse(os.path.join(static_path, "index.html"))


@app.get("/")
async def root():
    static_path = os.path.join(os.path.dirname(__file__), "../static")
    index_path = os.path.join(static_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Order Management API", "static_path": static_path})
