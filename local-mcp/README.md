# BAKEN LOCAL Claimed Context MCP

LOCAL専用の認証付きMCP bridge。ローカル実装・テストのみで、deploy・Plugin登録は未実施。
既存「BAKEN Task MCP Test」は変更・流用していません。

## tool契約

`POST /mcp` / stateless JSON-RPC、MCP protocol `2025-06-18`。
`initialize`、`notifications/initialized`、`ping`、`tools/list`、`tools/call`を実装。
HTTPSとSites hosting境界の検証済み利用者・サーバー許可リストが必須。未設定・不正認証はfail closed。

- tool: `lab_claimed_context`
- 入力: UUIDの`job_id`のみ。circuitの指定も拒否します。
- race・worker_id・run_id・claim_token・URLは入力できません。
- 出力: 既存upstream contextをtextと`structuredContent.context`へ格納。
- 予想、順位、TOP5、EYE、買い目、新規claim、renew、prediction保存は行いません。
- JSON-RPC idは安全な整数または128文字以内の文字列。秘密のechoを防ぐためUUIDを含む文字列は拒否。

## 動的claim取得と認可

認証済みのこのMCP利用者を、確定した`LOCAL_QUEUE_RESCUE` worker／`RESCUE` regionへ結び付けます。
そのworkerの現在有効なLOCAL CLAIMED jobだけを対象にします。同じworkerが保有する複数jobは対象にできます。
job_idはその範囲内の選択子であり、UUIDを知っているだけでは別workerのjobを取得できません。

1. 固定Supabase Data APIへGET。job_id、LOCAL、CLAIMED、許可workerをWHERE条件にして明示列だけを取得。
2. 0件・複数件は拒否。job.worker_run_idで実際にrunを取得し、id一致、worker_id=LOCAL_QUEUE_RESCUE、region=RESCUE、RUNNING、claimed_by一致、lease有効、試行上限、token型を独立に検査。
3. その場で得たrun_id/job_id/claim_tokenの3項目だけを既存`lab-claimed-context`へ送る。
4. contextのレース識別子をjobと照合。返却直前にjob/runを再取得し、失効・再割当・run/token変更を検知したらcontextを破棄。

tokenはリクエスト処理中のメモリだけに保持し、tool schema・応答・ログ・固定secretへ出しません。
毎回現在値を取得するのでレースごとのsecret手動更新は不要です。存在しない／他worker／失効したjobは同じ`CLAIM_UNAVAILABLE`で拒否します。
旧`LOCAL_MCP_CLAIM_JSON`が残っている設定もfail closedにします。

## 環境設定

| 名前 | 役割 |
| --- | --- |
| `LOCAL_MCP_BEARER_TOKEN` | 内部adapter→core専用secret、32文字以上。外部OAuthの代わりには使えない。Test MCPと共用しない |
| `SUPABASE_SERVICE_ROLE_KEY` | 既存Edge認証とサーバー内SELECT用のsecret。値を表示しない |
| `LOCAL_MCP_WORKER_ID` | `LOCAL_QUEUE_RESCUE`を必須設定。別の値・未設定は起動拒否。regionはコード内で`RESCUE`に固定 |
| `LOCAL_MCP_ALLOWED_SITES_USER_IDS` | この新規Siteの利用許可対象IDのJSON配列。emailや表示名で認可しない。未設定・空配列は拒否 |

**service-role credential自体はREAD ONLYではありません。** 実装上のData API操作は2テーブルへのGETだけですが、このkeyはRLSを迂回する強い権限を持ちます。secret管理、所有者限定アクセス、ホスト侵害時の権限範囲をdeploy前レビュー対象にします。
この方式に新規role/GRANT/schemaは不要です。将来DBでも範囲制約を強制する専用資格情報へ移す場合は別設計・別承認とし、現時点で最小権限達成とは表現しません。

worker/regionの認可条件はユーザーの本番READ ONLY調査により確定済みです。
Sitesの利用者をこの権限へ紐付ける認証adapterはローカル実装済みです。Sites専用workerは公式仕様のdispatch identity headerを使用します。identityなし401、許可リスト外403、必要設定なし503で拒否します。worker範囲を環境変数やtool入力で拡大できません。

## 接続・秘匿

接続先はproject `qjlvsndiqjfsfjinilig`の固定HTTPS originです。
Edgeの`verify_jwt=true`と既存Bearer認証を維持します。
全体30秒（claim取得・Edge・再取得・body読取り含む）。request 8KiB、DB response 16KiB、context response 1MiB。
redirect、HTTP、Origin付きrequestは拒否。キャッシュ・再試行はありません。
期限と切断でAbortSignalを送りますが、upstream処理の実停止までは保証しません。
アプリはログを出さず、生error/body/headerは固定error codeに置き換えます。成功contextでも秘密キー名・値を検査します。
ホスト側のaccess log、trace、request/response captureでAuthorization・DB応答・Edge request bodyを収集しない設定も必要です。

## Supabaseローカル修正候補

`supabase-candidate/`は取得済み本番ソースのローカルコピーです。
変更は`lab-claimed-context/handler.mjs`の値比較と新規`context-snapshot.mjs`だけです。
既存automationモジュールとindex.tsは元コピーから無変更。
protocol参照比較をcanonical値比較に置換し、予想に使う既存項目の変更を検知、市場情報の更新は比較対象外にしました。
詳細・比較対象・保証の範囲は[blocker修正レビュー](review/blocker-resolution.md)を参照してください。

## ローカル検証

Node 24。追加npm依存・Docker・ローカルDBの構築は不要。

```sh
node --test --test-isolation=none tests/*.test.mjs
```

全テストはfixture/mock I/Oです。実collectorを通すローカル統合テストを含みますが、本番E2Eではありません。
最終結果は **138 PASS / 0 SKIP / 0 FAIL**（既存108件＋Sites adapter30件）。構文チェック成功。claim条件は[認可照合](review/local-queue-rescue-auth.md)、最新仕様は[Sites hosting契約](review/sites-hosting-contract.md)を参照。
本番READ ONLY照合はinformation_schemaの必要列・型・NULL可否だけを確認し、claim tokenは取得していません。

## 本番前に残る工程

1. 新規LOCAL Siteのproject IDと実際のsite-scoped利用者IDを確定し、Sites公式runtime secret/envへ許可リストとcredentialを設定する。site-scoped ID取得方法は未確認。
2. Supabaseローカル候補のコードレビュー・Deno実行環境確認後、別途承認された工程でEdge更新。認証設定は変更しない。
3. 新規・非公開Sites MCPへ統合するadapterを用意。Sites OAuthの信頼できる利用者IDを許可利用者へ照合し、単一workerの権限へ結び付ける。偽装可能な一般HTTP headerを信用しない。
4. Sites runtimeのNode crypto互換性、secret注入、HTTPS、timeout、ログ秘匿を確認する。
5. 別途承認されたdeploy・Plugin登録後、未発走LOCALの有効CLAIMEDでsmoke testする。現在RETRYなら本bridgeは拒否する。

Sites用認可adapterと公式dispatch headerへの接続はローカル実装済みです。新規Site登録・設定・deploy manifest・runtime確認は未完了です。mock検証を本番OAuth成功とは扱いません。
既存Scheduled Task・JRA・既存LOCAL予想ロジック・mainは変更していません。FROZEN保存経路もありません。
