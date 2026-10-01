"""
Domain-Driven ORM Models collection for SchoolPath AI-DOP.
All active pipeline models inherit from SQLAlchemy declarative Base.
"""

from app.core.database import Base

# Batch execution & staging domain
from app.models.batch import (
    BatchModel,
    BatchSchoolModel,
)

# Cost & token tracking domain
from app.models.cost import OpenAICostLogModel

# AI Agents & Pipeline execution domain
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import (
    CrawlJobModel,
    DataProductModel,
    EvidenceRecordModel,
    ResolvedValueModel,
    SourceRegistryModel,
)
from app.models.prompt_template import PromptTemplateModel

# Schools domain (Golden Production Table)
from app.models.schools import (
    School,
    SchoolModel,
    Schools,
)
from app.models.scraper_cache import ScrapedPageCacheModel
from app.models.staging_school import StagingSchoolModel

__all__ = [
    "Base",
    # Core Production & Staging Schools
    "Schools",
    "School",
    "SchoolModel",
    "StagingSchoolModel",
    # Batch Intake
    "BatchModel",
    "BatchSchoolModel",
    # Pipeline & Crawler Execution
    "CrawlJobModel",
    "DataProductModel",
    "EvidenceRecordModel",
    "ResolvedValueModel",
    "SourceRegistryModel",
    "MetadataAgentOutputModel",
    "ScrapedPageCacheModel",
    "PromptTemplateModel",
    # Cost & Token Tracking
    "OpenAICostLogModel",
]
