# Stage 1: fixed prediction transport

Uncommitted local implementation, including protocol compatibility and per-race isolation. No prediction generation, selection protocol,
database migration, production deployment, or GitHub write is included.

## Files

- index.html: dedicated EYE reason, validated responses, reconciliation of partial
  race lists, clearing failed state, and ignoring superseded requests.
- prediction-contract.mjs: structural validation and exact protected-field comparison.
- supabase/functions/hub2-api/index.ts: local copy of deployed hub2-api v11 with
  transport guards. Original deployed source was obtained through Supabase.
- tests/reliability.test.mjs: real API handler and real inline HUB rendering code
  exercised with a simulated DB/DOM/network; no external packages are required.
- tests/fixtures/saved-prediction.json: a fixed synthetic official_predictions row.
  Its order, TOP5 and EYE are explicit expectations, not computed selections.
- scripts/verify-prediction.mjs: independent saved-row export vs API JSON check.

## Run

Requires Node 24 (TypeScript stripping is used only by the API test harness).

    node tests/reliability.test.mjs
    node scripts/verify-prediction.mjs saved-row.json api-response.json

Export saved-row.json from official_predictions through a read-only trusted
database connection. api-response.json is an unmodified list, prediction, or
results response. The comparator checks every occurrence of the same prediction
ID. Neither command writes to Supabase.

Protected fields: each runner's horse_no, horse_name, rank, grade in saved array
order; the entire saved TOP5 and EYE objects, including the EYE-specific reason.
Object key order is ignored; array order and values are exact.

The API compares its mapped payload with the row it just read and attaches
integrity.saved plus prediction_id. HUB checks this evidence before rendering.
This is a consistency check, not cryptographic authentication. The independent
export comparator is needed to verify against a separately obtained DB snapshot.
Market/rider metadata are outside the protected ranking fields and remain mutable.

Canonical payloads are not rebuilt. Incomplete canonical payloads fail with
DATA ERROR; no rank, TOP5, or EYE is invented. Supported protocol names are explicit in PROTOCOLS:

| protocol_version | EYE text | Notes |
| --- | --- | --- |
| BAKEN_LAB_STANDARD_7_KEYS | eye.comment only | reason is not substituted |
| BAKEN_LAB_WORK_TEST_V3 | none | excluded from normal prediction display |
| CHAPPY_DIRECT_1 | eye.reason, then eye.comment | fallback stays within saved EYE object |
| CHAPPY_LOCAL_1.1_20260926 | eye.reason only | eye=null allowed with at most five saved runners; required with six or more |
| CHAPPY_LOCAL_1.2_EYE_GUARD_20260929 | eye.reason only | no comment fallback |
| CHAPPY_LOCAL_1.3_EXECUTION_GUARD_20260930 | eye.reason only | no comment fallback |
| CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930 | eye.reason only | no comment fallback |
| JRA_REBUILD_0.3_FLAT_HISTORY | eye.reason only | no comment fallback |
| CHAT_PRE_RACE_LEGACY | eye.reason, then eye.comment | existing chappy_predictions adapter, separate from official production inventory |

EYE comment fallback is only from the saved EYE object itself. No runner comment
is ever used. The API does not add or rewrite eye.reason: equality comparisons
include the original eye object, including any comment field. eye=null is valid
with at most five saved runners. CHAPPY_LOCAL_1.1_20260926 requires EYE for six or more saved runners; a missing required EYE is isolated as DATA ERROR.
Unknown protocols are unsupported, not guessed by payload shape. Test tokens
(TEST/SMOKE/FIXTURE separated by underscore or hyphen) in protocol_version or
source, or explicit is_test=true, are excluded from prediction lists; metadata
is reported in excluded_predictions. Direct/detail RESULT access never exposes
their RANK/TOP5/EYE. Existing old-format conversion guesses were removed.

The eight official production protocol names and EYE rules above were supplied
by the user as authoritative after the SQL inventory could not be retrieved.
Read-only production audits use these supplied rules without changing stored data.
Unknown names are never converted by payload shape. Runners/TOP5/EYE must be
present in their saved schema; missing ranking data is not reconstructed.

A malformed prediction or unsupported protocol is returned as a metadata-only
DATA_ERROR envelope for that race. TODAY/RESULT show a disabled DATA ERROR row,
while valid peers continue displaying. The HUB also isolates malformed prediction
payloads independently. Network/query failure and an invalid top-level response
still produce a page-level SYSTEM/DATA ERROR because availability is unknown.

The updated HUB requires the updated API integrity envelope and RESULT
prediction_state. Deploying only the HUB would produce DATA ERROR against the
old API. No deployment has been performed. Before eventual release, validate
existing rows read-only for schema compatibility and deploy the API before HUB.
Existing malformed rows may now surface DATA ERROR rather than blank output.

Tests do not claim a live production DB comparison or browser end-to-end run.
Supabase networking, database policies, and deployment packaging still require
verification in a later deployment stage.

## Latest validation

39 tests passed: the previous 28 cases plus 11 new production-protocol tests.
The earlier reason-only test now uses CHAPPY_LOCAL_1.2_EYE_GUARD_20260929,
since the user explicitly enabled EYE comment fallback for CHAPPY_DIRECT_1.
Saved array order, ranks, grades, TOP5 and EYE objects remain the test expectations.
No selections are recalculated. Tests use local fixed rows and simulated services.
No main commit, Supabase write, or deployment was performed.

## Saved-form compatibility

DIRECT and STANDARD_7_KEYS accept TOP5 objects with saved mark/horse_no/horse_name
and absent rank/grade. JRA_REBUILD accepts TOP5 without grade, retaining its saved rank.
Present invalid values are still rejected; omitted values are never inferred from runners.
DIRECT alone accepts a runner with status=CANCELLED and rank=null, preserving both.
X copy prints rank only when saved and prints the saved mark without reordering TOP5.
payload.audit.run_mode=WORK_TEST alone does not exclude a prediction.

Verification: 39 existing + 9 compatibility tests passed (48 total). A fresh read-only
SELECT of 239 production rows classified 237 normal, 2 excluded, 0 DATA ERROR.
These are local compatibility results; no production release has occurred.
