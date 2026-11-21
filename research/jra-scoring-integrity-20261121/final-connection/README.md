# 最終接続検証：実装・隔離リプレイ完了、本番接続不可

## 今回実行したこと

基準add1134726186f1e8b6f6319e8d2816c299a4e79を維持し、現行MCP v39の正規取得経路を調査した。公式出馬表dry-runを1回だけ呼び出したが、queue/cname参照段階のJRA_OFFICIAL_QUEUE_MISSINGで停止し、HTML取得に到達しなかった。再試行や別経路の利用はしていない。

調査済みの経路には次の不足がある。

| 段階 | 確認した出力 | 欠けているもの |
|---|---|---|
| private.jra_merged_flat_history_v2 | 履歴の数値、source_kind | 選択元run/race ID、原文、取得時刻。RETURNS TABLEから既に失われる |
| public.jra_claimed_context | CLAIM/worker/lease/発走前検査後の履歴、追加材料 | 元のsource_refも削除。新しい取得で過去の正確な選択元を証明できない |
| private.jra_optional_content_evidence_v3 → restoreJraClaimedRunDetails | 照合した通過順・上がり・馬場・ラップ | 原HTML本文と署名receipt |
| jra_official_publish_card(dry_run=true) | ソース上は件数・状態等の要約を返す | 関数内部で生成するHTML hashさえdry-run返答に含めない。原文・署名・履歴IDも返さない |

provider-capability.jsonに実測と未接続条件を保存した。実公式原文・署名・過去走IDの一括照合成功は0件。Supabase MCPによる認可済みの読取り接続と、公式原文の真正性を証明するproviderは別物である。文字列source_refや今回のDB読取りを、署名付き公式snapshotに昇格させていない。

## 追加実装：旧素点生成器の実コードを隔離実行

旧5軸式が依存する上流のprivate.refresh_jra_live_rank_betaを回収した。automation/jra-score-ledger/legacy-readonly-replay.mjsは、hash固定した原文から採点CTEだけを抽出する。TRUNCATE/INSERT/UPDATE/EYE更新を除去し、依存先はpg_tempだけ。新しい係数は追加していない。

現在のFROZEN比較用13R・194頭について、取得済みDB履歴の許可列だけを5R/5R/3Rに分割固定した。人気、オッズ、rawテキスト、対象レース結果は入力から除外した。FROZENの順位・点数はcomparatorファイルへ分離し、DBによる採点結果を作成した後にだけ検査スクリプトが読む。

入力はliveのpast_runsであり、現行MCPが採用するLIVE/DB混合履歴の完全再現ではない。差分には方式と入力範囲の両方が混在する。

固定ファイルは今回作った**発走後再構成資料**であり、当時の実使用context原文ではない。live_runner_idは現在のlive行IDで、過去走run_idとは別。source_checked_at/updated_atが発走前でも、immutable snapshotと公式原文がないため、厳密な発走前入力保証にはならない。

統計なしの基準入力input-*.jsonは上書きせず、cohorts-*.jsonを別添した。既存daily statsを対象日より前だけに限定して集計した実数値である。条件替わり22頭、騎手149頭に対応する集計が取得できた。無い集計はNULLのまま。偽のdaily rowやneutral値を作っていない。これらも当時の取得証跡を持つ公式原本ではなくDB再構成である。

## 旧7成分の具体的配点・条件（採用承認なし）

原式は下記の**存在する成分の加重平均**を0〜100へclampし、小数2桁に丸める。名目重み合計は93であり、100点の固定予算を各成分へ割り振る方式ではない。

| 成分 | 原式の重み | 生成規則 |
|---|---:|---|
| 近走 | 0.30 | 前4走のrun_quality平均 |
| 同場同距離 | 0.17 | 同馬場・同場・同距離のrun_quality平均を50へ縮小、n/(n+2) |
| 同距離 | 0.12 | 同馬場・同距離、同上 |
| 同競馬場 | 0.08 | 同馬場・同場、同上 |
| 馬場状態 | 0.07 | 同馬場種別・同馬場状態、n/(n+3)。不明はNULL |
| 条件替わり | 0.12 | 過去の遷移統計、25+110*top3/n+30*wins/nを15..90、50へn/(n+20)縮小 |
| 騎手 | 0.07 | 同場の過去統計、同じ率式、n/(n+30)縮小。名前の好みではない |

