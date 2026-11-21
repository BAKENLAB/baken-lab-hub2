# PR83 実行できる成果と未接続を分離

## 実装

- automation/jra-score-ledger/declared-ledger.mjs: 既存auditの数値から全頭台帳を作る。数値/係数/根拠を生成せず、reviewとbridgeの層を保持。コメントから点数を推定しない。
- independent-check.mjs: 別実装のBigInt整数検算、clamp、bridge、重複、全頭順位、TOP5/EYE/grade/公式ACTIVE集合を検査。算術一致を原本真正性や正式採点証明にしない。
- save-boundary.mjs: 独立検算不一致、期限切れ、公式集合不一致、未登録エンジン、証拠未確認、独立再計算不一致を、既存保存呼出しより前に拒否する候補。正常値の書換え/二重保存/自動再送なし。
- engine-lock.json: 正式100点生成器・hashは未回収としてnull/UNCONNECTED。BASE_COREや補正器を全体生成器と偽装しない。

候補save-boundaryの成功試験は明示的なMOCK registryとMOCK saveであり、本番エンジン・本番保存成功ではない。本番MCPへimport/wiring/deployしていない。既存public保存関数に必須接続していない。

## 実データ

11/21午後13R/194頭をSELECTで取得し、全頭の申告base/因子points/source_ref/bridge/最終値を台帳化。observations/ledgers/ にレース単位で保存。observations/nov21-afternoon-extract.json は必要フィールドの研究projectionで、元wireやFROZEN全文ではない。元FROZENの変更は0。レース結果は読まず、実績精度や改善率はこの作業で再計算していない。

node research/jra-scoring-integrity-20261121/replay.mjs
node tests/jra-score-ledger.test.mjs

replayは既存数値の検算であり再予想・将来実証ではない。13/13の算術/shape一致、正式係数検証0、原本真正性検証0。本番保存0。

## テスト

新規29 PASS/0 FAIL、既存full-depth 11・handoff 6・配線契約6・bridge6の計29 PASS/0 FAIL。合計58。validation-results.jsonと各logを参照。

隔離PostgreSQLは未検証。psql/Denoなし、Docker APIはpermission denied。追加権限要求・Docker環境構築・本番transactionによる代用はしない。PR開始時のSQL候補/六ケースは変更・適用しておらず、SQL実行PASSには数えない。SQL候補は元々source_ref/asof文字列だけで真正性を保証せず、公式ACTIVE集合や固定係数も独立確定しないので、そのまま本番接続できない。

## 適用前条件

1. 元の因子→points生成元と承認版/係数/丸め/tie policyを回収。回収不能なら「既存正式式」と称さず、新しい方式の明示的な仕様承認が必要。独自のrate-to-100変換は禁止。
2. 正規CLAIMで実際に使われた履歴ID/原本/取得時計のresolverを接続し、発走前snapshotに束ねる。文字列source_refや自己申告フラグだけでPASSにしない。
3. 候補を既存MCPの最終payload生成と元DB保存transactionへ結び、既存CLAIM/READY/worker/lease/発走締切/FROZEN保護/EYE再監査をそのまま維持。bridge前後の点数を混同しない。
4. 隔離PostgreSQLと実Edgeで正常/拒否/rollbackを確認してから段階接続。未構成ガードを入れて全レース保存不可にしない。
5. 未知の発走前レースを正規CLAIM・保存で検証。過去FROZENの書換えや発走後保存で代用しない。

現段階の本番接続可否 **NO**。本番MCP/DB/既存FROZEN/CLAIM/Cron/LOCAL/main/デザインを変更していない。有料APIなし。研究だけで完了とは報告せず、実装・実データ検算が済んだ部分と未接続を区別する。
