---
name: secrets-management
description: "Comprehensive standards for managing environment variables and preventing hardcoded secrets, API keys, credentials, and sensitive connection strings."
risk: safe
date_added: "2026-09-09"
---

# Secrets Management & Zero-Hardcoding Skill

This skill enforces strict security hygiene across the fullstack codebase, ensuring that sensitive secrets, API keys, database connection strings, passwords, and tokens are **never hardcoded** and **never committed** to version control.

---

## 🧠 Core Philosophy
> **"Zero secrets in code. Zero secrets in git."**  
> Every secret must be treated as a runtime injection parameter managed via `.env` files locally or secure vaults in production.

---

## 1. Golden Rules of Secrets Management

1. **Never Hardcode Secrets**:
   - Never write API keys (e.g. `sk-...`, `fc-...`, `tvly-...`), passwords, database connection strings, JWT secrets, or tokens directly into `.py`, `.ts`, `.tsx`, `.js`, `.json`, `.sql`, or shell scripts.
   - Never place real secrets into test fixtures or example documentation.
2. **Strict `.gitignore` Enforcement**:
   - All `.env` files (including `.env.local`, `.env.production`, `.env.test`) MUST be included in `.gitignore`.
   - The ONLY file permitted in version control is `.env.example`, which contains descriptive variable names with blank or placeholder values.
3. **Always Maintain `.env.example`**:
   - Whenever a new environment variable is introduced into `backend/` or `frontend/`, immediately add its key and a safe placeholder description to `.env.example`.
4. **Dynamic Runtime Configuration**:
   - **Backend (Python)**: Read configuration strictly through `pydantic-settings` (`ApplicationSettings` in `app.core.config`) or `os.getenv()`. Never fallback to hardcoded production credentials in code.
   - **Frontend (React/Vite)**: Reference public variables strictly via `import.meta.env.VITE_*`. Never expose private backend keys or database URLs to frontend client bundles.
5. **Log & Error Sanitization**:
   - Never print or log raw connection strings or authentication headers in `console.log`, `print()`, or structured logger payloads.
   - Mask credentials before logging (e.g., `postgresql://user:****@host:port/db` or `sk-...****`).

---

## 2. When to Invoke This Skill
Invoke this skill:
- When adding a new 3rd-party API client or external service (OpenAI, Firecrawl, Tavily, Supabase, Stripe, AWS).
- When creating or modifying database connections or ORM session factories.
- Before committing or reviewing code, to verify no secrets were inadvertently staged.
- When creating scratch or inspection scripts (always read credentials from environment variables, never embed credentials in scripts).
- When reviewing or updating `.gitignore` rules.

---

## 3. Pre-Commit Secrets Checklist

Before saving, testing, or committing any changes:
- [ ] Are any raw API keys, passwords, or tokens hardcoded in the changed files?
- [ ] Is `.env` actively ignored in `.gitignore`?
- [ ] Is `git status` free of untracked or staged `.env` files?
- [ ] Has `.env.example` been updated with safe placeholder values for any newly introduced configuration keys?
- [ ] Do any print or log statements output raw credentials or Authorization headers?
- [ ] Are database URLs containing passwords normalized and masked in error outputs?
