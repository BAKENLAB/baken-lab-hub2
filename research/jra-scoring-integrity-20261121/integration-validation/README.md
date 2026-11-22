# PR83 最終統合・隔離実行

本番未反映。正式な全材料→100点生成器の完成・本番provider接続を宣言する記録ではない。
基準commit: `a86747f75ea5425f5793b7c543aa4b04c7734fbe`。

## 実ソースで確認した不一致と候補修正

v39の `eval-course-transfer-live.mjs` は `direction_corrobated` / `internal_stats_reliability` / `internal_stats_n` を生成する。
`jra-verified-evidence-rank-bridge.mjs` は、別名の `independently_corrobated_direction` / `independent_JRA_training_reliability` / `independent_JRA_training_n` と `bounded_eval_point_budget_eligible` を要求する。
生成側が後者4項目を出さないため、既存の「確認済み過去入着＋Eval S/A＋OWN n>=120・HIGH/MEDIUM等が一致した最大1点」の推奨が、実際の加点側へ届かない。別の接戦内容+1経路はこの不一致とは別。

候補は既存の `credible` 条件と統計値に同義の4項目を追加するだけ。新しい係数・条件・順位式は追加しない。原本は不変、候補全文・最小patch・SHA-256を保存した。
**実行時の加点が変わる修正なので、本番承認前の採用はしない。** 既存の最大2点・TOP5境界変更時のEYE再監査ゲートは維持する。同一根拠を提出側が既に評価している場合の意味的重複は、この接続テストだけで解決済みとはいえない。

## 実行した部分と代替した部分

|対象|実行内容|代替・未検証|
|---|---|---|
|候補MCP全体|既存candidate-index.ts全体を読み、型を除去して登録済みsaveハンドラーを実行。実handoff、全頭full-depth検査、実Eval生成器、実bridge、実EYE/null監査、保存後照合|Deno Edge、OAuth/SDK/Zod/HTTPはテスト境界へ置換。実ネットワークの認証成功ではない|
|Eval接続|実producer→実consumerで修正前0点、候補+1、低信頼・n不足・非入着・期限切れ拒否、同一入力反復|1,942行の形を持つ**全て架空のfixture**。非公開Eval原本の照合や精度比較ではない|
|保存SQL|保存済み定義の `jra_save_claimed_prediction` と `...with_shadow_v1` をそのままPG17で作成・呼出し|テーブル構造・レース・CLAIM・worker・protocolは隔離fixture。実CLAIM/OAuth/RLSの証明ではない|
|MCP→SQL連続実行|CIでは実saveハンドラーからpsqlで上記実関数を呼び、実FROZEN/DONE/receiptを受け取り、ハンドラーで読み戻し照合。各呼出しROLLBACK|DB clientをpsql adapterへ置換。実PostgREST/本番providerは未接続。readback transportは返却された実SQL行のfixture adapter|
|EYE|全頭・TOP5外の監査記録を持つ合成例でeye=null維持、監査漏れ拒否|実馬の17項目の意味的妥当性や新規選出精度を証明していない|
|公式証拠|既存reader/resolver・署名/ID/原文/hash/時刻拒否テストを維持|認可済み実issuer/providerからの実履歴認証0件。fixture署名を本番証拠としない|

DB adapterは環境変数が隔離PGの固定値と一致しないと拒否。`ledger_test`以外・既存productionテーブルがあるDBを拒否。各試験はBEGIN/ROLLBACK、本番接続設定やキーを利用しない。

## SQL実測

初回Actions run [44977303763](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/44977303763) SUCCESS。
実SQLの返却receipt、payload全文一致、FROZEN、DONE・lease解除、worker完了数、重複拒否、grade欠落、TOP5不一致、根拠欠落、期限切れ、発走3分前、protocol不一致、worker不整合、既存予想保護、任意shadow失敗時の通常保存、ROLLBACK後オブジェクト消失を確認。
後続の実ハンドラー→PG連続実行は別runで確認し、最終結果JSONへ記録する。

## 採点式と同一入力比較

[既存の新集約案](../core-connection/PROPOSED_AGGREGATION.md)と実装・80同一入力vector比較を維持。回収済み6区分5軸重みと未承認の丸め/欠損/同点仕様を区別する。新たな推測配点を追加しない。
現行本番の基礎点・因子点は提出側の判断記録であり、公式材料からそれを一意生成する現在の正式式は回収未完了。194頭の宣言台帳の算術再現と、旧SQLの再構成履歴からの反復実行は、同一発走前原文から現行スコアを再現した証明ではない。
5軸の真正な元入力がない194頭に逆算して軸を作らない。現行正式100点を新集約案で再現した頭数は0/194。

## providerの残障害

現行MCPはCLAIM済み要約を返すが、選択履歴ごとのrun/race/horse ID・署名付き原文・取得時刻を一体として返す認可済み経路を確認できていない。今回の限定的なpg_proc名検索（jra+official/evidence、claim/evidence、html）も0件。ただし名称検索だけでDB全体に経路がないと断定しない。
既存のOFF export候補は署名なし・CLAIM未結合・採点許可false。これを正式providerと偽らない。
必要な最小変更は、所有者・READY・lease・発走前を既存RPC同様に検証するreaderが、正確な選択元IDと原文/取得時刻/hash domainを返し、認可済みissuerの真正な証明へ結合すること。新たな本番RPC・権限・署名/保管設定が必要なら別途承認対象。新規CLAIMや管理DB経由の代替取得はしていない。

## 本番接続判定

**NO**。providerと全材料→100点生成式、実Deno/OAuth/PostgRESTでの統合、意味的二重加点と実入力回帰の未完了が残る。今回のEval項目名修正・隔離テスト成功だけを根拠に本番へ投入しない。本番MCP/DB/CLAIM/FROZEN/Cron/LOCAL/mainは未変更。
