"""
SQLAlchemy model for caching scraped web pages (Spec & Architecture).
Prevents redundant Firecrawl and Tavily calls by caching raw and cleaned markdown by URL hash.
"""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, Uuid

from app.core.database import Base


def _utc_now():
    return datetime.now(UTC)


def _default_expiration():
    return datetime.now(UTC) + timedelta(days=14)


def hash_url(url: str) -> str:
    """Normalizes URL and computes a SHA-256 hash."""
    clean_url = url.strip().lower().rstrip("/")
    return hashlib.sha256(clean_url.encode("utf-8")).hexdigest()


class ScrapedPageCacheModel(Base):
    """
    Caches scraped webpage markdown to save scraper credits and accelerate pipeline execution.
    """

    __tablename__ = "scraped_pages_cache"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url_normalized = Column(String(1000), nullable=False, index=True)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    domain = Column(String(255), nullable=False, index=True)
    scraper_source = Column(
        String(50), nullable=False, default="firecrawl"
    )  # 'firecrawl' or 'tavily'
    content_markdown = Column(Text, nullable=False)
    content_cleaned = Column(Text, nullable=False)
    content_length = Column(Integer, nullable=False, default=0)
    http_status = Column(Integer, nullable=False, default=200)
    school_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    crawled_at = Column(DateTime, nullable=False, default=_utc_now)
    expires_at = Column(DateTime, nullable=False, default=_default_expiration, index=True)
    hit_count = Column(Integer, nullable=False, default=0)

    __table_args__ = (Index("ix_scraper_cache_hash_expires", "url_hash", "expires_at"),)
