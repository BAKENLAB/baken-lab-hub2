# 追加対照監査: 馬場条件の差異は不的中の因果を示すものではない

本番のFROZEN/official_resultsを読み取り専用で横断比較 (2026-11-07 23:55 JST時点)。

| Date | Track | FROZEN races | FROZEN input going != official final going | Winner TOP5 captured |
|---|---|---:|---:|---:|
| 2026-11-07 | 福島 | 11 | 6 | 3 |
| 2026-11-07 | 京都 | 9 | 0 | 7 |
| 2026-11-07 | 東京 | 10 | 0 | 8 |
| 2026-11-01 | 京都 | 8 | 8 | 7 |
| 2026-11-01 | 東京 | 10 | 10 | 8 |
| 2026-10-25 | 新潟 | 11 | 11 | 5 |

**Important:** The 11/7 Fukushima going mismatch is a real data-quality discrepancy, but mismatch occurs with strong performance too, so it **cannot be established as the cause** of Fukushima's 3/11 winner recall. Hypotheses about going adjustment require independent replay / matched conditions, not outcome-conforming score edits.

There is a specific source integration opportunity: 福島1R live source showed 稍重/小雨 and body weights at 09:11:02 JST, whereas frozen field at 09:13:06 was still 重/曇 with missing weights. Other Fukushima race **latest live snapshot timestamps were after** FROZEN; do NOT retrospectively assume those values were previously available. Preserve FROZEN.

Historical older JRA FROZEN field snapshots frequently lacked body weights even in successful races. Missingness is systemic across dates; do not assert it's what caused a specific upset.

Remediation remains research branch only: timestamped pre-FROZEN source freshness warning, constrained historical same-course audit, pace review, and paired backtests on successful controls. No production changes.
