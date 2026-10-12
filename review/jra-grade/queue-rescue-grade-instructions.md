# JRA ⑦ Queue Rescue grade生成・保存前検証（候補・本番未適用）

## 生成時
1. CLAIM後、MCP jra_claimed_context で正式入力とactive JRA_MAINプロトコルを取得。全ACTIVE horse_noを確定し、履歴不足・不明は捏造しない。
2. 既存BASE_CORE_0.1と凍結順位を維持し、各runnerのS/A/B/C/D/E/Fを実際の近走、距離、相手、展開、リスクから独立に判断。rankをgradeに変換しない。各runnerに個別の具体的reasonを持たせる。
3. TOP5には対応runnerと同一のhorse_no/horse_name/rank/grade、各個別reasonを必須とする。EYEはTOP5外全馬を再監査し選出時は同一horse_no/horse_name/rank/gradeと具体的な上振れreasonを必須。eye=nullは許可。6位自動選出は禁止。
4. payloadは7キーのみ。bets=[]、bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY。auditにactive version、grade_basis、全頭根拠、TOP5外の監査記録、市場不使用、検証済み範囲を明記。
5. 保存前にはcontextのACTIVE馬番集合とrunners全件、runner/TOP5/EYEのgrade、reason、馬名、rankを突合。grade-guard.mjsは候補の純粋チェックであり、順位やgradeや理由を生成・補完・書換しない。
6. 不完全ならFROZENを保存せず、CLAIM有効なら既存のRETRY処理で理由を記録し次レースへ。全条件OKの場合だけ既存MCP jra_save_claimed_prediction で保存、別SELECTでFROZEN/DONE/完全一致を確認。

## 未検証・禁止
- このJSはGitHub Actions上でのみ検証。本番のScheduled Taskにはまだ組み込んでいない。
- 実レースの根拠の真実性、MCPの実接続、Scheduled Taskの通し実行は未検証。形式チェックだけでは検証できない。
- 既存FROZEN・LOCAL・JRA順位/EYEロジック・本番DB・mainは変更しない。明示承認があるまでは本番適用不可。
- 過去のJRA FROZEN24件を候補条件に照合すると3件だけ完全適合。保存側だけ先行変更すれば多数RETRYのリスク。