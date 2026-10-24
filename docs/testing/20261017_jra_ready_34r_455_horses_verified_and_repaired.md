# JRA公式READY 34/36R復旧＋33R/441頭の出馬表配列破損修復

## 2026-10-17 JST 約07:10〜07:16 実証
- 初期JRA `BASIC_READY` 33件の `field_payload.runners` は、**各レースで最後の馬が頭数分だけ重複**していた。READY・証拠verifiedだけでは保存後データの品質保証にならなかった。発見時JRA FROZEN=0、jobs=0。
- 直接原因：`public.jra_publish_verified_card_v1(jsonb)` の `JOIN LATERAL jsonb_array_elements(...) AS proof_item(value)` のON句が `proof_item.value` でなく、直前の `FOR v_item ... LOOP` の最後の `v_item` を参照していた。誤結合によりN行とも同一馬。`JOIN ON (proof_item.value->>'horse_no')::integer=r.horse_no` に最小修正。
- migration `jra_verified_publisher_proof_runner_join_20261017` 本番適用済み。ソース `docs/fixes/jra_verified_publisher_join_horse_no_20261017.sql`。
- 影響を受けた33Rについて、正規検証証拠・全ACTIVE・元出走捕捉の全頭一意/頭数・予想未保存/未CLAIMを照合し、**出馬表配列のみ**をトランザクションで修復。失敗時は例外で全件rollback。migration `jra_verified_ready_duplicate_runner_repair_20261017`、ソース `docs/fixes/jra_verified_ready_duplicate_runner_repair_20261017.sql`。
- 修復後は33R/441頭で、馬番の一意性・馬名・枠画像の数値・騎手・斤量・馬固有URLがすべてDB captureと一致、異常0。
- 今後同じ間違いをDBが受理しないよう`private.jra_verified_ready_full_field_guard_v1()` と `trg_jra_verified_ready_full_field_guard_v1` を導入。sourceが検証済みJRA BASIC_READYの場合だけ、出馬表配列の頭数、一意馬番、馬名・馬URL・枠・斤量・騎手のソース整合性を強制。migration `jra_verified_ready_full_field_guard_20261017`、ソース `docs/fixes/jra_verified_ready_full_field_guard_20261017.sql`。
- ガード実行テスト：京都1Rの正しいpayloadが通過（ネストされたトランザクションで必ずrollback）、馬番1を2回含むpayloadは期待した `JRA_VERIFIED_READY_DUPLICATE_OR_MISSING_HORSE` で拒否。テスト操作の永続的変更はなし。

## 東京11R 富士ステークス、正規BASIC_READY登録成功
- 14頭の現在JRA公式HTMLを実際に再取得し、読取専用 `jra-verified-card-dryrun` を実行：HTTP200、14/14一致、ACTIVE14、取消/除外0。dryrunは`net._http_response.id=21210`。
- 正規の同一認証付きEdge `jra-verified-card-publish` → 修正済みDB guarded RPCを1回実行、HTTP200（`net._http_response.id=21212`）。`official_races`東京11Rは **BASIC_READY/PENDING、14頭・一意馬番14、証拠 verified=true**。
- これはJRA公式READY登録であり、LAB RANK/EYE予想FROZENではない。FROZENは依然0。

## 最終全件監査 07:16 JST
- **JRA 34/36R BASIC_READY**、**455/455頭**の馬番・馬名・枠・騎手・斤量・固有URL一致、異常0。
- 未READY: 東京5R新馬（5番ジェットシェヴロン公式出走取消に対応する未実装の取消証拠処理）、京都4R障害戦（現行平地モデル対象外）。
- JRA jobs=0 / FROZEN=0。既存LOCAL/JRAの過去FROZEN変更なし。AI Cron再開なし、有料API未使用。
- 正規JRA CLAIM→全頭独立評価→TOP5/EYE→正式FROZEN save→DB DONE検証は発走70分前以降の**別工程**。最初の新潟1Rなら9:45発走、8:35ごろ開始可能。

## 警告
- 以前の『33R全頭READY整合性OK』との報告は誤りだった。source HTMLと証拠の照合は合格でも、実際にDBに書いた `field_payload.runners` が不正だったため。今回の正規の事後検証で初めて本当に34R/455頭を確認した。
- 一度成功したHTTP 200・README/PR結果をFROZEN完了と混同しない。追加の取消例はACTIVEに偽装しない。