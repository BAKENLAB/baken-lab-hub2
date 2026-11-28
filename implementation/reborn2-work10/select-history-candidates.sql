-- Exact history selection: local authorized operator only.
-- $1 verified current race UUID, $2 approved feature cutoff, $3 conservative start.
-- Retrospective selection is NOT prospective execution or new capture.
-- Use separately approved archived source versions only. This returns
-- candidate identifiers, never grants source truth or permission.
WITH target AS MATERIALIZED (
 SELECT h.id AS current_row_id,r.race_date,
 substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}$') horse_id,
 h.past_runs
 FROM public.jra_live_runners h JOIN public.jra_live_races r ON r.id=h.live_race_id
 WHERE r.id=$1::uuid AND $2::timestamptz<$3::timestamptz
 AND r.race_date=($3::timestamptz AT TIME ZONE 'Asia/Tokyo')::date
 AND r.source_checked_at<=$2::timestamptz AND r.updated_at<=$2::timestamptz
 AND h.source_checked_at<=$2::timestamptz AND h.updated_at<=$2::timestamptz
), history AS MATERIALIZED (
 SELECT t.current_row_id,t.horse_id,t.race_date,x.ordinality AS prior_pointer,
 x.v->>'race_date' AS prior_date,x.v->>'track' AS prior_track,
 x.v->>'horse_no' AS prior_no,
 substring(x.v->>'source_ref' from '^/JRADB/accessS[.]html[?]CNAME=(pw01sde(?:01|10)[0-9]{20}/[0-9A-Fa-f]{2})$') AS exact_ref
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.past_runs)='array' THEN t.past_runs ELSE '[]'::jsonb END) WITH ORDINALITY x(v,ordinality)
), matches AS MATERIALIZED (
 SELECT h.current_row_id,h.prior_pointer,r.id AS archive_race_id,a.id AS archive_row_id
 FROM history h JOIN public.jra_lab_races r ON r.source_ref=h.exact_ref AND r.race_date::text=h.prior_date AND r.track=h.prior_track
 JOIN public.jra_lab_runs a ON a.race_id=r.id AND a.record_role='full_runner' AND a.horse_no::text=h.prior_no
 AND substring(a.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}$')=h.horse_id
 WHERE h.horse_id IS NOT NULL AND r.race_date<h.race_date
 AND r.source_checked_at<=$2::timestamptz AND r.updated_at<=$2::timestamptz AND r.created_at<=$2::timestamptz
 AND a.updated_at<=$2::timestamptz AND a.created_at<=$2::timestamptz
), unique_match AS (
 SELECT current_row_id,prior_pointer,count(*) n,
 (array_agg(archive_race_id))[1] archive_race_id,(array_agg(archive_row_id))[1] archive_row_id
 FROM matches GROUP BY 1,2
)
SELECT h.current_row_id,h.prior_pointer,
 CASE WHEN u.n=1 THEN u.archive_race_id END AS archive_race_id,
 CASE WHEN u.n=1 THEN u.archive_row_id END AS archive_row_id,
 CASE WHEN h.horse_id IS NULL THEN 'HORSE_ID_MISSING'
 WHEN h.exact_ref IS NULL THEN 'PRIOR_REF_MISSING'
 WHEN u.n=1 THEN 'EXACT_CANDIDATE_NEEDS_INDEPENDENT_WITNESS'
 WHEN u.n>1 THEN 'AMBIGUOUS_HELD'
 ELSE 'NO_EXACT_MATCH_HELD' END AS state
FROM history h LEFT JOIN unique_match u USING(current_row_id,prior_pointer)
ORDER BY h.current_row_id,h.prior_pointer;

-- Next: for each independently verified selected archive event, use Work09
-- historical full-field projection template. Preserve all opponents, no
-- outcome of target race and no market. The attached prior history is not
-- a substitute for missing original; retain its exact pointer and seek
-- independently approved original row. No name/date-only alias.
-- LOCAL: use exact snapshot ID from approved inventory, not a latest card
-- for a historical target. Use independent official native horse ID and
-- exact native event/past horse number. Existing horse_runs lacks stable ID;
-- do not export by name. No direct source acquisition or DB write here.
