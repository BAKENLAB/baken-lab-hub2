# JRA official-card HTML regression follow-up | 2026-10-17 JST

## Scope
**Source-backed HTML structure verification only; not a complete decoded DOM/Cheerio integration pass.**
All calls used existing JRA official public source or read-only Supabase inspection, and no prediction publication.

## Kyoto 12R (18 horses), actual JRA HTML
Source CNAME: `pw01dde0108202604061220261017/B5`.
- `net._http_response.id=21042`: HTTP 200. Official HTML retrieved for examination.
- 18 rows with explicit `td.waku` image; 18 `td.horse`; 18 `td.jockey` rows.
- Initial strict SQL snippet wrongly showed only **16 of 18** horse-number matches. Root cause: the two blinker horses, **8 and 18**, have `<td class="num">8<span class="horse_icon blinker">…</span></td>` rather than simple `<td class="num">8</td>`. This was a **test-extractor regex** limitation, not confirmation of a production parsing failure.
- Allowing the explicit number at the beginning of the cell (before any blinker icon) extracted **18/18** pairs of horse number + image-derived frame. All **18/18** matched `jra_live_runners` and 0 mismatched.
- Actual current horse reference links `td.horse a[href*="accessU.html?CNAME"]` extracted **18/18**, matching captured `jra_live_runners.horse_ref` **18/18**.
- Exact JRA current weight from `td.jockey > p.weight` extracted **18/18**, matching `jra_live_runners.weight_carried` **18/18**.
- DOM has 18 `div.odds_line`, 18 numerical odds strong labels, 2 `icon_blinker.png` and one current `race_num_12.png` identity image. These are *status provenance and DOM evidence only*; no popularity/odds used for LAB RANK/EYE.

## Niigata 1R (12 horses), actual JRA HTML
Source CNAME: `pw01dde0104202604010120261017/47`.
- HTTP 200 `net._http_response.id=21041`.
- Horse no/draw **12/12** matching DB; horse_ref **12/12**; carried weight **12/12**.
- Current JRA frame values come from images (not plain frame-cell text).

## Combined
**Two independently retrieved source cards, 30 horses; explicit frame, horse reference and weight all 30/30 matching pre-captured live rows.** Sample size only; does not justify claiming all 36 cards verified.

## Staging changes
- JRA numbered parser now extracts frame from `/JRADB/img/waku/N.png` and horse number from `td.num.text()`, supporting an appended `span.horse_icon.blinker` without relying on a bare regex.
- Adds explicit current race-number image equality with selected `race_no`.
- Adds official row `horse_ref` equality with `jra_live_runners.horse_ref`.
- Adds `card.test.ts` (7 synthetic regression fixtures; **not executed** because this working environment has no Deno/Cheerio runtime).
- Staging Edge publisher is **not deployed** and cannot be represented as working production end-to-end.

## Outstanding before production
1. Decode real raw Shift_JIS bytes and run Cheerio parser against actual current full HTML (not the lossy pg_net text representation).
2. Test clear current cancellation/exclusion examples and ambiguity; fail closed on undocumented markup.
3. Run `card.test.ts` in Deno, then replay two actual source cards through parser+validator and verify exact all-horse match and timings.
4. Confirm authentication and fresh SHA-256 proof generated **from the same source bytes**.
5. Only then consider a controlled test via existing `jra_publish_verified_card_v1` to create BASIC_READY on a future, nonfrozen, eligible race.

## Unchanged
No FROZEN changes, no active-protocol changes, no Cron restarts, no paid API, no fake ACTIVE statuses.
