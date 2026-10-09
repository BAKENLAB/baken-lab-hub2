# COMPACT_V1 offline draft adapter

隔離ブランチへの新規追加のみ。元RAW・前回成果物・HUB・main・本番DB・Edge・queue・評価ロジックは無変更。
実モデル/API/公式通信/secret取得なし。今回の実装は前回読み取り取得した本番ソースを再読して構造を確認したもので、本番Functionを呼び出していない。

## 本番構造の根拠とdraftの境界

本番 `lab-claimed-context` v8 の `finalContext`、`local-ai-worker` v6 を基準にした。
ファイル・行番号・取得時のバージョン/識別値は `source-contract.json` に保存。
本番公開contextのトップキーは context_format/race/protocol/runners/missing_conditions/field_integrity_checked/stage/protocol_version。
過去走公開項目、current項目、欠損配列、最大5件もそのソースを参照。

`draft_context` は同じ項目・型の骨格だが、本番が要求する検証済みcontextではない。
`field_integrity_checked=false` と `protocol.enforced_server_side=false` を常に保持。
本番Workerのcontext contract検査はこのdraftを拒否する。`production_dispatch_allowed=false`。
構造検証器はdraft用であり、本番のclaim・同一性・最新公式・protocol検証を実行したものではない。
「DRAFT_STRUCTURE_MATCH」を本番入力一致、本番受理可能、評価可能、READYと読み替えない。

## 実装した変換

- RAWのACTIVE馬のみをdraft runnersへ。保存済みCANCELLED/EXCLUDEDは別一覧に残し、現在性はUNVERIFIED。
- 馬番・馬名・対象日・場・番号・競走名を維持。LOCAL circuitを対象場から明示。
- 記録済み日付とHH:mmを、日本のLOCAL開催時刻としてJST timestampへ形式変換。発走前可用性の検証成功とは扱わない。
- distance_m→distance、time→time_raw、過去走weight_kg→weight_carried。中央場のＪ/J接頭辞を観測済み開催場名へ正規化。
- scalar項目だけを明示投影。人気/オッズ、結果、raw HTML、未知のscore/secretキーを持ち込まない。
- 過去走は対象日より前・識別可能な開催場の履歴候補を並べ、最大5件。非完走のdated履歴も候補として保持し、5完走に置換しない。
- 既知race_noの同一履歴を重複排除。事実矛盾はCONFLICT。race_no不明は未解決とし、推測で照合しない。
- 全候補はUNVERIFIED/CONFLICTで別の `unverified_history_candidates` に保存。本番評価用のrecent_runsへの採用は0件。
- 現在属性は全てnull。過去騎手・過去斤量等を現在値へ流用しない。履歴sourceの自己申告を検証済みへ昇格しない。
- early_pos/final_turn_posは意味が一致する変換を確認できないためnull。未検証passing_orderや注入値から導出しない。
- 検証済みearly_posなしの本番fallbackと同じ `running_style_reference=["?"]`。

不足は `missing_items` / `missing_conditions` に記録。
`recent_runs:0/5` と `verified_history` は「検証済み採用件数0」を表し、馬の実キャリア数や評価不能の断定ではない。
元RAWを上書きしない。変換した候補も公式確認済みとして扱わない。

## 3軸

- A: DRAFT_STRUCTURE_MATCH、production_contract_accepted=false。current属性・位置取り・検証済み履歴不足も記録。
- B: UNVERIFIED。公式原本、馬同一性、履歴、最新状態、当時可用性が未確認。
- C: 従来SHADOWの5完走＋必須項目＋今回6条件の充足判定。原 `auditRace` を再利用し、MET/NOT_METとして記録。A/Bとは独立。

品質Cが仮にMETでも、Bが未確認ならoverall BLOCKED。品質条件の充足を公式検証と呼ばない。

## 23レースのオフライン結果

高知1〜11R、佐賀1〜12Rの全23レースでdraft変換完了、ACTIVE 230頭。
A: draft構造一致23 / 本番受理可能0。
B: 公式確認済み0 / 未確認23。
C: 充足0 / 不充足23。
READY 0 / BLOCKED 23。
未検証履歴候補1132件（dated非完走5件を含む）。評価用の検証済み履歴採用0件。
取消12頭・除外2頭は評価用runnerから除外し、未検証の別一覧として保持。
各レース・各馬の変換結果は `compact-v1-offline-output.json`。

## テスト・再現

Node24.19.0、追加依存・通信なし。

```sh
node --test --test-isolation=none research/lab-shadow/23r-20261010/adapter/compact-v1-adapter.test.mjs research/lab-shadow/23r-20261010/next-stage/history-review.test.mjs research/lab-shadow/23r-20261010/revalidate-23r-rowspan.test.mjs research/lab-shadow/saga11-20261010/package-validation.test.mjs
```

新規45 PASS / 0 FAIL、既存SHADOW58 PASS / 0 FAIL。合計103 PASS / 0 FAIL。
本番LOCAL/JRA全テスト、実DB検証、公式照合、モデル評価は行っていない。
元JSON不足で起動しない原佐賀11R testは従来通り含めない。
合成負例/仮の天候・追加履歴はテストメモリ内のみ。実監査成果物へ補完しない。

```sh
node research/lab-shadow/23r-20261010/adapter/build-offline-output.mjs
```

出力が既にある場合はEEXISTで停止（flag=wx）。再実行で成果物を上書きしない。

## 未実装・未確認

検証済み履歴の採用経路、公式HTMLパーサー、最新出走状態再確認、current属性の公式確認、early_pos/final_turn_pos変換は未実装。
JRA124件のレース番号/詳細URL、13頭の実キャリア、marginの公式表記との同義性、当時の時刻・source真正性は未確認。
原本取得や信頼できる検証経路がない状態でtrueフラグを作らない。
このdraftを公式予想生成や本番Workerへ接続しない。
