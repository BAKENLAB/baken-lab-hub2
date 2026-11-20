# V14：追加再取得の追跡と、実接続の境界

基準：V13 `ad04b2c275bd76f2aa286a5dfc929ba4342a6e35`。Draft PR #51研究専用。今回による本番MCP/DB/main/FROZEN/Cron/deploy変更、CLAIM/保存/有料API実行は0。

## 今回取得した実ソースと中断

開始時に本番MCP v31を読み取った後、DB側の保存/capture関数定義を読むSELECTが応答せず中断された。原因は未確定。結果は取得できず、SQL経路は再試行していない。実装・権限・保管内容を推測で確定しない。

再開後のソース再取得では本番は**v33**、bundle `e229535dd96e82e2b81da0859bf3e9c8808ffbc79e641237d7e2e39cba9db0c8`だった。これは他作業での更新であり、本作業でdeployしたものではない。G1 coverage/score traceが加わっていたのでv29へ巻き戻さず、v33を固定して追跡した。

`sources/`は読み取ったコードの参照用`.txt`、`source-manifest.json`は版/hash。私有EvalデータとLOCAL専用helperを複製していない。bundle値は受領メタデータで再ビルドhash照合ではない。以後も本番が変わり得るため、実証前に版照合が必要。

## 参照順・加工・出力範囲

行付きの対応表は **`source-route.json`**。

1. 正規認証→`jra_claimed_context`→ACTIVE scope→相対候補/比較材料→`loadEvalForClaim`→注記付きcontextを返す。
2. `loadEvalForClaim`はprivate normal snapshotと、`lab_course_jra_transfer_v1`のtarget-course query（最大200行）を用いる。contextと時刻に依存するため、初回と保存時の完全一致を仮定しない。
3. 必要に応じてrelative/evidence previewを呼ぶと、それぞれ**新たなcontext**を取得する。evidence previewはEval再取得、bridge、EYE処理、G1 coverage/score traceを派生させる。G1 helper自身は追加の外部情報取得や新しいG1加点器ではない。
4. 保存時はcontextを再取得（12秒timeout）、ACTIVE scopeとpayload検査、Eval/OWN再取得。bridge適用またはalready-applied再検証を行う。
5. 再取得contextでEYE補完/再検証を行い、必要なACTIVE scope監査を追加する。
6. optional shadowでさらにcontextを再取得（2.2秒timeout）し、baseline/previewを作る。
7. 通常の`jra_save_claimed_prediction_with_shadow_v1`へ、実savedPayloadとoptional baseline/previewを渡す。
8. 内部で実FROZEN rowをreadback。外向け応答はprediction_id、補正状態、TOP5、readback検証状態等の**要約**で、row全文ではない。

各段階は条件分岐があり、全レースで全取得が行われるとは言わない。今回これらのtoolを実ジョブで起動していない。

## 既存の無加工記録経路はあるか

確認できたEdge応答では**追加情報の原文一式を無加工で固定する経路は未確認**。

- 初回context textは呼出側が実際に受け取れればV13へ原文保管できる。実クライアントからのexport/使用証明は未実証。
- previewのproposed_payload/差分/根拠/G1注記は派生記録。内部raw/scoped context、OWN戻り行、使用private snapshot全文の代わりではない。
- `jra_seal_relative_rank_pair`は名前にsealがあっても**DB書込を伴う**。今回禁止なので呼ばない。引数はbaseline/previewであり、内部DBの追加保管内容は未確認。
- 通常保存wrapperもsavedPayload/baseline/previewを受けるが、DB関数が内部で何を保管するかは今回のSQL中断で確認できなかった。隠れた保存先がないと断定しない。
- したがって、既存の確認済みAPI出力だけで厳密な同一入力の全条件を満たすとは判定できない。

### already-applied検証の限界

`verifyJraBridgeAlreadyApplied`は再構成したscore_before/after、rank、TOP5、verified_run_refs等を照合する。しかし元の全context/OWN行/`verified_proof`全内容のbyte同一を照合する処理ではない。同じdeltaと参照が再現されたことを、無加工原文の一致へ格上げしない。

