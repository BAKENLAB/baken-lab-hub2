# 将来検証の準備 — 未開始・実経路未接続

holdout-registration.jsonは研究準備の固定記録で、実行タスクではない。現状はINPUT_COLLECTION_ONLY_NOT_ACTIVATED。現行プロトコルの取得、承認済み未接続式、信頼する入力不変保存receipt、検証期間/最低件数/採用判断基準が揃っていない。実開催のseal・予想・将来評価は0。

## 既存実装

- createRegistration: engine manifest hash、開発46R除外、JRA芝平地の範囲、測定項目を固定。これは期間/判断基準まで整った正式な事前登録ではない。
- sealInput/CLI: 登録後に観測した発走前入力だけを受け付け、結果/人気/オッズ、時刻不整合、将来の過去走、馬ID違い、重複馬・不足ロスター、公式参照の形式/日付/R不整合を拒否。UNKNOWN/nullは維持。正規の全頭確認を自動trueにしない。
- verifySeal: 内容hashと再構築を検証。ファイルはwxで新規作成のみ。trusted_immutable_receipt_verified/source_authenticity_provenはfalseのまま。

## 次の接続順序

1. 未接続4/2点の承認済み式または正式に固定した次研究版と、当時利用可能な入力を確認する。存在しなければ新しい研究案の別版が必要。今回その係数は作っていない。
2. 正規JRA MCPの現行protocol/context型を読み取りで確認。実際の原文を省略・推測・変換で取り違えないcapture契約とadapterを作り、新たに検証する。現在の研究スキーマはMCP原文との同一性を証明していない。
3. 最初の将来入力を見る前に、期間/件数/判断基準・対象除外/失敗処理を固定し、新しいregistration IDを発行する。既知46Rを将来検証へ移さない。
4. 発走前に入力原文・今回の計算/選択・旧基準との比較を不変固定し、信頼する外部receipt/事前commit等で時刻を確認する。ローカルファイルhashのみは事前存在の証明ではない。
5. 結果は別ファイルでレース終了後に照合。TOP5∪EYEの馬単位3着以内捕捉、既存好走馬の消失、母数/欠損/取消を報告。実行しなかったレースも記録する。予想原文を書き換えない。

## オフラインCLI

```sh
node research/unified-engine-20261116/v7/seal-input.mjs context.json holdout-registration.json NEW-research-seal.json
```

現在は研究用の限定schemaで、正規MCPへ直接接続するものではない。rootはrace/runners/source。sourceには公式出馬表ref、available_at、observed_at、declared_roster_count、各馬には公式horse_ref/status/source_checked_at/past_runs等が必要。CLIは現在時刻を使い、backdate用引数なし。実モデル/API/CLAIM/保存RPC/DB/スケジューラは呼ばない。

テストは明示的なsynthetic入力だけで行った。架空URLを取得したり実レースの証拠として保存したりしていない。テスト成功を実将来検証成功と数えない。
