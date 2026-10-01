import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import DatabaseSessionFactory
from app.services.batches import BatchService

logger = logging.getLogger(__name__)


async def _periodic_trash_purge_loop(stop_event: asyncio.Event):
    """Background worker running every 24h to auto-purge batches in Trash Bucket older than 30 days."""
    while not stop_event.is_set():
        try:
            with DatabaseSessionFactory() as db:
                purged = BatchService.purge_expired_trash(db, retention_days=30)
                if purged > 0:
                    logger.info(
                        "Automated Trash Purge: cleaned up %d expired batches (>30 days).", purged
                    )
        except Exception as e:
            logger.error("Error during automated trash purge: %s", e)

        with suppress(TimeoutError):
            await asyncio.wait_for(stop_event.wait(), timeout=86400)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    purge_task = asyncio.create_task(_periodic_trash_purge_loop(stop_event))
    yield
    stop_event.set()
    with suppress(TimeoutError, asyncio.CancelledError):
        await asyncio.wait_for(purge_task, timeout=5.0)


# Create FastAPI application
app = FastAPI(
    title=settings.application_name,
    version=settings.application_version,
    description="SchoolPath AI Data Operations Platform (AI-DOP) Backend API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes under /api
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", summary="API Root")
def read_root():
    return {
        "message": f"Welcome to {settings.application_name}",
        "docs_url": "/docs",
        "health_check": f"{settings.api_prefix}/health",
    }
