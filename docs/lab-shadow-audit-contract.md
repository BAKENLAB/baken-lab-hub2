# LAB SHADOW — read-only audit contract (draft)

Status: DEVELOPMENT ONLY. No production integration or automatic publishing.

## Verified scope
- Isolated page: `shadow.html` on `feature/lab-shadow-readonly-20261009`.
- No network calls, database reads/writes, prediction scoring, queue claims, or deployment triggers from this page.
- The summary 3 courses / 10 races / 5 READY is a **user-shared Work report**, not independently verified raw evidence.
- Individual 10-race audit JSON, Work source code, and failure causes are **not yet available** in this repository.

## Proposed future input format (not yet implemented)
A future validator may accept the following structure only after the producer's real output schema is confirmed:

```json
{
  "schema_version": "lab-shadow-audit-v1",
  "run_id": "example-only",
  "created_at": "2026-10-09T00:00:00+09:00",
  "races": [
    {
      "race_key": "example-only",
      "course": "example",
      "race_number": 1,
      "scheduled_start": "2026-10-09T12:00:00+09:00",
      "collected_at": "2026-10-09T11:00:00+09:00",
      "status": "DATA_INCOMPLETE",
      "entry_count": 0,
      "horses_with_five_prior_runs": 0,
      "reason_codes": []
    }
  ]
}
```

**This is a design sketch, not real race data. Do not use the example to assert READY or success.**

## Mandatory gates before any live use
1. Obtain raw Work audit artifacts and source code; verify provenance and timestamp.
2. Match official NAR horse identity; verify five *prior* runs for every runner and ensure no post-start leakage.
3. Explain each DATA_INCOMPLETE reason; do not convert missing data to READY.
4. Verify scratches, horse number changes, page/HTML changes, 429/5xx, retries and timeouts.
5. Run reproducible multi-course pre-start tests with logs, plus sustained unattended runs.
6. Confirm read-only DB credentials and no changes to official_predictions, official_results, LAB RANK, LAB EYE, TODAY, RESULT, or queue.
7. Review security, rate limits, and NAR site access conditions before scheduling official-site fetches.
8. Require explicit approval before merging into main or deploying production.

## Branch policy
- Only edit `feature/lab-shadow-readonly-20261009` until reviewed.
- No GitHub Actions scheduler, Supabase migrations, Edge Function deployments, or writes to production.
- UI must label report-derived figures separately from validated audit records.
