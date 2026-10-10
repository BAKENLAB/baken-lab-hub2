# JRA v16 recovery candidate (SHADOW only)
Baseline: production jra-live v16, fetched through Supabase MCP. Candidate is NOT deployed.
Changes only: no eligible seed emits JRA_NO_SEED and HTTP 503; returned future-seed upsert error emits JRA_FUTURE_SEED_SAVE_FAILED and HTTP 500.
Future-seed failure may occur AFTER queue registration; response reports queued count. This is not atomic; existing ignoreDuplicates semantics remain unchanged. A thrown transport exception still propagates, never returns success.
Tests execute candidate's actual discover handler with mocked DB/HTTP/anchor extraction. Synthetic future CNAME is a test fixture, not an official link.
No real HTML/DOM test or real PostgreSQL verification performed.
Production HTML-only acquisition route: unavailable in jra-live (discover/sync_batch write; status does not fetch); available JRA MCP only provides claimed context and save.
Confirmed seed: https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0105202604040120261011%2F7C (2026-10-11 Tokyo 1R, prior official web verification).
Executor proxy connection failed previously; no repeat/bypass this phase.
Remaining: raw HTML acquisition through approved environment; real discover link exploration; current-only status parser and UNKNOWN stop; verified horse-ID history filtering; isolated integration tests; separately authorized production changes.
LOCAL, HUB, cron and main unchanged.
