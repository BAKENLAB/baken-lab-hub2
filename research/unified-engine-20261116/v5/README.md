# 統合研究V5 — 順序に依存しない根拠配分

[検証結果](reports/README.md) / [馬別の新規捕捉・消失](reports/capture-changes.md) / [623頭CSV](analysis-reviewed/all623.csv) / [評価外46頭](analysis-reviewed/unrated46.json)

計画PLAN.mdとsource-lock.jsonを結果比較前に固定。12＋9＋4＋2＋14＝41 PASS/0 FAIL。V5の83捕捉は下限表示順の研究投影であり、確定TOP5/正式EYEを作れたという意味ではない。本番採用不可。

## 再現

Node.jsのみ。DB/MCP/秘密値/追加依存/外部モデルは不要。既存V4/RAWは読み取り専用。

```sh
node research/unified-engine-20261116/v5/allocator.test.mjs
node research/unified-engine-20261116/v5/eye.test.mjs
node research/unified-engine-20261116/v5/integration.test.mjs
node research/unified-engine-20261116/v5/eligibility-codes.test.mjs
node research/unified-engine-20261116/v5/artifacts.test.mjs
node research/unified-engine-20261116/v5/run-replay.mjs 1 --output-dir /tmp/v5-new-batch01
```

各batch1〜10は最大5R。新規出力先を使い、チェックポイントの上書きを拒否する。decision lockを出した後で比較ラベルを照合。既知開発集合の事後研究で、独立holdoutの代わりにはならない。

全原子fact・配賦slice・root予算・claim・EYE個別監査/全組比較はbatches/にSHA-256付きgzip JSONで保存。既存v4/packet.mjsのdecode()で読める。全頭明細と馬別個票はanalysis-reviewed/とreports/へ分離。

仕様取得時に末尾LFが1つ増えた版を固定hashへ取り込んだため、specification-captured.mdにその4090byteを保存。upstreamの803e835仕様は4089byteのまま変更しない。run-replay.mjsは/tmpのコピーでその末尾LFだけを再現し、凍結run-batchを実行する。採点コード・配点・入力・結果は変更しない。

`input.mjs`の凍結済み暫定失敗コードには正常照合の誤分類がある。根拠/採否/採点は影響なし。コード訂正は報告用eligibility-codes.mjsのみで、訂正版analysis-reviewedを参照する。凍結batchは変更していない。

同走EYE独立性の実証資料は0件。実データで同走独立性を認める方法の完成とは扱わない。本番/main/DB/FROZEN/Cron/デプロイ変更禁止を継続。
