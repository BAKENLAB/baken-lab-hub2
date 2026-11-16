# 統合研究エンジン V3（研究専用・未承認配点）

仕様: `07ca810100f2fa180a5b3a036f2eaf61f21842db`。
本番・main・DB・FROZEN・Cron・デプロイは変更しない。V1/V2の承認ガードも変更しない。

## 実装の範囲

- `query.mjs` / `enrichment-template.sql`: 保存済み5RからSELECT専用SQLを生成。馬ID（公式horse_ref）、公式過去レースCNAME、日付・競馬場・馬番・馬名・距離・馬場・着順・上がり・頭数を照合。00/10のURL文脈接頭辞を馬IDと混同しない。名前だけで結合しない。
- `enrich.mjs`: 一意な一致のみ採用。曖昧・矛盾・未来データは拒否。過去走の平地／障害が明示されない場合、芝だから平地とは推定しない。通過順はarchiveと照合する。非完走を好走扱いしない。
- `rival-template.sql`: 一致した過去レースの直接対戦相手と、その最初の平地の次走（対象レースより前）を取得。本人の着順を相手強化の代用にしない。archive内の観測であり将来全成績を網羅するものではない。
- `routes.mjs`: 24評価項目＋みねた14項目＝38項目の接続先・取得状態・判定状態・不足理由を一元化。**登録済み38経路は38項目取得済みを意味しない。** 欠損・未接続資料はUNKNOWN。市場・独自非公開指数等はEXCLUDED。
- `supplemental.mjs`: 公式不利、コース形状、調教、血統、全キャリア等の保存済み証拠をidentity/asof/SHA-256付きで受け取る入口。今回の46Rに未提供の証拠は生成しない。内容解釈・配点・正式監査を自動で実施済みにしない。
- `eval.mjs`: private NORMAL cacheの1,942行とS444/A554/B366/C379/E199/D0を照合。Dを作らない。原本行単位一致は未検証。取得日時より前のレース、未確認layoutは不採用。原本・private pair表を公開Gitに再保存しない。
- `rubric.mjs`: 仕様の15配点枠（計100点）と明示した正規化仮説。点数根拠と点数を分離。同じatomic factを再使用しない。同一過去レースの上限15/25/40の事前固定案を比較。主案25点は承認前の仮説で、結果から選んだものではない。
- 欠損は0点ではなく `[0, 項目上限]`。残項目に再配分しない。重複根拠抑制による0点と欠損を区別。旧score/rank/EYEは独立採点入力のホワイトリストから排除。順位を付けられない場合は区間順位だけを返し、旧順位でタイブレークしない。
- `formal-eye.mjs`: 完全な独立順位・厳密入力の証明・実際の全候補監査が揃うときだけ、既存V2の独立2因子・全組比較ゲートへ接続。今回の再構成データに監査済みフラグや正式EYEを捏造しない。

## 配点関数の未接続箇所

比較可能な着順/着差、別走の安定性/近時性、正規化先行位置、同等以上距離、同一競馬場、相対上がりは試算する（重複は抑制）。
展開効果・枠と形状・クラス間の正規化・相手次走の効果量・持続力・馬場・斤量/性齢・馬体/馬具/休養・騎手/調教師の効果量には未承認/未取得の部分があり、関数は未知区間を返す。属性が存在するだけでは能力加点しない。
Evalは同一競馬場適性と共通10点枠。取得証拠は接続するが、未較正の係数で追加加点しない。
独立100点の確定値・順位・正式EYEが揃わなければ、その変動数・捕捉数はnull。0件と偽らない。

## 再現

依存ライブラリ追加・外部API・有料モデル不要、Node.js 24。

```sh
node research/unified-engine-20261116/v3/tests.test.mjs
node research/unified-engine-20261116/v3/integration.test.mjs
node research/unified-engine-20261116/v3/run-batch.mjs 1 --output-dir /tmp/v3-replay-01
```

上の1を2〜10に変えて1回最大5R（最終1R）で実行。同じ出力先の上書きは禁止。
private cacheがある場合だけ `--eval-cache /absolute/path/eval-course-private-data.mjs` を追加。
公式補助資料は任意の `--supplemental /path/official-artifacts.json`（`BAKEN_V3_OFFICIAL_SUPPLEMENTAL_V1`）で入力する。市場情報を含めない。
ラベルを読む前にlockを書き、結果ファイルは別memberから読む。V2結果は比較用にだけlock後に読む。

## 証拠と限界

`source-manifest.json` と `inventory.sql` が実DBのSELECT結果と再現SQL。
`enrichment/*.payload.json` はgzip/base64＋展開bytes SHA-256を持つ分割チェックポイント。公式HTMLそのもののハッシュではない。
published_at不明はnull。今回の観測時刻を過去の取得日時に偽装しない。archiveの保存・照合日時が対象発走前でも、そのまま当時FROZENへ渡した入力原文の証明にはならない。
archiveは2026-09-13まで。以降の過去走は別の検証済み経路なしに補完しない。horse_runsには対象JRA競馬場のデータがなく、名前による地方履歴流用はしない。
46Rは既に結果を観測した開発集合。独立検証・改善立証ではない。配点・上限・判定を固定した後の時系列holdoutが必要。
旧87／簡易先行研究92捕捉は参照値で、V3の正式EYE成績ではない。


## 最新の検証出力

`validation/revision-01/` が現行出力。`validation/final/` はそれ以前のチェックポイントとして保持し、現行集計に混在させない。
みねたT01脚質はV2の `styleOf`（全通過順位の最小値）、T02は未知馬を含む上下限、T03は非先行の当該馬と両隣の先行馬を再利用する。新しい定義を独自に作らない。
現行ソースで全10組を再処理し、結果は別ディレクトリへ保存する。入力の再取得はしない。
圧縮audit内のdecisionを `JSON.stringify(decision,null,2)+'\n'` として展開すると、lock-manifestにある元ロックSHA-256を検証できる。巨大な展開済みlockはGitに二重保存しない。
`export-checkpoint.mjs` がそのmanifestとGitHub追加ファイル一覧を生成する。
補助資料published_atの未来日付と認証情報付きURLも拒否する。
