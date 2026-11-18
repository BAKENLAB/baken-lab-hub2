# 統合研究V7

[検証報告](reports/README.md) / [優先8頭](reports/priority-eight.md) / [馬別比較](reports/capture-changes.md) / [全623頭](analysis/all623-material-audit.csv) / [実装状態](implementation-status.json)

既存の承認済み4点/2点式は確認できず、数値式を作らずnullを維持。名前・枠は623頭にあるが、データ取得と効果評価は別。8頭/18候補の構造化参照は再照合、当時の原本取得0、復帰0。

46R/623を最大5Rずつ継承比較し、83診断捕捉、V6比新規0/消失0。正式順位0R。V5/V6採点コード/予算/点数/選出を変えていない。既知46Rは開発集合。

新規単体16＋成果物14＝30 PASS/0 FAIL。将来入力の研究用seal/registration/CLIは実装・synthetic検証済み。正規MCP・信頼receipt・実将来評価は未接続、activation=false。本番採用NO。

```sh
node research/unified-engine-20261116/v7/tests.test.mjs
node research/unified-engine-20261116/v7/artifacts.test.mjs
node research/unified-engine-20261116/v7/run-batch.mjs 1 --output-dir /tmp/v7-new-batch01
```

各batch1〜10は最大5R、既存出力の上書き拒否。保存済みV5/V6のhash/支持点/選出を照合する継承比較で、新規独立採点をしたとは報告しない。V7 lock後に結果比較行を読む。Node.jsのみで再現、追加依存/ネットワーク/秘密値/有料API不要。batchesの圧縮JSONは既存v4/packet.mjsのdecode()で確認できる。

公式分類ページの通常取得は環境PermissionErrorで本文未取得。再試行/迂回なし、Supabase再試行なし。source-audit.jsonは基準commitの16資料に限定した確認で、外部原本/現行本番に式がないという証明ではない。

[将来検証の準備と未接続](FUTURE_VALIDATION.md) / [必要資料](REQUIRED_MATERIALS.md)。main/本番/DB/FROZEN/Cron/デプロイは変更していない。
