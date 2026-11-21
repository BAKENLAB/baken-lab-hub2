# WIN5 第5対象レース早期CLAIM — 2026-11-21 改修記録

## 目的
WIN5の発売締切が第1対象レース発走5分前に来る一方、JRA通常CLAIMは発走3〜70分前で、最終（第5）対象レースの正規予想保存が間に合わない問題を解消する。勝手な保存や保存後変更を許可するものではない。

## 導入した本番設定
- 2026-11-22 京都11R（マイルCS）発走15:40、WIN5締切14:20、限定早期CLAIM開始13:20 JST。
- 2026-11-23 東京11R（東スポ杯2歳S）発走15:30、WIN5締切14:15、限定早期CLAIM開始13:10 JST。
- 設定テーブル: `private.jra_win5_fifth_early_targets_v1`。公式対象レース名・番号・開催日・予定発走・締切を管理者が確認したもののみ登録。
- 新関数: `private.jra_win5_fifth_early_allowed_v1`。日付・競馬場・番号の完全一致、予定発走時刻とのズレ120秒以内、140分前以降、WIN5締切前、is_enabled=true のときだけtrue。公開ユーザーから実行・設定変更不可。
- 正規RPC `public.jra_manual_claim_next_v1` の候補条件・選択優先度にのみ適用。通常3〜70分受付はそのまま。5R目だけ先に選ぶ（ただし既存の有効CLAIMがある場合はそれを先に再開）。
- `public.jra_manual_readiness_v1` に同条件を反映し、受付可能数の表示を一致させる。

## 変更していないこと
- 正規CLAIMに必要な公式 field BASIC_READY/READY、JRAの正しい場・R・出馬表、障害除外、未保存、既存予想なし、再試行回数、CLAIM有効期限、発走3分前より前の保存条件。
- `jra_claimed_context` の全頭公式過去走・通過順・ラップ・相手の実績・その他証拠。
- `jra_save_claimed_prediction` の採点・整合性監査・正規FROZEN保存。
- 既存FROZENの更新・Cron起動・DB直接予想書換え・オッズ使用。
- 一般のJRAレース、非登録日のCLAIM開始時刻。

## テスト済み
- 時刻の前・境界・締切後、指定以外の競馬場/番号、予定発走時刻の不一致、対象以外の日を含む10件がすべて期待値一致。
- anon に対象設定表SELECT権限なし、早期受付関数EXECUTE権限なし。service_role のみ可。
- 本番DBの正規CLAIMとreadinessの関数本文に早期対象判定が接続されている。
- 翌日11/22の実レースは現時点で未登録・未保存。実走データでのCLAIM→全頭評価→監査→receipt照合はまだ未実施。

## 明日以降の実運用
1. 朝のJRA公式準備・出走頭数確定・対象競走の正しさを確認。
2. 第5対象レースが公式 field BASIC_READY/READY になり、上記時刻が来たら正規JRA MCP `jra_queue_claim_next` でCLAIM。先に進行中の有効CLAIMがある場合は終了してから。
3. 現行の全頭100点評価・EYE監査を同じ方式で実施、正規 `jra_save_claimed_prediction`。15分CLAIM期限に注意、失効したら正規RPCで取り直す。
4. 発走前・READY・未保存・有効CLAIMを毎回確認。保存receiptと本番FROZEN一致を確認。
5. WIN5対象5Rの保存状況と締切時刻を読み取り専用で照合。欠落があれば未完了と明示する。
6. 新たな開催日はJRA公式で第5対象レースを検証してから設定表に登録する。レースを推測して追加しない。Cronは再開しない。

## 差し戻し
`ops/win5_fifth_early_claim_rollback_20261121.sql` に元のCLAIM/readiness関数定義を保存。適用時は正規運用中でないことを確認する。
