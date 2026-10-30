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
