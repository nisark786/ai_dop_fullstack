from pydantic_settings import BaseSettings, SettingsConfigDict


class ApplicationSettings(BaseSettings):
    """
    Application configuration with human-readable settings.
    Reads from .env file or environment variables, falling back to sensible local defaults.
    """

    application_name: str = "SchoolPath AI-DOP API"
    application_version: str = "1.0.0"
    api_prefix: str = "/api"

    # Local SQLite database file by default; switch to Supabase PostgreSQL via DATABASE_URL
    database_url: str = "sqlite:///./schoolpath_dev.db"

    # Target table for school audits
    target_table: str = "schools"

    # API Keys & Model for Audit & Crawling Pipeline
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"
    openai_input_cost_per_m: float = 0.10
    openai_output_cost_per_m: float = 0.50
    firecrawl_api_key: str = ""
    tavily_api_key: str = ""

    # Frontend CORS origins allowed
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    @property
    def normalized_database_url(self) -> str:
        """
        Ensures compatibility with SQLAlchemy for PostgreSQL URLs
        (e.g., converting postgres:// to postgresql://).
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


# Global configuration instance
settings = ApplicationSettings()
