-- 予想を保存しない時刻判定テスト（閲覧専用）
WITH cases(label,d,track,race_no,post_time,as_of,expected) AS (VALUES
 ('22-before',date '2026-11-22','京都',11,timestamptz '2026-11-22 15:40+09',timestamptz '2026-11-22 13:19:59+09',false),
 ('22-open',date '2026-11-22','京都',11,timestamptz '2026-11-22 15:40+09',timestamptz '2026-11-22 13:20+09',true),
 ('22-before-cutoff',date '2026-11-22','京都',11,timestamptz '2026-11-22 15:40+09',timestamptz '2026-11-22 14:19+09',true),
 ('22-cutoff',date '2026-11-22','京都',11,timestamptz '2026-11-22 15:40+09',timestamptz '2026-11-22 14:20+09',false),
 ('22-other-leg',date '2026-11-22','京都',10,timestamptz '2026-11-22 15:00+09',timestamptz '2026-11-22 13:20+09',false),
 ('22-post-mismatch',date '2026-11-22','京都',11,timestamptz '2026-11-22 15:45+09',timestamptz '2026-11-22 13:20+09',false),
 ('23-before',date '2026-11-23','東京',11,timestamptz '2026-11-23 15:30+09',timestamptz '2026-11-23 13:09:59+09',false),
 ('23-open',date '2026-11-23','東京',11,timestamptz '2026-11-23 15:30+09',timestamptz '2026-11-23 13:10+09',true),
 ('23-other-track',date '2026-11-23','京都',11,timestamptz '2026-11-23 15:30+09',timestamptz '2026-11-23 13:10+09',false),
 ('previous-day',date '2026-11-21','京都',11,timestamptz '2026-11-21 15:40+09',timestamptz '2026-11-21 13:20+09',false)
)
SELECT label,expected,private.jra_win5_fifth_early_allowed_v1(d,track,race_no,post_time,as_of) AS actual,
 expected=private.jra_win5_fifth_early_allowed_v1(d,track,race_no,post_time,as_of) AS passed
FROM cases ORDER BY label;