run_qualityは頭数補正着順の75%と着差式の25%。正確なNULL/LEAST/GREATEST/COALESCE処理はsource/refresh_jra_live_rank_beta.sqlの原式をそのまま実行し、独自補完していない。欠損頭数から着順品質を推定せず、その走のrun_qualityはNULL。

RANKED条件はhistory_n>=3かつavailable_components>=4、REFERENCEはhistory_n>=1かつavailable_components>=2。他はDATA_INSUFFICIENT。旧順序は状態→小数2桁の点数降順→馬番。研究順位だけを出し、正式順位はnull。

### 現行材料との相違

現MCPの位置取り・上がり3F・実ラップ・相手クラス・敗因・斤量・休養・Eval1942等を、旧7成分がすべて採点するわけではない。5軸診断の条件変化等とは別層である。現行の独立EYE監査もこの旧関数の簡易トリガーとは異なるため、旧EYE更新部分は一切実行しない。

この配点表は回収した旧式のレビュー資料であり、新方式の正式採用承認を求められる完成状態ではない。現行材料を正当に点数化する規則・重複根拠の予算・欠損時の意味を、未確認の係数で埋めていない。

## 実測結果

GitHub Actions run 44960514662 / commit e7492589508a9c4b2204420bcaf40a1ad55822d2で実行。

- Node：既存87＋追加11＝98 PASS / 0 FAIL（最終CIで確認）。
- PostgreSQL 17：既存の保存/refusal/ROLLBACKと80数学入力の照合を維持。
- 13R・194頭を、統計なし／統計ありの各条件で2回ずつ実行し、各条件内の出力が完全一致。
- 独立検算で成分合計、小数2桁丸め、統計式を照合。全入力馬の網羅と、失敗時停止・全トランザクションのROLLBACKを確認。

| FROZENとの比較 | 点数差 | 順位差 | TOP5集合が変化したレース |
|---|---:|---:|---:|
| 履歴のみ・統計未接続 | 194/194 | 164/194 | 12/13 |
| 取得した日付限定統計を接続 | 194/194 | 163/194 | 13/13 |

例：京都12R①ヤマニンループはFROZEN 78点・2位、統計あり再構成は60.11点・研究7位。京都10R⑬ウインデイジーは82点・1位→71.57点・研究13位。元予想を変更したわけではない。

これは精度悪化／改善の検証ではなく、**別の再構成入力・旧採点方式で点数と順位が一致しない**という結果である。現在の入力と当時の入力が同一だとは証明できず、差分だけで式の同一性を断定しない。対象レースの結果は今回取得しておらず、捕捉率を新規算出していない。

全388行（194頭×2条件）の比較はactions-replay-comparison.json。Actions artifactも生成したが、Codex側のdownloadはHTTP403で1回停止。認可済みGitHub job logに明示出力した比較行を取得して保存した。artifact原ファイルをダウンロード検証済みとは扱わない。

## 本番接続判定：NO

完成：旧素点生成SQLの隔離実行、固定入力・統計の別保存、2回再現、独立数値検算、馬別FROZEN比較、provider不足の実ソース追跡。

未完成：実公式原文と署名receipt、正規CLAIM内の選択元履歴ID、当時の同一入力証明、現行全材料に対する正式配点、EYE正式監査との統合、新方式の実精度・将来検証。これらが揃わないため、本番相当MCPでの正式採点→保護付き保存の統合実証は未実施である。モックを実証と数えていない。

本番MCP/DB/CLAIM/FROZEN/Cron/LOCAL/main/デプロイは変更なし。外部有料API0。既存engine-lockはUNCONNECTEDのまま。旧モデルを正式ルートへ無断採用していない。

次の最小条件はAPPROVAL_REQUIREMENTS.md参照。source/*.sqlは回収原本であり、書込み関数を含むため**一括実行禁止**。CIは元関数を呼ばず、採点SELECTだけを抽出してephemeral DBで実行する。
