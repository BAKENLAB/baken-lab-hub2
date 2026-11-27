BEGIN READ ONLY;
WITH t AS (SELECT id,race_date FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12),
c AS (SELECT h.horse_no no,h.horse_name,h.source_checked_at cutoff,j,ord,substring(j->>'source_ref' from '([0-9]{2})[0-9]{8}/[0-9A-F]{2}$')::int rno FROM t JOIN public.jra_live_runners h ON h.live_race_id=t.id CROSS JOIN LATERAL jsonb_array_elements(h.past_runs) WITH ORDINALITY p(j,ord) WHERE j->>'race_date'<t.race_date::text AND (h.horse_no,ord) IN ((1,1),(2,1),(4,1),(4,2),(4,3),(5,1),(7,1),(8,1),(8,2),(9,1),(9,2),(11,1),(12,1),(14,1),(17,1),(18,1))),
z AS (SELECT c.*,s.id result_id,s.source,s.settled_at,s.created_at,coalesce((SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.result->'finishers')='array' THEN s.result->'finishers' ELSE '[]'::jsonb END) f WHERE f->>'horse_no'=c.j->>'horse_no' AND f->>'horse_name'=c.horse_name),0) own_matches
FROM c LEFT JOIN public.official_results s ON s.circuit='JRA' AND s.race_date::text=c.j->>'race_date' AND s.track=c.j->>'track' AND s.race_no=c.rno AND s.created_at<=c.cutoff AND s.settled_at<=c.cutoff)
SELECT no,ord,j->>'race_date' date,j->>'track' track,rno,result_id,source,settled_at,created_at,own_matches FROM z ORDER BY no,ord;
ROLLBACK;
