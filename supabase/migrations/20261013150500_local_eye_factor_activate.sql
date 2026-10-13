-- Idempotent activation only after the V1.6 save guard and worker are deployed.
DO $eye_activate$
DECLARE n integer; active_version text;
BEGIN
 SELECT version INTO active_version
 FROM public.lab_prediction_protocols WHERE protocol_key='LOCAL_MAIN' AND is_active=true;
 IF active_version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013' THEN RETURN; END IF;
 IF active_version IS DISTINCT FROM 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'
  OR NOT EXISTS(SELECT 1 FROM public.lab_prediction_protocols WHERE protocol_key='LOCAL_MAIN'
   AND version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013' AND is_active=false)
  OR position('CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013' in pg_get_functiondef('public.lab_save_claimed_prediction(uuid,uuid,uuid,text,jsonb)'::regprocedure))=0
  OR position('local_eye_factor_count_guard_v1' in pg_get_functiondef('public.local_eye_comparison_insert_guard()'::regprocedure))=0
 THEN RAISE EXCEPTION 'EYE_16_ACTIVATION_GUARD_UNAVAILABLE'; END IF;
 UPDATE public.lab_prediction_protocols SET is_active=false
 WHERE protocol_key='LOCAL_MAIN' AND version=active_version AND is_active=true;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'OLD_PROTOCOL_CHANGED';END IF;
 UPDATE public.lab_prediction_protocols SET is_active=true
 WHERE protocol_key='LOCAL_MAIN' AND version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013' AND is_active=false;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'NEW_PROTOCOL_CHANGED';END IF;
 SELECT count(*) INTO n FROM public.lab_prediction_protocols WHERE protocol_key='LOCAL_MAIN' AND is_active=true;
 IF n<>1 THEN RAISE EXCEPTION 'ACTIVE_PROTOCOL_NOT_UNIQUE';END IF;
END
$eye_activate$;
