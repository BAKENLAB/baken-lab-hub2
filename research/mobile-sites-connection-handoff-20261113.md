# BAKEN LAB LOCAL: safe ChatGPT Sites connection handoff
**Date:** 2026-11-13 (JST)
**Status:** Design/handoff only — NOT installed, NOT published, no new live predictions.

## Grounded diagnosis
- The production `local-claimed-mcp` service is active and registers six guarded tools:
  `lab_queue_claim_next`, `lab_preclaim_official_corners`,
  `lab_claimed_context`, `lab_relative_rank_preview`,
  `lab_seal_relative_rank_pair`, `lab_save_claimed_prediction`.
- The conversation's existing `mcp__BAKEN_LOCAL_MCP_v9__*` tool surface exposes **three**:
  `lab_queue_claim_next`, `lab_claimed_context`, `lab_save_claimed_prediction`.
- The private personal plugin `plugins_6ac487e8d5008191aa7fc9d1c76c793a`
  declares **both** `.app.json` with App binding
  `asdk_app_6ac4887e6d0881918182a4b1a9cb04ca`
  and `.mcp.json` with the same HTTPS remote server. The observed three tools
  are **consistent with** the old App connector still exposing its earlier
  tool schema; do not represent that hypothesis as proven without App-side inspection.
- The newer personal plugin `plugins_6af64165c8dc819186e9164d78d565b3`
  has `.mcp.json` only and is **already installed** per Plugin Management,
  but its six tools do not appear in the current mobile conversation.
- OpenAI's official docs explicitly say plugins declaring `mcp.json` /
  `.mcp.json` can be **Desktop-only**, even for a remote HTTPS URL.
  **Reinstalling** or Chrome "Desktop site" alone is not a verified fix.
- Available ChatGPT Sites construction is through **ChatGPT Web → Work**
  or supported Desktop. No Sites plugin/backend tool is available to the
  present conversation; therefore this agent cannot create/publish the Site here.
- Sites is currently an eligible capability for Plus (subject to the actual
  user's client/usage limits). **Mobile Web support for the Site editor and
  mobile tool use must be tested, not assumed.**

## Safe migration plan: two-stage, NOT a direct plugin replacement

### Stage 1 — prove the connection surface with zero credentials
Using ChatGPT Work on the web, create a **private, minimal ChatGPT Site** called
"BAKEN LAB MCP 接続診断". Add only one Site-hosted MCP tool:

`baken_connection_probe({})` — read-only, no external requests or secrets.
Return a small static JSON object such as:
`{"ok":true,"bridge":"CHATGPT_SITES_HOSTED","capabilities":["PROBE_ONLY"],"production_changed":false}`.

Publish the Site privately so Sites provisions its own **canonical plugin**.
Do NOT create a second `.mcp.json` personal plugin.
Install and connect this Site-hosted plugin through the supplied card.
Try it on the user's actual Android ChatGPT app. Only if the single probe
is **visible and callable** proceed to Stage 2.
Do not expose a Supabase URL/credential or any prediction action in Stage 1.

### Stage 2 — guarded read-only connectivity first
Add to that **same** private Site one strictly read-only status tool:
`baken_local_connectivity_status` to query only verified non-sensitive
server capability metadata, under a narrowly scoped **server-side secret**.
Only after Stage 1 mobile proof and an authorization review.
Update and **republish** the SAME Site to refresh its plugin.
Never put `service_role`, bearer tokens, API secrets or credentials in chat,
plugin manifest, source code, client UI, or site metadata.
Use the Sites secure secret-entry/settings flow when and if required.
Do not grant blanket database-write privilege to the Site.
Recheck that the Site-hosted plugin actually exposes the new status tool.

### Stage 3 — six canonical guarded tools, one-by-one only
After confirmed authorization and tests, design delegated Site MCP tools
whose server-side implementations invoke the existing `local-claimed-mcp`
**through its normal authenticated, audited methods**, preserving:
- exact race key / JST clock, official READY, debut exclusion;
- canonical CLAIM ownership/expiry and before-post guard;
- all ACTIVE horse identity, full-field independent 100pt research scoring;
- LAB EYE outside TOP5 audit, market and odds exclusion;
- immutable previously saved FROZEN; empty `bets=[]`;
- refusal payloads not replayed unchanged, no direct database edits;
- no Cron restart, no paid APIs, no research-model production adoption;
- audit receipts checked via **read-only** production verification.

Do not expose `lab_save_claimed_prediction` as a shortcut or until
authorization and human-visible write approval are validated separately.
No guesses about Site editor file structure, SDK APIs, or install status.
Do not claim Site plugin connection until the actual mobile client test succeeds.

## Exact copy-paste prompt for ChatGPT Web Work
> BAKEN LABのAndroid接続問題を解消するため、ChatGPT Sitesで
> 「BAKEN LAB MCP 接続診断」という**非公開の最小Site**を作ってください。
> 最初にSiteホストのMCPツール `baken_connection_probe` を1個だけ作り、
> 外部通信・秘密情報・DB書込み・予想・CLAIM・FROZEN変更は**一切禁止**。
> 呼び出すと `{"ok":true,"bridge":"CHATGPT_SITES_HOSTED","production_changed":false}`
> の固定応答だけ返すこと。Siteを非公開で公開し、Site自身が発行する
> 正規プラグインをインストールできるようにしてください。
> AndroidのChatGPTでツールが表示・実行できるかを先に確認します。
> それが成功するまではSupabase認証、実データ、6ツール接続に進まない。
> 既存のBAKEN LABプラグイン・本番予想・FROZEN・Cronは変更禁止。
> 失敗や利用環境の非対応は正確に報告してください。

## Verification criteria
1. A **Site** was created, previewed and privately published through the
   actual Sites/Work feature.
2. A **Site-provisioned plugin** (not a Desktop-only `.mcp.json` package)
   exists, has an active connection and displays `baken_connection_probe`.
3. The Android ChatGPT client can execute that tool, returning the fixed
   test payload. If not: stop, report device/surface limitation.
4. None of the BAKEN LAB production DB rows, edge handlers, prediction
   statuses or FROZEN entries changed during Stage 1.

## Official references
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

**Do not treat this handoff as a successful connection or a proven mobile
Site MCP capability.**
