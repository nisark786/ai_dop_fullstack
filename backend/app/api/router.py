from fastapi import APIRouter

from app.api.routes import (
    agents,
    audit,
    batches,
    costs,
    health,
    jobs,
    prompts,
    published,
    results,
    review,
    runs,
    schools,
    sources,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(schools.router)
api_router.include_router(audit.router)
api_router.include_router(jobs.router)
api_router.include_router(review.router)
api_router.include_router(sources.router)
api_router.include_router(published.router)
api_router.include_router(prompts.router)
api_router.include_router(batches.router)
api_router.include_router(agents.router)
api_router.include_router(costs.router)
api_router.include_router(runs.router)
api_router.include_router(results.router)
