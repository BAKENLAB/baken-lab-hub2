import crypto from 'node:crypto';

export const SUPPLY_STATES=Object.freeze(['AVAILABLE','PARTIAL','MISSING','CONFLICT','HELD']);
export const DOC_KINDS=Object.freeze(['TARGET_CARD','HISTORICAL_RESULT','HORSE_PROFILE','RACE_LAPS','INDIVIDUAL_SPLITS','COURSE_SPEC','CLASS_RULE','PERSON_REGISTRY','INCIDENT_REPORT','FOLLOWUP_RESULT']);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=(c)=>{throw new Error(c)};
const required=(o,keys)=>{for(const k of keys)if(o?.[k]===undefined||o?.[k]===null||o?.[k]==='')fail('REQUIRED_'+k.toUpperCase())};
const forbidden=/\b(?:odds|popularity|payout|target[_-]?finish|target[_-]?result)\b/i;

export function validateRawDocument(doc,{cutoff,mode='RESEARCH'}={}){
 required(doc,['evidence_id','kind','issuer','source_url','raw_sha256','captured_at','published_at','version','parser_version','format','observations']);
 if(!DOC_KINDS.includes(doc.kind))fail('DOC_KIND');
 if(!/^https:\/\/(?:www\.)?(?:jra\.go\.jp|keiba\.go\.jp|ppr\.keiba\.go\.jp)\//.test(doc.source_url)&&doc.issuer!=='SYNTHETIC')fail('OFFICIAL_SOURCE');
 if(!/^[a-f0-9]{64}$/.test(doc.raw_sha256))fail('RAW_SHA256');
 if(cutoff&&(Date.parse(doc.captured_at)>Date.parse(cutoff)||Date.parse(doc.published_at)>Date.parse(cutoff)))fail('AFTER_CUTOFF');
 if(forbidden.test(JSON.stringify(doc.observations)))fail('FORBIDDEN_FIELD');
 if(mode!=='SYNTHETIC'&&doc.issuer==='SYNTHETIC')fail('SYNTHETIC_NOT_OFFICIAL');
 if(doc.kind==='INDIVIDUAL_SPLITS'&&doc.measurement_scope!=='INDIVIDUAL')fail('INDIVIDUAL_SCOPE');
 if(doc.kind==='RACE_LAPS'&&doc.measurement_scope!=='RACE_LEADER')fail('RACE_LAP_SCOPE');
 return true;
}

export function normalizeObservation({field,value,unit=null,evidence_ids,state='AVAILABLE',missing_reason=null,conflict=null}){
 if(!SUPPLY_STATES.includes(state))fail('SUPPLY_STATE');
 if(!Array.isArray(evidence_ids)||(!evidence_ids.length&&state==='AVAILABLE'))fail('EVIDENCE_IDS');
 if(state==='MISSING'&&value!==null)fail('MISSING_HAS_VALUE');
 if(state==='CONFLICT'&&(!Array.isArray(conflict)||conflict.length<2))fail('CONFLICT_DETAIL');
 return {field,value,unit,state,evidence_ids:[...new Set(evidence_ids)].sort(),missing_reason,conflict,estimated:false};
}

export function buildRunnerSupply({horse,card,profile,histories=[],relations=[],observations=[]},ctx){
 required(horse,['issuer','native_horse_id']);
 if(horse.join_method==='NAME_ONLY')fail('NAME_ONLY_IDENTITY');
 const docs=[card,profile,...histories,...relations].filter(Boolean);
 for(const d of docs)validateRawDocument(d,ctx);
 const ids=new Set(docs.map(d=>d.evidence_id));
 if(ids.size!==docs.length)fail('DUPLICATE_EVIDENCE_ID');
 for(const o of observations)for(const id of o.evidence_ids)if(!ids.has(id))fail('BROKEN_DEPENDENCY');
 const historyRows=histories.flatMap(d=>d.observations.rows??[]).filter(r=>r.native_horse_id===horse.native_horse_id);
 return {horse:{...horse},state:deriveState(observations),documents:docs.map(d=>d.evidence_id),history_count:historyRows.length,observations,formal:false,scoring_authorized:false};
}

export function deriveState(obs){
 if(obs.some(x=>x.state==='CONFLICT'))return 'CONFLICT';
 if(obs.some(x=>x.state==='HELD'))return 'HELD';
 if(!obs.length||obs.every(x=>x.state==='MISSING'))return 'MISSING';
 if(obs.some(x=>x.state!=='AVAILABLE'))return 'PARTIAL';
 return 'AVAILABLE';
}

export function buildBlindBundle({target,runner_supplies,pre_race_docs,result_docs=[]},cutoff){
 required(target,['issuer','event_id','scheduled_post']);
 if(Date.parse(cutoff)>Date.parse(target.scheduled_post))fail('CUTOFF_AFTER_POST');
 for(const d of pre_race_docs)validateRawDocument(d,{cutoff,mode:d.issuer==='SYNTHETIC'?'SYNTHETIC':'RESEARCH'});
 const preIds=new Set(pre_race_docs.map(d=>d.evidence_id));
 for(const s of runner_supplies)for(const id of s.documents)if(!preIds.has(id))fail('RUNNER_DOC_NOT_IN_PRE_RACE_SET');
 const analysis={target,cutoff,runner_supplies,pre_race_evidence_ids:[...preIds].sort(),result_reference:null,formal:false,scoring_authorized:false};
 const sealed_results={target_event_id:target.event_id,documents:result_docs.map(d=>({evidence_id:d.evidence_id,raw_sha256:d.raw_sha256})),accessible_to_analysis:false};
 return {schema:'REBORN2_BLIND_BUNDLE_0.1',analysis,sealed_results,bundle_sha256:sha(Buffer.from(JSON.stringify({analysis,sealed_results}))) };
}

export function buildReceipt(bundle,pins){
 return {schema:'REBORN2_SUPPLY_RECEIPT_0.1',bundle_sha256:bundle.bundle_sha256,pins,counts:{runners:bundle.analysis.runner_supplies.length,pre_race_documents:bundle.analysis.pre_race_evidence_ids.length,sealed_results:bundle.sealed_results.documents.length},states:Object.fromEntries(SUPPLY_STATES.map(s=>[s,bundle.analysis.runner_supplies.filter(r=>r.state===s).length])),prior_accepted_ledger:723,added_accepted:0,formal:false};
}
