# Database Safety Rules

1. **Safety First**:
   - Treat QA, staging, and remote databases as sensitive live environments.
   - Absolutely NO destructive operations (`DROP`, `DELETE`, `TRUNCATE`, `ALTER`, `UPDATE`, `INSERT`) without explicit user command.
2. **Read-Only Connections**:
   - Always enforce read-only transactions on remote/QA databases (`SET TRANSACTION READ ONLY;`).
   - Set statement timeouts (`statement_timeout = '5000'`) to prevent server strain or hanging connections.
3. **No Heavy or Crashing Queries**:
   - Never run unconstrained full table scans or unbounded `COUNT(*)` on large production/QA tables.
   - Always apply strict `LIMIT` clauses (`LIMIT 5` or less) for data sampling.
   - Use metadata catalogs (`pg_class`, `pg_stat_user_tables`, `information_schema`) for fast, non-blocking table statistics.
