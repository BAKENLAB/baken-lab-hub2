# JRA 0.5 base-first correction | 2026-10-23 JST

## The actual bug
Former 0.4 experimental tie-break scoring required a matching detailed archive. Therefore even valid earlier 2nd-place or win records could be excluded from numeric comparison despite the 4-run merged history already containing their finish/margin/surface/distance. Missing optional enrichment became a hidden negative.

**Concrete example:** 2026-10-17 新潟9R, エルナト (baseline rank5, actual 2nd): 2026-09-20 芝2000m 1勝 class 2nd 0.1 sec behind winner. No detailed archive was available, so former 0.4 skipped it. 0.5 preserves this baseline run. コスモナエマ (rank6) also retains the 2026-09-12 2nd/0.5 sec basic fact despite a missing detailed archive.

## Completed deployment: read-only evidence layer
- Installed private.jra_optional_content_evidence_v2(date,track,race_no). Baseline merged past results are always output regardless of archive match; added prior class, carried weight, early position, position change, per-run data provenance and archive availability. Detailed 3f/corners/lap splits are attached only on a unique corroborated archive.
- Installed private.jra_v05_evidence_bundle_v1(date,track,race_no) to retrieve all runners' prior-run basics + detailed content + historical rival subsequent finishes in one read-only bundle. Unexposed private schema, SECURITY INVOKER, no PUBLIC/anon/authenticated grants.
- Database SELECT verified: エルナト 4 basic runs/2 detailed, コスモナエマ 4 basic runs/3 detailed. No prediction row, saved FROZEN, grade, EYE or live scorer changed.

## New scoring experiment (RESEARCH BRANCH ONLY)
base-first-shadow-v05.mjs:
- All reliably pre-race historical **basic** facts are used regardless of detailed archive coverage.
- Same surface, more realistic distance window (min ±200m / max ±400m relative to race length); prior winning, close finishing, race-class comparison.
- Best historical effort plus second-best rather than 4-run mean washing out strong form; no automatic boost for quantity of races.
- Detailed 3F, first/last race 600m, early position, positional change, and later strong opponents are **recorded as supporting context but score impact=0** until calibrated. No odds/popularity and no inferred traffic incidents.
- Equal-base-rate rank differences are still an exploratory alternative only. Comparison must protect existing positive form at TOP5 boundary; no forced reordering when comparator lacks baseline data.
- 13 isolated JavaScript tests passed. This is not a native Node/GitHub CI claim.

## Retrospective partial replay
Due to a read-only call blocked by platform safety, **38 of the prior 43** all-runner-base-rated races were reprocessed, on dates 2026-10-17 and 2026-10-18:
- Frozen baseline TOP5 actual first–third capture: **73**.
- New v0.5 shadow TOP5 actual first–third capture: **73**.
- Net 0, no newly added or lost podium capture across these 38 races.
- The three former problem cases 2026-10-17 新潟3R, 9R, 10R no longer demote a previously captured podium finisher out of TOP5.
- This **does not yet increase predictive accuracy**, and the cohort was previously inspected, not unseen holdout. Do not claim the 38-race outcome replaces the original 43-race 85-vs-83 result; these have different denominators.

## Current production boundaries
JRA_MAIN protocol 0.4 is still active. The new v0.5 numeric ranking formula is NOT connected to JRA CLAIM or production save, and the detailed evidence is still a standalone optional read rather than automatically included in public.jra_claimed_context (an earlier attempt at that integration was blocked). Original validated BASE_CORE_0.1 and guarded save are unchanged. There is no Cron restart, paid API or post-start/old FROZEN update.

**Conclusion:** Verified evidence inclusion bug FIXED in deployed read-only layer. Safer candidate scoring code exists but is NOT YET a proven or deployed accuracy improvement. Require blind chronological validation and protect gains and losses before turning on automatic scoring.
