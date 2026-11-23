# PR83: 実際のJRA採点生成元の追跡

## 結論（本番ソースと既存FROZENの読取り）

本番 jra-claimed-mcp は **v39**。bundle `2601ff8de87dd7a061716c7274546efc0d984ce93d2d37abf2d10768dca2e7ad`。正式保存は public.jra_save_claimed_prediction。今回この関数は定義取得だけで呼び出していない。

実経路:
1. public.jra_claimed_context が既存job/worker/lease/発走3分前/protocolを検査し、candidate、merged最大4履歴、追加内容証拠を返す。
2. candidate_function public.jra_live_base_candidate_v1 が2025学習の集計表からbase_rateと候補順位を生成する。exact.runners>=100ならexact.top3_rate、そうでなければfallback.top3_rate。候補順位はrate降順→平均着差昇順→馬番昇順。
3. MCPのscopeVerifiedActiveField→restoreJraClaimedRunDetails→Eval/OWN材料→追加監査を返す。
4. **全頭100点と根拠別pointsはChatGPT/Work側がpayloadとして提出する。MCP内に全頭100点の基礎・各因子pointsを生成する関数は確認できない。** 保存前ガードはその申告値を検算する処理で、係数生成器ではない。
5. save時は既存contextを取得、restore/scoped、full-depth検査、既存Eval/pace bridge、EYE補完、optional shadow、元の保護付き保存、readback。

BASE_CORE_0.1はvalidated_core識別子としても使われるが、これを正式100点式そのものとは扱わない。base_rateを独自に100点へ変換していない。

## 11/21午前と午後（20Rの保存済みaudit）

7RはINDEPENDENT等のレース別文字列式、13R/194頭はfull-depth監査あり。全20Rでscore_engine_idはnull。午後の複数レースには `round(30+38*base_rate)` が**保存時の申告式**として記載される。これは30・38という数値の存在証拠であり、正式なサーバー配点関数・全レース共通の承認済み100点式の証明ではない。テキスト式をevalしたり、係数を推定して採点していない。

午後194頭のbase_score、全evidence_effects(kind/points/source_ref)、bridge前後、最終score/rank/gradeを原値から台帳化した。13/13Rで整数加減点・既存0..100 clamp・bridge最大2点・全頭順位/TOP5整合が成立。新たな係数正当性、原文・取得時計の真正性は0R検証済みである。

京都12R①ヤマニンループの実記録:
- review base_score 39、保存済み効果合計+38、score_after 77、review rank_after 3。
- bridge score_before 77、requested/applied_delta +1、score_after 78、rank_after 2。
- close_loss proofに阪神2026-04-19、着差0.4、上がり2位、通過7 7 8 6、ラップと参照が保存されている。

したがって「39+38なのに78」だけで不正・誤記とは断定しない。台帳は通常補正の別層を保持する。ただし保存済み参照文字列だけで原HTMLの存在/真正性を確認済みとはしない。

## 11/16の照合

public.official_predictionsでJRA/FROZEN/race_date=2026-11-16は0件。JST frozen_at日付=11/16も対象範囲の照合では0件。近接11/14は30R、11/15は27R。11/15の最終2件のaudit.score_methodはMANUAL_WHOLE_FIELD_EVIDENCE_ASSESSMENTで、runner_history_checkedは数値カウンターであり、11/21午後の因子別配列と同一ではない。日付を勝手に置換して11/16成功を再現したとはしない。ユーザーが指す11/16の具体的なprediction_id/レース/会話記録が追加調査の最小手掛かりになる。

## GitHub・実装履歴・タスク

- PR46 head ecdc9486ec667d7ae4029486f5a357c719e1a872: 既存Eval/pace加算bridgeと正規保存接続。bridgeは最大2点の補正であり、元100点生成器ではない。
- PR49 head 3c23745f17befd49560ffe0020d934a2fb714547: EYEなしの場合の補完。全頭100点生成器ではない。
- PR78 head 739434e8f0ceaac18fe2365503be33d546b12944: deployed v36/v38とfull-depth/handoff。取得できた本番v39でもガードはreview.base_score + sum(evidence_effects.points)を照合し、点数そのものは提出者が用意する。
- PR83開始head 605568efeeddbc9d1a21689e9891e65cc3d167dc: 算術/shapeだけの未接続SQL候補と文書4件。
- 読取り可能なタスク記録の「11/14 JRA 実戦順位改善」もChatGPT側の全頭比較と独立100点判断を指示し、Eval最大1点の条件は書かれるが、全因子の固定配点は定義しない。タスクの有効化/変更/実行はしていない。取得できた一覧の範囲であり、過去の全会話/全実行履歴の不存在を証明したものではない。

既知研究V9〜V16で元100点生成器未回収とされた経緯を、今回も別の推測式で埋めない。

## 確認できたコード位置

baseline/db/jra_claimed_context.sql.txt: CLAIM/lease/worker/発走/protocol検査、candidate_function、merged4履歴と追加証拠。
baseline/db/jra_live_base_candidate_v1.sql.txt: scored/ranked0 CTEの条件と候補順位。
baseline/mcp/index.ts.txt: 初回context 50行、preview 239〜252行、save 293〜366行、正式RPC呼出し付近、既存readback。
baseline/mcp/jra-full-depth-save-gate.mjs.txt: inspectJraFullDepthSave のeffectループとbase_score+sum照合。
baseline/mcp/jra-verified-evidence-rank-bridge.mjs.txt: scoreProof、buildJraVerifiedEvidenceRankBridge、verifyJraBridgeAlreadyApplied。
これらは調査時点の保存ソース。適用直前にはhash/versionを再照合する。

## 本番接続を止める具体的な障害

承認済みの根拠→points生成器と、履歴ID/公式原本/取得時刻を確定する正規resolverが未回収。engine-lock.jsonはUNCONNECTEDを固定する。これを正常な正式エンジンと偽らず、全通常レースを止める未完成必須ガードも本番へ入れない。既存FROZENや正規保存関数の変更では解決しない。
