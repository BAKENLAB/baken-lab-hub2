-- LAB REBORN | 2026-10-24 research-only as-of historical archive extraction.
-- SELECT only. Frozen inputs are NEVER updated, nor official predictions.
-- Note: historical JRA archive ends 2026-09-13, so results after that date
-- CANNOT be confirmed by this source. Old race source might be incomplete.
-- Always check stable horse code in addition to indexed Japanese horse name.
-- Final3f ranks may be passed as VERIFIED to v09 only if the archive full_field
-- is true AND the same frozen horse's 3f raw time matches to within 0.15 seconds.
WITH src AS MATERIALIZED (
 SELECT s.race_date target_date,s.track target_track,s.race_no target_no,
  h->>'horse_code' horse_code,h->>'horse_name' horse_name,
  (SELECT min((v->>'race_date')::date)
   FROM jsonb_array_elements(h->'history') v
   WHERE v->>'race_date'~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$') oldest_frozen
 FROM private.jra_research_shadow_frozen_v1 s
 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'runners') h
 WHERE s.race_date='2026-10-24'
 AND s.model_version='LAB_REBORN_V04_ASOF_INPUT_20261024'
), a AS (
 SELECT src.target_track,src.target_no,src.horse_code,src.horse_name,src.oldest_frozen,
 r.race_date,r.track,r.race_no,r.race_name,r.class_name,r.surface,
 r.distance,r.field_size,r.going,r.full_field,r.archive_complete,
 x.finish,x.final3f_rank,x.final3f,x.corner_positions,
 row_number() OVER (
 PARTITION BY src.target_track,src.target_no,src.horse_code,
 (r.race_date<src.oldest_frozen)
 ORDER BY r.race_date DESC,r.race_no DESC
 ) history_rank
 FROM src
 JOIN public.jra_lab_runs x ON x.horse_name=src.horse_name AND x.record_role='full_runner'
 JOIN public.jra_lab_races r ON r.id=x.race_id AND
 r.race_date<src.target_date AND r.surface IN('芝','ダート')
 WHERE x.horse_ref LIKE ('%'||src.horse_code||'/%') AND x.finish>0
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'target_track',target_track,'target_no',target_no,
 'source','JRA_LAB_ARCHIVE','record_role','full_runner',
 'horse_code',horse_code,'horse_name',horse_name,
 'race_date',race_date,'track',track,'race_no',race_no,
 'race_name',race_name,'class_name',class_name,
 'surface',surface,'distance',distance,'field_size',field_size,
 'full_field',full_field,'archive_complete',archive_complete,
 'finish',finish,'final3f_rank',final3f_rank,'final3f',final3f,
 'corner_positions',corner_positions
)), '[]'::jsonb) evidence FROM a
WHERE (race_date<oldest_frozen AND history_rank<=4)
 OR (race_date>=oldest_frozen AND history_rank<=8);
