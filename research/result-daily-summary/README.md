# RESULT daily summary candidate

Branch: feature/result-daily-summary-20261012. Base: main a4bd57427c0456c2a68508ae330c4277f8648486.
Not deployed or merged. No DB writes, Edge/Cron/worker changes, prediction or result mutations.

## Changes

result.html: RESULT circuit selector, summary above venue/race cards, responsive three-column numeric cards and full-width EYE, date-request sequencing, loading/error clearing. Venue and hit filters retain day-wide summary denominators. Original per-race detail/calculation functions are unchanged (hash assertions).
result-summary.js: read-only aggregator requiring matching date/circuit/track/R, FROZEN nonlegacy prediction, settled result, valid explicit ranks and unique horses. No index-derived finishes. Ties count all actual top-three horses. Cancelled/excluded entries are not hits. Null EYE is not an EYE denominator. Missing favorite mark or EYE is waiting for that metric. Duplicate/invalid races are excluded; matched race count is displayed. Missing denominator displays 集計待ち, while known zero hits displays 0.0%.
Finality relies on existing official-results API settled_at; an explicit provisional flag overrides it. This UI cannot independently re-verify JRA/NAR official results or repair incomplete upstream data.

## Verification

Run from repository root:

    node research/result-daily-summary/aggregation.test.cjs
    node research/result-daily-summary/ui.test.cjs

Aggregation: 23 PASS. Script/DOM-stub integration: 7 PASS. Includes ties, cancellation, missing data, duplicate identity, circuit/date filtering, empty EYE, no mutation, late-response race, HTTP failure, unchanged detail functions and static layout checks.
Real production DB read-only sample at development time: 4 matched 2026-10-12 JRA races; favorite win 4/4, favorite top3 4/4, TOP5 10/12, EYE 0/1. Offline aggregation only, not real API/browser E2E. Sample prediction bodies are not committed.

SKIP: real browser/mobile screenshot, actual page-to-API HTTP, production service-worker cache. Previous browser/socket failures in this execution environment were not retried or bypassed. Attached reference image unavailable in current message; follows requested 3-card + full-width EYE layout.

Before production approval: open this branch in a local/isolated preview at 320/375/390px, check long counts and waiting labels, switch JRA/LOCAL/ALL and dates, open/back existing cards, verify newest date survives delayed responses. Preview creation was not performed; no production deployment.
Deployment must include result.html and result-summary.js together. Module URL versioned v=20261012-v1. If the module cannot load, existing race rendering continues with summary waiting text. Service worker is unchanged; check online/offline cached pages before release, and hard-refresh if needed. Rollback restores original result.html; unused summary asset can remain until separate cleanup.

## Saved LAB RANK display addition

today.html and result.html ALL RUNNERS renderDetail now show saved numeric rank above the existing S–F badge. A copied display array sorts by saved rank, missing/invalid ranks last; no source mutation or rank inference. Eye rendering, top5/marks, horse numbers/names/comments and original result details remain unchanged.

    node research/result-daily-summary/rank-display.test.cjs

2 render tests PASS: same B grades keep individual ranks, unsorted input renders in saved-rank order, payload remains unchanged, missing rank stays unknown and existing fields/EYE remain. Real mobile browser remains SKIP.
