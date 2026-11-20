# 2026-11-21 JRA JUMP: pre-race readiness audit (no predictions)

**Scope:** 福島4R (11:15 JST), 福島5R (12:05 JST), prior to either post time. **Audit only: no ranking, saved forecast, FROZEN, seed bypass, protocol promotion, or official race publication.**

## Confirmed pre-race facts

| | 福島4R | 福島5R |
|---|---:|---:|
| Race type | 障害3歳以上未勝利 | 障害3歳以上オープン |
| Course | 障害2770m | 障害3380m |
| Official card runners | 13 | 13 |
| Captured runners in production JRA live tables | 13 | 13 |
| Runners with recent (4-row) card entries showing `race_class` beginning with 障害 | 9 | 13 |
| Runners with NO such obstacle entry in the limited 4-row card excerpt | 4 | 0 |
| Official numbered entry dry-run | PASS 13 ACTIVE | PASS 13 ACTIVE |
| Deployed JRA_JUMP protocol | absent | absent |
| Production dedicated JUMP publish/CLAIM/save RPCs | absent | absent |
| Official JUMP BASIC_READY | not published | not published |
| Official JUMP pre-post FROZEN | none | none |

The four 福島4R horses with no obstacle entry **in the limited recent card excerpt** are ②パンパネイラ, ④フェイトライン, ⑥モアリジット, ⑩ミクソロジー. This does **not** establish that their *full historic profile* is free of obstacle starts.

## Evidence and safety gates

- As-of production read-only SQL against `public.jra_live_races`, `public.jra_live_runners`, `public.official_races`, `public.official_predictions`, `public.lab_prediction_protocols` and `pg_proc`.
- Existing research source: isolated branch `research/jra-jump-01-hub-integration` commit `036f1f6f34adcf2b3ba6551f2a2f758f42431fec` (2026-11-15). The K2 research model, guarded DB draft and independent source test exist, but are **not in the production MCP**.
- Nov 15 research CI observed 20 complete historical days, 540 official races, 20 obstacle races and 222 obstacle runner results; it does not guarantee 2026-11-21's complete all-horse history and 365-day independently verified obstacle jockey starts.
- The K2 adapter demands full source-backed obstacle profiles and complete 365-day obstacle-jockey history, plus an active dedicated JRA_JUMP protocol and official current-card receipt. Limited latest-four card runs and generic jockey summary stats **do not satisfy** those requirements.
- Do not register a protocol, run draft SQL in production, expose a direct write API, save JUMP as JRA_MAIN, use odds, change Cron, or invent full historical coverage.
- Safe next step: complete bounded current-date historical source coverage and one-to-one jockey verification in a read-only/staged execution, then stage the dedicated RPCs and MCP with isolation/integration proof. Promote only following live authorized claim and approved negative-path tests, then verify official immutable receipt.
