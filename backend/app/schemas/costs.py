from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class CostLogEntry(BaseModel):
    """Pydantic model representing an individual OpenAI cost log entry."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: Annotated[str, Field(min_length=1, max_length=100)]
    agent_name: Annotated[str, Field(min_length=1, max_length=100)]
    school_id: Annotated[str | None, Field(default=None, max_length=100)] = None
    batch_id: Annotated[str | None, Field(default=None, max_length=100)] = None
    task_name: Annotated[str | None, Field(default=None, max_length=100)] = None
    model: Annotated[str, Field(min_length=1, max_length=100)]
    prompt_tokens: Annotated[int, Field(ge=0)]
    completion_tokens: Annotated[int, Field(ge=0)]
    total_tokens: Annotated[int, Field(ge=0)]
    cost_usd: Annotated[float, Field(ge=0.0)]
    duration_ms: Annotated[int, Field(ge=0)]
    logged_at: datetime


class AgentCostBreakdown(BaseModel):
    """Aggregated cost summary grouped by agent."""

    model_config = ConfigDict(str_strip_whitespace=True)

    agent_name: Annotated[str, Field(min_length=1, max_length=100)]
    total_cost_usd: Annotated[float, Field(ge=0.0)]
    total_calls: Annotated[int, Field(ge=0)]
    total_tokens: Annotated[int, Field(ge=0)]


class CostSummaryResponse(BaseModel):
    """High-level summary response for the cost & token monitoring dashboard."""

    model_config = ConfigDict(str_strip_whitespace=True)

    total_cost_usd: Annotated[float, Field(ge=0.0)]
    total_calls: Annotated[int, Field(ge=0)]
    total_tokens: Annotated[int, Field(ge=0)]
    avg_cost_per_call_usd: Annotated[float, Field(ge=0.0)]
    agent_breakdown: list[AgentCostBreakdown]
    period_label: Annotated[str, Field(min_length=1, max_length=50)]


class CostInvocationsResponse(BaseModel):
    """Paginated list of individual OpenAI invocations."""

    model_config = ConfigDict(str_strip_whitespace=True)

    items: list[CostLogEntry]
    total: Annotated[int, Field(ge=0)]
    page: Annotated[int, Field(ge=1)]
    page_size: Annotated[int, Field(ge=1, le=100)]
