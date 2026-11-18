# 統合研究V6 — 未確定要因を証明可能な範囲へ分離

**100点エンジン完成は未達。本番採用不可。**

[検証報告](reports/README.md) / [46頭の177履歴再照合](reports/unrated46.md) / [馬別捕捉変化](reports/capture-changes.md) / [623頭CSV](analysis-reviewed/all623.csv) / [レース別確定状況](analysis-reviewed/race-certification.csv)

復帰0頭、正式順位確定0R、正式EYE0。診断捕捉は83でV5から新規0/消失0。既知46Rの開発研究で、将来の独立検証ではない。新規単体14＋成果物16＝30 PASS/0 FAIL。

## 固定と再現

PLAN.mdとsource-lock.jsonを結果比較前に固定。V5の採点処理と配点は変更しない。

```sh
node research/unified-engine-20261116/v6/tests.test.mjs
node research/unified-engine-20261116/v6/artifacts.test.mjs
node research/unified-engine-20261116/v6/run-batch.mjs 1 --output-dir /tmp/v6-new-batch01
```

batch1〜10、各最大5R、出力上書きは拒否。Node.jsのみ。ネットワーク/秘密情報/モデルAPI/追加依存不要。V6のdecision lockを書いてからターゲット結果・比較選出を読む。元の構造化archiveはSHA-256検証付きだが、当時のimmutable prompt入力原文とは証明できていない。

全原記録・上限証明・未知軸・境界比較・可能TOP5外全組はbatches/*.lock.payload.json。既存v4/packet.mjsのdecode()で確認できる。analysis-reviewedが集計の正本。初回ローカル集計のcomponent件数を馬数と呼ぶ表示を修正し、861components/563頭のように区別した。凍結batch・採点結果は不変。

Supabase新SELECTの応答が得られず、新DB証拠0。batchごとのreadonly-followup.sqlは準備のみで未実行。適格な新証拠が見つかる場合は止めて採点再構築・再固定を要求するため、未検証の復帰を自動実行しない。

今回変更したのは研究用の上限解析・監査と報告だけ。未知上限の縮小を新しい能力点に転用しない。本番/main/DB書込み/FROZEN/Cron/デプロイ/有料APIへの操作なし。
