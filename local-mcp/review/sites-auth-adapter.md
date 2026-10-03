# Sites認証adapterのローカル実装

本資料は135件の前段階記録です。後続で公式仕様の直接header経路へ接続し、138件PASSになりました。最新の一致判定・secret設定方法・未確認事項は[Sites hosting契約](sites-hosting-contract.md)を参照してください。

## 確認できた仕様

公式提供のSites skill:

- `skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites-mcp/SKILL.md`
- `skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites-building/references/authentication.md`

Sitesはhosting境界でOAuthを管理します。認証済み利用者に`oai-authenticated-user-id`を渡し、IDは同一Site内で安定、Site間で異なります。
email/nameは表示用途であり、認可には使いません。非利用者のservice accessは利用者identityを生成しません。
新規LOCALプロジェクトにはhosting.jsonやSite固有設定がありません。既存BAKEN Task MCP Testの設定を読んだり流用したりしていません。

## 境界と未確認部分

`createSitesAuthAdapter({verifyHostingRequest,...})`のverifierは信頼されたserver側依存です。
`verifyHostingRequest(request,{signal}) === true`は、本実装の内部契約です。実際のSites APIやheaderではありません。
verifierはrequestごとに以下を保証する必要があります:

1. 実際のhosting OAuth検証で認証済み利用者のrequestである。
2. 無効・壊れた・期限切れcredentialは拒否済みである。
3. identity headerが利用者の自由入力ではなく、hostingが検証・注入した値である。

adapterはverifier承認後だけ公式headerを読みます。検証関数未設定時は503で拒否します。
環境変数の「trust=true」、ユーザーheader、内部Bearer、service accessへのfallbackはありません。
既定workerは未接続で拒否します。`createSitesWorker({verifyHostingRequest})`へ信頼されたhosting統合を注入する必要があります。

実際のOAuth token形式、issuer、audience、JWKS、introspection endpoint、有効期限claim、hostingへの安全な接続方法は未確認です。
推測したJWT検証や新OAuth flowは実装していません。直接headerを読んで常にtrueを返す実装を、本番verifierとして採用しないでください。
外部headerがhostingで除去・上書きされることと、別経路からworkerへ直接到達できないことも本番統合で確認が必要です。

## 認可と固定権限

`LOCAL_MCP_ALLOWED_SITES_USER_IDS`の完全一致許可リストを照合します。未設定、空、不正設定はfail closed。
認証なし401、認証済みでも許可IDでなければ403。初期化・discoveryも同じ認可を適用。
toolはjob_idだけ。worker_id、region、circuit、claim_token、worker_run_idを入力できません。
許可利用者は既存resolverへ進み、worker=LOCAL_QUEUE_RESCUE／region=RESCUE／circuit=LOCALを固定検証します。
新規claimや予想保存は行いません。既存lab-claimed-contextのverify_jwtとservice-role認証は変更しません。

## 内部転送と秘匿

外部OAuth/identity/任意headerをcoreやSupabaseへコピーしません。
adapterはcoreへの内部Requestだけに内部Bearerを設定し、Supabaseには既存service-roleの認証を使います。
OAuth secretは本adapterで必要とせず、SitesのOAuth自体を置き換えません。
incoming Authorization・platform service headerのcredential、runtime secret類、claim tokenの応答漏洩を検査します。
RPC idからのcredential echoも拒否。例外・DBエラーは固定error codeへ変換し、console logはありません。
context取得後もhosting認証を再確認し、失効ならcontextを破棄します。処理全体は30秒で拘束します。
ホスト側のrequest/body/headerログも本番設定で無効にする必要があります。

## テストの意味

無効・期限切れOAuthのテストはmock hosting検証器を使用します。実Sites token検証の成功を証明するものではありません。
header偽装、serviceアクセスのみ、別利用者、固定権限の上書き、secret response/log/error、resolver失敗、認証中断をローカルで検証します。
新規table/schema/role/GRANT、Supabase/Sites deploy、Plugin登録、Scheduled Task、main、JRA、FROZEN保存は変更しません。

最終結果: **135 PASS / 0 SKIP / 0 FAIL**（既存108件＋追加27件）。構文検査成功。
無効・期限切れtokenの拒否はmock authorityによるhosting境界の単体検証です。本番Sites OAuthとの実接続・検証は未実施です。

## 変更ファイル

追加: `src/sites-auth.mjs`、`tests/sites-auth.test.mjs`、本資料。
変更: `src/worker.mjs`（未接続defaultのfail closed）、`src/mcp.mjs`（job_idのみ・境界helper共有）、`tests/mcp.test.mjs`（入力契約追従）、`package.json`、`README.md`。
claim resolverと既存Edge候補は今回変更していません。

本番deploy判定はNO。次の1工程はSitesの実hosting認証境界との接続方法・identity headerの信頼性を公式仕様／新規Site設定から確認することです。
