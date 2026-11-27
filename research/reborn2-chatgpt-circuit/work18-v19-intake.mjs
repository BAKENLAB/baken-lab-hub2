import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {analyzeV19} from './field-interaction-v19.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pins={
 'stage18-replay-blocker-and-input-contract-v1.6.json':'8cb3025742180418f62233faa20f5cd0dcc7884a',
 'stage18-card-discrepancy-audit-v1.6.json':'8d9c43d4ea80083fa43f1adb731bf27ec5a94bd1',
 'stage18-local-candidate-audit-v1.6.json':'b458ffe68854edec38e021481cdf16a4de49fa45'
};
const require=(b,m)=>{if(!b)throw Error(m);};
export function readWork18(){return Object.fromEntries(Object.entries(pins).map(([name,expected])=>{const b=readFileSync(new URL('./work18-pinned/'+name,import.meta.url));const actual=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');require(actual===expected,'WORK18_BLOB');return [name,JSON.parse(b)];}));}
export function inspectWork18(files){
 const [c,d,l]=Object.keys(pins).map(k=>files[k]);
 const i=c.codex_intake,rows=i.runners.flatMap(h=>h.history_rows),cards=d.rows,receipts=c.card_capture_audit.records;
 const counts=Object.fromEntries([...new Set(cards.map(x=>x.status))].map(s=>[s,cards.filter(x=>x.status===s).length]));
 require(c.formal_admissions===0&&c.permission==='NOT_CLEARED'&&i.diagnostic_only&&i.eligible_values.length===0&&d.formal_admissions===0&&!l.formal_eligible,'WORK18_SCOPE');
 require(i.runners.length===18&&new Set(i.runners.map(x=>x.horse_id_candidate)).size===18&&rows.length===147&&new Set(rows.map(x=>x.row_id)).size===147&&rows.every(x=>x.observation_values===null&&!x.eligible&&x.publication_at===null),'WORK18_HISTORY');
 require(cards.length===69&&cards.every(x=>!x.formal_usable&&x.publication_at===null)&&counts.EXACT_ID_NUMBER_FINISH_CLOCK_CANDIDATE===43&&counts.ARCHIVE_EVENT_ABSENT===16&&counts.RUNNER_ID_NUMBER_OR_RESULT_CONFLICT===5&&counts.CROSS_CIRCUIT_NATIVE_LINK_REQUIRED===3&&counts.TRANSFER_EVENT_NOT_RACE===1&&counts.NONNUMERIC_OR_MISSING_RESULT===1,'WORK18_CARD');
 require(receipts.length===18&&new Set(receipts.map(x=>x.html_sha256)).size===18&&receipts.every(x=>x.both_prestart)&&receipts.filter(x=>x.official_status_verified).length===1&&receipts.find(x=>x.official_status_verified).id===3647&&!c.card_capture_audit.raw_bytes_recovered,'WORK18_RECEIPTS');
 require(c.prior_gates.groups===118&&c.prior_gates.flags===826&&c.prior_gates.all_false&&l.distinct_races===44&&l.all_runner_witness_races===23&&l.prestart_card_fetch_races===0&&!l.saga8.card_fetch_prestart,'WORK18_GATES');
 require(i.runners.every(h=>h.card_history_status.every(s=>cards.some(r=>r.no===h.current_no&&r.ord===s.ordinal&&r.status===s.status))),'WORK18_JOIN');
 return {runners:i.runners.length,histories:rows.length,card:cards.length,counts,prestart_receipts:receipts.length,status_witness:3647,raw_bytes:false,local_reported_races:l.distinct_races,local_reported_allrunner:l.all_runner_witness_races,local_reported_prestart_card:0,eligible_values:[],formal_admissions:0,required_fields:i.record_required_fields,scope:'DIAGNOSTIC_ONLY'};
}
const fields=['issuer','subject_id','target_race','historical_event','source_row_id','source_version','source_url','source_digest','observed_at','published_at_or_immutable_prestart_witness','valid_from','valid_until','correction_chain','evidence_kind','observations','permission_scope','missing_fields'];
const at=(d,t)=>d+'T'+t+':00+09:00';
const finite=x=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const market=o=>o&&typeof o==='object'&&Object.entries(o).some(([k,v])=>/odds|popularity|market|ninki|tansho|target_result/i.test(k)||market(v));
function record(target,kind,subject,event,obs,time,id){
 return {issuer:'FIXTURE_TEST_ONLY',subject_id:subject,target_race:target.id,historical_event:event,source_row_id:id,source_version:'fixture-v19-v1',source_url:'https://fixture.invalid/'+encodeURIComponent(id),source_digest:sha(obs),observed_at:time,published_at_or_immutable_prestart_witness:time,valid_from:time,valid_until:at(target.date,target.start),correction_chain:[],evidence_kind:kind,observations:obs,permission_scope:'SYNTHETIC_TEST_ONLY',missing_fields:[],fixture_only:true,official_evidence:false,formal_admission:false};
}
export function makeFixtureEnvelope(p){
 const t=p.target,meta={...t};delete meta.entrants;
 const records=[record(t,'TARGET_META',null,null,{packet_id:p.id,target:meta},at(t.date,t.published),'target:'+t.id)];
 for(const h of t.entrants)records.push(record(t,'CURRENT_CARD',h.id,null,h,at(t.date,t.published),'card:'+h.id));
 for(const r of p.history){const m={...r};delete m.rows;const time=at(r.date,r.published);
 records.push(record(t,'HISTORICAL_RACE',null,r.id,m,time,'race:'+r.id));
 for(const h of r.rows)records.push(record(t,'HISTORICAL_RESULT',h.id,r.id,h,time,'result:'+r.id+':'+h.id));}
 return {schema:'evidence-v1',scope:'FIXTURE_TEST_ONLY',formal_admissions:0,records};
}
export function routeFixtureEnvelope(envelope,{required_fields=fields,disabled=[]}={}){
 require(envelope.schema==='evidence-v1'&&envelope.scope==='FIXTURE_TEST_ONLY'&&envelope.formal_admissions===0&&Array.isArray(envelope.records)&&!market(envelope),'TEST_SCOPE');
 const a=envelope.records,meta=a.filter(x=>x.evidence_kind==='TARGET_META');
 require(meta.length===1,'TARGET_META');
 const {packet_id,target:t}=meta[0].observations,cut=Date.parse(at(t.date,t.published)),start=Date.parse(at(t.date,t.start));
 require(/^FK-/.test(t.id)&&cut<start,'TARGET_TIME');
 const ids=new Set();
 for(const r of a){
  require(fields.every(k=>Object.hasOwn(r,k))&&required_fields.every(k=>Object.hasOwn(r,k)),'MISSING_FIELD');
  require(r.issuer==='FIXTURE_TEST_ONLY'&&r.fixture_only===true&&r.official_evidence===false&&r.formal_admission===false&&r.permission_scope==='SYNTHETIC_TEST_ONLY'&&r.target_race===t.id&&r.source_url==='https://fixture.invalid/'+encodeURIComponent(r.source_row_id)&&r.source_version==='fixture-v19-v1','TEST_PROVENANCE');
  require(!ids.has(r.source_row_id)&&r.source_digest===sha(r.observations)&&Array.isArray(r.correction_chain)&&r.correction_chain.length===0&&Array.isArray(r.missing_fields)&&r.missing_fields.length===0,'ROOT_OR_DIGEST');ids.add(r.source_row_id);
  const pub=r.published_at_or_immutable_prestart_witness;
  require([pub,r.observed_at,r.valid_from,r.valid_until].every(finite)&&Date.parse(pub)<=Date.parse(r.observed_at)&&Date.parse(r.observed_at)<=cut&&Date.parse(r.valid_from)<=cut&&cut<Date.parse(r.valid_until),'ASOF');
  require(['TARGET_META','CURRENT_CARD','HISTORICAL_RACE','HISTORICAL_RESULT'].includes(r.evidence_kind),'KIND');
  if(r.evidence_kind.startsWith('HISTORICAL'))require(r.historical_event!==t.id&&typeof r.historical_event==='string'&&r.historical_event.startsWith('FK-'),'TARGET_RESULT');
 }
 const cards=a.filter(x=>x.evidence_kind==='CURRENT_CARD'),race=a.filter(x=>x.evidence_kind==='HISTORICAL_RACE'),results=a.filter(x=>x.evidence_kind==='HISTORICAL_RESULT');
 require(meta[0].subject_id===null&&meta[0].historical_event===null&&cards.every(r=>r.historical_event===null&&r.subject_id===r.observations.id&&r.source_row_id==='card:'+r.subject_id),'CARD_BIND');
 require(race.every(r=>r.subject_id===null&&r.historical_event===r.observations.id&&r.source_row_id==='race:'+r.historical_event&&Date.parse(at(r.observations.date,r.observations.published))===Date.parse(r.published_at_or_immutable_prestart_witness)),'RACE_BIND');
 require(results.every(r=>r.subject_id===r.observations.id&&r.source_row_id==='result:'+r.historical_event+':'+r.subject_id&&race.some(q=>q.historical_event===r.historical_event&&q.published_at_or_immutable_prestart_witness===r.published_at_or_immutable_prestart_witness)),'RESULT_BIND');
 const p={id:packet_id,target:{...t,entrants:cards.map(x=>x.observations)},history:race.map(x=>({...x.observations,rows:results.filter(r=>r.historical_event===x.historical_event).map(r=>r.observations)}))};
 const result=analyzeV19(p,{disabled});
 return {accepted_test_records:a.length,analysis:result,formal_admissions:0,official_replay_eligible:0,scope:'FIXTURE_TEST_ONLY'};
}
