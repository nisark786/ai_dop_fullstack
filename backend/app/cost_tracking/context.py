import contextvars
from dataclasses import dataclass


@dataclass
class CostContext:
    agent_name: str = "unknown"
    school_id: str | None = None
    batch_id: str | None = None
    task_name: str | None = None


_cost_context: contextvars.ContextVar[CostContext | None] = contextvars.ContextVar(
    "cost_context", default=None
)


def set_cost_context(
    agent_name: str,
    school_id: str | None = None,
    batch_id: str | None = None,
    task_name: str | None = None,
) -> None:
    """Set the contextual metadata for downstream OpenAI invocations."""
    _cost_context.set(
        CostContext(
            agent_name=agent_name,
            school_id=school_id,
            batch_id=batch_id,
            task_name=task_name,
        )
    )


def get_cost_context() -> CostContext:
    """Retrieve the current cost context, defaulting to an unknown context if unset."""
    current = _cost_context.get()
    return current if current is not None else CostContext()
