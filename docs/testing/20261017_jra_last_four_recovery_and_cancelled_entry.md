# 2026-10-17 JRA残4レースの安全な実行記録（07:01–07:05 JST）

## 本番で登録完了
- 新潟12R（16:00、18頭）：公式現行JRA HTML全頭18/18照合、認証付きEdge `jra-verified-card-publish` → 正規 `jra_publish_verified_card_v1` → DBの `BASIC_READY` / `PENDING` 反映。HTTP 200、`net._http_response.id=21190`、18頭。FROZENなし。
- 東京12R（16:30、14頭）：公式現行JRA HTML全頭14/14照合、同正規経路で `BASIC_READY` / `PENDING`。HTTP 200、`net._http_response.id=21191`、14頭。FROZENなし。
- 直後の全開催監査は **33/36R BASIC_READY**。既存FROZEN、LOCAL/JRA AI Cron、外部有料API、予想順位/EYEは変更なし。

## 残3レース（公式READY未完了）
- 京都4R（障害3歳以上未勝利）は平地予想モデル対象外。DATA ERRORではない。
- 東京5R（2歳新馬）は正式な出走取消あり。10/16 10:30 JRA発表で **5番ジェットシェヴロンが出走取消**（ラジオNIKKEI: https://www.radionikkei.jp/keiba_article/news/5r_3.html）。
  - JRA公式東京5Rの取得済み現行HTML `net._http_response.id=21193` はHTTP 200/111288 bytes、`td.num`×9、馬表×9。
  - 5行目の馬番セルは **`<td class="num"><span class="cap">取消</span></td>`** の形式で、通常の整数馬番ではない。以前の `JRA_CURRENT_HORSE_NUMBER_NOT_PUBLISHED` は実際の取消行をパーサが解釈できないため発生。
  - **予想の新馬戦は公式過去走がなく、無理にFROZENしない**。正式な取消証拠を検証するまで現行 `ALL_ACTIVE_ONLY` publisher には登録させない。馬番5を表示順から偽装したり、取消をACTIVEにしない。
  - 開発ブランチの `supabase/functions/jra-verified-card/parse-numbered-card.mjs` に `JRA_CURRENT_SCRATCH_NUMBER_OMITTED_REQUIRES_RECONCILIATION` の明示的診断を追加。`card.test.ts`に回帰ケース1件追加して計14件（**未実行**）。本番Edge/DBの現在の挙動は未変更。
- 東京11R（15:45・富士S・14頭）：前回、公式publishの独立した通常認証呼び出しが**OpenAI安全性チェックでブロック**された。このターンでは再試行・経路変更・回避なし。公式出馬表の取得済みデータは存在するが、新規 `BASIC_READY` はまだ作っていない。安全性チェックで拒否された操作を成功扱いしない。

## 結果の読み方
- 完了はあくまで **公式カードの正規 `BASIC_READY` 登録**であって、LAB RANK/TOP5/EYEを評価・予想FROZEN保存した意味ではない。
- `private.jra_card_coverage_audit_v1('2026-10-17')`を確認するときはREADY33、OFFICIAL_NOT_READY2、EXCLUDED_OBSTACLE1を期待。10/17 07:02現在ジョブと予想FROZENは共に0。
- 元のFROZEN全件は変更していない。Cron/タスク自動起動、有料OpenAI API使用、出走取消の捏造はしていない。

## 次の作業
- 東京11Rは安全性チェックの正常な承認経路を確認するまで書込実行を中断。別ルートで迂回しない。
- 取消を含む公式カードの検証には、JRA公式データの取消行と既存の公式馬ID/番号の来歴を厳密に照合する契約・テストが必要。
- 開発ブランチの14件テストはDeno実行未完了。競馬当日の本番parser差し替えではなく、レース後に再現実行して安全確認する。
- CLAIM→正式FROZEN保存は当日発走70分前～3分前の窓で、別工程として厳密に実施・DB照合する。