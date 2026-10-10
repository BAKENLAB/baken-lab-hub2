# 2026-10-10 Saga 12R — offline completed-template trial

LOCAL MCP v9 claimed job 690184e8-b7a1-4cd5-8ee8-c548f4e1806d using
LOCAL_QUEUE_WEST after explicit user authorization. A read-only DB query confirmed
the returned job was Saga 12R before lab_claimed_context was called.
The MCP returned 14 runners, COMPACT_V1, active LOCAL 1.5 and
field_integrity_checked=true. No independent official re-fetch was performed.

Input and all completion records are SHADOW only. No production prediction save,
HUB publication, external OpenAI API call, cron/config change or main change.

Ordering: 13 B, 3 B, 12 C, 10 C, 6 C, 8 D, 14 D, 2 D, 1 D, 4 D, 9 D,
7 E, 5 E, 11 F. TOP5: 13,3,12,10,6. EYE: null.
The evaluator selected this ordering; the recording script does not calculate scores.

14 runner evidence records, 9 outside candidates, 153 check records and 36 distinct
unordered-pair assessments are in completed-payload.json. Unavailable checks are
MISSING with empty refs; no nonexistent race or current attribute was filled in.
Horse 3 has four provided history entries. Horse 4's canceled race meeting has
finish=null and is not treated as a completed defeat. JRA margins are strings, not
seconds behind the winner. Historical JRA position-derived display labels are copied
unchanged and not used as current NAR pace evidence.

Completion timestamp and elapsed time (293.17 seconds from pre-claim clock to payload
completion) are in validation-record.json. Original claim expires 20:15:53 JST;
this does not establish that the claim is still live when someone later reads this.
Do not run claim or save from this directory. A later save requires separate permission
and fresh deadline/claim/field checks. This trial is not a HUB prediction success.

```sh
node research/lab-shadow/local-save-template-v1/cli.mjs check research/lab-shadow/live-template-trials/20261010-saga12/completed-payload.json research/lab-shadow/live-template-trials/20261010-saga12/input-context.json
```

CLI PASS: format_valid=true, production_save_verified=false.
Do not overwrite completed payload/input to incorporate later data or results.
Any later result comparison belongs in separate newly named files.
evaluation-record.mjs uses exclusive creation and will refuse existing outputs.

Still unverified: raw official HTML provenance independent of MCP, completeness of
past career, current draw/body weight/equipment, local recent positions, trouble,
training, class_name and exact promotions/demotions, and actual guarded DB acceptance.
Format validation cannot prove semantic truth or evaluation quality.
