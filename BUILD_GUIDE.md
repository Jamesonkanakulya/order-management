# Agent Instructions - Full-Stack App Build Template

This is a comprehensive guide for building full-stack applications with Python/FastAPI backend and React frontend, optimized for Dokploy deployment.

---

## Project Structure

### Recommended Layout (for Dokploy)
```
project/
├── Dockerfile              # Multi-stage build (root level)
├── docker-compose.yml     # Local development
├── .env.example           # Environment template
├── .gitignore
├── README.md
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py        # FastAPI entry point
│   │   ├── config.py      # Settings via pydantic-settings
│   │   ├── database.py    # Async SQLAlchemy setup
│   │   ├── models.py      # SQLAlchemy models
│   │   ├── schemas.py     # Pydantic schemas
│   │   ├── ai.py          # AI/LLM integration
│   │   └── routers/       # API routes
│   │       ├── __init__.py
│   │       ├── orders.py
│   │       ├── settings.py
│   │       ├── webhooks.py
│   │       └── stats.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/         # React pages
    │   ├── components/    # React components
    │   ├── services/      # API service
    │   ├── styles/         # CSS
    │   ├── App.jsx
    │   └── main.jsx
    ├── public/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## Django/FastAPI Backend

### 1. Requirements (requirements.txt)
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
httpx==0.27.2
python-multipart==0.0.12
```

### 2. Config (config.py)
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:pass@host:5432/dbname"
    github_token: Optional[str] = None
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
```

### 3. Database (database.py)
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### 4. Main App (main.py)
```python
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="App Name", lifespan=lifespan)

# Include routers
app.include_router(router)

# Static files - use absolute path
static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static"))
logger.info(f"Static path: {static_path}")

if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# Root route
@app.get("/")
async def root():
    index_path = os.path.join(static_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"error": "Not found"})

# SPA fallback - must be last
@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static"))
    
    # Try static file first
    file_path = os.path.join(static_path, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Fallback to index.html for SPA
    index_path = os.path.join(static_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"error": "Not found"})
```

### 5. Routers - IMPORTANT Import Paths
When routers are in a subfolder (`routers/`), use `..` instead of `.`:

```python
# CORRECT - routers package
from ..database import get_db
from ..models import ModelName
from ..schemas import SchemaName

# WRONG - will cause ModuleNotFoundError
from .database import get_db
```

---

## Dockerfile (Root Level for Dokploy)

```dockerfile
# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npx vite build --outDir /build/frontend/dist --emptyOutDir

# Stage 2: Python backend
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

COPY --from=frontend-builder /build/frontend/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Docker Compose (for local dev)

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
```

---

## PostgreSQL with n8n (Shared Database)

When using the same PostgreSQL instance as n8n or other apps:
- Use the same DATABASE_URL but **different table names**
- Tables are prefixed to avoid conflicts (e.g., `orders_`, `order_settings`)

```python
# Different from n8n's tables
class Order(Base):
    __tablename__ = "orders"

class OrderItem(Base):
    __tablename__ = "order_items"

class Setting(Base):
    __tablename__ = "order_settings"  # Different from other apps
```

---

## React Frontend

### API Service (services/api.js)
```javascript
const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}
```

### Settings Page - Webhook URL Display
Always include webhook URL prominently for n8n integration:

```jsx
const getWebhookUrl = () => {
  return `${window.location.origin}/api/webhooks/order`;
};

const copyWebhook = () => {
  navigator.clipboard.writeText(getWebhookUrl());
};
```

---

## n8n Integration

### Webhook Endpoint
The app exposes endpoints for n8n to call:

```
POST {app-url}/api/webhooks/order
Body: {
  "subject": "Email subject",
  "body": "Email body",
  "snippet": "Email snippet",
  "from": "sender@email.com"
}
```

### n8n HTTP Request Node
```
URL: {{ $json.webhook_url }}
Method: POST
Body Content Type: JSON
Body:
{
  "subject": "{{ $json.subject }}",
  "body": "{{ $json.body }}",
  "snippet": "{{ $json.snippet }}",
  "from": "{{ $json.from }}"
}
```

---

## Environment Variables

Always use `.env.example` (never commit secrets
# Database
):

```bashDATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# AI/LLM
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Optional
AI_MODEL=openai/gpt-5
AI_ENDPOINT=https://models.github.ai/inference
```

---

## Debug Endpoints (Development)

Add these during development:

```python
@app.get("/api/debug")
async def debug():
    return {
        "static_path": static_path,
        "static_exists": os.path.exists(static_path),
        "files": os.listdir(static_path) if os.path.exists(static_path) else []
    }

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

---

## Common Issues & Fixes

### 1. ModuleNotFoundError: No module named 'app.routers.database'
**Cause**: Using `.database` instead of `..database` in routers
**Fix**: Change imports to use `..` prefix

### 2. Static files not found
**Cause**: Relative path in Dockerfile vs absolute path at runtime
**Fix**: Use `os.path.abspath()` in main.py

### 3. React build fails - index.html not found
**Cause**: COPY order in Dockerfile
**Fix**: Copy index.html to correct location before build

### 4. Database connection fails
**Cause**: DATABASE_URL not set in deployment
**Fix**: Set environment variable in docker-compose or Dokploy settings

---

## Quality Standards

### For Every File Created:
- ✓ Proper Python import paths (`..` for subpackages)
- ✓ Async/await for all database operations
- ✓ Error handling with try/except
- ✓ Logging for debugging
- ✓ Environment variables for secrets

### For Every Deployment:
- ✓ Test locally first with docker-compose
- ✓ Check debug endpoints
- ✓ Verify database connection
- ✓ Test webhook endpoints
- ✓ Verify static files are served

### For n8n Integration:
- ✓ Display webhook URL prominently in UI
- ✓ Include cURL command for easy copy
- ✓ Document expected request format
- ✓ Test end-to-end flow

---

## Quick Start Commands

```bash
# Local development
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with DATABASE_URL and GITHUB_TOKEN

cd ../frontend
npm install
npm run build

cd ../backend
uvicorn app.main:app --reload --port 8000

# Docker build
docker-compose up --build
```
