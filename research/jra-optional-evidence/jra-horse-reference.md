# JRA CNAME horse-reference reconciliation (research only)

Source check on 2026-10-23: live form \`pw01dud002023105825/F4\` versus archived result \`pw01dud102023105825/DB\` (ギャラボーグ). Full links never matched in the 110-race historic prior-run cohort. For a subset with available archived race results, the internal ten-digit code matched **3,910** query combinations among 5,024 historical entries; all 3,910 corroborated identical horse names. (Some combinations re-use the same historical start for several forecast races; **not** 3,910 unique starts.) This is observed evidence, not a universal JRA ID guarantee.

The \`jra-horse-reference.mjs\` adapter reconciles ONLY JRA CNAME code with exact normalized name *within a supplied race date and track*. Any unsupported ref pattern, collision, missing archive, name mismatch, duplicate candidate or missing date causes **no match**, not a guess. Used only for read-only evidence lookup, NOT for scores/rank/EYE or production updates.

Native tests: \`node --test research/jra-optional-evidence/jra-horse-reference.test.mjs\`.

Still required: empirical checks for name changes, maiden horses without codes, stable code uniqueness across the entire stored dataset, source temporal validity and test in genuinely unseen racing dates before any production integration.
