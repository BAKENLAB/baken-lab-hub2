# 46R・623頭の実データ復元（2026-11-16）

## 完了したこと

ユーザー提示のSQLを**そのまま**実行し、46R・623頭・92捕捉・◎1着8R・◎3着内21Rを再現。`g`から全馬を抽出してJSON/CSVとして固定した。出力件数を合わせるための配点・閾値の調整はしていない。

さらに、結果を受け取らない独立JavaScript実装で、元SQLの**全623頭の点数・順位・dense rank・選出を差異0件**で再現した。SQLの計算済み出力列は照合用であり、JavaScriptの選定には使わない。

|実測項目|結果|
|---|---:|
|対象|芝46R・623頭|
|旧TOP5＋EYEの3着内捕捉|87頭|
|旧研究の先行力強化版|92頭|
|新規捕捉／既存消失|5頭／0頭|
|候補条件該当|68頭|
|点数変動／順位変動|37頭／50頭|
|EYE変動|10R|
|強化版の◎1着／3着内|8R／21R|
|統合エンジン25項目の記録|623×25＝15,575件|
|中央判定器の参考条件該当|2,035件|

**これは旧研究の簡易選出の再現であり、正式2因子EYE監査の実施成績ではない。** 正式な独立100点評価の項目別配点と、全頭の実監査記録はまだない。各監査ログの点数はnull、採点はBLOCKED、正式EYE監査はNOT_PERFORMEDとして保存した。既存総合点を、25項目採点の完了証拠に見せかけていない。

## 新規捕捉5頭

|日付・競馬場・R|馬番|馬名|着順|
|---|---:|---|---:|
|10/24 京都10R|2|アスミル|1|
|10/25 京都8R|10|タマモブラウンタイ|3|
|10/25 新潟9R|13|ルージュリリック|3|
|11/14 京都12R|13|ダンデノン|3|
|11/14 福島9R|1|ライフイズカラフル|2|

馬単位の全差分とレース単位の的中維持を別々に記録。`horse-comparison.csv`/`.json` と `measurement.json` を参照。

## 発走前情報の保証範囲

- 全623頭の `source_checked_at` と `history_updated_at` は発走前。対象46Rの出馬表 `field_fetched_at` も発走前。
- **605頭は履歴取得時刻が元のFROZEN後**。全頭がFROZEN以前に取得済みなのは京都12R（11/8）の1Rだけ。
- **9頭は発走3分前の保存締切より後の取得**。この研究再構成を、そのまま正式保存可能だった予想とみなさない。
- 本日SHA-256で固定したのは、現在読み取った「発走前取得時刻を持つ行」の研究再構成。**当時のimmutable FROZEN入力原本を新たに作ったとは主張しない。** mutable行の時刻だけで改変不可能性を証明することはできない。
- 元SQLは全馬の有効位置履歴2件以上・保存済み順位点数の存在を条件にした部分集合であり、期間内芝全139Rを代表する無作為サンプルではない。

## 方法上の注意

旧研究の先行力は「前半位置÷当時頭数」の平均。PR #51の既存 `relative_early` は前半位置の平均で、**定義を混同しない**。旧研究の5点加点は候補条件と保存コメントのキーワード有無によるもの。キーワードがないことは、元評価にその根拠が未使用だった証明ではない。正式な重複防止台帳の代わりにはならない。

旧研究には距離1800m超も入り、簡易EYE抽出は独立2因子監査ではない。旧SQLは再現専用として保存し、本番・正式統合採点へ無条件に採用しない。今後はこの固定明細を基準に、独立した採点定義と正式監査を実施して比較する。

## ファイル

