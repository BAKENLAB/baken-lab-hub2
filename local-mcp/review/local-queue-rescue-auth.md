# LOCAL_QUEUE_RESCUE 認可条件の照合

本資料の次工程であるSites認可adapterは後続でローカル実装済みです。最新状態は[認証adapter資料](sites-auth-adapter.md)を参照してください。

ユーザーが本番READ ONLYで確認した確定条件に対し、ローカルresolverを照合しました。本作業では本番アクセス・変更は行いません。

| 条件 | 修正前 | 修正後の検証 |
| --- | --- | --- |
| 指定job_idとjob.id一致 | 実装済み | job GETのid条件＋返却値一致 |
| circuit=LOCAL | 実装済み | GET条件＋返却値一致 |
| job_status=CLAIMED | 実装済み | GET条件＋返却値一致 |
| lease_until > now | 実装済み | job取得時・run取得後・context返却前に期限検証 |
| claim_token NOT NULL | 実装済み | NULLを含む非UUIDを拒否 |
| worker_run_id NOT NULL | 実装済み | NULLを含む非UUIDを拒否 |
| job.worker_run_id=run.id | 実装済み | job由来のIDでrunをGETし、返却値を再照合 |
| run.status=RUNNING | 実装済み | GET条件＋返却値一致 |
| run.worker_id=LOCAL_QUEUE_RESCUE | 任意の設定workerを許可していた | 設定をLOCAL_QUEUE_RESCUEに限定。GET条件＋返却値の固定値検証 |
| run.region=RESCUE | 未取得・未検証 | regionをSELECT・GET条件・返却値検証へ追加 |
| job.claimed_by=run.worker_id | 両方を同じ設定値へ照合して成立 | 両者の直接比較も追加 |
| context取得後に同じjobを再確認 | 実装済み | 同じjob_idでresolver全条件を再実行 |
| worker_run_id変更時は破棄 | 実装済み | sameClaimで取得前後のrun_idを比較 |
| token変更時は破棄 | 実装済み | sameClaimで取得前後のtokenを内部比較 |
| lease失効時は破棄 | 実装済み | resolverと返却直前の期限検証 |
| job_status変更時は破棄 | 実装済み | 再取得のCLAIMED条件・値検証 |
| run status変更時は破棄 | 実装済み | 再取得のRUNNING条件・値検証 |

認可はclaimed_byだけでは成立しません。job→worker_run_id→lab_worker_runsの実取得が必須で、runなし・複数件・不一致・他regionは拒否します。
`LOCAL_MCP_WORKER_ID`はLOCAL_QUEUE_RESCUEのみを許可。RESCUE regionはtool入力・環境変数から変更できません。
context取得後のworker/region変更も同じ検証で拒否します。

claim tokenはリクエスト内の変数から既存Edgeへの内部POSTにだけ使います。tool引数にせず、成功context、エラー詳細、RPC id、通常ログへの混入を防ぎます。
DB認可失敗は固定`CLAIM_UNAVAILABLE`、有効な別run/tokenへ交代した場合は固定`CLAIM_CHANGED`で、contextを返しません。

ソースの変更は`src/claim-resolver.mjs`のみ。テストfixtureと追加テストは`tests/mcp.test.mjs`、`tests/local-e2e.test.mjs`です。READMEとレビュー資料も更新します。
既存Edge候補、予想ロジック、Scheduled Task、JRAは今回変更しません。table/schema/role/GRANT追加、deploy、Plugin登録、main変更、FROZEN保存も行いません。

本番条件適合の判定対象はローカルresolverのコードとテストです。本番deploy済み・実E2E確認済みという意味ではありません。
次のblockerはSites認証の統合。次の1工程は、許可されたSites OAuth利用者だけをこの固定rescue権限へ紐付けるadapterのローカル実装とテストです。

## 検証結果

`node --test --test-isolation=none tests/*.test.mjs`: **108 PASS / 0 SKIP / 0 FAIL**（26件追加）。構文検査も成功。
指定された正常・不一致・失効・NULL・取得中交代・run終了・秘密漏洩防止の全ケースを検証しました。
fixture/mockを使った全ローカルテストであり、本番E2E成功とは扱いません。コード上の必須認可条件への適合はYESです。
