import base from '../reborn2-real-work/real-work-02-115-source-map.json' with {type:'json'};

const S={
 result:{documents:['HISTORICAL_RESULT','HORSE_PROFILE'],fields:['finish','official_margin','clock_ms','final600_ms','checkpoint_ranks'],join:['issuer','event_id','native_horse_id','row_pointer']},
 pace:{documents:['HISTORICAL_RESULT','RACE_LAPS','INDIVIDUAL_SPLITS'],fields:['race_leader_laps_ms','individual_split_ms','checkpoint_ms','checkpoint_ranks'],join:['event_id','native_horse_id','distance_boundary_m']},
 class:{documents:['HISTORICAL_RESULT','CLASS_RULE','FOLLOWUP_RESULT'],fields:['class_label','class_version','eligibility','opponent_native_id','followup_finish','followup_class'],join:['issuer','event_id','native_horse_id','effective_at']},
 course:{documents:['TARGET_CARD','HISTORICAL_RESULT','COURSE_SPEC'],fields:['venue','surface','distance_m','direction','first_turn_m','straight_m','course_version','going'],join:['venue','course_version','effective_at']},
 field:{documents:['TARGET_CARD','HISTORICAL_RESULT','RACE_LAPS','COURSE_SPEC'],fields:['gate','horse_no','weight_g','roster','status','checkpoint_ranks','race_leader_laps_ms'],join:['event_id','native_horse_id','card_version']},
 state:{documents:['TARGET_CARD','HORSE_PROFILE','PERSON_REGISTRY','HISTORICAL_RESULT','INCIDENT_REPORT'],fields:['days_since_run','body_weight','equipment','jockey_id','trainer_id','incident_role','published_at'],join:['native_horse_id','person_id','effective_at']},
 change:{documents:['TARGET_CARD','HISTORICAL_RESULT','COURSE_SPEC','CLASS_RULE'],fields:['current_condition','prior_condition','condition_delta','effective_at'],join:['native_horse_id','event_id','version']},
 eye:{documents:['TARGET_CARD','HISTORICAL_RESULT','RACE_LAPS','INDIVIDUAL_SPLITS','COURSE_SPEC','CLASS_RULE','FOLLOWUP_RESULT','INCIDENT_REPORT'],fields:['support','counter','missing','current_relevance','independent_evidence_ids'],join:['native_horse_id','event_id','evidence_id']}
};
const profile=(id)=>{const n=Number(String(id).replace(/\D/g,''));if(String(id).startsWith('EYE'))return S.eye;if(n<=12)return S.result;if(n<=32)return S.pace;if(n<=42)return S.class;if(n<=57)return S.course;if(n<=77)return S.field;if(n<=92)return S.state;return S.change};
export function buildSupply115(){
 const rows=base.items.map(item=>{const p=profile(item.id);return{id:item.id,name:item.name,required_documents:p.documents,required_fields:p.fields,join_keys:p.join,availability_states:['AVAILABLE','PARTIAL','MISSING','CONFLICT','HELD'],cutoff_rule:'every dependency published_at and captured_at <= target cutoff',correction_rule:'immutable versions; select latest version published before cutoff',identity_rule:'official native horse ID; name-only forbidden',missing_rule:'no inference; item remains MISSING/PARTIAL',formal:false}});
 if(rows.length!==115||new Set(rows.map(x=>x.id)).size!==115)throw Error('ITEM_115_INTEGRITY');
 if(rows.some(x=>!x.required_documents.length||!x.required_fields.length||!x.join_keys.length))throw Error('EMPTY_DEPENDENCY');
 return {schema:'REBORN2_SUPPLY_115_MULTI_SOURCE_0.1',scope:'RESEARCH_ONLY',counts:{items:115,rank:100,eye:15,benchmark_groups_held:118,conditions_held:826},items:rows,formal:false};
}
export const supply115=buildSupply115();
