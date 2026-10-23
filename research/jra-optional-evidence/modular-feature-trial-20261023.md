# JRA modular evidence / stored-data reuse — 2026-10-23

**Classification:** implemented research feature generation + verified read-only DB summary. Automatic JRA scoring changes are NOT activated.

## Verified code and data sources

- JavaScript pure feature extraction and shadow comparator:
  - `research/jra-optional-evidence/modular-evidence-v06.mjs`
  - `research/jra-optional-evidence/modular-evidence-v06.test.mjs`
- **15/15 isolated JavaScript tests PASS.** This is not a native Node/GitHub CI result.
- Source: official `jra_live_runners.past_runs`, optional historical archive `jra_lab_runs/jra_lab_races`, and read-only `private.jra_v07_evidence_packet_v1`. The latter already merges recent-4 basic facts, archive or source-tagged live past-run 3F/positions, opponent followups and older-than-4 course results.
- Stored baseline FROZEN `official_predictions.payload.runners` and official completed results compared *without any updates*.
- Latest DB addition: `private.jra_v08_compact_evidence_v1(date,track,race_no)`, **SECURITY INVOKER, private schema, no anon/authenticated EXECUTE**. A compact per-runner ledger includes recent/older course evidence, context and archival availability, with no numeric rank effect. It validates expected field size and detects duplicates. Missing race => `NO_RACE`, not a save blocker.

## Independent components

1. `historical_peak`: best matched-surface, near-distance prior performance (inc. older-than-four); downweights age and lower class; **not equivalent to current consistent ability**.
2. `recent_repeatability`: top two/three competitive prior performances in merged recent history; missing data stays `null` rather than zero. A later poor finish does not erase peak.
3. `course_distance_proof`: verified prior same-track and similar-distance history.
4. `current_class_proof`: verified prior performance at at least today's class level.
5. **Non-scoring context:** race early/late 600m when fractions verifiable; historical corner order and actual late positions; verified 3F rank; distinct rivals whose later results were known before target. No invented interference or other incident.

Unverified **hypothetical** score: baseline rank-normalized position plus `(weighted mean of known components - 0.5) * signalScale`. Component weights are 50% peak, 25% repeatability, 15% course, 10% class *among available components*. Missing = neutral shift. Tested signalScale=10 (conservative) and 25 (sensitivity) with no odds/popularity. **Not calibrated win probability**, no auto-save or edit of rank/EYE.

## 110 retrospective FROZEN races — corrected scoring comparison

FROZEN+result cohort: 2026-09-27 through 2026-10-18; JRA, saved strictly before post time.
- 110 original matched races.
- 1 excluded from this comparison: 2026-10-17 新潟2R where 1 source runner's stored rank is null. This is a **no-comparison / shadow skipped**, not two failures of the experimental method. Legacy baseline captured two podium horses in that excluded race.
- 109 complete all-runner shadow comparisons:
  - **BASELINE:** 198 podium horses in TOP5.
  - **signalScale=10:** 198; added 0, lost 0. Changed ordering internally in 2 races during 10/17-18 but not TOP5 coverage.
  - **signalScale=25:** 197; added 0, lost 1 (2026-10-18 新潟8R ヒナノムサシ). Stronger weights worsened capture.
- Earlier already-inspected dates and post-forecast refreshed live snapshots mean this is **retrospective development evidence, not a clean blind forward test**.
- Neither variant qualifies for auto production JRA score adoption.

## Independent historical conditional signal inspection (exploratory)

Archived same-horse follow-ups: only previous 4th-10th finishes, next run within 180 days, same surface and exact class, distance difference <=200m, verified winning time, separate cohorts 2025 / 2026 through 2026-09-13.
Condition: prior **4th-6th** and beaten by <=0.5 sec versus previous 4th-6th outside that gap:

| Cohort | Turf <=0.5s | Turf >0.5s | Dirt <=0.5s | Dirt >0.5s |
| --- | --- | --- | --- | --- |
| 2025 historical | 26.7% (394/1477) | 23.3% (303/1301) | 31.6% (249/787) | 26.2% (646/2470) |
| 2026 historical | 30.8% (318/1032) | 22.6% (168/745) | 31.3% (165/528) | 25.5% (383/1501) |

This is consistent **positive association** within the restricted comparison; it is not a calibrated causal impact or justification to promote every such horse. Former blanket close-margin rank promotion hurt TOP5 capture. Fast final3F or positional gain alone were **not consistently positive** across the inspected finish/surface groups. Longer date-split holdouts and relative comparison against the *displaced horse* remain required. Chronological cohorts are not fully independent if the research team has already inspected some 2026 outcomes; do not call it untouched unseen validation.

## Case tests

- 2026-10-18 東京8R ガラク: recent four contain mostly turf; older 東京ダート 1600m 1st+2nd and 東京ダート 1400m 3rd, verified but mostly maiden class. Panel captures prior ability without asserting present 1-win class wins.
- 2026-10-17 新潟3R ラベンダーヘイズ: high historical peak and recent repeatability in panel but still baseline rank7. No fabricated promotion.
- 新潟9R エルナト: older proof and real 9/20 beaten-gap evidence preserved; no archive-missing penalty.
- 新潟10R キャリーグレイス: previously captured winner retained under tested conservative ranking. Higher coefficient didn't improve total catch.

## Production / guards verified after DB addition

- `JRA_MAIN` active version: `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`.
- 110 past JRA FROZEN records remain intact.
- `private.jra_v08_compact_evidence_v1('2026-10-18','東京',8)` returned `READY`, expected 16, returned 16; ガラク old same-track top3 count=3, 6 older near condition records, 4 recent histories. Lower maiden achievements distinguished.
- Missing Oct24 東京1R returned `NO_RACE`; as of this verification there were 0 saved JRA predictions for Oct24/25. No actual future FROZEN saving claimed.
- Scorer, protected CLAIM/SAVE path, BASE_CORE_0.1, EYE, Cron, paid APIs and old FROZEN remain unchanged.
- Current scoring module remains in GitHub **research branch**, not automatically attached to the JRA CLAIM response. Prior attempted context integration was blocked; do not bypass.

## Optional operator action, never required

After verifying a future JRA race exists/READY and date/track/no from an official claim, a permitted read-only SQL diagnostic can use:

```sql
SELECT private.jra_v08_compact_evidence_v1(DATE '2026-10-18','東京',8);
```

Use verified date/track/number for actual target instead of the example. If query fails or times out, continue ordinary JRA evaluation; never wait for rider comments, and never treat absent extra data as low ability.

**Next research gate:** train feature importance/interaction estimates on past-data-only window and compare genuinely future FROZEN predictions with both added and displaced 1st–3rd finishers. Require proof before any numerical production ranking change.
