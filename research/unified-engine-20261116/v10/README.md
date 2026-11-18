# V10：実入力接続調査と観測値projection

基準：V9 `afaf3b3cb5a02b5b49f02c2f22c923e940d4a8db`、Draft PR #51。研究専用。新規採点式・係数・EYE理論は追加していない。本番DB・main・既存FROZEN・Cron・デプロイ変更なし。

## 今回取得できた現行ソース

Supabase MCPの読み取りで `jra-claimed-mcp` **v29 / ACTIVE** を取得。bundle SHA-256は `9017c9cc7c0a06396372645d54c8d42bcb14885f063b068d519f31d650576561`。DBはメタデータSELECTを4回行い、現在の13関数定義とBASE_COREの2依存テーブルの種別を確認した。HTML保管の列メタデータも限定検索した。これらの関数を実行したのではなく、`pg_get_functiondef`等で原文を読んだだけである。

`source-index.json` に版・時刻・依存ファイル名・SQL参照先・原文SHA-256を保存。`source-edge/`は関連4ファイル、`source-sql/`は13関数の参照用原文。`.sql.txt`は調査証拠であり適用SQLではない。読取時刻は今回の記録時刻で、外部署名付き時刻証明ではない。

Edge bundleハッシュは取得したメタデータ値であり、再ビルドしたbundleとの照合は未実施。

私有Evalデータは再配布せず、Edge bundleハッシュと依存名だけを記録した。他のEdge依存ファイルは一覧で存在確認できるが全件を複製していない。`npm:`の範囲指定、実行時環境、私有データ、学習統計テーブルの当時スナップショットまで固定できた完全実行closureではない。

## 元の独立100点評価器の回収結果

|対象|確認結果|根拠|
|---|---|---|
|BASE_CORE|`JRA_BASE_CORE_0.1_AB`、`base_rate`と`base_rank`の候補生成。独立100点スコアを返さない|`source-sql/public.jra_live_base_candidate_v1.sql.txt`|
|100点補正|入力済み`payload.runners[].score/rank`を受け、`score+p.delta`を上限100で調整する|`source-edge/jra-verified-evidence-rank-bridge.mjs.txt:111`以降|
|正規MCP|context取得・比較材料・プレビュー・保存ガード。完成draft payloadは呼出側から受け取る|`source-edge/index.ts.txt:218`以降、保存入口253以降|
|関連Git履歴|11/13の補正導入とTOP5変更時の監査修正を確認。元100点生成器の履歴とは証明できない|`source-index.json.history`|
|元独立100点評価器|**未回収**。現行コードから、入力だけで元の全馬100点を再生成できる処理は特定できない|上記は全て候補・補正・検証・保存の部分経路|

補正処理を元評価器に置き換えていない。ChatGPT側の当時の評価指示・実際の判断・モデル・全入力・設定との対応も未回収。全GitHub履歴の不存在証明ではなく、現行MCP/関連DB定義と対象Git履歴で確認できた範囲の結論。

BASE_COREの統計依存 `private.jra_base_core_stats_v1` / `private.jra_base_core_fallback_stats_v1` は両方通常テーブル（relkind=r）。当時の内容を固定した学習データ・生成版は未回収。現在の関数定義を得ても、過去46Rの完全再計算を保証しない。

## projection：接続したもの／接続していないもの

`projection.mjs: projectClaimedContext` は実v29のSQL出力構造を基準に、全ACTIVE馬を馬番・馬名で照合し、既存研究の `r` / `f.attrs` / `f.priors[].baseline` に観測値を写す。馬IDは既存 `horseId` 関数で公式プロフィール参照から抽出。空欄・衝突・無効数値はnullを維持する。

|情報・既存評価軸|接続する観測値|採点に不足する証拠|
|今回条件|馬場種別・距離・クラス名・馬場状態・天候・コース内外|原文・取得時刻の証跡。未記載の内外はnull|
|現在属性|枠、性齢、斤量、馬体重、馬具、騎手、調教師|原文取得の証跡。名前だけを能力点にしない|
|実績・継続性・距離持久|出走日・場・距離・着順・頭数・着差|履歴の馬ID、レースID、source_ref、取得時刻、明示的な平地区分|
|先行再現|`runner_history.past_runs[].early_pos`|検証済み通過順原文と採用履歴ID|
|展開・持続|一意に対応するcontentの`corner_positions`、`race_halons`|原本、時刻、原子的根拠のID、全頭の検証済み展開材料|
|相対上がり|contentの`final3f`、`final3f_rank`|全頭計時・順位再計算を照合できる証拠|
|クラス・斤量|`race_class`、過去斤量、今回斤量|採用履歴証跡。年度別クラス分類の推測はしない|
|コース適性・Eval|今回/過去コースの観測値|研究版Evalへのrun ID/時点付き対応。MCPの注記を別独立因子に格上げしない|
|相手レベル|未接続、`f.rivals=[]`|直接対戦相手の同一性・最初の発走前次走履歴。今回出走馬同士の比較表とは別物|
|枠・コース形状4点|枠番号を保持、採点はnull|承認済み効果式・コース形状の根拠|
|騎手・調教師2点|名前を保持、採点はnull|承認済み推定式・同一性と時点が保証された統計|

