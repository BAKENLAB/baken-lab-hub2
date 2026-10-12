# JRA結果取得のレース単位エラー隔離候補

基準はSupabase本番jra-result-refresh v7のレース処理ループ。候補は未適用。認証・公式HTMLパーサー・レース選択・Cronは変更しない。秘密値を含むEdge全文は保存しない。

## 差分

- レースごとにtry/catchを追加。例外で後続レースを中断しない。
- official_results.upsertの返却errorと例外を検出。
- official_races.updateの3経路（CNAMEなし、結果未取得、保存後READY更新）の返却errorと例外を検出。
- reportにresult_saved/ledger_updated/partial_failureを追加。返却errorと例外はfailure_kindで区別。catchは固定エラー分類だけを返し、例外本文を新たに公開しない。
- success_countはok=trueのみ。failure_count、partial_failure_count、skipped_countを別集計。
- 正常時のDB書き込み、対象キー、保存内容と既存のreport項目を維持。全体のレース取得／キュー取得エラーは引き続き全体失敗。

## 統合方法（まだ実施禁止）

`race-loop.patch`は現行Edgeのループ部分に当てるレビュー用差分。元ソースがv7と一致することを確認してから適用する。正常レスポンスのok/date/processed/reportを維持し、必要なら候補モジュール末尾と同じ成功・失敗件数を追加する。process-result-races.mjsはループを依存注入でオフライン実行する候補モジュール。tests/baseline-race-loop.mjsは同じ範囲の旧動作比較用で、TypeScript型注釈のみ除去している。

実行: `node research/jra-result-isolation/tests/isolation.test.mjs`

## 限界と残存リスク

- すべてオフラインのモックDB・通信。実Supabase書き込み、Edge実行、実通信・負荷・スマホ表示は未検証。
- 結果保存後に台帳更新が失敗すると結果行だけ保存済みになる。partial_failure=trueで報告し、追加補償更新をしない。既存の次回定期実行が再取得する可能性は残る。新しい自動再実行は追加していない。
- 書き込み通信例外は、サーバーでコミット済みか不明な場合がある。result_saved=falseは成功応答を確認できなかった意味であり、未保存の断定ではない。
- 既存のskip条件、Math.roundによる10分判定、パーサー、結果upsert仕様は改善対象に含めない。
- 個別失敗でも処理ループは継続してHTTP200に到達可能。監視側はHTTPだけでなくreport.okとfailure_count相当を確認する必要がある。
- 東京1R/4R登録後は対象2件の公式結果・台帳更新と通信が増える。無副作用とは扱わない。正常な後続レースの保存は隔離テストで不変確認。
- FROZEN、予想ジョブ、RESULT集計、LOCALを扱うコードは変更しない。

本番適用・2件登録・mainマージ・Cron変更は別途承認が必要。
