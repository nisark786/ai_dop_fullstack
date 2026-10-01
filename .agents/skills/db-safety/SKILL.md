---
name: db-safety
description: Safe, non-destructive, read-only database operations and inspection procedures for remote, staging, QA, and production databases.
---

# Database Safety & Safe Inspection Skill

## Core Principles
1. **Never Execute Destructive Commands**:
   - `DROP`, `DELETE`, `TRUNCATE`, `ALTER`, `UPDATE`, `INSERT` are strictly forbidden on remote, QA, staging, and production environments unless explicitly ordered and confirmed by the user.
2. **Read-Only Session Enforcement**:
   - Explicitly open sessions with `SET TRANSACTION READ ONLY;` or connection execution options `{"postgresql_readonly": True}`.
   - Set a strict statement timeout (e.g. `SET statement_timeout = '5000';` / 5s) to guarantee no runaway queries or table locking.
3. **Zero Heavy Queries / Prevent DB Crashes**:
   - Never run unbounded `SELECT *` without an explicit small limit (`LIMIT 3` to `LIMIT 10`).
   - Never run unindexed or unbounded `COUNT(*)` on large tables.
   - Use metadata and catalog tables for row estimates (`pg_stat_user_tables.n_live_tup` or `pg_class.reltuples`) instead of scanning tables.
   - For schema inspection, use `information_schema.tables`, `information_schema.columns`, or `sqlalchemy.inspect`.
4. **Isolated Connections**:
   - Close connections immediately after inspection.
   - Do not hold open transactions or long-lived locks.
