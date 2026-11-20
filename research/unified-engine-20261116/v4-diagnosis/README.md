# V4 敗因診断

本体・係数は変更せず、固定V4（78捕捉）と先行力強化研究対照（92捕捉）を分析。

- [結論・全軸比較](reports/README.md)
- [消失32頭の全頭分析](reports/LOST32.md)
- [新規18頭の全頭分析](reports/NEW18.md)
- [38項目の接続実態](reports/ROUTES38.md)
- [49ケース比較CSV](results/scenario-matrix.csv)
- [配点・抑制の項目別明細](results/axis-allocation.csv)
- [評価外46頭と確認すべき元資料](results/information46.csv)

ケース計画はPLAN.md。49ケースは対照・同値確認も含む。新しい予想候補を作るコードではなく、既存allocate/selectEyeの再利用または配分の算術診断。
重複/共有上限を非使用にするケースは独立性が成立した評価ではなく、修正案・本番採用候補ではない。欠損補完や係数の調整はしない。

## 再現

Node.js、追加依存/DB/MCP/private Eval/API不要。固定V4に含まれる既知claimと監査証拠だけを利用する。

```sh
node research/unified-engine-20261116/v4-diagnosis/tests.test.mjs
node research/unified-engine-20261116/v4-diagnosis/artifacts.test.mjs
node research/unified-engine-20261116/v4-diagnosis/run-batch.mjs 1 --output-dir /tmp/diagnosis-new01
```

1〜10をそれぞれ新しい出力先へ指定、1回最大5R。出力の上書きは拒否。シナリオ出力lockを作ってから測定ラベルを照合するが、既知データの事後診断で独立検証ではない。
`packet.mjs`のdecodeを通じSHA-256検証後に読む。

全623頭×49ケースの明細・抑制atomは、元の5Rチェックポイントに分割保存。`results/all623.index.json`と`suppression.index.json`が対応memberとhashを示す。巨大な同一内容の集約ファイルをGitへ重ねて保存しない。
50頭全明細は `results/focal50.payload.json`。

厳密発走前の正式EYEは0のまま。本番・DB・main・既存FROZEN・Cron・デプロイ・有料APIは変更/実行しない。V4以前のモデルコード・元データは読み取りのみ。

## 検証結果

診断ロジック15 PASS、保存成果物整合性14 PASS、合計29 PASS/0 FAIL。旧V4のテスト件数を加算していない。成果物テスト作成時のJSON配列/オブジェクト参照誤りを修正後、14件すべてPASS。
