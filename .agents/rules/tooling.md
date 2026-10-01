# Tooling & Package Manager Standards

## Mandatory Rules:

1. **Python / Backend Environment**:
   - **ALWAYS** use `uv` for all Python environments, dependency management, and script execution.
   - **NEVER** use system-wide Python directly.
   - **NEVER** use standard `pip` or `python -m pip`.
   - Always initialize environments using `uv init` / `uv venv`.
   - Install and manage dependencies using `uv add` or `uv pip install`.
   - Run backend services and scripts via `uv run` (or activate the `.venv` created by `uv`).

2. **Frontend Environment**:
   - **ALWAYS** use `pnpm` for all frontend package management and script execution (`pnpm install`, `pnpm dev`, `pnpm build`).
   - **NEVER** use `npm` or `yarn`.
   - Maintain `pnpm-lock.yaml` and avoid committing `package-lock.json`.
