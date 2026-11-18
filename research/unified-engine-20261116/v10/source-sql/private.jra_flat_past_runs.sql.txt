CREATE OR REPLACE FUNCTION private.jra_flat_past_runs(p_runs jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select coalesce(jsonb_agg(e.run order by e.ord),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_runs,'[]'::jsonb)) with ordinality as e(run,ord)
  where
    nullif(e.run->>'race_date','') is not null
    and btrim(coalesce(e.run->>'finish','')) ~ '^[1-9][0-9]*$'
    and btrim(coalesce(e.run->>'distance','')) ~ '^[1-9][0-9]*$'
    and nullif(e.run->>'surface','') is not null
    and coalesce(e.run->>'track','') !~ '(JRAへ転入|転入|転出|移籍|登録抹消|抹消|退厩)'
    and coalesce(e.run->>'race_class','') !~ '(JRAへ転入|転入|転出|移籍|登録抹消|抹消|退厩)'
    and coalesce(e.run->>'race_class_detail','') !~ '(JRAへ転入|転入|転出|移籍|登録抹消|抹消|退厩)'
    and coalesce(e.run->>'raw','') !~ '(JRAへ転入|転入|転出|移籍|登録抹消|抹消|退厩)'
    and not (
      coalesce(e.run->>'surface','')='障害'
      or coalesce(e.run->>'race_class','') like '%障害%'
      or coalesce(e.run->>'race_class_detail','') like '%障害%'
      or coalesce(e.run->>'raw','') like '%障害%'
      or exists (
        select 1 from public.jra_lab_races hr
        where hr.source_ref=regexp_replace(coalesce(e.run->>'source_ref',''),'^.*CNAME=','')
          and coalesce(hr.race_type,'平地')='障害'
      )
    );
$function$
