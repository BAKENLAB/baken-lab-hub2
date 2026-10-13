-- Minimal guarded replacements based on existing DB function source; old V1.5 checks kept intact.
DO $migration$
DECLARE v text; old text; n integer;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname='local_eye_comparison_insert_guard';
 IF v IS NULL THEN RAISE EXCEPTION 'MISSING_OLD_EYE_GUARD';END IF;
 old:='IF NEW.protocol_version IS DISTINCT FROM ''CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'' THEN';
 IF position(old in v)=0 THEN RAISE EXCEPTION 'GUARD_VERSION_ANCHOR_MISMATCH';END IF;
 v:=replace(v,old,'IF NEW.protocol_version NOT IN (''CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'',''CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'') THEN');
 old:='OR a->>''eye_selection_method'' IS DISTINCT FROM ''LOCAL_EYE_COMPARISON_V1'' THEN';
 IF position(old in v)=0 THEN RAISE EXCEPTION 'GUARD_METHOD_ANCHOR_MISMATCH';END IF;
 v:=replace(v,old,'OR a->>''eye_selection_method'' IS DISTINCT FROM (CASE WHEN NEW.protocol_version=''CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'' THEN ''LOCAL_EYE_FACTOR_COUNT_V1'' ELSE ''LOCAL_EYE_COMPARISON_V1'' END) THEN');
 old:='END LOOP;
 IF jsonb_array_length(a->''eye_pairwise_comparison'')<>cardinality(outside)*(cardinality(outside)-1)/2 THEN';
 IF position(old in v)=0 THEN RAISE EXCEPTION 'GUARD_PAIR_ANCHOR_MISMATCH';END IF;
 v:=replace(v,old,'END LOOP;
 IF NEW.protocol_version=''CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'' THEN
  PERFORM public.local_eye_factor_count_guard_v1(p);
  RETURN NEW;
 END IF;
 IF jsonb_array_length(a->''eye_pairwise_comparison'')<>cardinality(outside)*(cardinality(outside)-1)/2 THEN');
 EXECUTE v;
 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname='lab_save_claimed_prediction';
 IF v IS NULL THEN RAISE EXCEPTION 'MISSING_SAVE_FUNCTION';END IF;
 old:='''CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'') THEN';
 IF position(old in v)=0 THEN RAISE EXCEPTION 'SAVE_VERSION_ANCHOR_MISMATCH';END IF;
 v:=replace(v,old,'''CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'',
    ''CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'') THEN');
 EXECUTE v;
END
$migration$;
