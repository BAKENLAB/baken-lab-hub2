-- SELECT only: research candidates from existing LOCAL archive.
-- Change exclusive period_end to a date no later than the historical run being evaluated.
WITH params AS (SELECT DATE '2025-01-01' AS period_start, DATE '2026-09-01' AS period_end),
r AS MATERIALIZED (
 SELECT race_id,race_date,track,race_no,race_name,normalize(btrim(race_name),NFKC) AS label,surface,turn,distance,going,field_size,horse_no,finish,
 CASE WHEN time_raw~'^[0-9]{3,4}$' THEN CASE WHEN right(time_raw,3)::int<600 THEN (time_raw::int/1000)*60+(time_raw::int%1000)/10.0 END END AS elapsed_s,final3f
 FROM public.horse_runs CROSS JOIN params WHERE race_type='平地' AND track<>'帯広ば' AND race_date>=period_start AND race_date<period_end
), q AS (
 SELECT race_id,count(*) AS n,count(DISTINCT horse_no) AS unique_horses,count(DISTINCT ROW(race_date,track,race_no,race_name,surface,turn,distance,going,field_size)) AS metadata_n,min(field_size) AS expected,count(*) FILTER(WHERE finish>0) AS completed,count(DISTINCT finish) FILTER(WHERE finish>0) AS distinct_finish,min(finish) FILTER(WHERE finish>0) AS min_finish,max(finish) AS max_finish,count(*) FILTER(WHERE elapsed_s>0 AND finish>0) AS valid_clock,count(*) FILTER(WHERE final3f>0 AND final3f<elapsed_s AND finish>0) AS valid_f3,count(*) FILTER(WHERE finish=1) AS winners FROM r GROUP BY race_id
), e AS MATERIALIZED (
 SELECT r.* FROM r JOIN q USING(race_id) WHERE q.n=q.expected AND q.n=q.unique_horses AND q.metadata_n=1 AND q.completed=q.n AND q.distinct_finish=q.n AND q.min_finish=1 AND q.max_finish=q.n AND q.winners=1 AND q.valid_clock=q.n AND q.valid_f3=q.n
 AND r.race_name IS NOT NULL AND btrim(r.race_name)<>'' AND r.surface IN ('ダート','芝') AND r.turn IN ('右','左','直線') AND r.distance>0 AND r.going IN ('良','稍重','重','不良')
), g AS (
 SELECT track,turn,surface,distance,going,label,count(DISTINCT race_id) AS n_races,count(*) AS n_horses,count(DISTINCT race_name) AS raw_name_variants,count(DISTINCT date_trunc('month',race_date)) AS n_months,min(race_date) AS first_date,max(race_date) AS last_date,
 jsonb_build_object('n',count(*) FILTER(WHERE finish=1),'mean',round(avg(elapsed_s) FILTER(WHERE finish=1),3),'quartiles',percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY elapsed_s) FILTER(WHERE finish=1),'min',min(elapsed_s) FILTER(WHERE finish=1),'max',max(elapsed_s) FILTER(WHERE finish=1),'stdev',round(stddev_samp(elapsed_s) FILTER(WHERE finish=1),3)) AS winner_elapsed,
 jsonb_build_object('n',count(*),'mean',round(avg(elapsed_s),3),'quartiles',percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY elapsed_s),'min',min(elapsed_s),'max',max(elapsed_s),'stdev',round(stddev_samp(elapsed_s),3)) AS finisher_elapsed,
 jsonb_build_object('n',count(*),'mean',round(avg(final3f),3),'quartiles',percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY final3f),'min',min(final3f),'max',max(final3f),'stdev',round(stddev_samp(final3f),3)) AS individual_final3f
 FROM e GROUP BY track,turn,surface,distance,going,label
), output AS (
 SELECT 'LOCAL' AS circuit,g.*,p.period_start,p.period_end,CASE WHEN n_races>=20 THEN '20_PLUS_RESEARCH' WHEN n_races>=5 THEN '5_TO_19_RESEARCH' ELSE 'LT5_RESEARCH' END AS sample_flag,NULL::text AS course_layout,NULL::text AS verified_class,NULL::text AS verified_eligibility,false AS asof_verified,false AS benchmark_admitted,false AS scoring_authorized,'ARCHIVE_NAME_CONDITION_CANDIDATE' AS source_status FROM g CROSS JOIN params p
)
SELECT * FROM output ORDER BY track,turn,surface,distance,going,label;