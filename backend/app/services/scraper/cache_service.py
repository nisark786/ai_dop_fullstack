"""
Scraper Cache Service for saving web crawling results and preventing duplicate scraper calls.
"""

import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import DatabaseSessionFactory
from app.models.scraper_cache import ScrapedPageCacheModel, hash_url

logger = logging.getLogger(__name__)

DEFAULT_CACHE_TTL_DAYS = 14


class ScraperCacheService:
    """Manages reading and writing scraped webpage markdown in PostgreSQL."""

    @staticmethod
    def normalize_url(url: str) -> str:
        """Strips whitespace, lowercases scheme & host, strips trailing slashes."""
        u = url.strip()
        if not u.startswith(("http://", "https://")):
            u = "https://" + u
        try:
            parsed = urlparse(u)
            normalized = (
                f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"
            )
            if parsed.query:
                normalized += f"?{parsed.query}"
            return normalized
        except Exception:
            return u.lower().rstrip("/")

    @classmethod
    def get_cached_page(cls, url: str, db: Session | None = None) -> str | None:
        """
        Retrieves cached markdown if the URL has been scraped and is not expired.
        Increments hit_count on hit.
        """
        normalized_url = cls.normalize_url(url)
        url_h = hash_url(normalized_url)
        now = datetime.now(UTC)

        def _lookup(session: Session) -> str | None:
            cached = (
                session.query(ScrapedPageCacheModel)
                .filter(
                    ScrapedPageCacheModel.url_hash == url_h,
                    ScrapedPageCacheModel.expires_at > now,
                )
                .first()
            )
            if cached and cached.content_cleaned:
                try:
                    cached.hit_count += 1
                    session.commit()
                except Exception as commit_err:
                    session.rollback()
                    logger.debug("Failed to update cache hit counter: %s", commit_err)

                logger.info(
                    "[ScraperCache HIT] Reusing cached content for %s (hit #%d, saved credit!)",
                    url,
                    cached.hit_count,
                )
                return cached.content_cleaned
            return None

        if db is not None:
            return _lookup(db)

        with DatabaseSessionFactory() as session:
            return _lookup(session)

    @classmethod
    def store_page(
        cls,
        url: str,
        markdown: str,
        cleaned_text: str,
        scraper_source: str = "firecrawl",
        school_id: UUID | None = None,
        ttl_days: int = DEFAULT_CACHE_TTL_DAYS,
        db: Session | None = None,
    ) -> None:
        """
        Saves or updates scraped content in the cache table.
        """
        if not markdown and not cleaned_text:
            return

        normalized_url = cls.normalize_url(url)
        url_h = hash_url(normalized_url)
        try:
            domain = urlparse(normalized_url).netloc.lower() or "unknown"
        except Exception:
            domain = "unknown"

        now = datetime.now(UTC)
        expires_at = now + timedelta(days=ttl_days)

        def _save(session: Session):
            existing = (
                session.query(ScrapedPageCacheModel)
                .filter(ScrapedPageCacheModel.url_hash == url_h)
                .first()
            )
            if existing:
                existing.content_markdown = markdown or cleaned_text
                existing.content_cleaned = cleaned_text or markdown
                existing.content_length = len(cleaned_text or markdown)
                existing.scraper_source = scraper_source
                existing.crawled_at = now
                existing.expires_at = expires_at
                if school_id:
                    existing.school_id = school_id
            else:
                entry = ScrapedPageCacheModel(
                    url_normalized=normalized_url,
                    url_hash=url_h,
                    domain=domain,
                    scraper_source=scraper_source,
                    content_markdown=markdown or cleaned_text,
                    content_cleaned=cleaned_text or markdown,
                    content_length=len(cleaned_text or markdown),
                    school_id=school_id,
                    crawled_at=now,
                    expires_at=expires_at,
                    hit_count=0,
                )
                session.add(entry)
            session.commit()
            logger.info(
                "[ScraperCache STORED] Cached %d chars for %s via %s",
                len(cleaned_text),
                url,
                scraper_source,
            )

        try:
            if db is not None:
                _save(db)
            else:
                with DatabaseSessionFactory() as session:
                    _save(session)
        except Exception as e:
            logger.warning("[ScraperCache ERROR] Failed to cache page for %s: %s", url, e)
