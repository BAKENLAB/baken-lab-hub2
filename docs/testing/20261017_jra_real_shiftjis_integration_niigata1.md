# JRA 2026-10-17｜本物のShift_JISカードを使った統合テスト

日時：2026-10-17 JST 02:40頃（実行時刻はEdgeログで別途確認可能）
環境：BAKEN LAB Supabase project `qjlvsndiqjfsfjinilig`
対象：2026-10-17 新潟1R（平地・芝1600m、12頭）

## 実施したこと（確認済み）
1. 既存`jra_live_races`と`jra_live_runners`を**読み取り**。
2. 新規検証専用Edge Function `jra-verified-card-dryrun` v1を**認証必須（verify_jwt=true）**でデプロイ。既存の`jra_cron_gateway_jwt`と`jra_cron_token`で保護し、**FROZEN保存・公式READY公開RPC・予想テーブル書き込みは一切実装していない**。
3. このEdgeがJRA公式HTMLを実際に取得し、**生バイト**を`TextDecoder("shift_jis")`で日本語として解析。
4. Cheerioで番号付き出走表を解析し、`parseNumberedJraCard`→`validateCurrentJraField`で全頭と保存済みJRA liveデータを照合。
5. `net.http_post`の実HTTP応答 ID **21056**、status **200**、JSON結果：
```json
{
  "ok":true,
  "track":"新潟",
  "race_no":1,
  "date":"2026-10-17",
  "full_field":12,
  "verified":12,
  "counts":{"active":12,"cancelled":0,"excluded":0},
  "first_name":"ウメヒナタ",
  "last_name":"ルナロマンティカ",
  "has_japanese_name":true,
  "code":"READ_ONLY_VALIDATION",
  "no_prediction_written":true
}
```
6. **この1R/12頭については実HTML→Shift_JIS→Cheerio→validatorの統合実行が成功した。** 騎手・馬名・枠番・斤量・馬の識別URLを構造化データと照合した。

## 開発ソースの永続化
- `supabase/functions/jra-verified-card-dryrun/index.ts`
- `supabase/functions/jra-verified-card-dryrun/parse-numbered-card.mjs`
- `supabase/functions/jra-verified-card-dryrun/validate-current-field.mjs`

この3ファイルは**デプロイ済みEdge Function v1から取り出した実内容**でGitHub開発ブランチに保存した。永続化しないEdge-only変更を避けるため。

## 制約
- 京都12Rと東京1R等の**追加認証付き呼び出しが安全性チェックに阻止された**。それらで全HTMLの統合テストを実施済みとは言えない。
- ただし、前ターンの公式HTML構造比較では、新潟1R 12頭＋京都12R 18頭、計30頭の馬番・枠画像・識別URL・斤量がJRA liveデータと一致した。
- **取消・除外が実際に存在するカードでの実例テストは未実施**。これが重要な次の検証条件。
- 現行`jra-verified-card-dryrun`はあくまで**読み取り専用**。本番の`jra-verified-card`（publish版）はデプロイしていない。
- `jra_publish_verified_card_v1`への送信はゼロ。`official_races`のJRA `BASIC_READY`新規生成もしていない。
- 開発ブランチの`card.test.ts`は作成済みだが、Denoのテストランナーでの実行結果はまだない。
- 当日の手動予想CLAIM/FROZENを許可する状態に到達したと誤認しないこと。

## 本番反映の前提
(1) サンプル複数会場・複数頭数、(2) 取消/除外の実DOM、(3) 公式proofの鮮度（120秒）と同一バイトSHA-256、(4) DB正規ガードのテストを確認した後に限定的な本番出版を行う。過去FROZEN・AI Cronの変更および有料API利用は禁止。
