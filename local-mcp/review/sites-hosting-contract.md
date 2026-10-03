# Sites hosting認証経路の正式仕様照合

## 公式資料で確認済み

Sites MCP公式skill `skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites-mcp/SKILL.md`:

> Sites handles authentication at the hosting boundary. These trusted identity headers are available to Site code for authenticated user requests.

`oai-authenticated-user-id`はSite-scoped user IDと明記されています。

> Sites manages OAuth for this connection; do not replace it with a separate flow or weaken access rules to make a tool call succeed.

認証経路はChatGPT Plugin→Sites OAuth/dispatch→runtime Requestのtrusted identity header→MCP側許可リスト→固定LOCAL resolverです。
アプリはdispatchの認証済みheaderを信頼し、独立したOAuth署名検証やintrospectionを追加しません。
認証なし／壊れた／期限切れtokenの判定主体はhostingです。アプリ内のheader確認をtoken暗号検証と表現しません。

公式Authentication reference `skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites-building/references/authentication.md`:

> read `oai-authenticated-user-id` when a feature needs a stable user key.

IDは同一Site内で安定しSite間で異なります。email/nameやaccount user IDで代替・推測しません。
サービス用OAI-Sites-Authorizationはdispatchが検証・消費しますが、利用者identityを生成しないため、このMCPの認可は通りません。

## 最小修正

前版は架空のhosting検証APIではなく内部DI callbackを未接続のまま必須化していたため、公式経路からruntimeへ届いても拒否していました。
Sites専用workerが`hasSitesHostedUser`を標準で結び付け、正式headerを読むよう最小修正しました。
許可リスト・固定worker/region/circuit・secret秘匿・Supabase認証は維持します。
直接呼ばれるgeneric adapterは未検証callbackを勝手に補完しません。
このworkerをSites以外の任意公開サーバーへ配置して、クライアント送信headerを信頼してはいけません。実行対象はSites dispatch配下だけです。

request処理中にhosting tokenを再検証する公式APIは確認できません。2回目のチェックは同じdispatch identityの確認であり、OAuth失効の再照会ではありません。
旧mock callbackでの失効試験は境界の単体試験です。本番中途失効検知の保証へ読み替えません。

## secret/envの正式設定方法

利用可能な公式tool `sites_update_environment_variables`:

- 新規Siteの正確なproject_idを指定する。
- set_valuesへcase-sensitive key/valueを設定する。
- 機密値はis_secret:true。secret値はplaintextで返されない。
- runtime値はSites側で管理し、hosting.jsonやソースへ保存しない。
- 更新は指定keyだけ。他の値を消さない。
- 新しいenvironment revisionを反映するにはsaved versionのdeployが必要。

設定対象はLOCAL_MCP_ALLOWED_SITES_USER_IDS（JSON配列、secret扱い可）、LOCAL_MCP_BEARER_TOKEN（内部secret）、SUPABASE_SERVICE_ROLE_KEY（secret）、LOCAL_MCP_WORKER_ID（LOCAL_QUEUE_RESCUE固定）。
app側OAuth secretは不要です。OAuth自体はSitesが管理します。
sites_get_environment_variablesは設定状態を確認できますが、この作業では新規Siteのproject_idがなく、値取得・設定を行っていません。

## 未確認とdeploy前条件

- 新規LOCAL Siteは未登録。hosting.json／project_id／runtime secret／許可リスト未設定。
- 実Siteの許可利用者のsite-scoped IDは未取得。現在の公式tool schemaに、そのIDを直接取得する専用操作は確認できません。account user IDからの変換規則を推測しません。
- dispatch内部のheader上書き実装、OAuth token形式、token有効期限値は未確認。ただしruntimeでtrusted headerを使う契約自体は公式skillで確認済みです。
- Sites向けbundle/build・runtime実行・HTTPS・ログ設定と本番E2Eは未確認。
- Supabase側のCONTEXT_CHANGEDローカル修正候補も未deploy。

deploy後の利用者操作は新規Site/PluginのOAuth sign-in、PluginのInstall/Connectです。既存Test MCPは流用しません。
その前に許可site-scoped IDを正式に取得し、secret許可リストへ設定する工程が必要です。取得方法は未確認のため操作手順を推測していません。
公式skillのPlugin接続手順はget_site(include_mcp_connection:true)で得たplugin_idを用いるものです。登録・suggest・deployは今回行いません。

認証仕様との整合は修正後YES。認証経路の設計上のblockerは解消しました。現時点の本番deploy readinessはNO（新規Site設定・ID取得・runtime確認等が未完了）。

最終ローカルテストは **138 PASS / 0 SKIP / 0 FAIL**。3件追加でSites専用標準entryのtrusted identity経路・許可リスト・非利用者service access拒否を確認。構文検査成功。
これらはhostingから届くRequestの契約テストであり、実Sites OAuthやdispatch内部の動作を実測したものではありません。
