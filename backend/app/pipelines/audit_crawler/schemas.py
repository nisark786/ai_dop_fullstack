from typing import Any

from pydantic import BaseModel, Field


class EnumDefinition(BaseModel):
    field: str = Field(description="The name of the enum or the field using it")
    allowed_values: list[str] = Field(description="List of allowed values for this enum")


class FieldDefinition(BaseModel):
    field: str = Field(description="The name of the field in the database")
    type: str = Field(description="The data type (e.g., string, integer, boolean)")
    nullable: bool = Field(default=True, description="Whether the field can be null")
    allowed_values: list[Any] | None = Field(
        default=None, description="Allowed values if this is an enum or constrained field"
    )
    description: str | None = Field(
        default=None, description="Description of what this field represents"
    )
    default_value: Any | None = Field(
        default=None, description="The default value of the field, if any"
    )


class SchemaKnowledgeBase(BaseModel):
    model_name: str = Field(description="Name of the model or table (e.g., 'School')")
    fields: dict[str, FieldDefinition] = Field(
        default_factory=dict, description="Dictionary mapping field names to their definitions"
    )
    enums: dict[str, EnumDefinition] = Field(
        default_factory=dict, description="Dictionary mapping enum names to their definitions"
    )

    def get_field(self, field_name: str) -> FieldDefinition | None:
        return self.fields.get(field_name)

    def get_enum(self, enum_name: str) -> EnumDefinition | None:
        return self.enums.get(enum_name)

    def filter_fields(self, field_names: list[str]) -> "SchemaKnowledgeBase":
        filtered_fields = {k: v for k, v in self.fields.items() if k in field_names}
        return SchemaKnowledgeBase(
            model_name=self.model_name, fields=filtered_fields, enums=self.enums
        )


class EvidenceSource(BaseModel):
    """Verbatim quote and source URL supporting a recommendation."""

    url: str = Field(description="URL where the evidence was located")
    page: str | None = Field(
        default=None, description="Page section name, e.g. Admissions, Home, Tuition"
    )
    text: str = Field(description="Verbatim supporting text from the scraped source")
    trust_score: float = Field(default=1.0, description="Trust weight score from 0.0 to 1.0")


class Recommendation(BaseModel):
    """Field-level proposed update backed by web evidence."""

    field: str = Field(description="Database attribute name, e.g. name, website, address, grades")
    current: str | list[str] | int | float | bool | None = Field(
        default=None, description="Current database value"
    )
    recommended: str | list[str] | int | float | bool | None = Field(
        default=None, description="Agent-recommended value"
    )
    confidence: float = Field(description="Confidence level of recommendation (0.0 to 1.0)")
    reason: str = Field(description="Human-readable rationale for recommendation or verification")
    sources: list[EvidenceSource] = Field(
        default_factory=list, description="Verbatim evidence citations"
    )


class DQAReport(BaseModel):
    """Overall Data Quality Assurance report for a school."""

    school_id: str = Field(description="Identifier of audited school")
    school_name: str | None = Field(default=None, description="Name of audited school")
    overall_score: int = Field(description="Overall audit score out of 100")
    recommendations: list[Recommendation] = Field(
        default_factory=list, description="List of proposed field updates"
    )
    status_changed_to: str | None = Field(
        default=None, description="Updated validation status: Verified, Needs Review, Invalid"
    )


class TargetPlan(BaseModel):
    """Plan selecting top subpages for scraping."""

    selected_urls: list[str] = Field(description="Top 3 to 5 URLs selected from sitemap")
    reasoning: str = Field(description="Explanation of why these URLs were selected")


class WebsiteSelection(BaseModel):
    """Structured choice for official school website."""

    official_url: str | None = Field(
        description="The URL of the official website, or null if none found"
    )


# Alias for compatibility with standalone script
WebsiteChoice = WebsiteSelection


class CampusChoice(BaseModel):
    """Structured choice for identifying campus-specific subpages in an ISD directory."""

    campus_url: str | None = Field(
        description="The specific campus homepage or subpage URL for this school on the district domain, or null if only generic district pages were found."
    )