- `user-original-readonly.sql`: ユーザー提示の原文。
- `features-readonly.sql` / `results-readonly.sql`: `g`からの特徴量・結果の分離抽出。元のCTEは変更しない。
- `cohort-input.json`: 全623頭の入力、保存済み基準点・順位、履歴、時刻。人気・オッズ・raw列・対象結果は抽出しない。SQL計算済み出力は再計算の照合列。
- `official-results.json`: 照合ラベル専用。予想処理へ渡さない。
- `race-times.json`: 46Rの出馬表取得・FROZEN・発走時刻。
- `horse-comparison.csv` / `.json`: 全馬の前後比較、対象結果、捕捉差分。
- `measurement.json`: 候補数、点数・順位・EYE変動、新規・消失、時刻監査。
- `all-horse-25-item-audit.json.gz`: 15,575件の全項目ログ。容量削減のため可逆辞書化＋gzip。`audit-codec.mjs`の`unpackLogs`で全フィールドへ復元でき、実データで完全一致テスト済み。
- `snapshot-manifest.json`: 各データファイルの実バイト数・SHA-256、現在の固定時刻と保証範囲。

復元・全監査ログの展開例:

```js
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {unpackLogs} from './audit-codec.mjs';
const packed=JSON.parse(gunzipSync(readFileSync('all-horse-25-item-audit.json.gz')));
writeFileSync('/tmp/all-audits.json',JSON.stringify(unpackLogs(packed),null,2));
```

```sh
node research/unified-engine-20261116/restoration/build.mjs
node research/unified-engine-20261116/restoration/restoration.test.mjs
```

新規実データテスト15 PASS / 0 FAIL。既存の関連45件も回帰確認済み（合計60 PASS / 0 FAIL）。本番書き込み、CLAIM、FROZEN保存、デプロイ、Cron操作、課金は0。

## 未接続

みねた原本、正式100点項目配分、検証済みEval・不利・相手関係の完全な入力、全馬の本当の独立監査。この不足を旧研究の92捕捉や保存済みコメントで代替しない。

## 5R単位のチェックポイント保存（今回の更新）

一括blob保存APIが55秒で応答しなかったため中断し、その方法は再試行していない。GitHubでは通常のテキスト保存APIを使い、**5R×9組＋1R×1組**を別々のコミットに保存した。再現SQLはその前に `20993f36a0e30da82bcaf21878c3fbdf00ceb260` へ保存済み。

保存先は `batches/`。各組には閲覧用の `.csv`、件数とSHA-256の `.json`、元の5R分を丸ごと復元できる `.payload.json` がある。payloadはZIPをbase64で表現するUTF-8 JSONであり、ZIP自体のSHA-256と全内容ファイルのSHA-256を検証してから復元する。拡張子だけをZIPに偽装したファイルではない。

ZIP内は `features.json`、結果専用 `official-results.json`、`comparison.csv`、全項目 `all-25-item-audit.json`、`manifest.json`。結果は予想入力と別ファイルで、旧簡易選出と正式監査未実施の区別も維持する。圧縮コンテナの固定日時は再現性のための値であり、証拠取得日時ではない。

`batches/index.json` に全46R・623頭の索引、`batches/checkpoints.json` に10組それぞれの保存commitがある。分割テスト4 PASS。全組を一時ディレクトリへ復元し、欠落・重複なし、623頭・15,575項目・内容ハッシュ一致を確認した。既存60 PASSの記録とは別に報告する。

GitHub上のデータからの復元手順（研究フォルダ内だけへの書き出し）:

```sh
python3 research/unified-engine-20261116/restoration/restore-batches.py --output research/unified-engine-20261116/restoration
node research/unified-engine-20261116/restoration/build.mjs
node research/unified-engine-20261116/restoration/restoration.test.mjs
python3 research/unified-engine-20261116/restoration/test-batches.py
```

大きな元一括JSONは直接アップロードしていない。復元後のJSONの**内容**は元データと同一であることを正規化SHA-256で検証する。空白や数値の文字列表現を含む元一括ファイルのバイト列と、再シリアライズ後のバイト列の同一性は主張しない。個々のZIP内容ファイルのバイト列はSHA-256で検証する。

今回は取得済み固定データを分割し、本番DBからの再抽出は行っていない。再取得によるデータ混在を防いだ。本番変更・mainマージ・デプロイ・DB更新・FROZEN変更・Cron再開なし。
