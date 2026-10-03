# LOCAL blocker修正レビュー

本資料は82件のテスト時点の修正記録です。後続で確定したLOCAL_QUEUE_RESCUE／RESCUE条件と最新照合は[認可照合](local-queue-rescue-auth.md)を参照してください。

## 1. CONTEXT_CHANGED

原因: 既存handlerが2回のJSON deserializeで得た`protocol.content`を`!==`で比較していました。同じ内容でもobject参照が異なるため409になります。
出馬表側のraw `JSON.stringify`比較もキー順・runner配列順の差を実変更と扱っていました。

最小修正: collector呼出し前にcanonical stringを固定し、再取得したstateのcanonical stringと比較します。
ハッシュ衝突を避け、canonical値そのものを内部比較します。応答契約・collector・予想ロジックは変更しません。
object keyをsort、runnerを馬番でsort、identity_refsを集合としてsortします。protocolの命令配列は順番に意味があるため順序を保持します。

対象:

| 区分 | 比較対象 |
| --- | --- |
| race | race_date / track / race_no / circuit / post_time / race_name |
| protocol | protocol_key / version / is_active / content全体（規則の変更を検知） |
| runner | horse_no / horse_name / status / sex_age / weight_carried / jockey / draw / trainer / sire / damsire / body_weight / body_weight_diff / equipment / identity_refs |
| conditions | field_payload.conditionsのsurface / distance / going / weather / turn / class_name |

馬番・馬名・騎手・斤量・ACTIVE/CANCELLED/EXCLUDED・馬の増減は検知します。
runner/field_payloadの人気・オッズ・市場・結果・取得時刻等は含みません。列は既存collector/handlerの契約から列挙しています。
protocol.contentは市場値ではなくルール文書として全体比較します。「市場を使わない」等の規則まで削除しません。

保証の範囲: 1回のcontext取得中に2回読んだDB race/protocolの対象値の差。
外部公式ページだけの後続変更、過去履歴行の後続訂正、最終確認後の変更はこの比較では検出保証しません。既存collectorは公式出馬表を1回取得し、履歴を再収集しません。
呼出し間の比較用fingerprintを新たに公開する変更も行っていません。

## 2. 動的claimと認可境界

LOCAL_MCP_CLAIM_JSONは廃止。現在の認証済みMCP利用者をサーバー設定worker_idへ結び付けます。
toolはjob_idだけを受け付け、worker/run/token/raceは受け付けません。
指定jobをLOCAL・CLAIMED・claimed_by=許可workerの条件でSELECTし、worker_runのRUNNINGと同一workerを照合。
lease・attempts・UUID型も検査し、取得したtokenをEdgeへ内部転送します。
処理後も再照合し、run/token/owner/raceの交代や失効でcontextを破棄します。lease延長だけなら有効なまま返せます。
同じ許可workerの別jobは正当な対象です。別jobの行をresolverが返した場合や別workerのjobは拒否します。

Data APIは固定project、固定2テーブル、明示SELECT、limit2、GETだけです。
操作はREAD ONLYですが、既存Edge認証が必要とするservice-role自体は強い権限を持ちます。
DB側でMCPだけの権限範囲を強制する新role/view/RPCは今回作成も適用もしていません。
後続のユーザーREAD ONLY調査でworker=LOCAL_QUEUE_RESCUE／region=RESCUEが確定しました。Sites利用者への権限割当と本番設定は未実施です。

## 3. 本番DBのREAD ONLY型確認

information_schema.columnsのみSELECTしました。

- lab_prediction_jobs: id=uuid、race_date=date、track/circuit/job_status=text、race_no/attempts/max_attempts=integer（すべてNOT NULL）。
- claimed_by=text、lease_until=timestamptz、claim_token/worker_run_id=uuid（NULL可）。CLAIMED取得時にNULLは拒否。
- lab_worker_runs: id=uuid、worker_id/status=text（すべてNOT NULL）。

列契約はresolverの期待と一致。実PostgREST権限、実token、実claim動作を確認したものではありません。
必要資料はSupabaseのRLS/Data API公式docsで確認。changelogのHTTP取得は環境proxy接続失敗のため未確認で、再試行はしていません。

## 4. 適用範囲と本番判定

Supabase側: lab-claimed-contextのhandlerと新helperを将来更新する必要があります。verify_jwt=true維持。新schema/role/GRANTは本案に不要・未適用。
Sites側: 新規非公開MCPにOAuth利用者認可adapter、worker binding、secret管理、互換runtime、ログ非収集設定が必要。既存Test MCPは対象外。
本番deploy判定はNO。ローカル修正以外のhosting統合・実環境検証・有効claim smoke testが残ります。
本作業中はdeploy、Plugin登録、Scheduled Task変更、FROZEN保存、main変更を実施しません。

## 5. 最終検証とファイル

**82 PASS / 0 SKIP / 0 FAIL**。値比較28件、MCP/動的claim50件、実collectorを使うローカル統合4件。
必要ケース: 同一context成功／キー順変更成功／実データ変更拒否／市場だけ変更成功／有効claim成功／期限切れ拒否／他worker・job・run拒否／non-LOCAL拒否／token値・key・大文字UUID・RPC id・ログ漏洩防止を確認。
DB/Edge timeout、エラー、重複行、取得中token交換、lease延長、次jobの自動token解決も確認。
本番DB/公式サイト通信を使うE2E成功とは扱いません。

変更: `src/mcp.mjs`、`tests/mcp.test.mjs`、`package.json`、`README.md`、`review/upstream-audit.md`。
追加: `src/claim-resolver.mjs`、`tests/context-change.test.mjs`、`tests/local-e2e.test.mjs`、本資料。
追加したローカル候補 `supabase-candidate/` の修正箇所は `supabase/functions/lab-claimed-context/handler.mjs` と新規 `context-snapshot.mjs` のみ。
候補内automationモジュールとindex.tsは取得済み原本とのdiffが0件。既存予想ロジックには差分がありません。
