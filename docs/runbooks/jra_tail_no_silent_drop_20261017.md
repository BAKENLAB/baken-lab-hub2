# JRA終盤取りこぼし防止｜2026-10-17

## 実DBで確認した先週と今週の原因の違い
- 2026-10-11: 京都11,12R、東京10,11,12Rの合計5件が `BASIC_READY` かつ `jra_prediction_jobs.QUEUED`、`attempts=0`、予想 `PENDING` で発走時刻を過ぎた。予想ジョブの実行が途絶えたことで保存されなかった。ChatGPT Scheduled Task `JRA Queue Rescue` は無効だったことを確認。停止指示者や理由は特定していない。
- 2026-10-17朝: 京都11R,12Rを含む31件は `BASIC_READY` に到達。新潟12R、東京11R(富士S)、東京12Rは `official_races` に未登録で、公式の現行HTMLに対するpublish実行も行われていなかった。最後の呼出はOpenAI安全性チェックによって停止した。**馬・レース固有のデータ不具合と断定してはいけない**。
- 例外: 京都4Rは障害競走（平地対象外）。東京5R新馬は実際に `JRA_CURRENT_HORSE_NUMBER_NOT_PUBLISHED` が出ており、これはパーサ/公式表示状態の個別問題。

## 今回実装した独立した全スレート監査（本番適用済み）
- private.jra_card_coverage_audit_v1(date)：**常に `jra_live_races` から全レースを列挙**。READYやjobの存在から列挙すると、そもそも登録されない終盤Rが不可視になるため禁止。
- `EXCLUDED_OBSTACLE`, `OFFICIAL_NOT_READY`, `READY_AWAITING_CLAIM_WINDOW`, `READY_QUEUED`, `CLAIMED_NOT_SAVED`, `JOB_FAILED`, `QUEUE_NOT_RUN_AFTER_DEADLINE`, `DEADLINE_PASSED_OFFICIAL_NOT_READY`, `DEADLINE_PASSED_UNSAVED`, `FROZEN_SAVED` 等に分類。`jra_live_races.post_time`（JST表記）を時刻へ変換して発走順に表示。
- `private` スキーマ／SECURITY INVOKER／anon・authenticated EXECUTE無し。予想・job・Cronに書き込まない。
- 再現テスト 10/11：全24Rから終盤QUEUED締切超過5Rを実際に再検出（ほか FROZEN14、JOB_FAILED4、障害1）。
- 再現テスト 10/17 06:55頃：全36Rから READY31、OFFICIAL_NOT_READY4、障害1を正確に抽出。実行前に差分を可視化できる。

## READ ONLYオペレーター監査SQL
```sql
SELECT track,race_no,to_char(scheduled_at AT TIME ZONE 'Asia/Tokyo','HH24:MI') start_jst,
  race_name,field_status,job_status,state
FROM private.jra_card_coverage_audit_v1('2026-10-17'::date)
ORDER BY scheduled_at,track,race_no;

SELECT state,count(*) FROM private.jra_card_coverage_audit_v1('2026-10-17'::date)
GROUP BY state ORDER BY state;
```

## 今後の運用上の改善（明示的に分離）
1. 全36Rの監査 → 各Rに SOURCE/READY/JOB/FROZEN の4段階を記録。SOURCE=DONEやREADYは予想保存完了ではない。
2. 公式発走・対象クラス・障害/新馬対象条件を確認し、出馬表が現行JRA全頭に合格したRだけ正規 `jra_publish_verified_card_v1` から `BASIC_READY` を作る。
3. 1件のHTML/取消/除外/認証エラーはレース単位で記録し、**ほかの独立した対象レースの状態を必ず一覧で再監査**。安全性チェックがブロックした操作は再試行で回避しない。APIの実行成功が確認できないRは『未実行』のまま。
4. 発走70分前から3分前の窓で通常の `jra_manual_claim_next_v1()` → connected JRA MCP context →全馬根拠/S〜F/TOP5/EYE監査→正規save→DBのDONE+FROZEN一致確認。レース1件失敗時に全日の処理結果を成功と見せない。
5. 東京11R 15:45ならCLAIM最早14:35、新潟12R 16:00なら14:50、東京12R 16:30なら15:20 JST。これは現在のDB保存ルールに基づく開始可能目安であり、必ずDB時刻と公式発走時刻を再確認する。
6. 障害レースや根拠不足の新馬を無理にFROZENしない。市場人気・オッズは能力順位とEYEに使用しない。
7. JRA Queue Rescue Scheduled Taskは現時点で無効。**この監査関数はタスクを自動実行しない**。勝手にScheduled Task・Cronを再開したり、有料APIを起動しない。無人再開には別途明示合意と独立テストが必要。
8. 既存FROZENを更新/上書きせず、欠損・安全性チェックを成功扱いしない。