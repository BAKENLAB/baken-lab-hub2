// Pinned source registry. A connected fact is NOT an approved scoring weight.
export const VERSION='BAKEN_UNIFIED_RESEARCH_ENGINE_0.1_20261116';
export const BASE_REF='3c23745f17befd49560ffe0020d934a2fb714547';
export const CONDITIONS=Object.freeze([
 ['recent_form','RECENT_PODIUM_OR_CLOSE','BASE_CORE/OWN','public.jra_live_base_candidate_v1','FACTS_ONLY'],
 ['same_class','SAME_VERIFIED_CLASS_CLOSE','BASE_CORE','public.jra_live_base_candidate_v1','CLASS_MAPPING_REQUIRED'],
 ['near_distance','SAME_SURFACE_NEAR_DISTANCE_CLOSE','BASE_CORE','public.jra_live_base_candidate_v1','CONNECTED'],
 ['same_track','SAME_SURFACE_TRACK_CLOSE','BASE_CORE','public.jra_live_base_candidate_v1','CONNECTED'],
 ['relative_early','WHOLE_ACTIVE_FIELD_EARLY_DENSE_RANK','OWN','automation/jra-eye-additional-audit.mjs','CONNECTED'],
 ['front_hold','EARLY_FRONT_AND_CLOSE_FINISH','OWN','automation/jra-eye-additional-audit.mjs','CONNECTED'],
 ['long_turf','SAME_OR_LONGER_TURF_GOOD_RUN','OWN','automation/jra-eye-additional-audit.mjs','CONNECTED'],
 ['position_gain','OFFICIAL_CORNER_ADVANCE','OWN','automation/historical-pace-causality.mjs','DESCRIPTIVE_NOT_CAUSAL'],
 ['eval_course','EVAL_WITH_OWN_TRAINING_CORROBORATION','EVAL','automation/eval-course-transfer-live.mjs','PRIVATE_VERIFIED_INPUT_REQUIRED'],
 ['incident','OFFICIAL_INCIDENT','OWN','automation/jra-official-incident-evidence.mjs@PR48','VERIFIED_INPUT_REQUIRED'],
 ['rival_followup','PRE_TARGET_OFFICIAL_RIVAL_FOLLOWUP','OWN','automation/verified-rival-followup-audit.mjs','VERIFIED_INPUT_REQUIRED'],
 ['race_pace','OFFICIAL_FIELD_LAPS','OWN','automation/historical-pace-causality.mjs','DESCRIPTIVE_RULE_NOT_CONNECTED'],
 ['last3f','OFFICIAL_LAST3F_RELATIVE','OWN','automation/jra-verified-evidence-rank-bridge.mjs','POINT_RULE_NOT_UNIFIED'],
 ['stamina','LONG_SPURT_SUSTAINABILITY','OWN',null,'NO_VERIFIED_SCORING_RULE'],
 ['distance_change','DISTANCE_CHANGE_REPRODUCIBILITY','OWN',null,'NO_VERIFIED_SCORING_RULE'],
 ['going_weather','GOING_AND_WEATHER','OWN','public.jra_claimed_context','FACT_PRESENT_POINT_RULE_UNAVAILABLE'],
 ['carried_weight','CARRIED_WEIGHT','OWN','public.jra_claimed_context','FACT_PRESENT_POINT_RULE_UNAVAILABLE'],
 ['body_weight','BODY_WEIGHT_CHANGE','OWN','public.jra_claimed_context','FACT_MAY_BE_MISSING_POINT_RULE_UNAVAILABLE'],
 ['equipment','OFFICIAL_EQUIPMENT','OWN','public.jra_claimed_context','FACT_MAY_BE_MISSING_POINT_RULE_UNAVAILABLE'],
 ['sex_age','SEX_AGE','OWN','public.jra_claimed_context','FACT_PRESENT_POINT_RULE_UNAVAILABLE'],
 ['jockey_trainer','OFFICIAL_RIDER_TRAINER_ATTRIBUTES','OWN','public.jra_claimed_context','NO_NAME_PREFERENCE_SCORING'],
 ['draw_geometry','DRAW_AND_COURSE_EFFECT','OWN',null,'NO_VERIFIED_SCORING_RULE'],
 ['training','TRAINING_COMMENT','OWN',null,'SOURCE_AND_RULE_UNAVAILABLE'],
 ['bloodline','PEDIGREE_ADAPTATION','OWN',null,'SOURCE_AND_RULE_UNAVAILABLE'],
 ['mineta','MINETA_RESEARCH','MINETA',null,'ORIGINAL_RESEARCH_UNAVAILABLE']
].map(([id,label,family,source,status])=>Object.freeze({id,label,family,source,status})));
export const REFERENCE=Object.freeze({surface:'芝',races:46,horses:623,good_horse_captures:92,old_captures:87,new_captures:5,lost_captures:0,leader_wins:8,leader_top3:21,period:['2026-10-17','2026-11-15'],
 evidence_status:'USER_REFERENCE_NOT_INDEPENDENTLY_VERIFIED',capture_definition:'TOP5_OR_EYE_TOP3_UNIQUE',
 required:['locked per-race pre-freeze inputs with stable horse IDs','before predictions and item-level 100-point scorecard','official final results','race membership and horse lists for old87/new92 captures','original Mineta research and approved scoring weights','private Eval input provenance (not proprietary rows in public Git)']});
