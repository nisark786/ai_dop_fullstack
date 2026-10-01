---
name: docs-maintenance
description: "Automatically maintain and synchronize docs/DEVELOPER_GUIDE.md whenever changes, new features, new endpoints, or builds are performed."
risk: safe
date_added: "2026-09-07"
---

# Documentation Maintenance Skill

This skill ensures that `docs/DEVELOPER_GUIDE.md` is continuously maintained as the single source of truth for all developers working on the SchoolPath AI-DOP project.

## When to Invoke
Invoke this skill whenever:
- Adding or modifying backend API endpoints or routes in `app/api/routes/`.
- Adding or modifying frontend pages, components, or services in `frontend/src/`.
- Adding or changing environment variables in `backend/.env` or `frontend/.env`.
- Installing, upgrading, or removing packages in `pyproject.toml` or `package.json`.
- Changing database schemas, models, or migrations in `alembic/` or `app/models/`.
- Fixing bugs or changing operational/build commands.

## Key Instructions
1. **Never ship changes without updating documentation**:
   Before finishing any feature, refactor, or bug fix, review `docs/DEVELOPER_GUIDE.md`.
2. **Synchronize System Architecture Map**:
   Ensure newly added files and directories are accurately reflected in the file tree diagram.
3. **Keep Commands & Ports Accurate**:
   Verify port numbers (e.g. backend `8001`, frontend `5173`) and startup commands (`uv run uvicorn ...`, `pnpm dev`).
4. **Document New APIs & Types**:
   If an endpoint or payload changes, update Section 6 ("Core Subsystems & How They Work") and Section 3 ("Repository Layout").
5. **Add FAQs for Encountered Errors**:
   If a subtle issue is solved (e.g. contract discrepancies, rate limits, CORS origins), document the diagnosis and fix in Section 8 ("Troubleshooting & FAQ").
