"""Unit tests for the OpenAI cost tracking system.

Covers:
- Context management (CostContext, set_cost_context, get_cost_context)
- Event recording (DB insert and graceful JSONL fallback)
- CostTrackingOpenAIClient proxy interception and cost calculation
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from pydantic import BaseModel

from app.cost_tracking.client import CostTrackingOpenAIClient
from app.cost_tracking.context import get_cost_context, set_cost_context
from app.cost_tracking.recorder import (
    _write_to_jsonl,
    record_cost_event,
)


class TestCostContext:
    """Tests for CostContext management via contextvars."""

    def test_default_cost_context(self):
        ctx = get_cost_context()
        assert ctx.agent_name in ("unknown", "test-agent")

    def test_set_and_get_cost_context(self):
        set_cost_context(
            agent_name="MetadataAgent",
            school_id="school-123",
            batch_id="batch-456",
            task_name="extraction",
        )
        ctx = get_cost_context()
        assert ctx.agent_name == "MetadataAgent"
        assert ctx.school_id == "school-123"
        assert ctx.batch_id == "batch-456"
        assert ctx.task_name == "extraction"


class TestCostRecorder:
    """Tests for record_cost_event, DB writes, and JSONL fallback."""

    @patch("app.cost_tracking.recorder.DatabaseSessionFactory")
    def test_record_cost_event_writes_to_db_success(self, mock_factory: MagicMock):
        mock_session = MagicMock()
        mock_factory.return_value.__enter__.return_value = mock_session

        record_cost_event(
            agent_name="TestAgent",
            model="gpt-4o",
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
            cost_usd=0.00015,
            duration_ms=450,
            school_id="sch-1",
            batch_id="bat-1",
            task_name="test",
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @patch("app.cost_tracking.recorder._write_to_db")
    @patch("app.cost_tracking.recorder._write_to_jsonl")
    def test_record_cost_event_db_failure_falls_back(
        self, mock_write_jsonl: MagicMock, mock_write_db: MagicMock
    ):
        mock_write_db.side_effect = RuntimeError("DB connection dropped")

        record_cost_event(
            agent_name="TestAgent",
            model="gpt-4o",
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
            cost_usd=0.00015,
            duration_ms=450,
        )

        mock_write_jsonl.assert_called_once()

    def test_write_to_jsonl_creates_file_and_appends(self, tmp_path: Path, monkeypatch):
        test_log_file = tmp_path / "logs" / "openai_costs.jsonl"
        monkeypatch.setattr("app.cost_tracking.recorder.FALLBACK_LOG_PATH", test_log_file)

        _write_to_jsonl(
            agent_name="FallbackAgent",
            model="gpt-4o-mini",
            prompt_tokens=200,
            completion_tokens=100,
            total_tokens=300,
            cost_usd=0.00003,
            duration_ms=120,
            school_id="sch-fallback",
            batch_id="bat-fallback",
            task_name="audit",
        )

        assert test_log_file.exists()
        lines = test_log_file.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 1
        entry = json.loads(lines[0])
        assert entry["agent_name"] == "FallbackAgent"
        assert entry["model"] == "gpt-4o-mini"
        assert entry["prompt_tokens"] == 200
        assert entry["completion_tokens"] == 100
        assert entry["cost_usd"] == 0.00003

    def test_write_to_jsonl_handles_write_error_gracefully(self, monkeypatch):
        mock_path = MagicMock()
        mock_path.parent.mkdir.side_effect = OSError("Disk write failed")
        monkeypatch.setattr("app.cost_tracking.recorder.FALLBACK_LOG_PATH", mock_path)

        # Should not raise exception
        _write_to_jsonl(
            agent_name="Agent",
            model="gpt-4o",
            prompt_tokens=10,
            completion_tokens=10,
            total_tokens=20,
            cost_usd=0.00001,
            duration_ms=50,
            school_id=None,
            batch_id=None,
            task_name=None,
        )


class DummyResponseFormat(BaseModel):
    name: str


class TestCostTrackingOpenAIClient:
    """Tests for CostTrackingOpenAIClient proxy interception."""

    @patch("app.cost_tracking.client.OpenAI")
    @patch("app.cost_tracking.client.record_cost_event")
    def test_beta_chat_completions_parse_records_cost(
        self, mock_record_cost: MagicMock, mock_openai: MagicMock
    ):
        mock_raw_client = MagicMock()
        mock_openai.return_value = mock_raw_client

        # Mock parsed completion with usage
        mock_completion = MagicMock()
        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 1000
        mock_usage.completion_tokens = 500
        mock_usage.total_tokens = 1500
        mock_completion.usage = mock_usage
        mock_raw_client.beta.chat.completions.parse.return_value = mock_completion

        client = CostTrackingOpenAIClient(
            api_key="sk-test",
            input_cost_per_m=2.50,
            output_cost_per_m=10.00,
        )

        set_cost_context(agent_name="ParseAgent", school_id="school-parse")
        result = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
            response_format=DummyResponseFormat,
        )

        assert result == mock_completion
        mock_record_cost.assert_called_once()
        kwargs = mock_record_cost.call_args[1]
        assert kwargs["agent_name"] == "ParseAgent"
        assert kwargs["prompt_tokens"] == 1000
        assert kwargs["completion_tokens"] == 500
        # Cost: (1000 / 1M) * 2.50 + (500 / 1M) * 10.00 = 0.0025 + 0.0050 = 0.0075
        assert pytest.approx(kwargs["cost_usd"], 1e-6) == 0.0075

    @patch("app.cost_tracking.client.OpenAI")
    @patch("app.cost_tracking.client.record_cost_event")
    def test_beta_chat_completions_parse_without_usage_does_not_record(
        self, mock_record_cost: MagicMock, mock_openai: MagicMock
    ):
        mock_raw_client = MagicMock()
        mock_openai.return_value = mock_raw_client

        mock_completion = MagicMock()
        mock_completion.usage = None
        mock_raw_client.beta.chat.completions.parse.return_value = mock_completion

        client = CostTrackingOpenAIClient(api_key="sk-test")
        result = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[],
            response_format=DummyResponseFormat,
        )

        assert result == mock_completion
        mock_record_cost.assert_not_called()

    @patch("app.cost_tracking.client.OpenAI")
    @patch("app.cost_tracking.client.record_cost_event")
    def test_standard_chat_completions_create_records_cost(
        self, mock_record_cost: MagicMock, mock_openai: MagicMock
    ):
        mock_raw_client = MagicMock()
        mock_openai.return_value = mock_raw_client

        mock_completion = MagicMock()
        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 2000
        mock_usage.completion_tokens = 1000
        mock_usage.total_tokens = 3000
        mock_completion.usage = mock_usage
        mock_raw_client.chat.completions.create.return_value = mock_completion

        client = CostTrackingOpenAIClient(
            api_key="sk-test",
            input_cost_per_m=5.00,
            output_cost_per_m=15.00,
        )

        set_cost_context(agent_name="CreateAgent", task_name="summary")
        result = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hello"}],
        )

        assert result == mock_completion
        mock_record_cost.assert_called_once()
        kwargs = mock_record_cost.call_args[1]
        assert kwargs["agent_name"] == "CreateAgent"
        assert kwargs["task_name"] == "summary"
        # Cost: (2000 / 1M) * 5.00 + (1000 / 1M) * 15.00 = 0.010 + 0.015 = 0.025
        assert pytest.approx(kwargs["cost_usd"], 1e-6) == 0.025

    @patch("app.cost_tracking.client.OpenAI")
    @patch("app.cost_tracking.client.record_cost_event")
    def test_standard_chat_completions_create_without_usage_does_not_record(
        self, mock_record_cost: MagicMock, mock_openai: MagicMock
    ):
        mock_raw_client = MagicMock()
        mock_openai.return_value = mock_raw_client

        mock_completion = MagicMock()
        mock_completion.usage = None
        mock_raw_client.chat.completions.create.return_value = mock_completion

        client = CostTrackingOpenAIClient(api_key="sk-test")
        result = client.chat.completions.create(
            model="gpt-4o",
            messages=[],
        )

        assert result == mock_completion
        mock_record_cost.assert_not_called()
