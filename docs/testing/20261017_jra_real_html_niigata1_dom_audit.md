# JRA公式カード構造の実HTML検証記録（2026-10-17）

**状態: 実ソースの一部を検証済み。全36Rの完全確認・本番デプロイではない。**

## 正規ソース
- 対象: 2026-10-17 新潟1R（平地・芝1600m・12頭）
- JRA公式カード: `https://www.jra.go.jp/JRADB/accessD.html?CNAME=pw01dde0104202604010120261017%2F47`
- Supabase pg_netから **GET 200** を取得（read-only JRA HTTP request; `net._http_response.id=21041`）。content_type=text/html、約152KB。
- ページの宣言は `<meta charset="Shift_JIS">`。DBのHTTP応答テキストは日本語が文字化けするため、**文字化け後の日本語テキストは証拠として使っていない**。HTMLのASCII構造を検証した。Edge実装では生バイト列から `TextDecoder("shift_jis")` を使用予定。

## 実際に確認できたDOM
- 馬表は `<table class="basic narrow-xy mt20">`（単なる `narrow-xy` ではなく追加クラスあり）。
- 枠は文字列の `td.waku.text()` ではなく `<td class="waku"><img src="/JRADB/img/waku/5.png" .../></td>` の**画像ファイル**（馬番から推定禁止）。
- 馬番は `<td class="num">5</td>`、馬識別は `td.horse a[href*='accessU.html?CNAME=...']`。
- 斤量・騎手は `td.jockey > p.weight` および `td.jockey > p.jockey`。
- 今回調べたレースは `div.odds_line` が各12件存在。オッズは出走状態確認に限り使い、能力順位/EYEには使わない。

## 実HTML vs 取得済みDB、正確な比較結果
- 馬番と画像枠順の隣接ペアを**12件抽出**。
- ペア全12件が `jra_live_runners.horse_no/draw` と一致（不一致0）。
- `td.horse` 内の実JRA馬識別URLを12件抽出。保存済み `jra_live_runners.horse_ref` との一致 **12/12**。
- `td.jockey` 内の斤量を12件抽出。保存済み `jra_live_runners.weight_carried` との一致 **12/12**。
- 新潟1Rの全頭について、馬番・枠・馬識別子・斤量の構造は今回の実ソースと一致した。

## 修正
- 開発ブランチ `supabase/functions/jra-verified-card/parse-numbered-card.mjs`:
  - `td.waku img[src^='/JRADB/img/waku/']` から画像に書かれた枠番号を抽出。馬番からの数学的補完はしない。
  - `p.weight` と `p.jockey` に照合箇所を限定。
  - 通常出走の推定に依存しないよう、現在行の数値オッズ表示＋騎手/斤量をACTIVEの追加裏付けとして要求。未確認なら拒否。**オッズは順位付けに使用しない**。
  - 取消と除外は、過去走の列を除いた現在行から判定し、矛盾なら拒否。

## 今後の検証が必要
1. 第二会場、**多頭数18頭**の実ソースで枠画像・馬番を検証する。追加の照合SQLは環境側安全性チェックに阻止されたため、**確認済みとは記録しない**。
2. 明確な取消・競走除外がある公式カードで、マークと該当行のDOMを検証。
3. 実HTMLを `TextDecoder('shift_jis')` → Cheerio で読み取り、**完全な実HTMLを使ったテスト**を実施（現段階では構造照合のみ）。
4. Edge Functionに組み込む前に、氏名・騎手の正規化、日付・競馬場・発走時間、本人確認・認証、既存SQLガードの実結合テストを実施。
5. それまでは本番 `jra_publish_verified_card_v1` への証拠送信、`BASIC_READY` 公開、FROZEN保存をしない。

## 既存運用の保護
この調査は本番の `official_races`, `official_predictions`, Cron, 既存FROZENを変更しない。再取得したHTMLは公式ページの検証用で、内容をDBの正規出馬表として捏造・代用しない。
