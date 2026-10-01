"""
Tests for the Prompt Studio API.

Endpoints:
    GET /api/prompts              — list prompt templates (auto-seeds if empty)
    PUT /api/prompts/{id}        — update prompt_text, version, is_active

Seeding behaviour
-----------------
``_seed_initial_prompts_if_empty()`` is called on every GET /api/prompts.
It checks ``PromptTemplateModel.count()`` and inserts two default templates
("Open Seats (Grade 1)" and "SPED Accommodations") when the table is empty.

Because the DB session is rolled back after each test, each test starts
with an empty ``prompt_templates`` table — so seeding runs fresh every time.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# The two hard-coded default template IDs seeded by the route
SEED_IDS = {"prompt-os-01", "prompt-sped-01"}
SEED_NAMES = {"Open Seats (Grade 1)", "SPED Accommodations"}


class TestGetPrompts:
    """Tests for GET /api/prompts."""

    def test_get_prompts_returns_200(self, client: TestClient) -> None:
        """GET /api/prompts always returns HTTP 200."""
        response = client.get("/api/prompts")
        assert response.status_code == 200

    def test_get_prompts_seeds_two_defaults_on_empty_table(self, client: TestClient) -> None:
        """When the table is empty, exactly 2 default templates must be seeded."""
        response = client.get("/api/prompts")
        body = response.json()

        assert isinstance(body, list)
        assert len(body) == 2

    def test_get_prompts_seeded_ids_are_correct(self, client: TestClient) -> None:
        """Seeded records must carry the canonical IDs from DEFAULT_INITIAL_PROMPTS."""
        response = client.get("/api/prompts")
        returned_ids = {item["id"] for item in response.json()}
        assert returned_ids == SEED_IDS

    def test_get_prompts_seeded_product_names_are_correct(self, client: TestClient) -> None:
        """Seeded records must carry the canonical product names."""
        response = client.get("/api/prompts")
        returned_names = {item["product_name"] for item in response.json()}
        assert returned_names == SEED_NAMES

    def test_get_prompts_response_schema_contains_required_fields(self, client: TestClient) -> None:
        """Every returned item must have all PromptTemplateResponse fields."""
        response = client.get("/api/prompts")
        item = response.json()[0]

        required_keys = {
            "id",
            "product_name",
            "version",
            "prompt_text",
            "approval_rate",
            "correction_rate",
            "rejection_rate",
            "total_evaluations",
            "is_active",
        }
        assert required_keys.issubset(item.keys())

    def test_get_prompts_does_not_double_seed_on_second_call(self, client: TestClient) -> None:
        """Two consecutive GET requests must not create duplicate records."""
        client.get("/api/prompts")
        response = client.get("/api/prompts")
        assert len(response.json()) == 2

    def test_get_prompts_sorted_alphabetically_by_product_name(self, client: TestClient) -> None:
        """Results must be ordered by product_name ascending (Open < SPED)."""
        response = client.get("/api/prompts")
        names = [item["product_name"] for item in response.json()]
        assert names == sorted(names)

    def test_get_prompts_skips_seed_when_records_already_exist(
        self, client: TestClient, db_session: Session
    ) -> None:
        """
        When at least one template already exists, _seed_initial_prompts_if_empty
        is a no-op — a second GET call must not increase the template count.
        """
        # First call: may seed or find existing rows
        first_response = client.get("/api/prompts")
        count_after_first = len(first_response.json())

        # Second call: count must be identical (no additional seeding)
        second_response = client.get("/api/prompts")
        count_after_second = len(second_response.json())

        assert count_after_second == count_after_first

    def test_get_prompts_is_active_field_is_bool(self, client: TestClient) -> None:
        """is_active must be a boolean value in the response."""
        response = client.get("/api/prompts")
        for item in response.json():
            assert isinstance(item["is_active"], bool)


class TestUpdatePrompt:
    """Tests for PUT /api/prompts/{template_id}."""

    def _seed(self, client: TestClient) -> list[dict]:
        """Helper: seed defaults and return the list of templates."""
        return client.get("/api/prompts").json()

    def test_update_prompt_returns_200(self, client: TestClient) -> None:
        """PUT /api/prompts/{id} with a valid payload returns HTTP 200."""
        templates = self._seed(client)
        template_id = templates[0]["id"]

        response = client.put(
            f"/api/prompts/{template_id}",
            json={"prompt_text": "Updated prompt text with enough characters."},
        )
        assert response.status_code == 200

    def test_update_prompt_text_is_persisted(self, client: TestClient) -> None:
        """Updated prompt_text must appear in the response body."""
        templates = self._seed(client)
        template_id = templates[0]["id"]
        new_text = "This is a revised extraction prompt with sufficient length."

        response = client.put(
            f"/api/prompts/{template_id}",
            json={"prompt_text": new_text},
        )
        assert response.json()["prompt_text"] == new_text

    def test_update_prompt_version_is_updated(self, client: TestClient) -> None:
        """When version is supplied, the returned record must reflect it."""
        templates = self._seed(client)
        template_id = templates[0]["id"]

        response = client.put(
            f"/api/prompts/{template_id}",
            json={
                "prompt_text": "Some updated prompt text long enough for validation.",
                "version": "v9.9",
            },
        )
        assert response.json()["version"] == "v9.9"

    def test_update_prompt_can_deactivate(self, client: TestClient) -> None:
        """is_active=false must disable the template."""
        templates = self._seed(client)
        template_id = templates[0]["id"]

        response = client.put(
            f"/api/prompts/{template_id}",
            json={
                "prompt_text": "Deactivation test prompt text with enough characters.",
                "is_active": False,
            },
        )
        assert response.json()["is_active"] is False

    def test_update_prompt_not_found_returns_404(self, client: TestClient) -> None:
        """PUT with an unknown template_id returns HTTP 404."""
        response = client.put(
            "/api/prompts/nonexistent-prompt-id",
            json={"prompt_text": "Prompt text that is long enough for validation."},
        )
        assert response.status_code == 404

    def test_update_prompt_too_short_text_returns_422(self, client: TestClient) -> None:
        """prompt_text shorter than 10 characters is rejected (min_length=10)."""
        templates = self._seed(client)
        template_id = templates[0]["id"]

        response = client.put(
            f"/api/prompts/{template_id}",
            json={"prompt_text": "Short"},
        )
        assert response.status_code == 422

    def test_update_prompt_updates_timestamp(self, client: TestClient) -> None:
        """updated_at must be present (non-null) in the response after an update."""
        templates = self._seed(client)
        template_id = templates[0]["id"]

        response = client.put(
            f"/api/prompts/{template_id}",
            json={"prompt_text": "Timestamp verification prompt text is long enough."},
        )
        assert response.json()["updated_at"] is not None
