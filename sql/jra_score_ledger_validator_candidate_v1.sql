-- Candidate only. DO NOT attach to production save before the generator emits the ledger.
-- The registered engine ID is a deployment constant, not a payload-selected value.
create or replace function private.lab_jra_score_ledger_validate_v1(
  p_payload jsonb,
  p_expected_engine text
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog', 'private'
as $$
declare
  v_errors text[]:=array[]::text[];
  v_r jsonb;
  v_c jsonb;
  v_ledger jsonb;
  v_base numeric;
  v_sum numeric;
  v_final numeric;
  v_cap numeric;
  v_n int:=0;
  v_active int:=0;
  v_rank int:=0;
  v_previous numeric:=null;
  v_seen int[]:=array[]::int[];
  v_no int;
  v_top jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    return jsonb_build_object('ok',false,'errors',array['PAYLOAD_NOT_OBJECT']);
  end if;
  if nullif(p_expected_engine,'') is null then
    return jsonb_build_object('ok',false,'errors',array['EXPECTED_ENGINE_NOT_CONFIGURED']);
  end if;
  if p_payload->'audit'->>'score_engine_id' is distinct from p_expected_engine then
    v_errors:=array_append(v_errors,'ENGINE_MISMATCH');
  end if;
  if jsonb_typeof(p_payload->'runners') is distinct from 'array' then
    return jsonb_build_object('ok',false,'errors',array_append(v_errors,'RUNNERS_NOT_ARRAY'));
  end if;
  for v_r in select value from jsonb_array_elements(p_payload->'runners') loop
    v_n:=v_n+1;
    if coalesce(v_r->>'horse_no','') !~ '^[0-9]+$' then
      v_errors:=array_append(v_errors,'HORSE_NO_INVALID');continue;
    end if;
    v_no:=(v_r->>'horse_no')::int;
    if v_no=any(v_seen) then v_errors:=array_append(v_errors,'DUPLICATE_HORSE'); end if;
    v_seen:=array_append(v_seen,v_no);
    if coalesce(v_r->>'status','ACTIVE')='CANCELLED' then continue; end if;
    v_active:=v_active+1;
    v_ledger:=v_r->'score_ledger';
    if jsonb_typeof(v_ledger) is distinct from 'object'
      or jsonb_typeof(v_ledger->'components') is distinct from 'array'
      or jsonb_array_length(v_ledger->'components')=0 then
      v_errors:=array_append(v_errors,'LEDGER_MISSING');continue;
    end if;
    if v_ledger->>'engine_id' is distinct from p_expected_engine then
      v_errors:=array_append(v_errors,'RUNNER_ENGINE_MISMATCH');
    end if;
    if coalesce(v_ledger->>'base','') !~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_errors:=array_append(v_errors,'BASE_INVALID');continue;
    end if;
    v_base:=(v_ledger->>'base')::numeric;
    v_sum:=v_base;
    for v_c in select value from jsonb_array_elements(v_ledger->'components') loop
      if jsonb_typeof(v_c) is distinct from 'object'
        or nullif(v_c->>'name','') is null
        or coalesce(v_c->>'delta','') !~ '^-?[0-9]+(\.[0-9]+)?$'
        or nullif(v_c->>'source_ref','') is null
        or nullif(v_c->>'asof_date','') is null then
        v_errors:=array_append(v_errors,'COMPONENT_INVALID');continue;
      end if;
      v_sum:=v_sum+(v_c->>'delta')::numeric;
    end loop;
    -- Exact, documented rounding/capping policy.
    v_cap:=greatest(0,least(100,round(v_sum)));
    if coalesce(v_r->>'score','') !~ '^[0-9]+(\.[0-9]+)?$' then
      v_errors:=array_append(v_errors,'SCORE_INVALID');continue;
    end if;
    v_final:=(v_r->>'score')::numeric;
    if v_final<>v_cap then v_errors:=array_append(v_errors,'SCORE_SUM_MISMATCH'); end if;
    if coalesce(v_r->>'rank','') !~ '^[0-9]+$' then
      v_errors:=array_append(v_errors,'RANK_INVALID');continue;
    end if;
    v_rank:=v_rank+1;
    if (v_r->>'rank')::int<>v_rank then v_errors:=array_append(v_errors,'RANK_NOT_SEQUENTIAL'); end if;
    if v_previous is not null and v_final>v_previous then v_errors:=array_append(v_errors,'SCORE_NOT_DESCENDING'); end if;
    v_previous:=v_final;
  end loop;
  if v_active<5 or v_active>20 then v_errors:=array_append(v_errors,'FIELD_SIZE_INVALID'); end if;
  if jsonb_typeof(p_payload->'top5') is distinct from 'array' then
    v_errors:=array_append(v_errors,'TOP5_NOT_ARRAY');
  else
    if jsonb_array_length(p_payload->'top5')<>5 then v_errors:=array_append(v_errors,'TOP5_SIZE_INVALID'); end if;
    for v_top in select value from jsonb_array_elements(p_payload->'top5') loop
      if not exists (
        select 1 from jsonb_array_elements(p_payload->'runners') x
        where x->'horse_no'=v_top->'horse_no'
          and x->'rank'=v_top->'rank'
          and x->'score'=v_top->'score'
          and (x->>'rank') ~ '^[1-5]$'
      ) then v_errors:=array_append(v_errors,'TOP5_RUNNER_MISMATCH'); end if;
    end loop;
  end if;
  return jsonb_build_object('ok',cardinality(v_errors)=0,'errors',v_errors,
    'runner_count',v_n,'active_count',v_active,
    'warning','Arithmetic and shape only; source_ref/asof authenticity must be verified independently');
end;
$$;
revoke all on function private.lab_jra_score_ledger_validate_v1(jsonb,text)
  from public,anon,authenticated;
