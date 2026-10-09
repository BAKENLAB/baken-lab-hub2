# 全23レース出走状態監査（最新状態は未確認）

基準commit `d801233e5dee49bb5db37367b05ba047de6ecb21`、対象2026-10-10高知11R/佐賀12R。ばんえい対象外。

## 実施状況

公式GETを1回試行し、指定proxy:8080への接続に失敗（curl exit 7 / HTTP 000）。
公式サーバーの拒否・取消情報未掲載とは断定しない。同じ経路の反復、プロキシ解除、Edge Functionによる迂回は行わない。
残り22URLは共通接続障害のため未試行。最新公式状態の確認は0/23、全23レースUNVERIFIED。
最新公式出走馬数、誤取消・誤ACTIVEの最新件数、修正後の最新ACTIVE総数は不明（null）。

## 保存済み高知3R HTMLによる過去時点の検証

`../official-history-pilot/evidence/kochi3-card.html`をhash照合して再利用。原本は上書き・複製しない。
取得時刻は同`card-fetch.json`のdownload_completed_at（2026-10-10 07:11頃JST）。
当時の掲載9頭、現在情報の構造証跡を伴うarchive ACTIVE9頭、archive CANCELLED/EXCLUDEDは0頭。
RAW ACTIVE8頭/CANCELLED1頭との差は6番アルデヤーノのみ。
6番の取消文字は過去2026-05-23のdiv.raceInfo/span.pastRankにあり、今回のtd.odds_weightにはない。
馬セル所有リンク、馬番号、騎手セル、性齢、当該斤量/成績セルを確認した上でarchive ACTIVEと分類。
掲載だけを理由にACTIVEにしない。archive値を現在状態に昇格させずcurrent_statusは全馬null。
旧時点との誤取消差分1件、誤ACTIVE差分0件。全23レースの最新件数とは異なる。

## 原因と修正範囲

過去取消を今回の状態と区別すべきことと、6番RAWの状態が保存HTMLの現在情報と一致しないことは確認済み。
RAW生成元の状態判定コードは成果物内に見つからず、実際にどの式が誤判定を起こしたかは未確認。
したがって「全馬block全文検索が原因」という説明は仮説。過去欄混入を排除するSHADOW代替パーサーを新規実装した。
既存パーサー・RAWは変更せず、他22レースの状態を推測補正しない。

`field_status.py`はhorseNameリンクを所有する馬番号行から次の馬番号行までを分割。
状態根拠はそのblockの直接子td.odds_weightのみ。div.raceInfoや入れ子result表は状態根拠から除外。
取消/除外の混在、非ACTIVEと正の人気付きオッズの共存、中止、構造証跡不足はUNVERIFIED。
今後の佐賀HTML・現在取消/除外の実HTMLによる追加検証が必要。合成ケースのテストは公式確認にはしない。
変更情報が未知のDOM列へ移動した場合の検出は未実証。本番と同等・本番受理可能とは断定しない。

## 本番コードの確認（変更なし）

Supabase MCPで`lab-claimed-context` ACTIVE v8をread-only取得。
ezbr SHA-256 `5242c259c45eefd4051c58e31c85a63591b9dd32e2c693b356886b7a3cf2d09c`。
`automation/nar-official-data.mjs`のcurrentRunnerSlice/currentRunnerStatusは最初の過去日付セルより前に限定し、取消→CANCELLED、除外→EXCLUDED、それ以外ACTIVE。
currentRunnerStatusはparseNarProbe/readDirectOfficialRaceの現在行に使用される。parseNarDomDiagnosticは上流diagnosticのstatusを受け取り、現在セルのオッズ矛盾を検査する。上流nar-schedule-probe内部の判定実装は今回未確認。
非ACTIVEと現在の正の人気付きオッズが同居した場合はOFFICIAL_FIELD_STATUS_CONFLICT。
`automation/local-worker-data.mjs:49` activeRunnersは既定3状態と重複馬番を検査しACTIVEだけを残す。
同`:60` verifiedSnapshotは公式race/URL、取得時刻60秒以内、発走3分前、post_race/truncated否定を要求。
同`:177`付近でDB ACTIVE集合と最新公式ACTIVE集合の馬名/馬番を照合。不一致はFIELD_STATUS_CONFLICT。
本監査はclaim/context/queue関数を実行していない。状態取得のためEdge Functionを呼んでいない。

## 出力・再検証

`audit-results.json`: 全23レース・全RAW馬の状態、URL、未確認理由、別枠の高知3R archive比較。
元RAWのSHA-256、監査時刻、接続失敗を記録。latest ACTIVE集合/総数はnullを維持。
`build_audit.py`は排他的新規書込、READY変更なし。保存証跡を読み取り、ネットワーク・DB操作なし。

```sh
python -m unittest discover -s research/lab-shadow/23r-20261010/field-status-audit -p 'test_*.py'
```

新規12テストPASS: 掲載のみの拒否、現在取消/除外/中止、矛盾、保存9頭、過去取消/除外/中止の分離、最新値の未確認維持。
Node既存オフライン回帰は5テストファイル成功/0失敗。今回のrunner出力はファイル単位であり、個別128件再確認とは報告しない。

次の安全な手順: 指定通信経路が利用可能になった環境で23URLのHTML原本、取得時刻、最終URL、HTTP status、hashを保存し、本モジュールで解析。
新鮮な証跡と各馬の現在欄を再確認してから比較。ユーザー提供HTMLでも取得時刻不明なら最新確認には使わない。
全23レースのREADYは変更なし。本番DB/main/Edge/キュー/LAB RANK/EYE/公式予想の変更、モデル呼出し、追加課金は0。
