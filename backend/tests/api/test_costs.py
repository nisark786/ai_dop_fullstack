"""
Tests for Cost Monitoring API endpoints.

Endpoints:
    GET /api/costs/summary       — aggregate token and cost usage grouped by agent
    GET /api/costs/invocations   — paginated individual OpenAI invocations with filters
"""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import make_cost_log


class TestCostSummary:
    """Tests for GET /api/costs/summary."""

    def test_cost_summary_returns_200(self, client: TestClient) -> None:
        """GET /api/costs/summary returns HTTP 200 with required top-level summary keys."""
        response = client.get("/api/costs/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_cost_usd" in data
        assert "total_calls" in data
        assert "total_tokens" in data
        assert "avg_cost_per_call_usd" in data
        assert "agent_breakdown" in data
        assert "period_label" in data
        assert data["period_label"] == "Last 7 days"

    def test_cost_summary_aggregates_agent_metrics(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Cost summary aggregates totals and groups breakdown correctly by agent."""
        unique_agent = f"Agent-{uuid.uuid4().hex[:6]}"
        now = datetime.now(UTC)

        make_cost_log(
            db_session,
            agent_name=unique_agent,
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            cost_usd=0.005,
            logged_at=now,
        )
        make_cost_log(
            db_session,
            agent_name=unique_agent,
            prompt_tokens=200,
            completion_tokens=100,
            total_tokens=300,
            cost_usd=0.010,
            logged_at=now,
        )
        db_session.commit()

        response = client.get("/api/costs/summary")
        assert response.status_code == 200
        data = response.json()

        # Find our agent in breakdown
        agent_item = next(
            (a for a in data["agent_breakdown"] if a["agent_name"] == unique_agent), None
        )
        assert agent_item is not None
        assert agent_item["total_calls"] == 2
        assert agent_item["total_tokens"] == 450
        assert agent_item["total_cost_usd"] == 0.015

    def test_cost_summary_custom_days_parameter(self, client: TestClient) -> None:
        """Passing days=30 updates the period_label and filters accordingly."""
        response = client.get("/api/costs/summary?days=30")
        assert response.status_code == 200
        assert response.json()["period_label"] == "Last 30 days"

    def test_cost_summary_invalid_days_returns_422(self, client: TestClient) -> None:
        """days < 1 or days > 90 are rejected by query bounds."""
        assert client.get("/api/costs/summary?days=0").status_code == 422
        assert client.get("/api/costs/summary?days=91").status_code == 422


class TestCostInvocations:
    """Tests for GET /api/costs/invocations."""

    def test_cost_invocations_returns_200(self, client: TestClient) -> None:
        """GET /api/costs/invocations returns paginated structure."""
        response = client.get("/api/costs/invocations")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert data["page"] == 1
        assert data["page_size"] == 20

    def test_cost_invocations_filter_by_agent_name(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Filtering by agent_name returns only matching invocation logs."""
        target_agent = f"SpecialAgent-{uuid.uuid4().hex[:6]}"
        other_agent = f"OtherAgent-{uuid.uuid4().hex[:6]}"

        make_cost_log(db_session, agent_name=target_agent, task_name="task-1")
        make_cost_log(db_session, agent_name=other_agent, task_name="task-2")
        db_session.commit()

        response = client.get(f"/api/costs/invocations?agent_name={target_agent}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert all(item["agent_name"] == target_agent for item in data["items"])

    def test_cost_invocations_filter_by_batch_id(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Filtering by batch_id returns only logs associated with that batch."""
        target_batch = f"batch-{uuid.uuid4().hex[:8]}"

        make_cost_log(db_session, batch_id=target_batch, task_name="batch-task")
        make_cost_log(db_session, batch_id="other-batch", task_name="other-task")
        db_session.commit()

        response = client.get(f"/api/costs/invocations?batch_id={target_batch}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["batch_id"] == target_batch

    def test_cost_invocations_pagination(self, client: TestClient, db_session: Session) -> None:
        """page and page_size parameters control offset and limit accurately."""
        batch_marker = f"paginate-{uuid.uuid4().hex[:6]}"
        for i in range(8):
            make_cost_log(db_session, batch_id=batch_marker, task_name=f"task-{i}")
        db_session.commit()

        # Request page 1 with page_size 5
        res1 = client.get(f"/api/costs/invocations?batch_id={batch_marker}&page=1&page_size=5")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["total"] == 8
        assert len(data1["items"]) == 5
        assert data1["page"] == 1

        # Request page 2 with page_size 5
        res2 = client.get(f"/api/costs/invocations?batch_id={batch_marker}&page=2&page_size=5")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["total"] == 8
        assert len(data2["items"]) == 3
        assert data2["page"] == 2

    def test_cost_invocations_invalid_page_size_bounds(self, client: TestClient) -> None:
        """page_size < 5 or > 100 returns HTTP 422."""
        assert client.get("/api/costs/invocations?page_size=4").status_code == 422
        assert client.get("/api/costs/invocations?page_size=101").status_code == 422

    def test_cost_invocations_invalid_page_bounds(self, client: TestClient) -> None:
        """page < 1 returns HTTP 422."""
        assert client.get("/api/costs/invocations?page=0").status_code == 422

    def test_cost_invocations_resolves_batch_and_school_names(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Cost invocations populate human-readable batch_name and school_name."""
        from tests.factories import make_batch, make_staging_school

        batch = make_batch(db_session, name="Illinois Pilot 2026")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Lincoln High School")
        db_session.commit()

        make_cost_log(
            db_session,
            batch_id=str(batch.id),
            school_id=str(staging.id),
            agent_name="ExtractionAgent",
            task_name="extract_emails",
        )
        db_session.commit()

        response = client.get(f"/api/costs/invocations?batch_id={batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        item = data["items"][0]
        assert item["batch_name"] == "Illinois Pilot 2026"
        assert item["school_name"] == "Lincoln High School"

    def test_cost_invocations_filter_by_batch_name(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Filtering by partial batch name matches logs referencing that batch."""
        from tests.factories import make_batch

        unique_name = f"North Dakota Batch {uuid.uuid4().hex[:6]}"
        batch = make_batch(db_session, name=unique_name)
        db_session.commit()

        make_cost_log(db_session, batch_id=str(batch.id), task_name="crawl_nd")
        db_session.commit()

        response = client.get(f"/api/costs/invocations?batch_id={unique_name[:12]}")
        assert response.status_code == 200
        data = response.json()
        assert any(item["batch_id"] == str(batch.id) for item in data["items"])


class TestCostExport:
    """Tests for GET /api/costs/export."""

    def test_export_cost_logs_csv_returns_streaming_csv(
        self, client: TestClient, db_session: Session
    ) -> None:
        """GET /api/costs/export streams CSV formatted content with header and data."""
        marker = f"csv-agent-{uuid.uuid4().hex[:6]}"
        make_cost_log(
            db_session,
            agent_name=marker,
            prompt_tokens=150,
            completion_tokens=50,
            total_tokens=200,
            cost_usd=0.00004,
            duration_ms=450,
        )
        db_session.commit()

        response = client.get(f"/api/costs/export?agent_name={marker}")
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        assert "Content-Disposition" in response.headers
        assert "openai_cost_audit_" in response.headers["Content-Disposition"]

        content = response.text
        lines = content.strip().split("\r\n" if "\r\n" in content else "\n")
        assert len(lines) >= 2  # Header + at least 1 record
        header = lines[0]
        assert "Logged At (UTC)" in header
        assert "Prompt Tokens" in header
        assert "Completion Tokens" in header
        assert "Cost (USD)" in header
        assert marker in content
