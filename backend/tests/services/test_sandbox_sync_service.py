"""Service tests for SandboxSyncService with mocked engine (zero live RDS mutations)."""

import uuid
from unittest.mock import MagicMock

from sqlalchemy.exc import OperationalError

from app.services.sandbox_sync.sync_service import SandboxSyncService


def test_sync_school_missing_name():
    result = SandboxSyncService.sync_school(school_data={}, engine=MagicMock())
    assert result.status == "failed"
    assert "school name is missing" in (result.error or "")


def test_sync_school_disabled_when_no_engine(monkeypatch):
    monkeypatch.setattr("app.services.sandbox_sync.sync_service.get_sandbox_engine", lambda: None)
    result = SandboxSyncService.sync_school(school_data={"name": "Test School"})
    assert result.status == "disabled"
    assert "disabled or connection parameters are unconfigured" in (result.message or "")


def test_sync_school_insert_flow():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    # Check query returns None (not found)
    mock_conn.execute.return_value.fetchone.side_effect = [
        None,  # Not found by name
        (str(uuid.uuid4()),),  # RETURNING id from insert
    ]

    school_data = {
        "name": "Oakridge Preparatory",
        "website": "https://oakridge.example.com",
        "address": "500 Oakridge Way",
        "phone": "512-555-1234",
        "email": "info@oakridge.example.com",
        "type": ["private"],
        "grades": ["K", "1", "2"],
        "description": "Excellence in education",
    }

    result = SandboxSyncService.sync_school(
        school_data=school_data,
        engine=mock_engine,
    )

    assert result.status == "synced"
    assert result.sandbox_id is not None
    assert "Inserted new school" in (result.message or "")
    assert mock_conn.commit.called


def test_sync_school_update_flow():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    existing_id = str(uuid.uuid4())
    # Match by name returns existing id
    mock_conn.execute.return_value.fetchone.side_effect = [
        (existing_id,),
    ]

    school_data = {
        "name": "Oakridge Preparatory",
        "website": "https://oakridge-new.example.com",
        "phone": "512-555-9999",
    }

    result = SandboxSyncService.sync_school(
        school_data=school_data,
        engine=mock_engine,
    )

    assert result.status == "synced"
    assert result.sandbox_id == existing_id
    assert "Updated school" in (result.message or "")
    assert mock_conn.commit.called


def test_sync_school_catches_db_error_gracefully():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_conn.execute.side_effect = OperationalError("connection timed out", None, None)

    result = SandboxSyncService.sync_school(
        school_data={"name": "Faulty Network School"},
        engine=mock_engine,
    )

    assert result.status == "failed"
    assert "connection timed out" in (result.error or "")
