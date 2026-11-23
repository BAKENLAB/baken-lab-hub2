# JRA score ledger regression cases (2026-11-21)

These cases must be executed against the isolated candidate validator before production activation. No real prediction write is permitted.

## Grounded anomaly: Kyoto 12R, horse #1
Official FROZEN 2026-11-21 Kyoto 12R horse #1 has numeric score 78. The stored reason says base 39 + evidence delta 38 = 77, followed by a separately stated maximum 1-point verified adjustment. It does **not** include a machine-readable component ledger proving that the 1 point was actually applied. The score might be correct, but the current evidence is insufficient to independently verify it. Never rewrite that FROZEN.

## Required test matrix
1. VALID: registered engine, 6+ ACTIVE runners, all with nonempty ledgers and official source IDs, base + signed deltas = rounded/capped score, contiguous ranks and identical TOP5. Expected PASS.
2. WRONG_ENGINE: change top-level or runner engine ID. Expected FAIL.
3. WRONG_SUM: change score by +1 without changing component. Expected FAIL.
4. WRONG_RANK: swap ranks without changing scores. Expected FAIL.
5. TOP5_MISMATCH: change a TOP5 score or horse. Expected FAIL.
6. MISSING_LEDGER: remove one active runner's ledger. Expected FAIL.
7. MISSING_SOURCE: remove source_ref from a nonzero component. Expected FAIL.
8. POST_RACE_EVIDENCE: source date later than official race cutoff. Expected FAIL after independent as-of provenance validator.
9. FABRICATED_SOURCE: syntactically valid but nonexistent source_ref. Expected FAIL after independent source resolver.
10. ODDS_LEAK: market-derived component. Expected FAIL after evidence-category allowlist validator.
11. SCRATCHED: official scratched runner excluded from active ranking; field list must match official entries.
12. ALL_RACES: valid runner scores may tie; stable deterministic tie-breaker must be defined and validated.

## Existing candidate limitations
The current staged SQL function is arithmetic/shape-only. It does not prove that the referenced evidence exists, that the source predates the cutoff, or that component deltas were produced by the approved fixed coefficient implementation. It must not be attached to the official save path until those checks and tests exist.

## Source of truth
JRA official entries and historical result records as-of the race cutoff, not the textual 'reason' field or market odds. Engine identity must come from trusted server configuration, not from user-supplied payload.
