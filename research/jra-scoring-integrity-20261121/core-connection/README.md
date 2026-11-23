# PR83 核心接続：回収できた式・証拠resolver

## 実装済み

- `automation/jra-score-ledger/recovered-diagnosis.mjs`: 実DBで発見したクラス別5軸集約の正確な有理数移植。6区分重み、欠損再正規化、7点条件を保存。旧SQLに存在しない丸めやclampは追加しない。旧rebuild04のDATA_INSUFFICIENT最後→診断点降順NULL最後→RANKED/REFERENCE→馬番のinternal_orderも別関数へ移植。正式点数・正式順位は出力しない。
- `proposed-aggregate.mjs`: 欠損拒否、丸め、clamp、研究同点順を明記した新集約案。正式採用なし。PROPOSED_AGGREGATION.md参照。
- `evidence/contract.mjs` と `reader.mjs`: PR51 V11/V16を再利用。元3ファイルはPR51 head d4cf1d0baf5284cf04e82b6356a5c9cb9153f190のGitHub本文SHA-256と一致。実行に不要な研究ランナーへのimportを外し、純粋helperへ接続。元と移植後のhashはreuse-manifest.json。
- `factor-resolver.mjs`: 署名済みCLAIM/READY/lease/発走前gate、完全なcontext原文hash、ACTIVE馬ID、元run/race/horse ID、原文body hash、信頼された抽出器、取得時刻を確認した履歴だけを、因子の計測値に接続。文字列source_ref単独やarchiveのboolだけでは採用しない。
- `claimed-factor-reader.mjs`: 既存の認可済みproviderを1回だけ呼び、同じpacketを因子検証へ渡す。provider未設定はREADER_DISCONNECTED。管理DBへのfallback、新規CLAIM、再評価、保存は実装しない。

接続できる因子は、真正性が通った原文に実在する着順/着差・通過・上がり、距離/馬場種別・競馬場・過去日付。class/going/laps/Eval/opponent等の未接続計測値をarchiveだけから昇格させない。同一ソースの同じ因子の重複を拒否するが、異なる因子の加点独立性まで証明したことにはしない。

## 回収状況と限界

現MCP v39、bundle 2601ff8de87dd7a061716c7274546efc0d984ce93d2d37abf2d10768dca2e7ad。

追加のpg_proc調査で以下を発見し、13関数を原文保管した。
- private.jra_segmented_diagnosis_score と3つのrefresh呼び出し元、履歴/区分/コース依存helper。
- private.jra_live_locked_2025_score_packet_v1: 係数表、0.60補正、±0.10上限、0.01..0.95、100倍2桁丸めが実在。ただし関数自身がRESEARCH_100_UNCALIBRATED/compare_onlyと明記する。**この100倍方式を正式100点へ採用していない。**
- public.jra_live_base_candidate_v1: 既存確率率と候補順位。全因子100点生成器ではない。

旧診断の原CTEには5軸を生成するコードがあるが、現行保存経路から呼ばれる証拠はない。現MCPのRPC名、現在のclaimed-context定義、既存生成タスク、FROZENの台帳形式と一致せず、これを現行正式式と同定できなかった。GitHubコード検索も当該診断関数名0件で、DB定義の回収が一次根拠。

11/14・15・16・21のlive診断/rebuild04候補テーブル、および診断snapshotは対象行0。対象FROZEN1119頭のrunner内でscore以外の5軸数値項目も確認できなかった。11/21午後194頭の保存原値は比較用に保持し、欠けた5軸を推定して再現成功とはしない。旧診断関数自体の移植検証と、当時の正式予想生成の再現は別。

## 証拠経路の実接続状況

**隔離resolver実装済み・本番provider未接続・実公式履歴の新規検証0件。**

現DBのpublic.jra_html_evidenceにはURL/取得時刻/hash/bytes等があるが本文列がない。検索したcatalogで原HTML本文テーブル/readerは見つからず、JRA名のStorage bucketも0。これは外部保管の不存在を証明しない。新しい管理経路や新規権限で探しに行かず、許可された原文reader・取得receiptが必要な箇所として残した。

信頼されたissuerの公開鍵、正規READY/CLAIMからの署名receipt、固定抽出器、原文bytesは既定で一切登録していない。テストはSYNTHETIC_TEST署名と架空JSONであり、公式JRA HTMLや実運用署名ではない。phaseをFUTUREへ書き換えても拒否する。実行可能な公式HTML抽出器・capture権限は未実証。source_refの現文字列から新しいURLを推測生成しない。

## テストと比較

- 既存60件を維持。追加27件（合計87件）：回収式、欠損、7点条件、旧同点順、新案との差分、署名改変、偽issuer、原文改変/欠落、馬/履歴不一致、時刻不正、原文hash、未承認抽出器、二重因子、未接続reader、1回取得の連結。
- PostgreSQL 17：回収した純粋診断関数を隔離serviceに作成し、80数学入力でNode有理数移植と照合。全一致、ROLLBACK成功。実公式データの採点・保存試験ではない。
- `compare.mjs`: 合成80例の新案差分を再計算し、194頭の不足入力を馬別に保存。48受理/32拒否、24例で丸め等の差。これらを実精度の回帰改善とは扱わない。
- 既存13R194頭の申告台帳は変更なし。正式係数の再現、将来実レース比較、正式保存：いずれも0件。

## 禁止対象の維持と次の最小条件

本番MCP/DB/CLAIM/FROZEN/Cron/LOCAL/mainは変更なし。有料API0。engine-lock.jsonはUNCONNECTEDのまま。現在の正常な保存へ新しい必須ガードを接続していない。

1. 現行の実100点生成元の記録が別にあれば、そのcode/task/outputと完全入力を提供して対応を確認する。なければ、上の旧診断を採用するのか既存統合研究案を採用するのかも含め、**新方式として**5軸生成と全因子の配点仕様を確定し、馬別比較後に承認する。
2. 原文bodyを正規CLAIMに結び付ける認可済みreaderと、選択元ID/時刻/原文hashを含む信頼receiptを用意する。MCP変更・capture署名設定が必要なら別途明示承認。本PRはその本番変更をしない。
3. その2点が揃った同一入力で、因子点数の独立検算、TOP5境界・EYE監査・正規保存を隔離統合試験する。未完成の入力を通したり全レースを止める必須ガードを投入しない。

`recovered/*.sql` は定義の調査原本。refresh関数には書き込み処理があるため、**本番・開発DBを問わず一括実行禁止**。CIが実行するのは副作用のないjra_segmented_diagnosis_scoreのみ。元refresh関数は一度も呼び出していない。
