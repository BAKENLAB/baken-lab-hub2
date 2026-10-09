# 高知3R 公式履歴採用パイロット（オフライン・本番利用不可）

基準: `151e295f84adfa363270bc1c2c5833ce7307e6e9` / `feature/lab-shadow-readonly-20261009`。
対象: 2026-10-10 高知3R、RAWでACTIVEの馬番1,2,3,4,5,7,8,9。
取得時点は2026-10-10 07:11 JST前後、出馬表の発走予定16:40より前。
23R展開、本番受理、READY変更は行わない。

## 結果

8頭の馬セルに属するプロフィールリンクを公式出馬表HTMLから取得し、保存RAWのURL・馬名・馬番と照合。
8プロフィールはHTTP 200。各最新5履歴、計40履歴のレースキーと主要成績が一致した。
公式照合済み40、照合未完了0、不一致0、採用対象外0（対象8頭の40 RAW履歴内）。
公式プロフィールを根拠に評価用draft recent_runsへ40履歴を採用。未検証RAWを直接コピーしない。
レース名はNFKC/空白正規化、着差はRAWの明示的な数値部分だけ比較。
騎手表記の略称・減量記号、RAW通過順・ダート表記は照合成功の根拠にせず、公式プロフィール値だけ使用。
プロフィールに明示されないsurface、early_pos、final_turn_posはnull。個別詳細レースの通過順照合は未実施。

|馬番|馬名|公式一致|採用|
|---|---|---:|---:|
|1|メイショウオキビ|5|5|
|2|サノノスピード|5|5|
|3|ウォーターレモン|5|5|
|4|ゲンパチレオニダス|5|5|
|5|モズリッキー|5|5|
|7|エイシンオッティモ|5|5|
|8|ハルノサムソン|5|5|
|9|ストーミーデイ|5|5|

現在属性: 性齢・斤量・騎手・枠番・調教師は8/8取得。斤量の☆/▲と枠番rowspan=10を明示的に解析。
馬体重・馬具は8/8 nullのまま。過去の馬体重で現在値を埋めない。

## 出走状態の不一致（重大・未修正）

RAWは6番アルデヤーノをCANCELLEDとして除外している。一方、保存した公式出馬表には9頭の馬セルがあり、
6番の「取消」は過去2026-05-23のraceInfo/pastRank欄にある。現在の取消・除外とは区別しなければならない。
現時点のRAW除外根拠は不成立。指定の8頭に限定し、6番の履歴取得・採用は今回行わない。
全出走馬の整合性、最新出走状態、当日天候・馬場は未確定としてBLOCKEDを維持。
発走直前に再照合が必要。07:11頃の保存証跡をその後も最新として扱わない。

## 本番の採用条件と根拠

Supabase MCPで取得した`lab-claimed-context` ACTIVE v8を再確認。
ezbr SHA-256: `5242c259c45eefd4051c58e31c85a63591b9dd32e2c693b356886b7a3cf2d09c`。
`baseline/`は当該ソースの読取保存（末尾改行差を除き同内容）。本番ファイルを変更していない。

* `baseline/local-worker-db.mjs:10` horse_runsは馬名・対象日より前、日付/R/id降順LIMIT5。名前一致だけでは採用しない。
* 同`:22` jra_lab_runsとjra_lab_racesのinner join、full_runner/jra_public_reference/対象日前/LIMIT5。
  current公式identity_refsにJRADB参照がある場合horse_refを絞る。今回DBの実履歴照合は未実施。
* `baseline/local-worker-data.mjs:79` 公式馬ref一致、または過去レース＋過去馬番の公式証人で同一性を検査。
* 同`:90` prior-date/source/record_roleを検査、identity_source_ref/identity_verified_byを記録。
* 同`:109` date/track/Rで重複排除、日付/R降順最大5。5完走を必須にするfilterはない。
* `baseline/nar-history-rescue.mjs:42` NAR公式馬リンク・プロフィール見出し・23列行・対象日前を検査。
  finishが数値以外の場合nullを維持。surfaceを距離だけからダートと推定しない。
* `baseline/history-boundary.mjs` 対象当日以降、発走/結果時刻違反、予想archive等を除外。

今回の方式はNAR_OFFICIAL_RESCUE経路。DB側のsource_ref witness経路やJRADB stable ref経路を実証したものではない。
profile source_ref / identity_source_refは実際の馬セルリンク、identity_verified_byは検査成立後のOFFICIAL_HORSE_REF。

## 実装と再検証

`extract-evidence.py`は保存HTMLを標準HTMLParserで読み、馬セル所有リンク、現在属性、プロフィール行を抽出。
`admit-history.mjs`はHTML hash・HTTP結果・発走前時刻を確認し、保存HTMLからDOMを再抽出してJSON改変を拒否する。
本番から保存したparseNarHorseHistoryをオフラインで使用し、RAWフラグだけの採用は不可。
`build-pilot.mjs`はdraft形式のrecent_runsを作り、3軸を保持。構造と公式履歴確認は全出走馬検証やREADYとは独立。
Python 3 (`python`コマンド)とNodeが必要。ネットワーク・DB・モデルは不要。

```sh
node --test research/lab-shadow/23r-20261010/official-history-pilot/admit-history.test.mjs
```

生成ファイルは排他的新規書込。再生成時は生成先を事前に別場所へ退避する。
`extracted-evidence.json`は`python extract-evidence.py`、`pilot-results.json`は`node build-pilot.mjs`で再生成できる。
`--stdout`は保存証跡の検査に使用し、ファイルを変更しない。
fetch-log/card-fetchとHTML原本は取得時の証跡。独立した署名・信頼時刻を持つarchiveではない。

## テスト・制約

新規25テスト: 8頭の正常採用、8頭の証跡なし拒否、HTML改変/非200/時刻違反/JSON改変/リンク欠落/属性改変拒否、rowspan/減量斤量、draft隔離。
既存の正規オフライン回帰群103テストと合わせて実行: 128 PASS / 0 FAIL（Node v24.19.0）。
追加で試した旧`original/saga11-readonly-reaudit.test.mjs`は、その参照先にSAGA11_PRERACE_SHADOW_2026-10-10.jsonがなくENOENTで起動失敗。
旧ファイルと参照先は変更していない。この失敗をPASS扱いしない。

未解決: 6番の現在状態と全頭整合性、当日条件再取得、馬体重・馬具、通過順意味照合、DB経路、発走直前の鮮度、実本番context受理。
本番DB書込、Edge/キュー/公式予想操作、モデル呼出し、APIキー作成、deploy、main変更は0。
