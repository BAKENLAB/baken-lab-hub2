// Offline research only. Actual Work22 producer runs unchanged in a child process.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyzeTyped01to32} from './typed-01-32.mjs';
const dir=new URL('./work22-producer-pinned/',import.meta.url);
const pins={'stage22_probe.py':'c1761138bd9b9d6f4eb7eb53495a3fb5d590c724','stage22_handoff_probe.py':'e4c6c945c29f71091c6100adf43d196576bd1376','stage22-handoff-execution-summary.json':'dc19e4de9fb835b4510826346d351cd3000a0486'};
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const packetDigest=x=>sha(JSON.stringify(canon(x)));
const need=(ok,reason)=>{if(!ok)throw Error(reason)};
const shape=(x,keys)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(' ')===keys.split(' ').sort().join(' '),'SCHEMA');
const int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const ITEMS=[...Array.from({length:100},(_,i)=>'RANK'+String(i+1).padStart(2,'0')),...Array.from({length:15},(_,i)=>'EYE'+String(i+1).padStart(2,'0'))];
const prefix=(x,issuer)=>typeof x==='string'&&x.startsWith(issuer+':')&&/^[A-Z0-9:_-]+$/.test(x);
const packetBase='schema scope issuer event status formal_admissions formal_eligible evidence runners';
function itemsCheck(items,status,ids,reason){
 need(Array.isArray(items)&&items.length===115,'ITEM_COUNT');
 const seen=new Set();for(const i of items){
  shape(i,'item state reason evidence_ids analysis_consumed formal_usable');need(ITEMS.includes(i.item)&&!seen.has(i.item),'ITEM_ID');seen.add(i.item);
  const avail=status==='MISSING'&&i.item==='RANK05'&&ids.length>0;
  need(i.state===(avail?'TEST_INPUT_AVAILABLE':status)&&i.reason===(avail?null:reason)&&i.analysis_consumed===false&&i.formal_usable===false,'ITEM_STATE');
  need(Array.isArray(i.evidence_ids)&&JSON.stringify(i.evidence_ids)===JSON.stringify(avail?ids:[]),'ITEM_ROOTS');
 }
}
export function validateWorkPacket(p,expectedDigest){
 need(hex(expectedDigest)&&packetDigest(p)===expectedDigest,'PACKET_DIGEST_MISMATCH');
 need(p&&p.schema==='WORK22_SYNTHETIC_HANDOFF_0.1'&&p.scope==='SYNTHETIC_ONLY'&&p.formal_admissions===0&&p.formal_eligible===false,'SCOPE');
 need(['TEST:JRA','TEST:LOCAL'].includes(p.issuer)&&prefix(p.event,p.issuer),'ISSUER');
 need(Array.isArray(p.evidence)&&Array.isArray(p.runners),'ARRAY');
 if(p.status==='HELD'){
  shape(p,packetBase+' reason items');need(typeof p.reason==='string'&&p.reason.length>0&&!p.evidence.length&&!p.runners.length,'HELD_LEAK');itemsCheck(p.items,'HELD',[],p.reason);return true;
 }
 shape(p,packetBase+' selected_version latest_inventory_version cutoff analysis_at registry_sha');
 need(p.status==='TEST_ONLY_PACKET'&&int(p.selected_version,1)&&int(p.latest_inventory_version,p.selected_version)&&int(p.cutoff)&&int(p.analysis_at,p.cutoff)&&hex(p.registry_sha),'ENVELOPE');
 const byId=new Map(),byNo=new Set();for(const h of p.runners){shape(h,'id no status items');need(prefix(h.id,p.issuer)&&int(h.no,1)&&!byId.has(h.id)&&!byNo.has(h.no)&&['ACTIVE','CANCELLED','EXCLUDED'].includes(h.status),'ROSTER');byId.set(h.id,h);byNo.add(h.no);}
 need(byId.size>0,'ROSTER');
 const roots=new Set();for(const e of p.evidence){
  shape(e,'evidence_id root issuer subject_id current_event historical_event historical_no current_no source_version raw_sha256 hash_domain pointer field value unit historical_event_at published_at observed_at capture_end seal cutoff analysis_at identity_status permission_status registry_sequence registry_sha formal_usable');
  const h=byId.get(e.subject_id);need(h?.status==='ACTIVE'&&h.no===e.current_no&&e.issuer===p.issuer&&e.current_event===p.event&&prefix(e.historical_event,p.issuer)&&e.historical_event!==p.event&&int(e.historical_no,1),'EVIDENCE_IDENTITY');
  need(e.field==='finish_clock'&&e.unit==='0.1_second'&&int(e.value,1)&&e.source_version===p.selected_version,'FIELD_UNIT_VERSION');
  need(hex(e.raw_sha256)&&e.hash_domain==='RESPONSE_ENTITY_BYTES'&&/^\/rows\/(0|[1-9]\d*)\/historical\/(0|[1-9]\d*)\/ticks$/.test(e.pointer),'RAW_POINTER');
  const pointerRow=Number(e.pointer.split('/')[2]);need(p.runners[pointerRow]?.id===e.subject_id,'POINTER_ROSTER');
  const root='TEST:'+sha(JSON.stringify([e.issuer,e.historical_event,e.subject_id,e.historical_no,'finish_clock']));
  need(e.root===root&&e.evidence_id===root&&!roots.has(root),'ROOT_BINDING');roots.add(root);
  need([e.historical_event_at,e.published_at,e.observed_at,e.capture_end,e.seal,e.cutoff,e.analysis_at].every(x=>int(x))&&e.historical_event_at<e.published_at&&e.published_at<=e.observed_at&&e.observed_at<=e.capture_end&&e.capture_end<=e.seal&&e.seal<=e.cutoff&&e.cutoff===p.cutoff&&e.analysis_at===p.analysis_at,'TIME');
  need(e.identity_status==='SYNTHETIC_SAME_ISSUER_ONLY'&&e.permission_status==='TEST_ONLY_LATEST_REGISTRY'&&int(e.registry_sequence,1)&&e.registry_sha===p.registry_sha&&e.formal_usable===false,'RIGHTS_RECEIPT');
 }
 for(const h of p.runners){const ids=p.evidence.filter(e=>e.subject_id===h.id).map(e=>e.evidence_id),active=h.status==='ACTIVE';itemsCheck(h.items,active?'MISSING':'NOT_APPLICABLE',ids,active?(ids.length?'REQUIRED_MATERIAL_NOT_PROVIDED':'NO_FINISHED_CLOCK'):'NOT_ACTIVE');}
 return true;
}
export function consumeWorkPacket(p,expectedDigest){
 try{validateWorkPacket(p,expectedDigest)}catch(e){return {status:'REJECTED',reason:e.message,observations:[],runners:[],formal:false,grade:null,comparison:null};}
 if(p.status==='HELD')return {status:'HELD',reason:p.reason,items:p.items.map(x=>({...x})),observations:[],runners:[],formal:false,grade:null,comparison:null};
 const active=p.runners.filter(h=>h.status==='ACTIVE'),roster=active.map(h=>({horse_id:h.id,horse_no:h.no})),trace=[];
 const accepted=p.evidence.map(e=>({fixture_only:true,formal_admission:false,event_key:e.root,evidence_ids:[e.evidence_id],record:{official_evidence:false,work22_validated_partial:true,kind:'WORK22_FINISH_CLOCK',horse_id:e.subject_id,race_id:e.historical_event,fact:{clock_tenths:e.value,unit:e.unit}}}));
 // No CURRENT_CARD or RESULT synthesized; existing 01-32 shared kernel runs on a partial input.
 const typed=analyzeTyped01to32({target:{circuit:'FIXTURE',race_id:p.event},roster,intake:{fixture_only:true,accepted},traceRead:x=>trace.push(x)});
 const runners=p.runners.map(h=>{
  const found=typed.find(x=>x.horse_id===h.id),observations=found?.items['05'].observations??[];
  const consumed=observations.flatMap(o=>o.evidence_ids);
  need(consumed.length===p.evidence.filter(e=>e.subject_id===h.id).length,'CONSUMPTION_COUNT');
  if(found)need(Object.entries(found.items).every(([id,x])=>id==='05'||x.observations.length===0),'UNRELATED_OUTPUT');
  return {id:h.id,no:h.no,status:h.status,items:h.items.map(i=>({...i,analysis_consumed:i.item==='RANK05'&&consumed.length>0,consumed_roots:i.item==='RANK05'?consumed:[],semantic_scope:i.item==='RANK05'&&consumed.length?'DISPLAY_CLOCK_OBSERVATION_ONLY':null,individual_effect_proven:false})),observations,grade:null,WIN:null,PLACE:null};
 });
 return {status:'RESEARCH_PARTIAL_OBSERVATIONS',packet_digest:expectedDigest,runners,observations:runners.flatMap(h=>h.observations),trace,formal:false,grade:null,comparison:null,missing_context:['FINISH','DISTANCE','COURSE','GOING','CLASS','WEIGHT','OPPONENTS','BASELINE'],evaluation_policy:'SABC_ONLY_NO_ASSIGNMENT'};
}
export function runActualWorkProducer(){
 for(const [name,pin] of Object.entries(pins))need(blob(readFileSync(new URL(name,dir)))===pin,'PRODUCER_BLOB_MISMATCH:'+name);
 const bytes=execFileSync('python3',[fileURLToPath(new URL('stage22_handoff_probe.py',dir))],{timeout:90000,maxBuffer:4*1024*1024});
 const out=JSON.parse(bytes.toString('utf8')),summary=JSON.parse(readFileSync(new URL('stage22-handoff-execution-summary.json',dir),'utf8'));
 need(out.scope==='SYNTHETIC_ONLY'&&out.formal_admissions===0&&out.total===25&&out.passed===25&&out.tests.every(x=>x.pass_===true&&x.expected===x.actual),'PRODUCER_TEST_FAILURE');
 need(packetDigest(out.tests)===packetDigest(summary.tests),'PRODUCER_TEST_DRIFT');
 // Exact saved Work evidence values and statuses are compared against the full reproducible output.
 for(const [name,p] of Object.entries(out.examples)){
  const s=summary.examples[name];need(s&&p.status===s.status&&p.issuer===s.issuer&&p.event===s.event&&packetDigest(p.evidence)===packetDigest(s.evidence),'PRODUCER_EXAMPLE_DRIFT:'+name);
  need(p.runners.length===s.runners.length&&p.runners.every((h,j)=>h.id===s.runners[j].id&&h.no===s.runners[j].no&&h.status===s.runners[j].status),'PRODUCER_ROSTER_DRIFT:'+name);
  if(p.status==='HELD')need(p.reason===s.reason&&p.items.length===s.global_held_items,'PRODUCER_HELD_DRIFT');
 }
 return {examples:out.examples,digests:Object.fromEntries(Object.entries(out.examples).map(([k,p])=>[k,packetDigest(p)])),producer_tests:out.passed,stdout_sha256:sha(bytes),source_pins:pins,trust:'LOCAL_REPRODUCTION_ONLY'};
}
export {packetDigest};
