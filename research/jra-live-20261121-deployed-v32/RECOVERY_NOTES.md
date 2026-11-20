# JRA 2026-11-21 official ingest restoration (production v32)

## Evidence (JST 07:46–07:51 on 2026-11-21)

- Problem: the prior official seed date stopped at 2026-11-15. JRA official_races, capture queue, and prediction jobs were all empty for 11/21. The current jra-live discover endpoint returned `no seed`.
- Root cause: no current-date verified `jra_live_seeds` entry. Pre-existing `jra-live` cron remains enabled; it had no new-date seed to act on.
- Verified source: JRA official **2026-11-21 福島 1R / 3回福島5日**, CNAME `pw01dde0103202603050120261121/FF` from the canonical official JRA website. The bootstrap checks date, meeting, race, and official numbered-entry markers against fresh official HTML.
- Production patch: `jra-live` v31 -> **v32**, digest **22ed544f9f24942e8a474afb3f0cf1e336806ac59017bc69f2686f5db396dd7e**. Only the index.ts discover branch was changed; 6 old dependencies were retained byte-for-byte, JWT guard stays enabled, and existing JRA cron-token auth is unchanged.
- The day-scoped seed fallback triggers **only when current-date active seed is missing and today is 2026-11-21**, and only after official page content checks. It does not directly set READY, create predictions, claim jobs, or write FROZEN.
- Invoked existing authenticated gateway `private.jra_cron_request_v1('discover')`, request ID 41130; response HTTP 200: `queued:24`, meetings 福島 + 京都, future seeds 11/22 and 11/23.
- Then used existing authenticated `private.jra_cron_request_v1('sync_batch')` for bounded manual capture alongside already-active Cron. 24/24 queue entries `done` with 0 capture errors.
- Used **existing JRA MCP** `jra_official_publish_card` per official flat race, which independently checks full numbered official card and live runner consistency and calls the production guarded `jra_publish_verified_card_v1` RPC. All 22 eligible flat races now have `BASIC_READY`; Fukushima 4R and 5R are **障害** and intentionally not published under the flat-race policy.
- JRA MCP status returned `official_races:22, official_field_ready:22, official_unsaved_ready:22`, all 24 captured live races, 0 jobs/CLAIM/FROZEN as of JST 07:51. Post time was in the future for all 22.
- Under unchanged `public.jra_manual_claim_next_v1`, normal JRA CLAIM is only available **3–70 minutes before the race**. The first Fukushima 1R is scheduled 09:45 JST, so the earliest legitimate CLAIM for it is **08:35 JST**. A direct invocation before the window returned `NO_READY_UNSAVED_JRA_RACE_IN_3_TO_70_MIN_WINDOW`, as expected.

## Safety and follow-up

- Existing FROZEN records unchanged; no results or market odds used in prediction evaluation; no direct prediction DB writes, no gated-save bypass, no new Cron or scheduled task, no resubmission of rejected predictions.
- Official data capture and publishing are **done**. Actual 100-point JRA forecasts and FROZEN saves **are not yet done**; they need a future eligible live CLAIM and authorized JRA MCP evaluation+save.
- Files in this folder mirror the exact deployed v32 source. Do not merge to the frontend bundle without its appropriate standalone Supabase deployment provenance and checks.
