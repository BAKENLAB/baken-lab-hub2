// V24 isolated research: exact pinned Work23 producer payloads, never official intake.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {work23} from './work23-pinned/stage23-producer-v0.2.2.mjs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
const dir=new URL('./work23-pinned/',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const need=(v,why)=>{if(!v)throw Error(why)};
const read=n=>readFileSync(new URL(n,dir));
const parse=b=>JSON.parse(b.toString('utf8'));
const unique=xs=>[...new Set(xs)];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ids=[...Array.from({length:100},(_,i)=>'RANK'+String(i+1).padStart(2,'0')),...Array.from({length:15},(_,i)=>'EYE'+String(i+1).padStart(2,'0'))];
const fields={finish:'02',margin_to_winner:'03',margin_to_next:'04',finish_clock:'05',individual_final3f:'06',checkpoint_positions:'17',race_leader_laps:'19'};
const validState=new Set(['TEST_INPUT_AVAILABLE','MISSING','HELD','REJECTED','NOT_APPLICABLE']);
const int=x=>Number.isSafeInteger(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const bind=(p,e)=>{const no=e.event_role==='CURRENT_CARD'?e.current_no:e.historical_no;const root='TESTROOT:'+sha(JSON.stringify([e.issuer,e.event_id,e.subject_id,no,e.field]));return root===e.root&&e.evidence_id==='TESTEV:'+sha(JSON.stringify([root,e.source_version,e.raw_sha256,e.pointer]));};
function validate(p,x,reproduced,bytes){
 need(blob(bytes)===x.blob&&sha(bytes)===x.sha256&&bytes.length===x.bytes,'PACKET_BYTES:'+x.name);
 // Exact deterministic producer bytes include pointer, raw, identity, timing, version, rights and state checks.
 // This deliberately does not certify independent real-world custody or arbitrary external transport.
 need(bytes.equals(Buffer.from(JSON.stringify(reproduced)+'\n')),'PRODUCER_REPLAY:'+x.name);
 need(p.schema==='WORK23_SYNTHETIC_HANDOFF_0.2'&&p.scope==='SYNTHETIC_ONLY'&&p.status===x.status&&p.formal_admissions===0&&p.formal_eligible===false&&p.official_group_id===null,'PACKET_SCOPE');
 const checkItems=(items,active)=>{need(items.length===115&&unique(items.map(i=>i.item)).length===115&&items.every(i=>ids.includes(i.item)&&validState.has(i.state)&&i.formal_usable===false&&i.analysis_consumed===false&&i.evidence_ids.every(k=>byId.has(k))&&(i.unavailable_field_ids??[]).every(k=>states.has(k)&&states.get(k).state!=='TEST_INPUT_AVAILABLE')&&(active||i.evidence_ids.length===0)),'ITEM_BINDING');};
 const byId=new Map(p.evidence.map(e=>[e.evidence_id,e])),states=new Map(p.field_states.map(e=>[e.evidence_id,e]));
 need(byId.size===p.evidence.length&&states.size===p.field_states.length&&unique(p.evidence.map(e=>e.root)).length===p.evidence.length,'DUPLICATE');
 if(p.status==='HELD'){need(!p.evidence.length&&!p.field_states.length&&!p.runners.length,'HELD_LEAK');checkItems(p.items,false);return;}
 need(['TEST:JRA','TEST:LOCAL'].includes(p.issuer)&&p.event.startsWith(p.issuer+':')&&int(p.selected_version)&&int(p.latest_inventory_version)&&p.latest_inventory_version>=p.selected_version&&p.cutoff<=p.analysis_at&&hex(p.registry_sha)&&hex(p.selected_receipt_sha),'ENVELOPE');
 const roster=new Map(p.runners.map(h=>[h.id,h]));
 need(roster.size===p.runners.length&&unique(p.runners.map(h=>h.no)).length===p.runners.length,'ROSTER');
 for(const e of p.evidence){
  need(equal(states.get(e.evidence_id),e)&&bind(p,e)&&e.state==='TEST_INPUT_AVAILABLE'&&e.value!==null&&e.formal_usable===false&&e.issuer===p.issuer&&e.current_event===p.event&&e.source_version===p.selected_version&&e.registry_sha===p.registry_sha&&e.registry_sequence===p.registry_sequence&&e.cutoff===p.cutoff&&e.analysis_at===p.analysis_at&&hex(e.raw_sha256)&&e.hash_domain==='RESPONSE_ENTITY_BYTES'&&e.identity_status==='SYNTHETIC_SAME_ISSUER_ONLY'&&e.permission_status==='TEST_ONLY_LATEST_REGISTRY','EVIDENCE_BINDING');
  need([e.event_at,e.published_at,e.observed_at,e.capture_start,e.capture_end,e.seal_at,e.uncertainty].every(int)&&e.published_at<=e.observed_at&&e.capture_start<=e.capture_end&&e.capture_end<=e.seal_at&&e.seal_at+e.uncertainty<=p.cutoff,'EVIDENCE_TIME');
  need(e.event_role==='CURRENT_CARD'?e.event_id===p.event&&e.event_at>p.cutoff&&e.pointer.startsWith('/target/'):['HISTORICAL_RACE','HISTORICAL_RUNNER'].includes(e.event_role)&&e.event_id!==p.event&&e.event_at<e.published_at&&e.event_at<p.cutoff&&e.pointer.startsWith('/history/'),'EVENT_SCOPE');
  if(e.event_role==='HISTORICAL_RUNNER'){need(p.evidence.some(q=>q.field==='historical_runner_identity'&&q.subject_id===e.subject_id&&q.event_id===e.event_id&&q.historical_no===e.historical_no&&q.value===e.subject_id),'HISTORICAL_IDENTITY');}
  if(e.current_no!==null)need(roster.get(e.subject_id)?.no===e.current_no,'CURRENT_NUMBER');
 }
 for(const s of p.field_states)need(validState.has(s.state)&&(s.state==='TEST_INPUT_AVAILABLE'?byId.has(s.evidence_id):!byId.has(s.evidence_id)&&s.value===null),'STATE_LEAK');
 for(const h of p.runners){need(h.id.startsWith(p.issuer+':')&&['ACTIVE','CANCELLED','EXCLUDED'].includes(h.status),'RUNNER_SCOPE');checkItems(h.items,h.status==='ACTIVE');}
 for(const r of p.relations)need(r.formal_usable===false&&r.evidence_ids.every(k=>byId.has(k)),'RELATION_BINDING');
}
export function loadWork23(){
 const indexBytes=read('stage23-final-handoff-v0.2.2.json');
 need(blob(indexBytes)==='b01a41e432399cc5de9fd9c569652fc39230db62','INDEX_PIN');
 const index=parse(indexBytes);need(index.schema==='WORK23_FINAL_HANDOFF_0.2.2'&&index.producer_version==='0.2.2'&&index.packet_schema==='WORK23_SYNTHETIC_HANDOFF_0.2'&&index.packet_index.length===12&&unique(index.packet_index.map(x=>x.name)).length===12,'INDEX_SCHEMA');
 for(const pin of index.source_pins){const b=read(pin.name);need(blob(b)===pin.blob&&(!pin.sha256||sha(b)===pin.sha256),'SOURCE_PIN:'+pin.name);}
 const out=work23(parse(read('stage22-custody-to-115-contract-v0.1.json')).items,parse(read('stage22-handoff-execution-summary.json')).examples);
 need(out.tests.length===30&&out.tests.every(t=>t.pass===true),'WORK23_PRODUCER_TESTS');
 const packets=new Map();for(const x of index.packet_index){const b=read(x.path.split('/').at(-1));const p=parse(b);validate(p,x,out.packets[x.name],b);packets.set(x.name,{p,pin:x});}
 return {packets,producerTests:out.tests.map(t=>t.name),indexBlob:blob(indexBytes)};
}
// Intervention views are research-only and never replace indexed bytes or create authenticated evidence.
export function analyzeWork23(loaded,name,intervention=null){
 const entry=loaded.packets.get(name);need(entry,'UNKNOWN_PACKET');const p=entry.p;
 if(p.status==='HELD')return {name,status:'HELD',reason:p.reason,items:p.items,runners:[],trace:[],comparisons:[],formal:false,grade:null};
 const active=p.runners.filter(h=>h.status==='ACTIVE'),trace=[],reads=[],view=p.evidence.flatMap(e=>{
  if(intervention?.evidence_id!==e.evidence_id)return [e];
  if(intervention.mode==='WITHHOLD')return [];
  need(intervention.mode==='SYNTHETIC_FINAL3F_CHANGE'&&e.field==='individual_final3f'&&int(intervention.value)&&intervention.value>0,'INTERVENTION_SCOPE');
  return [{...e,value:intervention.value}];
 });
 const find=(ev,sub,f)=>view.find(e=>e.event_id===ev&&e.subject_id===sub&&e.field===f);
 const note=(consumer,es)=>{const used=es.filter(Boolean);reads.push({consumer,evidence_ids:unique(used.map(e=>e.evidence_id)),roots:unique(used.map(e=>e.root))});return used;};
 const groups=[];
 for(const h of active){
  const history=unique(view.filter(e=>e.subject_id===h.id&&e.field==='historical_runner_identity').map(e=>e.event_id));
  for(const ev of history){
   for(const f of Object.keys(fields)){
    const e=find(ev,f==='race_leader_laps'?null:h.id,f);if(!e)continue;
    const identity=find(ev,h.id,'historical_runner_identity'),geometry=f==='checkpoint_positions'?find(ev,null,'course_geometry'):null;
    if(!identity||f==='checkpoint_positions'&&!geometry)continue;
    const deps=[e,identity,...(geometry?[geometry]:[])];
    groups.push({fixture_only:true,formal_admission:false,event_key:e.root,evidence_ids:deps.map(z=>z.evidence_id),record:{kind:'WORK23_TYPED_FIELD',official_evidence:false,work23_validated_partial:true,horse_id:h.id,race_id:ev,roots:deps.map(z=>z.root),fact:{field:f,unit:e.unit,value:e.value,...(geometry?{checkpoints_m:geometry.value.checkpoints_m}:{})}}});
   }
  }
 }
 const typed=analyzeTyped01to32({target:{circuit:'FIXTURE',race_id:p.event,work23_partial:true},roster:active.map(h=>({horse_id:h.id,horse_no:h.no})),intake:{fixture_only:true,accepted:groups},traceRead:t=>trace.push(t)});
 const comparison=[],seen=new Set();
 const obs=(h,ev,id)=>typed.find(t=>t.horse_id===h)?.items[id]?.observations.find(o=>o.value.race_id===ev);
 const measurement=(h,ev,id)=>obs(h,ev,id)?.value.measurement??null;
 const recordObs=(label,os)=>{const evidenceIds=unique(os.filter(Boolean).flatMap(o=>o.evidence_ids));note(label,evidenceIds.map(k=>view.find(e=>e.evidence_id===k)));};
 const context=(h,ev)=>{
  const old=find(ev,null,'conditions'),now=find(p.event,null,'conditions'),og=find(ev,null,'course_geometry'),ng=find(p.event,null,'course_geometry'),ow=find(ev,h,'weight'),nw=find(p.event,h,'weight');
  note('CURRENT_CONDITION:'+h+':'+ev,[old,now,og,ng,ow,nw]);
  const keys=['venue','surface','distance_m','going','direction','class_id'];
  const changed=old&&now?keys.filter(k=>old.value[k]!==now.value[k]):null;
  return {changed,geometry_same:og&&ng?equal(og.value,ng.value):null,weight_delta_grams:ow&&nw?nw.value-ow.value:null};
 };
 for(const r of p.relations.filter(r=>r.type==='DIRECT_CURRENT_RIVALS')){
  const pair=[r.subject_id,r.opponent_id].sort(),ev=r.reference_event,key=JSON.stringify([ev,pair]);if(seen.has(key)||!pair.every(h=>active.some(a=>a.id===h)))continue;seen.add(key);
  if(!r.evidence_ids.every(k=>view.some(e=>e.evidence_id===k)))continue;
  const [a,b]=pair,af=measurement(a,ev,'02'),bf=measurement(b,ev,'02'),ac=measurement(a,ev,'05'),bc=measurement(b,ev,'05'),as=measurement(a,ev,'06'),bs=measurement(b,ev,'06'),ap=measurement(a,ev,'17'),bp=measurement(b,ev,'17'),lap=measurement(a,ev,'19');
  recordObs('DIRECT:'+ev,[...pair.flatMap(h=>['02','03','04','05','06','17','19'].map(id=>obs(h,ev,id)))]);
  note('DIRECT_RELATION:'+ev,r.evidence_ids.map(k=>view.find(e=>e.evidence_id===k)));
  const directReads=unique([...pair.flatMap(h=>['02','03','04','05','06','17','19'].flatMap(id=>obs(h,ev,id)?.evidence_ids??[])),...r.evidence_ids]);
  const ctx=pair.map(h=>context(h,ev)),pastOrder=af===null||bf===null?null:af<bf?a:bf<af?b:null;
  const fasterFinal=as===null||bs===null?null:as<bs?a:bs<as?b:null;
  const contextKnown=ctx.every(c=>c.changed!==null&&c.changed.length===0&&c.geometry_same===true&&c.weight_delta_grams!==null);
  comparison.push({event:ev,pair,finish:[af,bf],clock_gap_b_minus_a_tenths:ac===null||bc===null?null:bc-ac,final3f_gap_b_minus_a_tenths:as===null||bs===null?null:bs-as,past_order_support:pastOrder,final3f_support:fasterFinal,position_ranks:[ap,bp],leader_laps:lap,conditions:ctx,contextKnown,
   relative_history:pastOrder===null?'UNKNOWN':fasterFinal===null?'ORDER_ONLY_FINAL3F_UNKNOWN':pastOrder===fasterFinal?'ORDER_AND_FINAL3F_AGREE':'ORDER_AND_FINAL3F_NOT_ALIGNED',
   current_head_to_head:'UNRESOLVED',individual_checkpoint_clocks:null,pressure_causality:null,WIN:null,PLACE:null});
  const value=comparison.at(-1),used=note('RANK35_DIRECT',directReads.map(k=>view.find(e=>e.evidence_id===k)));
  for(const h of active.filter(z=>pair.includes(z.id)))trace.push({consumer:'work23.directComparison',consumer_item_id:'35',horse_no:h.no,item_id:'35',value,evidence_ids:unique(used.map(e=>e.evidence_id)),roots:unique(used.map(e=>e.root))});
 }
 // Distinct-event common peer: compare measured peer profiles, never chain margins.
 const indirect=[];
 const profile=(ev,h)=>{
  const es=['historical_runner_identity','finish','finish_clock','individual_final3f','checkpoint_positions','weight'].map(f=>find(ev,h,f));
  const [identity,finish,clock,final3f,position,weight]=es;
  return {es,identity:identity?.value??null,finish:finish?.value??null,clock:clock?.value??null,final3f:final3f?.value??null,position:position?.value??null,weight:weight?.value??null};
 };
 for(const r of p.relations.filter(r=>r.type==='COMMON_OPPONENT_DIFFERENT_EVENTS')){
  const hs=[r.subject_id,r.other_subject_id],evs=[r.reference_event,r.followup_event],peer=r.opponent_id;
  if(evs[0]===evs[1]||!hs.every(h=>active.some(a=>a.id===h))||!r.evidence_ids.every(k=>view.some(e=>e.evidence_id===k)))continue;
  const own=evs.map((ev,i)=>profile(ev,hs[i])),peers=evs.map(ev=>profile(ev,peer)),cs=evs.map(ev=>find(ev,null,'conditions')),gs=evs.map(ev=>find(ev,null,'course_geometry')),ls=evs.map(ev=>find(ev,null,'race_leader_laps'));
  const keys=['venue','surface','distance_m','going','direction','class_id'],scope=cs.every(Boolean)&&gs.every(Boolean)?keys.filter(k=>cs[0].value[k]!==cs[1].value[k]).concat(equal(gs[0].value,gs[1].value)?[]:['geometry']):null;
  const measured=['finish','clock','final3f','position','weight'],known=peers.every(q=>measured.every(k=>q[k]!==null)),changes=known?measured.filter(k=>!equal(peers[0][k],peers[1][k])):null;
  const used=note('RANK36_COMMON_PEER',[...own.flatMap(z=>z.es),...peers.flatMap(z=>z.es),...cs,...gs,...ls,...r.evidence_ids.map(k=>view.find(e=>e.evidence_id===k))]);
  const out={horses:hs,events:evs,peer,scope_differences:scope,relative_clock_gaps:own.map((z,i)=>z.clock===null||peers[i].clock===null?null:z.clock-peers[i].clock),relative_weight_grams:own.map((z,i)=>z.weight===null||peers[i].weight===null?null:z.weight-peers[i].weight),peer_profiles:peers.map(({es,...z})=>z),leader_laps:ls.map(e=>e?.value??null),measured_peer_changes:changes,state:changes===null?'PEER_PROFILE_INCOMPLETE':changes.length?'PEER_PROFILE_DIFFERS':'PEER_MEASURED_PROFILE_MATCH_ONLY',inferred_current_order:null,combined_margin:null,peer_strength:null,roots:unique(used.map(e=>e.root))};
  indirect.push(out);
  for(const h of active.filter(z=>hs.includes(z.id)))trace.push({consumer:'work23.indirectPeer',consumer_item_id:'36',horse_no:h.no,item_id:'36',value:out,evidence_ids:unique(used.map(e=>e.evidence_id)),roots:out.roots});
 }
 // EYE04 review: a measured loss followed by actual prior-cutoff opponent finish.
 // No margin threshold, strong-opponent inference, automatic promotion or independent vote.
 const eye=[];
 for(const r of p.relations.filter(r=>r.type==='OPPONENT_LATER_PRIOR_TO_CUTOFF')){
  const h=r.subject_id,ev=r.reference_event,peer=r.opponent_id,next=r.followup_event;
  if(!active.some(a=>a.id===h)||!r.evidence_ids.every(k=>view.some(e=>e.evidence_id===k)))continue;
  const self=find(ev,h,'finish'),opp=find(ev,peer,'finish'),margin=find(ev,h,'margin_to_winner'),later=find(next,peer,'finish'),c1=find(ev,null,'conditions'),c2=find(next,null,'conditions');
  if(!self||!opp||!margin||!later||opp.value!==1||self.value<=1)continue;
  const es=note('EYE04_CONTEXT_REVIEW',[self,opp,margin,later,c1,c2,...r.evidence_ids.map(k=>view.find(e=>e.evidence_id===k))]);
  const matched=c1&&c2?['venue','surface','distance_m','going','direction','class_id'].every(k=>c1.value[k]===c2.value[k]):null;
  eye.push({horse:h,opponent:peer,event:ev,followup:next,margin:margin.value,later_finish:later.value,condition_match:matched,observed_later_win:later.value===1,roots:unique(es.map(e=>e.root)),state:'REVIEW_ONLY_STRENGTH_AND_NARROWNESS_UNPROVEN',return_to_grade:false});
  trace.push({consumer:'work23.laterOpponentContext',consumer_item_id:'37',horse_no:active.find(z=>z.id===h).no,item_id:'37',value:eye.at(-1),evidence_ids:unique(es.map(e=>e.evidence_id)),roots:unique(es.map(e=>e.root))});
 }
 const runners=p.runners.map(h=>{const t=typed.find(z=>z.horse_id===h.id);return {id:h.id,no:h.no,status:h.status,grade:null,WIN:null,PLACE:null,items:h.items.map(i=>{
  const os=t?.items[i.item.slice(4)]?.observations??[],tr=i.item.startsWith('RANK')?trace.filter(x=>x.horse_no===h.no&&'RANK'+x.item_id===i.item):[];
  const used=unique(tr.flatMap(x=>x.evidence_ids));
  return {item:i.item,material_state:i.state,unavailable_field_ids:i.unavailable_field_ids??[],runtime_read:used.length>0,consumed_evidence_ids:used,stable_roots:unique(tr.flatMap(x=>x.roots)),observations:tr.length?(os.length?os:tr.map(x=>({kind:x.consumer,value:x.value,evidence_ids:x.evidence_ids,original_event_keys:x.roots}))):[],semantic_effect_proven:false,grade_effect_proven:false};
 })};});
 return {name,status:'RESEARCH_PARTIAL',source_sha256:entry.pin.sha256,intervention:intervention?{...intervention,scope:'SYNTHETIC_VIEW_NOT_AUTHENTICATED'}:null,runners,trace,reads,comparisons:comparison,indirect,eye04:eye,eye14:'HELD_NO_VALIDATED_CLASS_WEAKENING',eye15:'HELD_NO_INDEPENDENT_COMBINED_IMPROVEMENT',field_interaction:'PAST_HEAD_TO_HEAD_ONLY_CURRENT_PACE_UNRESOLVED',formal:false,grade:null};
}
