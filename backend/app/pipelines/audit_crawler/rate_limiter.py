import logging
import threading
import time

logger = logging.getLogger(__name__)


class ApiRateLimiter:
    """Enforces global thread-safe minimum interval between calls across all workers."""

    def __init__(self, name: str, min_interval_seconds: float = 6.0):
        self.name = name
        self.min_interval = min_interval_seconds
        self.last_call_time = 0.0
        self.lock = threading.Lock()

    def wait(self) -> None:
        with self.lock:
            now = time.time()
            elapsed = now - self.last_call_time
            if elapsed < self.min_interval:
                sleep_duration = self.min_interval - elapsed
                if self.name == "Firecrawl":
                    logger.info(
                        "Throttling Firecrawl: waiting %.2fs...",
                        sleep_duration,
                    )
                time.sleep(sleep_duration)
            self.last_call_time = time.time()


class KeyRotator:
    """Thread-safe key rotator for API services with multiple keys or quota tiers."""

    def __init__(self, name: str, keys: list[str]):
        self.name = name
        self.keys = [k for k in keys if k]
        self.index = 0
        self.lock = threading.Lock()

    def get_key(self) -> str:
        with self.lock:
            if not self.keys:
                return ""
            return self.keys[self.index]

    def rotate(self) -> str | None:
        with self.lock:
            if self.index + 1 < len(self.keys):
                self.index += 1
                new_key = self.keys[self.index]
                logger.info(
                    "[%s KEY ROTATION] Switched to Key #%d: %s...%s",
                    self.name,
                    self.index + 1,
                    new_key[:8],
                    new_key[-4:],
                )
                return new_key
            else:
                logger.error(
                    "[%s EXHAUSTED] All %d keys have been depleted!",
                    self.name,
                    len(self.keys),
                )
                return None


# Backward-compatible alias
FirecrawlRateLimiter = ApiRateLimiter

# Global rate limiters (Firecrawl 6.0s spacing, Tavily 1.5s spacing)
firecrawl_limiter = ApiRateLimiter("Firecrawl", min_interval_seconds=6.0)
tavily_limiter = ApiRateLimiter("Tavily", min_interval_seconds=1.5)
