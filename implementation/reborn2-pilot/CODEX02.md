# Codex02 practical development
Main audit 44685775b3146749acb30aa84996b5371f6202eb.
Work02 source preflight 75372fd85c3eccc602b663af45ddc4ff11c4fd85.
Fixed engine f565e88af3404c84328a6cd035d2f21df3ea49dc untouched.

- compact-store.mjs: lossless byte-order reconstruction of the Codex01
  serialized snapshot; per-runner/per-field gzip content-addressed objects,
  committed manifest and race/model/cutoff/mode identity no-replace.
  Original Codex01 projection remains the baseline; no additional analysis
  content or refs discarded. Hashes are local integrity, not external custody.
- mobile-preview.mjs: loopback GET only. List loads compact manifest summary,
  not raw analysis objects. Click individual horse/section/route/item to
  read and verify just that field, then paginate displayed text at 12000
  characters. No inline giant JSON or external network calls. Detail field
  decompresses on server, not mobile; full axis evidence remains in paths.
  No browser performance claim from HTTP byte tests.
- comments-ja.mjs: Japanese summaries based on actual source-bound
  route rank ranges, relative clock differences, named roster peers,
  reported finish/final600/context, mixed supports/counters and holds.
  No invented real race dates; synthetic fixture IDs remain only in evidence
  links/detail. Summary does not assign a new grade.
- work02-supply-plan.mjs: source-specific field mapping from Work02 aggregate
  and metadata only. JRA raw HTML hash is not bytes; LOCAL horse_runs no
  horse_ref means no name join. Literal race laps/corner groups not individual
  clocks/ranks. Actual projection/engine input remain closed until explicit
  permission, verified official native source and trusted custody. Work02
  preflight is not a real packet. No new data acquired.

Run local (fixture only):
node implementation/reborn2-pilot/cli-v2.mjs FK34_FULL /tmp/reborn2-codex02 8765
Open loopback URL shown in terminal. Separate fresh directory for repeat
same fixture identity. No public hosting. test-v2.mjs verifies three
existing fixtures, exact snapshot roundtrip, tamper rejection, list size,
actual HTTP detail links, no detail load during list, metadata gate.
No research scope expansion, no production/DB/FROZEN/CLAIM/merge/deploy.
