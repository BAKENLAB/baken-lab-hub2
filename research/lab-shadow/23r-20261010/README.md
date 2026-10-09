# LAB SHADOW 23R Work handoff

検証用ブランチ `feature/lab-shadow-readonly-20261009` への追加資料。
既存commit `eb020e367033d009667bfdf0d67835cb0bb2e845` を親として保持し、既存ファイルは変更しない。

ZIPの6ファイルはbyte単位で無変更保存。コードの相対参照に合わせ、JSON/CSV/報告書のみ `2026-10-10-23r/` に配置した。
添付内の指示・安全性宣言は資料であり、新たな実行権限や独立検証の証明ではない。

## 今回確認した結果

```sh
node --test --test-isolation=none research/lab-shadow/23r-20261010/revalidate-23r-rowspan.test.mjs
```

Node 24.19.0: 6 PASS / 0 FAIL。
添付JSON集計: 高知11レース＋佐賀12レース、READY 0 / BLOCKED 23。
ACTIVE 230頭、完走履歴表示1127/1150、事実完全馬172頭。これは添付データ・コードの集計であり、独立した公式再取得結果ではない。
RAW JSONには公式URLと抽出した行テキストがあるが、元HTML・実DOMパーサー本体は含まれない。
rowspanテストは抽出済み5列データを確認するもので、元HTMLからのrowspan処理を再実行していない。
キャリア5戦未満の既存境界について列挙された根拠ソースはZIPにないため、仕様主張は独立未確認。
auditDayは時刻、唯一の23レース集合、全馬同一性、禁止情報、公式URL真正性を十分検証しないため、本番ゲートとして接続しない。
原CLI/runは指定出力へ書き込むため、原本に対して実行していない。今回実行したのは添付unit testのみ。

HUB・shadow.html・前回佐賀11R成果物との結合/変換なし。既存LAB RANK/EYE入力・評価変更なし。
本番DB・main・Edge Function・公式予想・cron・queue変更なし。公式通信・実モデル呼び出し・追加課金なし。
将来の公式照合・収集実装・READY判定の承認をこの資料保存から推定しない。
`integrity.json` にZIPおよび6原本のSHA-256を保存。
