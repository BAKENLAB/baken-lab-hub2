# Work44 minimal real-data bridge contract — research only
Main48 audit ceab194c30c677b9485ab561a113ddb28184af02; accepted 864 unchanged. PR95 observed HEAD 984c6fbad8841938aab6de48b5523255ad6dfa06 (V47). No V48 head available at inspection; no analysis engine edited.

## Native race and source binding
Identity is issuer + stable venue ID + JST date + race number; literal venue label is validated against signed inventory with unique bidirectional mapping; race ID and time must agree on every document and horse row. Same native target race under any other event ID is rejected. Native venue IDs here are synthetic only; official code registry must be approved, no name-based equivalence. Inventory signed with as-of, observation/seal bounds and coverage, identity signed with observation bound. Raw document/row/field roots link manifest/rights/inventory/identity/parser digest; rights at capture and current use checked. Test signatures and independently passed test pins are NOT real external time, official origin, inventory completeness or permission.

## Data interface
preparePartial(bundle,trust) -> {packet,digest,engineInput:null,engineBlockers,formal:false}; verifyPartial replays from original bytes. Schema WORK44_PARTIAL_OBSERVATIONS_0.2 preserves native identity, role, event fields, individual fields, explicit missing/unavailable states, source field evidence IDs and dependencies. Literal clocks remain literals until approved native unit parser; individual final600 is distinct from race final3F. Blank lap and corner slots remain in original order; corner order is never assumed exact-distance rank or individual elapsed clock. No target result fields or popularity projected. Current status unknown until certified, no default ACTIVE. No fake clocks, no fake geometry, no relabeling real IDs as TEST.

| Material | Input readiness |
|---|---|
| NAR documented CSV gate/no/name/age/sex/birth/weight/body weight/distance/going/class and event post | positional synthetic parser, real format and authority pending |
| Historical finish, literal time/margin, individual final600 | available in documented schema; exact clock literal conversion, statuses and missing sentinels not certified |
| Race-level final4F/3F, lap slots, grouped corner slots | literal only or typed reported final section; no inferred checkpoint distances |
| JRA card/result and official ratings | documented public routes, approved native parser and authenticated sample missing |
| course geometry, class rules, incident reports, rider records, profile/training | separate official versioned source required, coverage varies |
| individual elapsed clocks at checkpoints | no general official public route established; null |
| exact individual checkpoint rank | grouped corner position not equivalent; null until approved mapping |
| EYE04/06/14/15 | held until strength, incident, rules and independent mechanism evidence are admitted |
| all 115 | canonical inventory retained, no claim all item dependencies mapped or analyzed |

## Minimal V48 integration boundary
Current PR95 v43-generic verifyIntake accepts SYNTHETIC_ONLY and run31 requires TEST IDs and test epoch, so real packet must never enter it. Preserve Work42 unchanged. Codex must expose an approved real/partial intake accepting native event identities and real cutoff, authenticated evidence and explicit unknown fields. It should consume finish/last600/gate/weight and historical context with corresponding evidence IDs where valid; grouped/literal fields only after their own semantics are verified. Hold split-response kernels that require individual crossings; retain other independent observations. No grade chosen here. Real packet is not a WORK32 synthetic packet, and this interface intentionally returns engineInput:null. Actual V48 callable connection cannot be certified before its code is fixed and the real gate is approved.

## Approval checklist
Main approval of particular material/operation (acquisition, retention, local vs cloud, publication); authorized real samples for both circuits and source parser/conformance including native IDs and race-status fields; independently trusted external as-of custody, version inventory and publication timing; approved real adapter consuming partial shapes, no field-specific guessing; independent prospective outcome isolation, no actual race selected before approval. Existing Work43 test and 864 ledger retained. No acquisition, DB, FROZEN, Cron, merge, deployment or formal adoption.
