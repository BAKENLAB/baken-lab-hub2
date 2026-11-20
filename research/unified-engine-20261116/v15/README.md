# V15: 保存済み情報の接続監査

基準: e0cca84ed52cd7c89c095c22898cdb8afa9a2012 / Draft PR #51。
研究のみ。本番はメタデータと既存行のSELECTのみ。保存関数は呼び出していない。

## 確認できたこと

V14で未取得だった3関数をSupabase MCPのpg_get_functiondefで取得できた。原文、SHA-256、ACLはsources/とsource-manifest.jsonに保存した。今回の取得は成功し、失敗経路の反復や迂回は行っていない。接続障害の過去の根本原因までは確定しない。

| 関数 | 実ソースで確認した保存内容・制約 |
|---|---|
| jra_save_claimed_prediction | 7項目payload全文をofficial_predictionsへ保存。job/workerをlockしCLAIM・RUNNING・lease・発走3分前・active protocol・既存予想保護・grade等を検査。DONE時にclaim/run関連列を解除。model_labelの固定文字列は実際の評価モデルを証明しない |
| jra_save_claimed_prediction_with_shadow_v1 | baselineとpreviewが両方ある場合のみ既存preflight capture。capture失敗はOPTIONAL_CAPTURE_SKIPPED。正式保存は元関数を使用。prediction_id等を返す。正式保存失敗時は同じtransaction内のcaptureもrollback |
| lab_capture_rank_shadow_preflight_v1 | ACTIVE馬番/馬名、draft/proposed順位、job_id、protocol、model、post_time、capture hashをprivateへ保存。READY/BASIC_READY、CLAIM・RUNNING・期限を検査。context全文、履歴ID/原文、Eval/OWN原材料、全payload、実attempt識別は保存しない |

preflightはSECURITY DEFINER、wrapperはSECURITY INVOKER、正式保存はSECURITY DEFINER。3関数のACLはpostgres/service_roleで、検索パスは原文に固定されている。private preflightとjobはanon/authenticatedにSELECT権限なし。official_predictionsのSELECT grantだけでは全行取得可能という意味にはならない（RLSあり）。現行権限は変更していない。

## 既存行での接続確認

2026-10-17〜11-15のJRA preflight **48件**について、同じレースキーのFROZENが48件、job_id一致ジョブ48件、DONE48件、captureが発走3分前より前48件。これは既知開発期間の既存行であり、新規実比較48件とは数えない。46R/623頭の集合と同一とは主張しない。

link-counts.sql/jsonが再現クエリと実結果。link-samples.sql/jsonでは2件の実データを抜粋し、snapshot/job/prediction ID、capture/frozen時刻、順位配列、payloadの7キーを確認した。2件ともcapture<=frozen、frozen<発走3分前。全48件の時系列関係をこの2件から推測しない。

| 記録 | 既存情報で確認できる範囲 | 残る不足 |
|---|---|---|
| 初回context | V14のMCP応答経路・V13の原文記録器 | 当該実行の原文、実使用時刻、同一ACTIVE集合の発走前固定 |
| 保存前の追加材料 | V14ソースでfresh context / Eval / OWN / bridge / EYEの経路を確認 | 実際にそのattemptで使った原材料全文・版・各段階hashと時刻 |
| 提出payload | 正式RPCへ渡した7項目はDBでそのまま保存される | クライアント提出値から通常のMCP補正を経た差分の実記録。DB payloadと利用者の最初の提出値は無条件に同一ではない |
| 実FROZEN | 保存済みpayload、prediction_id、protocol、frozen_atを認可済みSELECTで取得可能 | input全体との因果的な紐付け。保存済みだから入力原本もあるとはしない |
| receipt | wrapper応答はprediction_id等。preflight/job/race/FROZEN間を既存行で対応付け可能 | 当時の外向け応答原文・attempt traceが別途必要。3関数に専用receipt INSERTは見当たらないが、全trigger/他関数を調査していないのでDB全体の不存在とは断定しない |

preflight hashは馬番/馬名・順位・job・protocol等のJSONB表現に対するhashで、context hashではない。horse ID、履歴原文、grade、EYE、コメント、attemptを拘束しない。レースキーjoinは対応関係の証拠で、入力が全く同じだったという証明ではない。

## 必須・代替可能・不要

**必須**: 正規CLAIM/READY/権限/lease/発走締切、両版が実際に使用した同一入力と全ACTIVE馬集合、履歴ID・race/horse ID・原文参照・取得時計の真正性、結果隔離、両版の発走前独立固定、正式payload/FROZENとの追跡。未証明履歴は観測候補に留め、採点へ昇格しない。

**代替可能**: 実FROZENの新規複製保存は不要で、認可済み既存row読取りで代替できる。receiptは元応答＋実rowのID/レース/時刻/内容照合で追跡する。私有Eval全コーパスの公開は不要で、使用分の認可済み再現可能な版/参照/hashを使う。ただし取得不能な本文をhashだけで代替できない。初回と保存前の値が一致した場合も、実際の取得・使用の記録が必要。

**不要**: 研究のための新規CLAIM、旧版再評価、正式保存再実行、FROZEN補完更新、架空の旧100点評価器、係数追加、既知46Rを未来検証へ転用、私有データのGit公開。

## 判定

**本番変更なしで未知実レースの正式な同一入力比較: NO。実比較0件。**

保存関数取得の障害は解消。最小の残障害は実使用context/保存前材料の記録と、採点に必要な履歴原本・ID・時刻の正規証拠接続。既存DBが全payloadを保存することは確認できたので、FROZEN保存基盤を新設する必要はない。元の独立100点数値生成器は今回も回収しておらず、旧版の現行判断を架空式に置き換えない。

CAPTURE_DESIGN.mdに既定OFFの最小案と承認対象を記載。候補MCP/DBのコード・schemaは変更していない。現在のソース確認はV14取得版と今回のDB定義が対象で、将来の適用直前にはversion/hashの再照合が必要。

## 検証

regression-summary.jsonと各ログ: V9 24、V10 19、V11 21、V13 9、V14 5の計78テストPASS/0 FAIL。V12の実資料整合性6検査PASS。V9〜V14既存208ファイルの実行前後SHA-256差分0。テスト成功は実MCP接続・未来レース比較の成功ではない。採点順不変・根拠予算・null保護は既存テストの検証範囲で維持。

本番書込み0、新規CLAIM0、実レース予想保存0、FROZEN変更0、main/Cron/デプロイ変更0、有料API呼出し0。
