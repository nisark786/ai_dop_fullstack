# Explicit Imports & Clean Organization Standards

## Mandatory Rules:

1. **Explicit Imports**:
   - Every file must explicitly import the modules, functions, and classes it directly needs.
   - **NEVER** use wildcard imports (`from module import *` or `import *`).
   - Do not rely on implicit transitive re-exports unless explicitly consuming a designated public barrel export (`index.ts` or `__init__.py`).

2. **Clean Organization**:
   - Keep your import statements transparent so that code dependencies are obvious at a glance.
   - Maintain clear grouping separated by empty lines:
     - **Backend (Python)**:
       1. Standard library imports (e.g., `os`, `sys`, `typing`, `datetime`, `uuid`)
       2. Third-party dependencies (e.g., `fastapi`, `pydantic`, `sqlalchemy`, `openai`)
       3. First-party application modules (e.g., `app.core`, `app.models`, `app.schemas`, `app.services`)
     - **Frontend (TypeScript / React)**:
       1. Core framework / React imports (`react`, `react-router-dom`)
       2. Third-party libraries (`lucide-react`, TanStack Query)
       3. Internal project modules (components, services, types)
   - Zero unused imports: Remove all dead imports immediately.
   - Automated enforcement: All Python imports must conform to `uv run ruff check app` (isort) and TypeScript to `pnpm lint`.
