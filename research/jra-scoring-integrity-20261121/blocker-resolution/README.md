# PR83 接続障害の切り分け・候補実装

## 1. JRA_OFFICIAL_QUEUE_MISSING

前回は私がキューの存在を確認せず、2026-11-21 東京1Rを指定した。今回のDB読取りでは、この対象はcapture queue / live races / official racesに無かった。一方、2026-11-22 東京1Rは登録されており、正規MCPのdry_run=trueが成功した。

返答：ok=true、published=false、DRY_RUN_VERIFIED_HTML_ONLY、16頭、ACTIVE16/取消0/除外0、capture queue done。HTTP数値ステータス、原文bytes、hash、署名はこの返答に含まれない。状態数は現行MCPの解析結果で、独立した原DOM照合を今回済ませたとは扱わない。

**認証・公式取得が一律に故障していたという前回の印象は不正確だった。** 未登録対象の指定が当該エラーの直接原因。11/21東京の公式開催そのものが無かったと証明したわけではない。未登録だけで休催と断定しない。

11/21のseedは公式検証bootstrapの福島1R、11/22は東京1R。現jra-live v32は有効seed→公式リンクの開催日照合→jra_live_queue登録→sync_batchでlive races/runners/evidence metadata→queue doneという取得経路。discover/sync_batchを今回実行していない。

対象22日東京1Rは読取時点でofficial_races.field_status=BASIC_READY、prediction_status=PENDING、予想job0/FROZEN0だった。これは一時点の観測で、現在のジョブ状態を保証しない。今回job/CLAIMを生成していない。

READY判定の所在はofficial_races.field_status。queue doneは取得完了であり、予想READYや保存許可ではない。既存の正規CLAIM・owner・worker・lease・発走締切は別途必要。

## 2. 確認できたコード不具合と最小修正

現MCP v39の`if(qerr||!queue?.cname)`は、DBの照会失敗まで「キューなし」と報告する。この診断上の不具合を候補で分離した。

- DB照会エラー：JRA_OFFICIAL_QUEUE_QUERY_FAILED。private error本文は返さない。
- 本当に行/CNAMEがない：従来のJRA_OFFICIAL_QUEUE_MISSINGを維持。
- 返却行と指定日・場・Rが不一致：TARGET_MISMATCH。別レースへ自動切替しない。
- 正常なCNAMEと正常応答は維持。

`official-queue-read.mjs`と`queue-only.patch`が最小案。DB、認証、Cron、CLAIM、保存ルールの変更は不要。**本番未適用**。

## 3. 公式証拠の段階的接続候補

既存fetchが既に受け取った原bytesだけを観測するexport候補を作った。追加fetch・profile取得・CLAIM・DB保存はしない。

- 既定OFF：server flag JRA_RESEARCH_CARD_EXPORT_ENABLED=1と、dry_run=true / include_evidence=trueが両方必要。
- 同じ原bytes、hash、URL、取得/確認時刻、馬リンクからのID候補を返す。原文を再取得してsnapshotの代用にしない。
- 元bytesの上限512KiB、エラーは研究exportをUNAVAILABLEとし、通常dry-run結果を維持する。
- 未要求時は従来の返答を維持。include_evidenceとpublishの併用は拒否。
- 秘密ヘッダーを返さない。identity metadataは許可列だけ。本文は公開公式ページの原文で、市場情報が含まれ得るため能力採点へ直接渡してはならない。
- signature=null、claim_bound=false、scoring_authorized=false、history_run_ids=[]を明示。原文観測ができても正式な履歴証拠にはしない。既存の署名付きfactor resolverはこの未署名観測を拒否する。

**重要なhash差**：jra-live v32のjra_html_evidence.html_sha256/html_bytesは、Shift-JIS等でdecodeしたHTMLをUTF-8へ再encodeしたもの。MCP v39の内部proofは受信bytesのSHA-256。この2つは同じ列名でも対象が違う。旧DBのhashを更新・読み替えず、候補にHTTP_RESPONSE_BYTESとDECODED_SHIFT_JIS_HTML_UTF8を区別して実装した。domain不明なら検証拒否。既存rowのextractor_version文字列だけで歴代のhash対象を保証しない。

hash区別は合成Shift-JIS bytesでテストした。実公式原文のhash/署名/馬ID/過去走IDの一括検証成功は依然0件。現行正規MCPは原文と署名receiptを返さず、旧履歴選択元IDも失われるため、現在の権限・経路だけでは完全providerを接続できない。

## 4. 194頭・因子別分析

factor-differences.json/CSVに全194頭の以下を固定した。

- 現FROZEN：申告されたbase、因子kind別点数、参照文字列、bridge、最終score/rank/grade。
- 旧再構成：7成分の値・重み・欠損・正規化寄与点、研究順位。
- ソース間FROZEN値が違う場合は分析拒否。既存の申告台帳検算を再利用。

例えば京都12R①はbase39＋申告因子38＝77、bridge1＝78、保存順位2。旧再構成60.11・研究7。これを同じ因子の寄与差と解釈していない。旧式は欠損時再正規化を行い、現在のclass/position/laps/Eval等の申告因子と一対一対応しない。

同じ参照文字列が複数kindに使われる箇所も記録したが、それだけで二重加点・独立性違反と断定しない。原文と独立観測が必要。全194頭でcausal_factor_difference_identified=false / same_original_input_verified=0。正式式の同定や当時入力からの再現成功と扱わない。新係数の推定、既存順位・EYEの変更、対象レース結果の取得は行っていない。

## 5. 検証範囲

Node：既存98件＋追加17件＝115件。queue分岐、OFF無影響、bytes/hash、domain、改変拒否、時刻/馬対応、秘密metadata除外、未署名証拠拒否、194頭の検算・source drift拒否を確認。

candidateの変更を逆に戻すとv39 baselineと全文一致する回帰テストを実装。CLAIM/READY/worker/lease/save RPC/EYE等の他処理を変えていない。

CIは既存PostgreSQL17の保存拒否・rollback・80数学入力・13R194頭リプレイを維持する。**candidate全体のDeno/MCP実行、本物の原文export、署名issuer、正式採点とEYE・保護付き保存の統合は未検証**。正常なhashの合成テストを公式証拠の実証と数えない。

## 6. 本番接続：NO

完成：未登録対象指定の切り分け、正しい登録対象の正規dry-run成功、診断修正候補、既定OFFの原文観測候補、hash対象の分離、全194頭の二系列因子台帳。

残る必須条件：
1. v39 candidateを同SDK/Deno環境で起動検証し、必要な明示承認後だけ限定反映すること。既定OFFのままでも新importがあるためhelper2ファイルを必ずbundleへ含める。
2. 許可された実原文reader、正規CLAIM/contextへの固定、過去走run/race/horse IDと真正な取得時刻・信頼issuer receipt。自己署名やsource_refだけで代用しない。
3. 現材料から因子点を生成する承認済みの正式採点規則。旧7成分や旧5軸を無断採用しない。
4. その後に正式EYE監査・正規保存ガードの隔離統合と未知レース実証。今は必須前提が無いため未実施。

本番MCP/DB/CLAIM/FROZEN/Cron/LOCAL/mainは変更なし。旧エラー解消のための架空queue/CLAIMは作っていない。
