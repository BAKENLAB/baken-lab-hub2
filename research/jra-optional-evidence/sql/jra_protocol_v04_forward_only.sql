-- BAKEN LAB: Activate revised JRA evaluation protocol for FUTURE predictions only.
-- FROZEN rows, existing saved predictions, save guards, EYE, Cron: untouched.
BEGIN;
DO $block$
BEGIN
  IF (SELECT COUNT(*) FROM public.lab_prediction_protocols
      WHERE protocol_key='JRA_MAIN' AND is_active=true
        AND version='JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004') <> 1 THEN
    RAISE EXCEPTION 'JRA_PROTOCOL_CURRENT_VERSION_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lab_prediction_protocols
      WHERE protocol_key='JRA_MAIN' AND version='JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023') THEN
    RAISE EXCEPTION 'JRA_PROTOCOL_NEW_VERSION_ALREADY_PRESENT';
  END IF;
END $block$;

UPDATE public.lab_prediction_protocols
SET is_active=false,updated_at=clock_timestamp()
WHERE protocol_key='JRA_MAIN' AND is_active=true
  AND version='JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004';

INSERT INTO public.lab_prediction_protocols(
  protocol_key,version,is_active,content,notes
)
SELECT protocol_key,'JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023',true,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        content,
        '{ranking,versioned_mode}',
        '"CONTENT_EVIDENCE_OPTIONAL_0.4"'::jsonb,
        true
      ),
      '{ranking,content_evaluation_contract}',
      jsonb_build_object(
        'base_core','BASE_CORE_0.1_UNCHANGED',
        'full_runner_first',true,
        'selection','compare every runner independently on prior as-of race content, course surface distance, winner gaps, positional work, pace and opponent quality with verified facts only; relative evidence must be assessed against all rivals, not one fixed bump',
        'claim_context','Use runner_history and optional runner_content_evidence if present; if absent continue normally; an authorized read-only diagnostic may supply historic content but is never mandatory',
        'comments','optional; missing cannot lower score or block',
        'source_cutoff','only events demonstrably known before this race start',
        'incident_guard','never infer an unverified break, interference, or wide trip',
        'ranking_guard','no automatic rank6 promotion; do not blindly promote all small-margin finishers, compare with displaced top5 and protect strong form',
        'surface_switch','first turf or dirt is uncertainty, not zero ability or guaranteed uplift',
        'market_data','no market odds or popularity in ability evaluation',
        'history_window','use four verified merged runs; add older factual racing evidence only where source and as-of are certain',
        'rank_effect','Manual whole-field ranking may deviate from baseline candidate when race-specific comparative evidence is explicitly stated',
        'when_optional_unavailable','CONTINUE_BASE_CORE_NO_PENALTY'
      ), true
    ),
    '{change_policy}',
    '"Content-aware full-runner comparison in new races only. No formula-based boost without evidence. Legacy BASE_CORE_0.1 remains the statistically validated baseline; content assessment is experimental until monitored. Existing FROZEN unchanged."'::jsonb,true
  )
  || jsonb_build_object('research_status','LIVE_FORWARD_ONLY_EXPERIMENTAL_20261023'),
  'Forward-only pilot of race-content comparative reasoning. BASE_CORE 0.1 untouched. No forced upshift, FROZEN rewrite, EYE or market change. Source evidence optional.'
FROM public.lab_prediction_protocols
WHERE protocol_key='JRA_MAIN' AND version='JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004';

DO $verify$
BEGIN
  IF (SELECT COUNT(*) FROM public.lab_prediction_protocols
      WHERE protocol_key='JRA_MAIN' AND is_active=true) <> 1
  OR (SELECT version FROM public.lab_prediction_protocols
      WHERE protocol_key='JRA_MAIN' AND is_active=true) <> 'JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023' THEN
    RAISE EXCEPTION 'JRA_PROTOCOL_ACTIVATION_FAILED';
  END IF;
END $verify$;
COMMIT;