当日出走状態はcardの明示値を観測するだけ。UNKNOWNが1頭でもあれば停止し、取消・除外はACTIVE投影から除く。**ACTIVE記載や`verified=true`だけで、独立照合済みとはしない。**

履歴の最終コーナーは一意に対応した公式contentの通過順からだけ抽出し、`pos_change`から逆算しない。前半位置と通過順が衝突した場合は両方の導出位置をnullにする。非出走・着順欠損・当日以後の行は有効な過去走観測に数えない。直近最大5件の観測候補を別表示するが、未検証履歴を採用履歴にしない。

## なぜ採点用の検証済み履歴を作れないか

正規SQL `public.jra_claimed_context` は履歴4件を返すが、方針として`source_ref`を除去している。各履歴のrun ID・race ID・馬ID・archive取得/更新時刻も返さない。optional contentは詳細一意性のサマリーを返すが、研究版V4/V5の採用ゲートが必要とする原本とID・時刻を復元できない。

また `private.jra_merged_flat_history_v2` には馬キーの片側がnullでも通る分岐があり、`source_kind=DB`だけで研究版の厳密な馬同一性を証明できない。既存本番を変更せず、projectionでは不足のまま保持した。`history_policy.flat_only=true`を、各履歴の明示的平地原本の代用にしない。

そのため `f.scoring_priors=[]`、`evaluation_eligible=false`、位置/相対上がりの検証フラグfalse。既存 `scoreClaims` の15項目に接続して構造を検査するが、全unitをnullとして扱う。**V5の根拠台帳・配分・正式EYEへの採点入力接続は未完了**。スコア0・架空順位・EYEを作って完成扱いしない。

## 既存の正規経路で証明できる範囲

- CLAIM contextは正規RPC内でジョブ・worker・期限・READY等を確認する。しかし返却値自体に原文一式・入力ハッシュ・署名付き取得時刻はない。
- 現行MCPの公式出馬表確認はHTTP取得の**元バイト列**にSHA-256を計算する。Shift_JISをUTF-8へ変換したHTMLのハッシュとは別になる。
- `dry_run=true`の応答は件数等の要約で、原HTML・hash・全頭証跡をそのまま返さない。本番publish時のproofはchecked_at/hash/全頭を持つが、本番書込なしの今回には使用しない。
- 限定メタデータ検索では`public.jra_html_evidence`にURL・取得/記録時刻・SHA-256・バイト数等の12列が存在するが、本文列はない。このテーブルの実行時入力との結び付けは未検証。名前検索範囲外のStorage等に原文が存在しないと断定するものではない（`html-storage-metadata.json`）。
- したがって、現行読取contextだけからV9の信頼できる発走前原文・全ACTIVE集合・時刻受領証を完成させる経路は未確認。直接private関数を呼んでCLAIMゲートを迂回しない。

今後は承認済みの正規読取経路で、同一context原文、全ACTIVEの馬ID集合、履歴の原子的ID/時刻、元HTMLバイト列とURL/取得時計を結び付ける必要がある。V9へ渡すSHA-256はその原文に対して計算し、信頼できる証明者の実受領証で時点を検証する。架空署名・自己申告時刻を実証扱いしない。必要な正規経路の追加は今回実装・適用していない。

## オフライン実行結果

`fixtures/local-historical-context.json` はローカル既存の11/15福島7R形状資料を別保存したもの。元パスは基準Git treeに存在せず、取得元・取得時刻の独立確認はできない。`historical-provenance.json` にこの制限と現在固定したSHAを明記。**公式入力原本や新規実レースの証明ではない。**

この形状資料では16頭・64履歴を変換した。枠/性齢/斤量/騎手/調教師/馬場/天候は16頭分、馬具3頭、前半位置53/64件、クラス/着順/着差64/64件を保持。馬体重・内外・最終通過順・上がりは欠損のまま。採点用検証済み履歴0件、15項目×16頭＝240 unitは全てnull。詳細は `development-projection/coverage.json`。

- 新規projection：**19 PASS / 0 FAIL**（実v29契約を模した架空データ＋出所未確認の過去形状資料）。
- V9回帰：**24 PASS / 0 FAIL**。
- V9整合性検査：**6 PASS / 0 FAIL**。V5以降の処理順不変対策・二重加点防止のコードハッシュ、623頭の根拠予算一致を維持。
- 新規実レース比較：**0件・未実施**。46R・623頭は開発集合のまま。

再実行：`node research/unified-engine-20261116/v10/projection.test.mjs`。形状投影は `node research/unified-engine-20261116/v10/run-offline-projection.mjs /tmp/NEW_OUTPUT_DIRECTORY`（未作成パス限定）。既存資料・出力は上書きしない。

## 結論と残る障害

観測値projectionと現行経路のソース回収は実装・検証済み。元独立100点評価器は未回収、厳格な採点特徴量・正式EYE・実レースの同一入力比較は未接続。

次に必要な資料は、①元基礎評価器と完全依存/入力対応、②正規ゲートを通した履歴ID・時刻・原文の証跡、③信頼できる実発走前受領証。この3つが揃うまで、実比較可能・本番投入可能とはしない。

納品整合性の追加5検査もPASS。集計値・原文ハッシュ・V9不変・未接続状態の表示を照合した（`delivery-results.txt`）。
