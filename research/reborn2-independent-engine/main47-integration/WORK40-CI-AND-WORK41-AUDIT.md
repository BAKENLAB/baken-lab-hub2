# 統合版のCIとWork41受け入れ照合

## PR #95の実行記録

- 実装固定点: `0e00578bea6a9f8d8ed220c976bee40c0d84c892`。
- [Actions 46074223528](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/46074223528): common / work39 とも SUCCESS。Node 22.23.5。共通回帰シェルは484試験構成を維持し成功。取得できたCIログは共通回帰ステップの一部出力を省略。F42-01〜10の個別PASSは既存のローカル実行記録を参照。
- Work39の修正後11チェックを実ログで確認。`W39_CHANGED_PEER`、4組の同一証拠EYE対照、`F42_GUARD_ARITHMETIC` を含む。Work側の累積受入台帳の更新は別監査。
- EYEだけの切替とWork40の既存回路接続は別ステップでSUCCESS。Work40は5頭・原本6件・派生証拠537件。ローカル `work40-execution.json` と同じ分析SHA-256・共通SHA-256をActionsで確認。
- 初回 [Actions 46073712008](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/46073712008) はcommon SUCCESS、work39 FAIL。Work39は固定SHAへ独立checkoutしてからV38修正だけを適用する手順に切り替え、再実行で完走。

## Work41の受け入れ保留

Work41固定点 `d6ce92eb59465e6b428499bdc7e48602fcc925fe` の [Actions 46073974941](https://github.com/BAKENLAB/baken-lab-hub2/actions/runs/46073974941) はSUCCESS。原本の `makeValidRace` と検証関数を独立して実行したところ、次の点が共通分析への投入を妨げた。

| 検査 | 実測 |
|---|---|
| 先頭ラップの1200m累積と馬別通過時計の最小値 | 71,600msと73,000ms。1,400msの矛盾があるがWork41の算術検査は通過 |
| 原文と構造化観測の結合 | raw bytesとハッシュを保持し、別オブジェクト側の上がりを1msに変更しても文書検査が通過 |
| 締切の妥当性 | `cutoff: 'invalid'` が文書検査を通過 |
| EYE15分類 | 15件に同型の汎用指標を付与。分類ごとの具体的な成立条件を検査した証拠は不足 |

Work41の資料は改変せず、受け入れ保留。ラップの累積と通過時計の整合、raw bytesから抽出した値への結合、厳密な締切検証、分類別の観測根拠が最低限必要。手動補完による正式判定は行わない。公式原本検証・本番接続は未実施。
