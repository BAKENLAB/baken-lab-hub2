-- Execute in a transaction and roll back. Requires candidate validator already loaded
-- in the SAME transaction, before this script. Does not modify predictions.
with seed as (
 select jsonb_build_object(
  'audit',jsonb_build_object('score_engine_id','TEST_FIXED_V1'),
  'runners',(select jsonb_agg(jsonb_build_object(
    'horse_no',i,'rank',i,'status','ACTIVE','score',91-i,
    'score_ledger',jsonb_build_object('engine_id','TEST_FIXED_V1','base',90-i,
      'components',jsonb_build_array(jsonb_build_object(
        'name','verified_form','delta',1,'source_ref','OFFICIAL_TEST',
        'asof_date','2026-11-20')))) order by i)
    from generate_series(1,6) i),
  'top5',(select jsonb_agg(jsonb_build_object('horse_no',i,'rank',i,'score',91-i)
      order by i) from generate_series(1,5) i)
 ) p
), cases as (
 select 'valid' label,p,true expected_ok from seed
 union all select 'wrong_engine',jsonb_set(p,'{audit,score_engine_id}','"OTHER"'),false from seed
 union all select 'wrong_sum',jsonb_set(p,'{runners,0,score}','99'),false from seed
 union all select 'missing_ledger',p #- '{runners,0,score_ledger}',false from seed
 union all select 'top5_mismatch',jsonb_set(p,'{top5,0,horse_no}','99'),false from seed
 union all select 'missing_source',p #- '{runners,0,score_ledger,components,0,source_ref}',false from seed
), results as (
 select label,expected_ok,
  private.lab_jra_score_ledger_validate_v1(p,'TEST_FIXED_V1') result
 from cases
)
select label,expected_ok,(result->>'ok')::boolean actual_ok,
       expected_ok=(result->>'ok')::boolean as passed,
       result->'errors' errors
from results order by label;
