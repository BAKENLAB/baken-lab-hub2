-- READ ONLY: JRA current-race evidence audit. Does not trust ACTIVE labels.
with race_fields as (
 select r.race_date,r.track,r.race_no,r.field_status,
        r.field_payload,
        jsonb_array_length(coalesce(r.field_payload->'runners','[]'::jsonb)) as runner_count
 from public.official_races r
 where r.circuit='JRA' and r.race_date=date '2026-10-11'
), runner_evidence as (
 select f.race_date,f.track,f.race_no,
        count(*) as total,
        count(*) filter(where x->>'status'='ACTIVE') as active_labelled,
        count(*) filter(where x ? 'status_evidence' and
           x->'status_evidence'->>'scope'='CURRENT_RACE' and
           x->'status_evidence'->>'verified'='true' and
           coalesce(x->'status_evidence'->>'locator','')<>'' and
           coalesce(x->'status_evidence'->>'basis','')<>'') as evidence_present
 from race_fields f
 cross join lateral jsonb_array_elements(coalesce(f.field_payload->'runners','[]'::jsonb)) x
 group by f.race_date,f.track,f.race_no
)
select f.track,f.race_no,f.field_status,f.runner_count,
       coalesce(e.active_labelled,0) as active_labelled,
       coalesce(e.evidence_present,0) as evidence_present,
       case when f.runner_count>0 and f.runner_count=coalesce(e.evidence_present,0)
            then 'EVIDENCE_PRESENT_UNTRUSTED_EXTRACTOR'
            else 'HOLD_NO_CURRENT_RACE_EVIDENCE' end as shadow_gate
from race_fields f left join runner_evidence e
 using(race_date,track,race_no)
order by f.track,f.race_no;