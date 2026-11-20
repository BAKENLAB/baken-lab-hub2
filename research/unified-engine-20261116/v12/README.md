# V12：実ソース調査で判明した接続条件

基準：V11 `4c333bed1ad5b5e281fdd4851b196625b8f45d8b`、Draft PR #51。Supabase MCPで現在のソース・権限・過去の保存記録を読み取り調査した。**22件のSELECTのみ**を実行し、CLAIM関数/取得worker/保存関数は呼んでいない。新しい採点式・係数・汎用検証器・架空署名は追加していない。

## 1. 正規READYはどこか：実装を確認できた

`jra_manual_claim_next_v1` の**新規確保経路**に次の条件がある：

- 当日JST、JRA、`field_status IN ('BASIC_READY','READY')`。
- prediction_statusがPENDING/RETRY、発走3〜70分前、障害を除外。
- live race/runnerの存在、official_predictionsとchappy_predictionsに未保存。
- 次回試行時刻、試行上限、QUEUED/RETRYまたは期限切れCLAIMを確認。

しかし経路差がある。

|経路|field_status再確認|補足|
|---|---|---|
|手動の新規CLAIM|あり|BASIC_READY/READY。確保処理自体は書込あり|
|手動の既存CLAIM再開|なし|有効CLAIM・RUNNING・期限・未保存等は確認する|
|汎用jra_claim_prediction_jobs|なし|3〜70分窓等はある。全日付の試行上限終了UPDATEもある|
|jra_manual_readiness_v1|集計で確認|readiness件数表示。新規CLAIMとはchappy除外等が完全同一ではない|
|jra_claimed_context|直接比較なし|CLAIM・RUNNING・3分締切・protocol等を確認|

したがって「どのCLAIMも同じREADY確認を行う」「context取得成功だけで今もREADY」とは言えない。READYの意味は台帳状態と最低限のデータ存在であり、全過去走のID/公式原文照合まで証明するものではない。新しいsidecarには正規認証・有効CLAIMを前提に**現在のfield_statusの読み取り再確認**が必要だが、今回本番へ追加していない。

現在の実効権限も確認した。調査した4 RPCと3データ表はanon/authenticated不可、service_role可。新規CLAIM/汎用CLAIMはSECURITY INVOKER、既存contextはSECURITY DEFINER。service_roleの既存BYPASSRLS=trueもpg_rolesで確認。これは既存のサーバー権限であり、新たにRLSを回避する設定を追加したわけではない。権限は変更していない。`confirmed/access.json`が正規化した結果。生query14のtable行のsecurity_definer列はUNION上の名称で、実際の値はRLSフラグとして同JSONに分離している。

ソース：`sources/jra_manual_claim_next_v1.sql.txt`、`jra_manual_readiness_v1.sql.txt`、`jra_claim_prediction_jobs.sql.txt`。適用SQLではなく参照用原文である。定義hashと経路差は **`confirmed/ready-source-contract.json`**。

## 2. 選択元reader：実在レコードまで追跡、正規接続は未完了

既知46Rの研究参照にある過去走1件を、UUID指定のSELECTで実DBへ照合した。

- 対象参照：2026-10-24京都8R⑤キーウェーブ。
- 過去走：2026-08-01新潟6R、平地。
- run_id `c7a36ac8-f044-4f05-ab97-e616df44a459`、race_id `841e855d-d4c0-4b96-921d-b7e60a7b6b0a`。
- 馬ID `2021102561`、公式source_ref、race取得時計、race/runの作成・更新時計を取得できた。

これは**既存の研究参照IDが実在するarchive行に解決できた**という診断である。有効CLAIMに紐付く取得ではなく、元の結合履歴が実際に選んだ行や原HTMLを証明したものではない。採点用昇格は0件。データは `confirmed/reader-record.json`。

`jra_merged_flat_history_v2` はLIVE優先と同日DISTINCTで元IDを落とし、同優先順位の同日行のtie-breakが未指定。DB行が一つ見付かるだけでは、LIVEから選ばれた行の源流を復元したことにならない。正規readerには、同じCLAIM/contextの選択元を一意に保持・照合する処理が必要。曖昧なら不採用にする。

時刻もraceとrunを混同できない。取得したrace行ではcreated_atがupdated_atより約37ms後だが、runの作成/更新時計は別。勝手な時刻補正や一つの汎用timestampへの合成はしない。V11のclock契約へ接続するには各時計の由来を正しく定義し、原文のfetchと対応を取る必要がある。

**接続済み：既存レコードのID/参照/時計を取得する診断SELECTと研究データへの参照対応。未接続：正規MCPで有効CLAIMに束ねたexact-source readerと本文。** 新規の架空readerは追加していない。

## 3. HTML原文：現在確認できた保管はメタデータ

現在の`jra-live`はv31。取得したソースの`fetchCard`はHTTP応答をdecodeした文字列にし、`parseCard`で抽出し、`jra_html_evidence`にはURL・時計・hash・バイト数等を保存している。本文そのものの保存処理は、この経路では確認できない。

確認範囲：ユーザースキーマのHTML/gzip/body系の列、関連routine/表メタデータ、Storage bucket一覧、最新のHTML証拠1件。本文列/本文readerは見付からず、Storage bucketは0件だった。外部保管を含む世界中の不存在証明ではない。tableはservice_role SELECT可、anon/authenticated不可、RLS有効。権限を変更・迂回していない。

