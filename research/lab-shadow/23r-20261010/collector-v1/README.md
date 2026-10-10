# collector-v1: 保存HTMLからの高知3R当日変更セル抽出

対象は2026-10-10高知3Rのみ。ネットワーク、DB、Edge、キュー、モデル、評価ロジックは使用しない。
基準commit: `73369b4cc6d2239362c93c0759dca49bbaaf988a`。
元RAW・既存証拠・READY判定は変更しない。

## 入力・証拠

* `../official-history-pilot/evidence/kochi3-card.html`
* `../official-history-pilot/card-fetch.json`

SHA-256: `4ac733b51a252a1234a2000670addcb93a4b2a939674a452ecbabf8563142995`。
取得完了時刻2026-10-10 07:11:44.282639 JST。後から添付された描画DOMとは別の証拠。
JSONのURL/path/hash/取得時刻とHTMLのレース見出しを照合。UTF-8不正、時刻不明、発走以降、対象違い、hash不一致は失敗。
HTTP statusは証拠JSONにないためnull。200やブラウザ描画成功を推定しない。
原本署名や第三者による取得時刻証明はない。整合性確認を取得元の独立証明と同一視しない。

## 抽出・状態

既存`official-history-pilot/extract-evidence.py`のオフラインDOMプリミティブのみ再利用し、抽出関数は実行しない。
外側section.cardTableの実馬テーブルを一意に選び、数字のtd.horseNum[rowspan=5]を基点に5行ブロックを検査。
当日変更情報は第5行の直接子第3セルtd.infoだけ。odds_weight、raceInfo、入れ子成績表、説明用表を状態根拠にしない。
馬番・馬名・所有プロフィールリンク・セル数・原文text・正規化text・原文HTML・行/列/文字位置を保存。
DOM位置のtable_index/outer_row_index/direct_cell_index/source_column/文字offsetは0始まり、source_lineは1始まり。
block_row/direct_cell_numberは1始まり。
同一ブロックのtd.infoが0個ならMISSING、複数または所定位置外ならAMBIGUOUS、所定位置に1個ならPRESENT_EMPTY/PRESENT_NONEMPTY。

この証拠では9頭すべて1個の空欄td.info。全頭entry_status/status_at_capture/latest_statusはUNKNOWN。
⑥アルデヤーノの過去2026-05-23取消は状態判定へ入力されない。
公式の当日取消・除外・ACTIVEの表記パターンは未確認。非空欄に「取消」「競走除外」が来ても、今回の実装は推測採用せずUNKNOWN。
判定可能なパターン追加には実公式証跡と意味の確認が必要。
保存時点を後日の最新確認へ昇格させない。latest_status_checked=false、production_dispatch_allowed=false、ready_evaluated=false。

## 実行

Python 3、標準ライブラリのみ。生成済み出力は`kochi3-field-status.json`。

```sh
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s research/lab-shadow/23r-20261010/collector-v1 -p 'test_*.py'
```

新規20テストPASS、既存Python回帰12 PASS、既存Nodeオフライン回帰128 PASS、すべて0 FAIL。
GitHub基準commitと既存23R配下48ファイルのGit blob hashが一致（元RAW・証拠・READYを含む既存出力は不変）。
検証中の変更HTMLはメモリ上の合成負例で、公式証拠として保存しない。
原本・RAW・既存出力のhashをテスト前後に比較。生成JSONは毎回の純粋抽出結果と一致確認。
CLIは固定入力を読むだけで、出力は排他的新規書込。既存JSONがある状態で実行するとFileExistsErrorで終了し、上書きしない。
再生成が必要なら既存生成JSONを別場所へ退避してから実行する。元証拠は退避/変更しない。

```sh
PYTHONDONTWRITEBYTECODE=1 python research/lab-shadow/23r-20261010/collector-v1/collector.py
```

## 制限

元RAWをCANCELLEDへ生成したコードの修正ではなく、新しい独立した最小collector。
実公式の非空変更欄、佐賀DOM、他レース、欠落した馬、取消時に変わる行構造は未検証。
固定の高知3R9頭だけを扱い、対象外・不正構造は失敗。全23レースへの展開は未実装。
READY、本番予想、LAB RANK/EYEへ接続しない。main merge/deploy/課金なし。