### readback検証の限界

現行比較は主に全馬の馬名/score/rank、TOP5の馬番/rank、bridge版/順序/件数、空bets等。grade・コメント・EYE・監査全文・全7項目の完全一致をその要約だけで証明したとは扱わない。正常な変換を研究都合で戻すこともしない。

## 今回実装・接続したもの

**`archive-observation.mjs`** はV13の既存raw/hash記録を読み、V10の観測値projectionへ同じcontext原文を渡すローカル補助。保存された原文を再生成せず、hash一致を検査する。receiptと実rowが別途得られた場合はprediction ID/race/statusの記録上の対応と、提出/実payloadの構造差を表示する。

これは実APIへの接続ではない。ID/race一致だけでjob・原文・取得時計・真正性が証明されたとはしない。出力は常に比較条件未達、研究採点・順位・EYEは生成しない。正常補正によるpayload差はtrace要求とし、自動修正・再保存をしない。

```
node research/unified-engine-20261116/v14/archive-observation.mjs /APPROVED_PRIVATE_RESEARCH_ARCHIVE/session
```

パスは説明用。今回の実レースsessionは0件。

## 未来projectionの実装可能/未接続

|範囲|状況|
|---|---|
|原文context→card/ACTIVE集合/現在属性/近走観測値→既存r/f構造|ローカル接続実装済み|
|V13原文hashとV10 raw_response hashの一致|補助コードで確認|
|正規履歴run/race/horse ID、原文、取得時刻、exact source lineage|未接続|
|観測値からV5の採点可能な証拠への昇格|未実装。scoring_priors空、unit/能力score/rankは未知のまま|
|公式原文から得た新しい能力情報を研究だけに補完|禁止。同じ情報が旧版にも渡った証明が必要|
|研究の独立固定と実時計/真正性|未実証|

V13のRUNBOOKと合わせ、初回text、可視判断、提出payload、保存直前材料、実FROZEN、receipt/呼出記録、研究結果を別々に保管する。receiptにはjob_idが返らない現行例なので、元の正規ツール呼出し記録との結び付けも必要。補助コードはこの証明を自動生成しない。

旧版の順位/配点/EYE/結果は研究評価器へ渡さず、原文hashと全ACTIVE集合、共通の発走前情報を共有する。研究プロセスにV13の全アーカイブを丸ごと見せない。記録・真正性・証拠・独立性・期限の一つでも未達なら比較不成立。

## 次に必要な承認

**[APPROVAL_REQUIRED.md](APPROVAL_REQUIRED.md)** に変更内容・権限・影響を記載した。最小候補は既定OFFで、通常処理が得たローカル変数を記録/返却し、既存の認可済みreadbackと結ぶこと。追加の再取得やCLAIMで代用しない。

これは追加の本番処理になるため、**候補Edge/RPCの変更実装には進んでいない**。まずDB定義/保管内容を確認し、出力先・データ権利・payload互換性・時間/容量・fail-open・rollbackの承認が必要。その後も隔離検証と本番適用承認は別。

## テスト・不変性・実績

- V14ローカル連携5 PASS：同じ原文、hash改変拒否、記録ID対応、通常変換差の保全、誤紐付け拒否。架空storage testであり実比較ではない。
- 指定の再実行：V9 24 PASS、V10 19 PASS、V11 21 PASS、V12実観測整合性6 PASS、V13 9 PASS。全て0 FAIL。
- 旧版/研究版コード・配点・根拠予算・EYE・欠損nullは変更しない。ソースsnapshotと元コード変更を混同しない。
- v33 runtimeツールの実ジョブ実行、DB wrapper/capture保存の確認、実FROZEN取得、実入力共有、真正性/時計、公式結果比較は未実証。

**実比較0件・新規CLAIM0件・本番保存0件。本番反映NO。** 46R/623頭は開発集合。今回による本番MCP/DB/main/FROZEN/Cron/deploy変更はなく、研究PR #51をDraftで維持する。