最新サンプルは2026-11-15京都12R、`status_basis=UNVERIFIED_HTML_CAPTURE`、official_status_verified=false。メタデータがあるだけで出走状態確認や本文復元をPASSにしない。

**重要なhash表現の差**：

- jra-live v31は復号済みHTML文字列をUTF-8に再encodeしてSHA-256とbyte数を計算している（source 430行以降）。
- 正規MCP v29の手動公式確認はHTTP元バイト列をSHA-256にする（V10保存ソース）。

この二つを元バイト列の同一hashとして扱えない。実本文がないのでサンプルのhash再計算・照合は未実施。`extractor_version=jra-live-v17-provenance`は現在v31ソースにも固定文字列として残っており、保存行のその値だけで実デプロイ版を確定できない。

既存のMCP手動確認dry-runは要約しか返さず、jra-live実行は書込を伴う。どちらも本文回収のために起動していない。正規の認可付き本文読取/保存経路を別途確認・承認しなければ、V11原文契約に接続できない。生バイト列を保管・参照する最小変更は承認対象であり、今回実装/適用していない。

## 4. 元評価器：手順・保存配点を回収、完全自動生成器ではない

Git以外に現在のプロトコル表、保存済みFROZEN監査、過去snapshot、worker実行記録とDB routineを調べた。

### 回収できたもの

- active `JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023` と旧0.3のprotocol内容。既知46Rの保存versionは**全46件とも0.4**。
- 現在の0.4文書にはBASE_CORE候補＋全頭の手動比較判断＋根拠を伴う順位変更が記載されている。固定の独立100点数値生成式は記載されていない。created_at/updated_atは同値だが、当時の本文をhashで保存した証明は別である。
- 監査の`independent_score_method`は3件の記述、`manual_score_breakdown`は期間全体で13件。そのうち既知46Rの京都8R（11/14）は8頭の手動配点を全件取得できた。
- この1Rは5軸（近走・クラス・コース距離・内容・近況）、上限30/25/20/15/10。**保存配点合計→既存補正→保存済みFROZEN点数が8頭全て一致**。`confirmed/historical-manual-trace.json`。
- `jra_segmented_diagnosis_score`という既存数値合成部品と、`jra_live_locked_2025_score_packet_v1`等の別研究packetを回収。後者はbase_rate補正×100の`RESEARCH_100_UNCALIBRATED`であり元独立採点の代用禁止。前者も5成分の元入力生成・当時の使用との対応が未回収。

### 欠けているもの

元実入力から手動5軸の各点を決定する完全な判断手順/実プロンプト/実行モデル/依存データの対応、元context原文と当時hash。対象auditの候補キー検索では入力原文・hash・実行モデル等の指定キーは見付からず、manual_score_breakdownとrunner_evidence_auditのみだった。別名や他の保管先まで否定した結論ではない。

取得snapshotは9月の`JRA_LIVE_BETA_0.1`/`JRA_DIAG_BETA_0.4`で、10〜11月FROZENの完全入力ではない。worker管理記録も取得できたが、RUNNINGというDB状態だけで実際のモデル稼働・入力保存を証明しない。旧optional shadowもbaseline/previewであり全context保管とは確認できない。

**元評価経路の一部と保存済み配点は回収。独立100点生成の完全再実行は未回収。** 回収した一例の配点枠を全46R共通の公式式に格上げしたり、数値を推測再構築したりしていない。

## 5. 今回接続した範囲・検証

`connect-confirmed.mjs` は実取得したJSONだけを読み、READY定義、権限、archive参照、保存配点の実トレース、本文の限界を`confirmed/`へ接続する。DB/外部API/採点関数を呼ばず、点数を再評価しない。別出力先で再現できる：

`node research/unified-engine-20261116/v12/connect-confirmed.mjs /tmp/NEW_DIRECTORY`

新しい架空署名/架空公式DOM/架空100点器/汎用検証器は追加していない。実観測の整合性6検査PASS。V9回帰24、V10回帰19、V11回帰21が全PASS、既存整合性6/5/3も全PASS。元のコード・配点・根拠予算・処理順不変性・欠損nullを維持。

22件のSQLと結果、読み取った関数定義、現在の取得経路ソースは研究資料として保存。`queries/`はSELECTのみ、`sources/*.sql.txt`は定義参照であり実行・適用禁止。

## 6. 同一実入力比較と、残る最小障害

**今すぐ同一実入力の実比較：NO。新規実レース比較0件。** 46R/623頭は開発集合のまま。

READYの定義不明という障害は解消した。ただし正規接続のための残課題は次の3点。

1. **元の100点生成手順**：旧版は候補＋手動評価＋補正の経路。元プロンプト/判断手順・モデル・実入力を回収する必要がある。旧版を「自動100点評価器」とする前提のまま代用品を作らない。
2. **正規CLAIMに束ねる履歴reader**：source候補の一意性と元行ID/時計を、現在のREADY再確認と同じ認可経路で返す必要がある。診断SELECTをそのままゲート回避用の入力取得に転用しない。
3. **公式本文の認可済み経路**：元バイト列、保管参照、時計、公式抽出器を結び付ける必要がある。現状のhashメタデータだけでは不十分。

この3点を解消する本番変更は今回行っていない。PRはDraft維持、本番MCP/DB/main/FROZEN/Cron/デプロイは変更なし。CLAIM・ワーカー実行・有料API・予想保存0件。
