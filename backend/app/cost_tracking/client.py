import logging
import time
from typing import Any, TypeVar

from openai import OpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.cost_tracking.context import get_cost_context
from app.cost_tracking.recorder import record_cost_event

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class _BetaChatCompletionsProxy:
    """Proxies beta.chat.completions.parse and records costs."""

    def __init__(self, raw_client: OpenAI, input_rate: float, output_rate: float):
        self._raw = raw_client
        self._input_rate = input_rate
        self._output_rate = output_rate

    def parse(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        response_format: type[T],
        **kwargs: Any,
    ) -> Any:
        ctx = get_cost_context()
        start_time = time.monotonic()

        completion = self._raw.beta.chat.completions.parse(
            model=model,
            messages=messages,
            response_format=response_format,
            **kwargs,
        )

        duration_ms = int((time.monotonic() - start_time) * 1000)
        usage = getattr(completion, "usage", None)

        if usage:
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            total_tokens = getattr(usage, "total_tokens", prompt_tokens + completion_tokens) or (
                prompt_tokens + completion_tokens
            )
            cost_usd = (prompt_tokens / 1_000_000.0) * self._input_rate + (
                completion_tokens / 1_000_000.0
            ) * self._output_rate

            record_cost_event(
                agent_name=ctx.agent_name,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
                duration_ms=duration_ms,
                school_id=ctx.school_id,
                batch_id=ctx.batch_id,
                task_name=ctx.task_name,
            )

        return completion


class _BetaChatProxy:
    def __init__(self, completions: _BetaChatCompletionsProxy):
        self.completions = completions


class _BetaProxy:
    def __init__(self, chat: _BetaChatProxy):
        self.chat = chat


class _StandardChatCompletionsProxy:
    """Proxies chat.completions.create for non-structured calls and records costs."""

    def __init__(self, raw_client: OpenAI, input_rate: float, output_rate: float):
        self._raw = raw_client
        self._input_rate = input_rate
        self._output_rate = output_rate

    def create(self, *, model: str, messages: list[dict[str, Any]], **kwargs: Any) -> Any:
        ctx = get_cost_context()
        start_time = time.monotonic()

        completion = self._raw.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs,
        )

        duration_ms = int((time.monotonic() - start_time) * 1000)
        usage = getattr(completion, "usage", None)

        if usage:
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            total_tokens = getattr(usage, "total_tokens", prompt_tokens + completion_tokens) or (
                prompt_tokens + completion_tokens
            )
            cost_usd = (prompt_tokens / 1_000_000.0) * self._input_rate + (
                completion_tokens / 1_000_000.0
            ) * self._output_rate

            record_cost_event(
                agent_name=ctx.agent_name,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
                duration_ms=duration_ms,
                school_id=ctx.school_id,
                batch_id=ctx.batch_id,
                task_name=ctx.task_name,
            )

        return completion


class _StandardChatProxy:
    def __init__(self, completions: _StandardChatCompletionsProxy):
        self.completions = completions


class CostTrackingOpenAIClient:
    """Drop-in wrapper around official OpenAI client that transparently logs

    token usage, execution latency, and calculated USD costs per invocation.
    """

    def __init__(
        self,
        api_key: str | None = None,
        input_cost_per_m: float | None = None,
        output_cost_per_m: float | None = None,
    ):
        resolved_api_key = api_key or settings.openai_api_key
        input_rate = (
            input_cost_per_m if input_cost_per_m is not None else settings.openai_input_cost_per_m
        )
        output_rate = (
            output_cost_per_m
            if output_cost_per_m is not None
            else settings.openai_output_cost_per_m
        )

        self._raw_client = OpenAI(api_key=resolved_api_key)
        self.beta = _BetaProxy(
            _BetaChatProxy(_BetaChatCompletionsProxy(self._raw_client, input_rate, output_rate))
        )
        self.chat = _StandardChatProxy(
            _StandardChatCompletionsProxy(self._raw_client, input_rate, output_rate)
        )
