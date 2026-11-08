-- BAKEN LAB research only. SELECT, never UPDATE/INSERT or RPC/CLAIM.
-- Generate compact pairs without odds or popularity for the pure JS auditor.
-- Export the pair JSON objects into an array, then call auditFrozenPostrace(pairs).
WITH matched AS (
 SELECT p.race_date,p.track,p.race_no,p.circuit,p.status,p.frozen_at,p.post_time,
        p.payload,r.result
 FROM public.official_predictions p
 JOIN public.official_results r
   ON r.race_date=p.race_date AND r.track=p.track AND r.race_no=p.race_no
 WHERE p.race_date BETWEEN DATE '2026-10-25' AND DATE '2026-11-08'
)
SELECT jsonb_build_object(
 'prediction',jsonb_build_object(
   'race_date',to_char(m.race_date,'YYYY-MM-DD'),
   'track',m.track,'race_no',m.race_no,'circuit',m.circuit,
   'status',m.status,
   'frozen_at',to_char(m.frozen_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'post_time',to_char(m.post_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'payload',jsonb_build_object(
     'top5',(SELECT jsonb_agg(jsonb_build_object('horse_no',(h->>'horse_no')::int,'horse_name',h->>'horse_name','rank',(h->>'rank')::int,'grade',h->>'grade') ORDER BY ord)
       FROM jsonb_array_elements(m.payload->'top5') WITH ORDINALITY AS e(h,ord)),
     'runners',(SELECT jsonb_agg(jsonb_build_object('horse_no',(h->>'horse_no')::int,'horse_name',h->>'horse_name','rank',(h->>'rank')::int) ORDER BY ord)
       FROM jsonb_array_elements(m.payload->'runners') WITH ORDINALITY AS e(h,ord)),
     'eye',CASE WHEN jsonb_typeof(m.payload->'eye')='object' THEN
       jsonb_build_object('horse_no',(m.payload->'eye'->>'horse_no')::int,
                          'horse_name',m.payload->'eye'->>'horse_name',
                          'rank',(m.payload->'eye'->>'rank')::int)
       ELSE NULL END)),
 'result',jsonb_build_object(
   'finishers',(SELECT jsonb_agg(jsonb_build_object('finish',(h->>'finish')::int,'horse_no',(h->>'horse_no')::int) ORDER BY ord)
     FROM jsonb_array_elements(m.result->'finishers') WITH ORDINALITY AS e(h,ord)
     WHERE ord<=3))
) AS pair
FROM matched m
ORDER BY m.race_date,m.circuit,m.track,m.race_no;
