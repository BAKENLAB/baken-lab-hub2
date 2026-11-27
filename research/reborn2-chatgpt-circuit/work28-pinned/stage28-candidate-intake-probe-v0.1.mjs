// Candidate diagnostics only; no positive real source path. Contract probes use fictional flags and never return performance values.
function diagnosticIntake(m){
 const fail=x=>{throw Error(x)};
 if(m.schema!=="WORK28_REAL_CANDIDATE_COMPACT_0.1"||m.scope!=="EXISTING_LOCATOR_METADATA_ONLY_NO_OFFICIAL_VALUES"||m.formal_admissions!==0||m.eligible_values.length||m.global_item_state.formal_state!=="HELD"||m.global_item_state.analysis_sufficient||m.global_item_state.eligible_values.length)fail("SCOPE");
 const itemIds=new Set(m.itemDictionary.map(i=>i.item));if(m.itemDictionary.length!==115||itemIds.size!==115)fail("ITEMS");
 const roster=[...m.JRA.runners,...m.LOCAL.runners];if(roster.length!==30||new Set(roster.map(r=>r.issuer+":"+r.horse_no)).size!==30)fail("ROSTER");
 if(m.LOCAL.target.current_card!==null||m.LOCAL.target.current_card_status!=="POSTSTART_RETRIEVAL_REJECTED")fail("LOCAL_POSTSTART_CARD");
 return {scope:"LOCATOR_DIAGNOSTICS_ONLY",formal_admissions:0,eligible_values:[],runners:roster.map(r=>{
 if(r.items.length!==115||new Set(r.items.map(i=>i[0])).size!==115||r.items.some(i=>i.length!==5||!itemIds.has(i[0])||!["PARTIAL","MISSING_OR_UNMAPPED"].includes(i[1])||[...i[2],...i[3]].some(k=>!Number.isInteger(k)||k<0||k>=r.history_refs.length))||r.history_refs.some(h=>h.formal_usable||h.raw_bytes_verified||h.publication_at!==null))fail("VALUE_OR_AUTHORITY_LEAK");
 return {issuer:r.issuer,horse_no:r.horse_no,identity:r.identity_state,items:r.items.map(i=>({item:i[0],state:"HELD",observation_availability:i[1],reasons:m.global_item_state.reasons,value:null}))};
 })};
}
function probeContract(e){
 const hold=reason=>({state:"HELD",reason,values:[],formal:false}),reject=reason=>({state:"REJECTED",reason,values:[],formal:false}),accept=(state,reason)=>({state,reason,values:[],formal:false});
 if(e.scope!=="SYNTHETIC_CONTRACT_TEST_ONLY")return hold("OFFICIAL_INTAKE_DISABLED");
 if(Object.keys(e).some(k=>!["scope","source","event","target","subject","rights","observation"].includes(k)))return reject("UNKNOWN_ENVELOPE_FIELD");
 const {source:s,event:h,target:t,subject:p,rights:r,observation:o}=e;
 if(!s||!h||!t||!p||!r||!o)return reject("ENVELOPE_MISSING");
 if(h.id===t.id||["target_result","market"].includes(o.field))return reject("TARGET_OUTCOME_OR_MARKET");
 if(![h.at,t.cutoff,t.post,s.published,s.captureStart,s.captureEnd,s.seal,s.uncertainty,s.update,t.analysisAt].every(Number.isFinite))return hold("TIME_UNVERIFIED");
 if(!(h.at<s.published&&s.published<=s.captureStart&&s.captureStart<=s.captureEnd&&s.captureEnd<=s.seal&&s.update<=s.seal&&s.uncertainty>=0&&s.seal+s.uncertainty<=t.cutoff&&t.cutoff<t.post&&t.analysisAt>=t.cutoff))return hold("ASOF_TIME_INVALID");
 if(s.correctionBeforeCutoffUncaptured)return hold("PRE_CUTOFF_CORRECTION_UNSEALED");
 if(!s.originalBytesMatched||!s.authorityReceipt||!s.immutableSeal||!s.registryComplete)return hold("CUSTODY_NOT_ESTABLISHED");
 if(r.status!=="SYNTHETIC_TEST_ONLY"||!r.purposeAI||!r.retention||!r.latestRegistry||!Number.isFinite(r.validFrom)||!Number.isFinite(r.validUntil)||r.validFrom>t.analysisAt||r.validUntil<=t.analysisAt||r.revokedAt!==null&&(!Number.isFinite(r.revokedAt)||r.revokedAt<=t.analysisAt))return hold("RIGHTS_NOT_ESTABLISHED");
 if(!p.nativeMatch||p.issuer!==h.issuer||p.historicalId!==o.subjectId||!p.historicalId||!p.nativeId||!p.rowId||p.crossIssuerRequired&&!p.crossIssuerVerified)return hold("IDENTITY_NOT_ESTABLISHED");
 if(o.field==="individual_intermediate_clock"&&o.value===null)return accept("MISSING","NO_INDIVIDUAL_MEASUREMENT");
 if(o.field==="individual_intermediate_clock"&&o.measurementScope!=="INDIVIDUAL_NATIVE_EXPLICIT")return reject("WRONG_MEASUREMENT_SCOPE");
 if(o.field==="passing_order"){
 if(o.semantics!=="SOURCE_GROUPED_ORDER"||!Array.isArray(o.value)||!o.value.length||o.value.some(g=>!Array.isArray(g)||!g.length||g.some(n=>!Number.isInteger(n)||n<1))||new Set(o.value.flat()).size!==o.value.flat().length)return reject("PASSING_GROUP_SEMANTICS");
 return accept("TEST_SHAPE_ACCEPTED_GROUPS_ONLY","NO_EXACT_ORDER_WITHIN_GROUP");
 }
 if(o.field==="finish"){
 if(["DNF","CANCELLED","EXCLUDED"].includes(o.runStatus))return o.value===null?accept("NOT_NUMERIC_PERFORMANCE",o.runStatus):reject("NONPERFORMANCE_NUMERIC_LEAK");
 if(o.semantics==="DEAD_HEAT")return Number.isInteger(o.value)&&o.value>0&&typeof o.tieGroupId==="string"&&o.tieGroupId.length?accept("TEST_SHAPE_ACCEPTED_TIE_ONLY","FULL_CLASSIFICATION_NEEDED"):reject("DEAD_HEAT_SEMANTICS");
 if(!Number.isInteger(o.value)||o.value<1)return reject("FINISH_SHAPE");
 }
 if(!["finish","individual_intermediate_clock","race_leader_laps","individual_final600","finish_clock"].includes(o.field))return reject("UNKNOWN_FIELD");
 if(["finish_clock","individual_final600","individual_intermediate_clock"].includes(o.field)&&(!Number.isInteger(o.value)||o.value<=0||o.unit!=="ms"))return reject("CLOCK_UNIT_OR_VALUE");
 if(o.field==="race_leader_laps"&&(o.measurementScope!=="RACE_LEADER"||!Array.isArray(o.value)||!o.value.length||o.value.some(v=>!Number.isInteger(v)||v<=0)))return reject("LEADER_SCOPE_OR_VALUE");
 return accept("TEST_SHAPE_ACCEPTED_ONLY","SYNTHETIC_NOT_OFFICIAL_AUTHORITY");
}
export {diagnosticIntake,probeContract};
