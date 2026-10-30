# LOCAL 1.7: deep-history review / research-only

This branch adds a **read-only, deterministic shadow review**, not a replacement for the production LOCAL 1.6 model.

## Verified 2026-10-30 evidence
- 47/47 races FROZEN before post and matched to result records.
- Data covers 名古屋12, 園田12, 大井12, 金沢11 races.
- ◎ 15/47 wins; ◎ top3 33/47; winners in frozen TOP5 37/47; TOP5 podium horses 97/141.
- Winner ranks outside top5: 6th=5, 7th=2, 8th=2, 10th=1.
- Pure hindsight replacement of frozen fifth by sixth would move podium captured 97->105 and all-three 13->18, but destroys seven races where only the fifth was top3. This is **not** a deployable rule.
- A loose retrospective scan of archived horse_runs using SAME track+distance+going and 3rd-or-better, older than 60 days, raised 63 flags outside TOP5, of which only two were winners. This scan is an **imperfect proxy**, not the exact five-run shadow audit, because available horse_runs archive ended 2026-08-31. This warns against uniform bonuses.

## Specific missed evidence (verified historical source)
2026-10-30 名古屋12R: ⑨キャンディタフト was ranked 8th and won. On 2026-06-05 she had finished second in 名古屋 金シャチ最終戦Ｃ, 1500m, 稍重: same event name (NFKC-normalized), track, distance and going. Recent failures 11th and 9th remain valid counterevidence.

## What the module does
Call reviewDeepHistory with original five verified recent runs for each frozen lower-ranked horse and separately verified, ID-matched historical official results. It signals older same-track/distance/going top-3 evidence, counts same-name events and includes risk warnings.
It cannot change ranking, scores, protocol, FROZEN records or EYE selection. It ignores odds, popularity, post-race results and unverified sources. In absence of five recent runs or verified runner identity, no positive alert is emitted.

## Verification gate before production use
1. Add a read-only, verified per-horse deep-history provider. **Name-only matching is not sufficient.** The existing horse_runs snapshot alone cannot fully replay the 47-race day.
2. Backtest all 47 without using the race outcome for ranking, and test on separate earlier dates. Compare to the SAME frozen 1.6 baseline.
3. Protect successful 1.6 races: 15 ◎ winners, 33 ◎ top3, all EYE 2 winners, and seven 'only-rank-5' top3 cases. Report **newly captured AND lost** runners/races.
4. No automatic fifth/sixth swap; manual reassessment needs evidence, class and recency considerations.
5. Ship to production ONLY after independent scoring/evaluation and user authorization, with no paid API, Cron restoration, schema writes or modification of existing FROZEN.

Run: node --test research/local17/deep-history-review.test.mjs

## 2026-10-31 follow-up: Oct 26–30 LOCAL1.6 frozen/result comparison (read-only)

Same LOCAL1.6 protocol, FROZEN before post, five TOP5 runners, and three official finishers. Matched sample: Oct 26–29 **183 races**, Oct 30 **47 races**.

| Metric | Oct 26–29 (183) | Oct 30 (47) |
| --- | ---: | ---: |
| ◎ wins | 46 | 15 |
| ◎ top 3 | 99 | 33 |
| Winner in original TOP5 | 140 | 37 |
| EYE top 3 | 23/88 EYE | 6/16 EYE |
| Rank 5 top 3 | 59 | 11 |
| Rank 6 top 3 | 49 | 19 |
| Swapping rank 5→6: gained top-3 runners | 37 | 15 |
| Swapping rank 5→6: lost top-3 runners | 47 | 7 |

**Score-gap <= 2** trial (frozen rank5 score minus rank6 score): Oct26–29 flagged 17/183, gaining 4 top-3 runners but losing 8 (winner gain 0, loss 1); Oct30 flagged 12/47, gaining 7 and losing 1 (winner gain 4, loss 1). This inconsistent rule must NOT be deployed.

Oct30 EYE: 16 selected, 16 with exactly two positive factors. Oct26–29 saved FROZEN: 89 selected (one omitted from complete result comparison), 62 with exactly two factors, 27 with three or more. Independently audit factor evidence and do not inflate duplicate facts.

**Ground correction:** Oct30 名古屋12R FROZEN rationale assumed 稍重 and the historical 2026-06-05 same-track/same-distance/same-race-name 2nd place also was 稍重. But **final going for Oct30 名古屋12R was 重**: 名古屋 R1–10 ended 稍重, R11–12 重. Historic going matches the pre-race assessment, NOT the final track condition. The deep-history example must not claim final-going identity. Changes in going require independent updates, never retroactive edits of FROZEN.

**Data limits:** Official result JSON returns just top-three finishers for 30/47 Oct30 races, and no lap/passing-order arrays. Archived horse_runs ends 2026-08-31. Name-only past-form joins are insufficient for proof of identity or 47-race validated deep-history replay. No new rank-scoring model has proven superior.

**Decision:** Protect current LOCAL1.6. Research read-only alerts for verified older-condition form, class drops/transfers, close rank5/rank6 scores and going changes, then independently rerun with a ledger for both gained AND lost top-3 runners. No main merges, FROZEN edits, Cron or paid API.
