# 残る2障害の集中追跡（2026-11-22）

基準 `033eeea83f849bc91d94d16fbb0dd55ae2d8fc54`。本番はSELECTとソース取得のみ。新規CLAIM、予想保存、設定変更なし。

## ① 正規provider：部分回収、未解消

実稼働の接続先は `qjlvsndiqjfsfjinilig`。本番取得ソースのbundleは `source-observations.json`、実ソース抜粋と行番号は `source-slices.json` に固定した。全IDは実DBの読み取り結果。取得時点での再構成であり、過去の実使用入力固定ではない。

|実経路|確認した実装|保持／欠落|
|---|---|---|
|jra-live v32|index.ts:54 fetchCard → parseCard:124 → sync_batch:438 → HTML hash:465 → evidence upsert:491|出馬表URL・取得時刻・decoded HTML UTF-8のSHA-256・evidence ID。原文・署名の保存なし|
|jra-backfill v27|index.ts:287 result HTML → parseResultPage:134 → lab_races upsert:339 → lab_runs upsert:361|run/race ID、horse_ref、source_ref、race.source_checked_at。HTML本文・署名を保持しない。結果ページは過去走資料であり対象レース結果を予想入力に混ぜない|
|正規CLAIM生成|public.jra_manual_claim_next_v2 → 正規worker/job/15分lease → jra_claimed_context|当日・平地・3〜70分窓・未保存等の既存条件。定義を読んだだけで実行していない|
|CLAIM履歴選択|private.jra_merged_flat_history_v2 → claimed_context|LIVE優先、日付単位のdedupe、最新4件。RETURNS TABLEと最終projectionでrun/race/horse ID、元source_ref・取得時刻を返さない|
|補足内容|private.jra_optional_content_evidence_v3|馬ID付きarchive照合後、数値・件数だけ返す。原文・署名・run/race IDは返さない|

### 実データで接続できた部分

`archive-lineage-readonly.sql` は過去の京都12R①ヤマニンループ（馬ID `2019100606`）1頭に限定したSELECT。現在の履歴選択結果4件に対し、日付・場・馬場・距離・着順・馬名・非NULL馬ID一致を条件に、実archive counterpartを取得した。

|過去日|run ID|race ID|
|---|---|---|
|2026-08-30|62ab58ee-350d-411c-ad95-bb744f94de09|88a7d27d-12d1-4108-b3a1-daa636d6a7c7|
|2026-08-09|c903b763-702d-479f-b4ee-9572ba218453|0542b82e-f66a-4211-aa94-26c7cdfb6cad|
|2026-07-19|7e27b5af-7e62-459b-90a0-11effd88a7b3|1690bb3d-5d3c-44b4-8fa7-274f91c369fa|
|2026-04-19|b01689fa-3fe3-4f00-ba08-c1bf08b98124|f250e67a-c6b8-4802-a820-31ee1b99bad6|

同じ馬・履歴に対応するarchiveは4/4で一意。ただし選択元はLIVEであり、対応archive行が「その時使った原本」だと証明したわけではない。4/4を証拠検証成功数へ加算しない。
対象レースの出馬表evidenceは15件。例：ID3280、取得時刻2026-11-21T06:46:02.449Z、hash `a2cc903a0619c595e0bd4536adac81fc3b88677443b5641b8d85f0d424526e6c`。これは**今回出馬表のメタデータ**で、4件の過去走本文のhashではない。各過去走へこのevidence IDを付け替えない。

`archive-lineage-audit.mjs` はこの実データを診断し、曖昧・異馬・ID欠落を拒否。正式providerやCLAIM readerへ登録しない。actual_selected_source_id=null、signature_verified=false、formal_scoring_allowed=falseを維持する。

### 接続できない理由と最小の変更対象

- jra_html_evidenceはメタデータ専用。schemaにHTML本文／署名列なし。private.lab_preclaim_evidence_snapshots_v1のJRA行は0件。JRA名のStorage bucketも0件（名称検索の範囲。別名・外部保管先の不存在までは断定しない）。
- 元HTMLのbytesと抽出器を再照合できず、認可済みissuerの署名packetを発行する既存経路も確認できない。SQLへの認証付き接続は原文真正性の証明ではない。
- 失われた過去の本文や署名は後付けで回復できない。将来取得時に、既存fetchが得た原文を固定し、選択元ID・馬ID・取得時刻・hash domainを同時に保持し、正規CLAIMの認可下で読めるcompanion readerへ接続する必要がある。署名を要求するなら、その認可済みissuerと鍵管理も必要。
- これは本番取得/MCP/保管経路の追加を伴い、今回の本番変更禁止範囲を超える。認証・READY・leaseを省く管理DBfallbackや、架空署名による代替は実装しない。

**正式に真正性検証を通過した実履歴：0件。実データ接続はarchiveの対応関係4件まで。**

## ② 現行100点生成元：判断経路を特定、固定配点は未確定

- active JRA_MAINは `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023`。全文を `active-protocol-readonly.json` に取得した。`ranking.content_evaluation_contract.rank_effect` は **Manual whole-field ranking may deviate** と明記。全頭の根拠比較を求めるが、基礎点・因子点・丸め・同点の固定生成式を持たない。
- 現行MCPの全頭full-depth/bridge/saveは、提出済み `base_score`・`evidence_effects[].points` を検査／限定補正する。原情報から基礎点を自動生成するコードではない。
- 関連DB関数の本文検索で見つかった100点風出力 `jra_live_locked_2025_score_packet_v1` の `research_score_100` は `new_rate*100`。**研究用確率表示であり、現行正式100点の生成器として採用しない。** 既存6区分5軸の診断式と80vector比較も維持するが、現行FROZENとの同一性は証明していない。
- 正規タスクを読み取りで調査し、JRA用2件のpromptを `jra-task-source.json` へ保存した。11/14の実行指示は全頭の定性的比較・独立再評価を要求し、Evalの最大1点予算は定義するが、100点の基礎点／全因子配点を定めていない。このタスクはlast_run_time=nullであり、11/21の実行元と断定しない。取得できた25件のリストに11/21専用生成タスクは見つからず、全会話の不存在を意味しない。
- public.jra_live_diagnosis_snapshotsを11/14・15・16・21で調査したが0行。194頭の現行FROZENに対応する5軸入力をここから回収できなかった。DB列があるだけで入力が保存されていると仮定しない。
- Git履歴の既回収生成器・補正処理と区別した。現行100点は、少なくとも確認した正規経路では**提出側の全頭判断→申告基礎点・因子点→MCP検査・補正→保存**。各点数をその値にした生成時判断の原記録／固定式は回収できていない。

**正式な「原情報→同一100点」の固定式：未確定。** 新しい配点は作成・採用しない。必要なのは11/21等の生成側の完全な入力・判断記録・使用ルール（存在する場合）の回収。それが存在しなければ、新方式として定義し承認・別の比較検証が必要。194頭から逆算して係数を作らない。

## テストと禁止対象

追加5件：実4履歴のcounterpart接続と非昇格、曖昧候補拒否、異馬／ID・時刻欠落拒否、出馬表hashの過去走流用防止、監査モード／重複slot拒否。
既存124件は維持。CIで既存統合・PG17の回帰も確認する。
研究領域・テスト・CI以外のソースは変更しない。本番接続 **NO**、新規CLAIM **0**、予想保存 **0**、FROZEN変更 **0**。
