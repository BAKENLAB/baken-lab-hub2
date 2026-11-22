# JRA raw-original capture research handoff — 2026-11-23 08:46 JST

## Verified blocker found in deployed jra-live v32 (read-only source inspection)

The live JRA card fetch uses `fetch(BASE + '/JRADB/accessD.html?CNAME=' + encodeURIComponent(cname))` and immediately decodes `new Uint8Array(await res.arrayBuffer())` as Shift-JIS, returning only the decoded HTML string. Later `html_sha256` in `public.jra_html_evidence` is SHA-256 of `new TextEncoder().encode(html)`, i.e. UTF-8 bytes of decoded text. **It is not a hash of the original HTTP response bytes**. The stored metadata contains the decoded-text hash, capture time, URL and length, but not the original original bytes or JRA issuer signature. Do not treat that recorded hash as historical raw original bytes, nor claim the original can be reconstructed from the metadata.

`jra_live_races.post_time` is text such as `9時45分`, not an ISO timestamp. A future integrated raw-byte capture must use a vetted ISO target post-time from the authoritative race schedule rather than feeding that string into the cutoff guard.

The actual 2026-11-23 Fukushima R1 CNAME is `pw01dde0103202603060120261123/EC`; Tokyo R1 is `pw01dde0105202605060120261123/E2`. The last eight-digit group is the target `YYYYMMDD`; this matches deployed `jra-live v32 parseCname`. Early research CNAME tests used the wrong group and were corrected against these live reference keys.

## Research-only code and tests added

- `claim-retention/jra-raw-response-capture.mjs`: from already-fetched `Uint8Array`, checks the exact JRA URL and final response URL, CNAME/track/date/race identity, source pre-post cutoff, length and Shift-JIS decoder. Preserves raw HTTP response `bytes` (base64 for isolated private writer), SHA-256 of raw bytes, and a **separate** SHA-256 of UTF-8 of decoded HTML. It never signs, reads privileged data, authorizes a CLAIM or turns bytes into verified JRA scoring evidence.
- `claim-retention/authorized-byte-retention-candidate.mjs`: accepts an injected offline archive writer/reader; retains exact original bytes and immediately reads them back, rechecking raw digest, metadata and the archive's full-document receipt. Refuses redirects, later-than-cutoff captures, wrong race IDs and modified bytes; reports only hashes and receipt, not original bytes. It is deliberately **not wired to production** and contains no network or trusted key.
- `claim-retention/live-archive.mjs` (previous research work) validates raw SHA-256 and whole receipt on write/read. The new capture boundary can feed it without encoding/hash-domain confusion.
- `tests/jra-raw-response-capture.test.mjs` tests a Shift-JIS 'あ' body where raw and decoded text hashes **differ**, both actual live CNAME layouts, timestamp and redirect refusal, and metadata/byte tampering.
- `tests/jra-raw-retention-boundary.test.mjs` tests capture→isolated nonpersistent writer→private readback→hash/receipt checks, and refuses untrusted URL, improper cutoff and tampered archive. Neither test touches Supabase or fetches official JRA content.

Isolated Node and PostgreSQL CI SUCCESS: [GitHub Actions run 45084979239](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/45084979239). These tests prove offline mechanics, not official origin/issuer or an approved scoring formula.

## Earlier work retained

- Signed synthetic V11 evidence proof→fact-to-point generator→submitted field scoring comparison and refusal of caller-provided `verified=true` flags (CI success 45083813327).
- Actual full-field Nov23 as-of research input observations fixed before first post: 23 flat races, 345 horses, 995 past runs (983 final 3f, 979 corner, 563 archive details, **0 signed raw-body/run-ID binding triples**). The original bytes are **not** within those snapshots, and they do not authorize any model.
- Current v42 research rebase, synthetic handler transport and PG rollback CI, but **not** live source-to-score.

## Release blockers and non-actions

1. Secure, authorized source capture must preserve original response bytes **at the time of actual fetch**, with a reviewed private storage design. The current v32 fetch returns decoded text only; this PR does not patch or deploy it.
2. Real official historic *past-run* result originals must be retained and matched to exact selected run/horse IDs, not mistaken for current race **card** HTML. Issuer signer/registration, trust anchors and pinned extractor must be approved, and the actual CLAIM/READY/lease must be revalidated before any score use.
3. An approved, fixed, complete fact→point model (class, pace/laps, opponents, conditions, EYE, bridge) is still absent; synthetic rule coefficients are not production rules.
4. No production MCP/DB writes, new CLAIMs, Cron changes, existing FROZEN modifications, release flags, full model changes, or PR merge in this batch.

## 08:46 read-only operational status

`jra_queue_status(2026-11-23)` reported 23 READY, 1 in claim window, 0 jobs, 0 claimed, 0 FROZEN. Today's ordinary save flow is **not** started by the research tests. Actual post time Fukushima 1R 09:45 JST.

**Status: research raw-byte integrity improved; production JRA prediction and original-byte issuer are NOT yet reconnected.**
