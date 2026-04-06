from contextlib import asynccontextmanager
import asyncio
import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.database import engine, AsyncSessionLocal
from api.models import *  # noqa: F401, F403 — import all models so Alembic sees them
from app.core.cache import close_redis
from app.core.config import get_settings
from app.core.limiter import limiter
from api.routes import auth
from api.routes.trains import router as trains_router, stations_router
from api.routes.posts import router as posts_router
from api.routes.stories import router as stories_router
from api.routes.users import router as users_router
from api.routes.media import router as media_router
from api.routes.tracking import router as tracking_router, towers_router
from api.routes.gamification import router as gamification_router
from api.routes.chat import router as chat_router
from api.routes.reels import router as reels_router
from api.routes.notifications import router as notifications_router
from api.routes.reports import router as reports_router
from api.routes.admin import router as admin_router

logger = logging.getLogger("railgram.worker")

settings = get_settings()


# ── Background position-refresh worker ───────────────────────────────────────

async def _refresh_active_trains() -> None:
    """Recompute positions for trains with activity in the last 2 hours."""
    from datetime import timedelta
    from sqlalchemy import select
    from api.database import AsyncSessionLocal
    from api.models.tracking import GpsReport, SpotterReport
    from app.services.truth_engine import compute_position
    from app.services.interpolation import IST
    from datetime import datetime

    async with AsyncSessionLocal() as db:
        now = datetime.now(IST)
        cutoff = now - timedelta(hours=2)

        gps_res = await db.execute(
            select(GpsReport.train_no).where(GpsReport.created_at >= cutoff).distinct()
        )
        spot_res = await db.execute(
            select(SpotterReport.train_no).where(SpotterReport.created_at >= cutoff).distinct()
        )
        active = {r[0] for r in gps_res.all()} | {r[0] for r in spot_res.all()}

        for train_no in active:
            try:
                await compute_position(train_no, db, skip_cache=True)
            except Exception as exc:
                logger.warning("position refresh failed for %s: %s", train_no, exc)
            await asyncio.sleep(0.05)   # avoid DB flood


async def _position_refresh_loop() -> None:
    """Runs every 60 s; errors are caught so the loop never dies."""
    while True:
        try:
            await _refresh_active_trains()
        except Exception as exc:
            logger.warning("position refresh loop error: %s", exc)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — seed badge catalogue then launch background worker
    async with AsyncSessionLocal() as seed_db:
        from app.services.badge import ensure_badges_seeded
        await ensure_badges_seeded(seed_db)
    refresh_task = asyncio.create_task(_position_refresh_loop())
    yield
    # Shutdown
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass
    from app.services.chat_manager import chat_manager
    await chat_manager.close()
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="RailGram API",
    version="1.0.0",
    description="Railfan social media + train tracker for Indian Railways",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)


# ── Security headers middleware ───────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "0"  # Modern browsers don't need this; CSP handles it
    
    # Content Security Policy
    if settings.environment == "production":
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://www.googletagmanager.com; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self' https://railgram.in https://*.cloudfront.net wss://railgram.in https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; "
            "media-src 'self' https://*.cloudfront.net blob:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none';"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self' http://localhost:8000 ws://localhost:8000; "
            "media-src 'self' https: blob:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none';"
        )
    
    # HTTP Strict Transport Security (HSTS) - Force HTTPS
    # Only set in production to avoid local dev issues
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    return response


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(trains_router, prefix="/api/v1")
app.include_router(stations_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
app.include_router(stories_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(tracking_router, prefix="/api/v1")
app.include_router(towers_router, prefix="/api/v1")
app.include_router(gamification_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(reels_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


# ── Exception handlers ────────────────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with sanitized response."""
    def _safe(v):
        if isinstance(v, bytes):
            return v.decode("utf-8", errors="replace")
        return v
    errors = [
        {k: _safe(val) for k, val in e.items()} for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions - sanitize errors in production."""
    # Log full error internally
    logger.error(f"Unhandled error: {exc}\n{traceback.format_exc()}")
    
    # Return sanitized error to client
    if settings.environment == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal error occurred"},
        )
    else:
        # In development, show full error for debugging
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(exc), "type": type(exc).__name__},
        )


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["infra"])
async def health():
    return {"status": "ok", "service": "railgram-api"}
