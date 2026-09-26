# SQL / DB tests

Run with:

```sh
bun run test:db
```

This runs `supabase db reset` (fresh, seeded local database) and then every
`tests/db/*.test.sql` file in sorted order. It uses `psql` when it's on PATH
and `SUPABASE_DB_URL` is set, and otherwise falls back to `docker exec`
against the local Supabase Postgres container (override its name with
`SUPABASE_DB_CONTAINER`).

Only one local Supabase stack can run at a time on the default ports, so
stop any other `supabase start` (e.g. from a different worktree/branch)
before running this — `supabase stop` first if unsure.
