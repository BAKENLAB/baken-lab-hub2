# 公式原文保持候補・11/22午前81頭の実台帳接続

基準 ecc1bbd32ef25883f6fd600171da2e19ed68458e。本番変更なし。provider／正式採点の本番完成を意味しない。

## 実装した部分

`capture-history-document.mjs` は、**既存の認可済み取得処理が既に取得したbytes**を受け取る保持候補。新規fetch、CLAIM、DB書込み、署名生成を含まない。

- 元bytesをコピーし、Shift-JISデコードとの一致を確認。元bytes SHA-256とデコード後UTF-8 SHA-256を別々に計算する。
- 公式accessS URL／CNAME／source_refを厳格に対応付ける。race IDと馬別run ID／horse ID／名前、取得時刻、抽出器IDを保持する。
- request header・token等は入力からコピーせず、明示した項目だけ保持する。
- 保存済みIDの同一性は呼出し側が渡すもので、このモジュール単独で原文中の馬ID・数値との意味的一致を証明したことにしない。
- `signature=null`、`signature_verified=false`、`claim_bound=false`、`historical_asof_proven=false`、`formal_scoring_allowed=false`。未署名sourceを署名済みにはしない。
- OFFは入力にアクセスしない。ONでも認可済みretain callbackがなければCAPTURE_SKIPPED。timeoutは既定75ms（許容1〜250ms）。capture失敗は通常取得へthrowしない。callbackにはAbortSignalを渡すが、外部処理自体の停止保証は実provider側にも必要。
- 全体の一貫した保管先・正規CLAIMで読めるproviderは未接続。メモリ上の保持／注入callbackの試験を、実DB保存や正規証拠提供の成功と数えない。

### 実履歴4件の原文取得

既存4件の実run/race/horse IDを起点に取得経路を確認。現在も設定経路は既知の失敗先proxy:8080だったため、再試行・プロキシ変更・別経路の迂回はしなかった。`acquisition-result.json` に `KNOWN_FAILED_PROXY_8080_NOT_RETRIED`、取得0件を記録した。
テストは実4履歴のIDと**明示的な架空bytes**を組み合わせてバイト保持機能を検証したもので、実JRA原文の真正性検証ではない。実原文・署名・正規CLAIMのE2Eは0件。

### 完成に足りない具体的な接続

実稼働jra-backfill v27は取得したHTMLをparseした後、本文を捨ててlab_races/lab_runsへ保存する。race IDは得るがrun upsertはIDのrepresentationを返さない。jra-live v32も本文を保存せずmetadataのみ。既存署名付きhistory-readerは確認できない。

将来取得に対する最小接続は、(1)既存fetchで得たbytesを保持、(2)同じ保存応答から正しいrun/race/horse IDを取得、(3)非公開の認可済み原文保管先へ保持、(4)正規CLAIM/READY/worker/lease/発走前検査を維持したreaderから同じ選択元を返す、という変更。署名を要求するなら認可済みissuerも必要。本番取得・保管・MCPの変更を伴うため、今回の禁止条件下では設定・デプロイしない。過去の失われた本文と取得時刻証明を、この候補で後付け生成しない。

## 11/22午前6R・81頭：実データによる再現検証

Supabaseのofficial_predictionsを読み取り専用で取得。race_date=2026-11-22、JRA、FROZEN、frozen_at<post_time、post_time<=12:00 JST。東京／京都1〜3R、6R・81頭を確認。原文は5R＋1Rの2ファイルに分割保存し、過去の194頭とは混同しない。

`replay-morning.mjs` は既存collectorと独立検算器を再利用する。

|対象|結果|限界|
|---|---|---|
|基礎点＋因子別points → review score|81/81一致|基礎点・pointsは保存された申告値。公式事実から生成した値ではない|
|記録されたEval/pace橋渡し → 最終点|81/81一致|補正値の計算元となる当時のcontext原文は未保存。数値照合と根拠真正性は別|
|点数順＋補正前順位＋馬番tie-break → 最終順位|6/6R一致|基礎点・因子点の生成方法は同定できない|
|TOP5／grade／EYEのrunner一致|6/6R一致|gradeの生成基準やEYEの内容監査を再生成したものではない|
|TOP5外の個別理由記録|51/51頭あり|17項目別の構造化review_checksは0/51頭。eye_pairwise_comparisonは0件。文章にあった監査まで「未実施」と断定しないが、全項目／全組の実施は証明できない|
|EYE選出|0/6R|nullを変更しない。理由記録から2因子監査の完全な実施を証明しない|

この比較は**同じ申告台帳から点数・順位を再計算した実績**であり、同じ公式発走前入力から独立した100点を再生成した実績ではない。結果テーブルは取得していない。6R/81頭を将来検証の新規予想として数えない。

## 正式式・承認候補の範囲

基礎点・因子pointsの元生成規則は、今回の81頭にも固定式／完全な入力・判断原記録がなく未確定。基礎点32等の観測値から閾値や係数を逆算しない。距離・クラス・着差・通過順・上がり・馬場の宣言効果は集計できるが、点数にした規則の真正性は証明できない。展開・直接対戦・相手後続実績の未証明材料を補完しない。

既存の承認候補 [UNAPPROVED_DIAGNOSTIC_AGGREGATE_V1](../core-connection/PROPOSED_AGGREGATION.md) は6区分・5軸の具体的な重み、丸め、同点、欠損拒否をコード化済み。新係数や旧式の正式採用はしない。この81頭にも必要な真正な5軸入力はなく、公式材料→5軸の生成規則の同一性も未確定。**そのため全材料から採点する完成候補とは判定しない。** 集約器だけの比較80vectorを、81頭の公式入力からの比較成功に置き換えない。

## 統合状態

既存の候補MCP保存ハンドラー→実PostgreSQL17保存関数→FROZEN/DONE/receipt/ROLLBACK回帰は維持。新capture候補→認可済み証拠→正式なfact-to-score生成→EYE17項目→正式保存を通す完全な正系は、前記接続がないため未実施。既存の隔離成功をこの未実施区間の成功と混同しない。

本番接続NO。capture候補はOFF/未接続。既存FROZEN・本番MCP/DB・CLAIM・Cron・LOCAL・mainは変更していない。
