// V26 additive synthetic research only. Never used in production or formal SABC.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadWork23} from './work23-v24-bridge.mjs';
import {analyzeCurrentV25} from './work23-v25-current.mjs';
import {work23} from './work23-pinned/stage23-producer-v0.2.2.mjs';
import {work24} from './work25-pinned/stage24-supplement-producer-v0.1.1.mjs';
import {project} from './work25-pinned/stage25-pace-projection-v0.1.mjs';
const dir=new URL('./work25-pinned/',import.meta.url);
const read=path=>readFileSync(new URL(path.split('/').at(-1),dir));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const parse=b=>JSON.parse(b.toString('utf8'));
const need=(x,m)=>{if(!x)throw Error(m)};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const uniq=a=>[...new Set(a)];
const pinEq=(a,b)=>['ref','path','blob','sha256'].every(k=>a[k]===b[k]);
const verify=pin=>{const b=read(pin.path);need(blob(b)===pin.blob&&(!pin.sha256||sha(b)===pin.sha256)&&(!pin.bytes||b.length===pin.bytes),'PIN:'+pin.path);return b};
const resolve=(o,p)=>p.split('/').slice(1).reduce((v,k)=>v?.[k],o);
export const effective=(interval,t)=>Array.isArray(interval)&&interval.length===2&&Number.isFinite(t)&&interval[0]<=t&&t<interval[1];
export function loadV26(){
 const parent=loadWork23();
 const a=read('stage24-final-handoff-v0.1.1.json'),b=read('stage25-final-handoff-v0.1.json');
 need(blob(a)==='378927b5a439e8d6073ae8c1088c210dc1b13b4e'&&blob(b)==='ec02ebaed188a658b8da868e6b28c56c2fde4547','INDEX_PINS');
 const w24=parse(a),w25=parse(b);
 need(w24.schema==='WORK24_FINAL_HANDOFF_0.1.1'&&w25.schema==='WORK25_FINAL_HANDOFF_0.1'&&w24.parent_index.blob===parent.indexBlob&&w25.parent_index.blob===blob(a)&&w24.packet_index.length===12&&w25.packets.length===12,'INDEX_BINDING');
 for(const x of [...w24.source_pins,...w25.receipts,w25.projection])verify(x);
 const canonical=parse(read('stage22-custody-to-115-contract-v0.1.json')).items;
 const replay=work23(canonical,parse(read('stage22-handoff-execution-summary.json')).examples);
 need(replay.tests.length===30&&replay.tests.every(t=>t.pass),'PRODUCER23');
 const receipts=new Map(w25.receipts.map(x=>[x.path,{pin:x,data:parse(verify(x))}]));
 const packets=new Map();
 for(const x of w24.packet_index){
  const old=parent.packets.get(x.name),y=w25.packets.find(z=>z.name===x.name);
  need(old&&y&&pinEq(old.pin,x.original)&&pinEq(y.original,x.original)&&pinEq(y.supplement,x.supplement),'PARENT_PAIR:'+x.name);
  const sb=verify(x.supplement),s=parse(sb),p=old.p;
  need(pinEq(s.parent_packet,x.original),'SUPPLEMENT_PARENT');
  const reproduced=work24(p,replay.bundles[x.name],x.original,canonical,replay);
  need(sb.equals(Buffer.from(JSON.stringify(reproduced)+'\n')),'SUPPLEMENT_REPLAY:'+x.name);
  const receipt=receipts.get(y.receipt_path);need(receipt&&receipt.pin.ref===y.receipt_ref,'RECEIPT_PIN');
  const o=resolve(receipt.data,y.output_pointer);
  need(o&&o.pins.name===x.name&&pinEq(o.pins.original,x.original)&&pinEq(o.pins.supplement,x.supplement),'OUTPUT_POINTER');
  const projected=project(p,s,o.pins);
  need(eq(projected,o),'PROJECTION_REPLAY:'+x.name);
  packets.set(x.name,{p,s,o,original:x.original,supplement:x.supplement});
 }
 need(packets.size===12,'PACKETS');
 return {parent,packets,receiptChecks:w25.receipts.reduce((n,x)=>n+x.checks,0)};
}
export function analyzeV26(loaded,name,withdraw=null){
 const pack=loaded.packets.get(name);need(pack,'UNKNOWN_PACKET');
 const {p,s,o}=pack;
 if(p.status==='HELD'){need(withdraw===null,'HELD_VIEW');return {name,status:'HELD',runners:[],trace:[],formal:false,grade:null,ordinal_paths:0,followup_links:0};}
 const all=new Map([...p.evidence,...s.extensions.filter(e=>e.state==='TEST_INPUT_AVAILABLE')].map(e=>[e.evidence_id,e]));
 if(withdraw!==null)need(all.has(withdraw),'UNKNOWN_WITHDRAWAL');
 const get=id=>{const e=all.get(id);return e&&id!==withdraw&&(e.depends_on??[]).every(k=>all.has(k)&&k!==withdraw)?e:null};
 const f=(event,horse,field)=>get([...all.values()].find(e=>e.event_id===event&&e.subject_id===horse&&e.field===field)?.evidence_id);
 const validObs=x=>x&&get(x.ref)&&['OBSERVED','OBSERVED_LABEL_ONLY'].includes(x.state);
 const trace=[];
 const note=(horse,item,meaning,refs,missing=[])=>{const es=uniq(refs.filter(Boolean)).map(get).filter(Boolean);const deps=uniq(es.flatMap(e=>[e.evidence_id,...(e.depends_on??[])])).map(get).filter(Boolean);const row={horse,item,meaning,refs:deps.map(e=>e.evidence_id),roots:uniq(deps.map(e=>e.root)),missing,formal:false};trace.push(row);return row};
 const target=o.events.find(e=>e.current),targetMeta=s.events.find(e=>e.event_role==='CURRENT_CARD');
 const active=o.runners.filter(h=>h.status==='ACTIVE'),registered=get(targetMeta.field_count_ref),activeCount=get(targetMeta.active_count_ref);
 const rosterComplete=!!activeCount&&activeCount.value===active.length&&!!registered&&registered.value===o.runners.length&&target.rows.every(r=>get(r.identity.ref));
 const historical=[];
 for(const event of o.events.filter(e=>!e.current)){
  for(const row of event.rows){
   const ident=get(row.identity.ref),pos=f(event.id,row.id,'checkpoint_positions');
   if(!ident)continue;
   const rp=row.rank_path,known=rp.state==='OBSERVED_ORDINAL_ONLY'&&rp.refs.every(k=>get(k));
   const points=known?rp.points.map(x=>({...x,relative_from_front:x.field_count>1?(x.rank-1)/(x.field_count-1):null})):null;
   // Unlocated rank is retained only with its own authenticated synthetic identity and field.
   const rawOrdinal=pos&&Array.isArray(pos.value)?pos.value:null;
   const old=event.conditions,now=target.conditions;
   const distance=validObs(old)&&validObs(now)?now.value.distance_m-old.value.distance_m:null;
   const geom=validObs(event.geometry)&&validObs(target.geometry)&&effective(event.geometry.value.effective,event.at)&&effective(target.geometry.value.effective,target.at);
   const cls=validObs(event.class_label)&&validObs(target.class_label)&&effective(event.class_label.effective,event.at)&&effective(target.class_label.effective,target.at);
   const contextRefs=[old.ref,now.ref,event.geometry.ref,target.geometry.ref,event.class_label.ref,target.class_label.ref];
   const rankRefs=[ident.evidence_id,pos?.evidence_id,...(known?rp.refs:[])];
   const transitions=known?rp.transitions.map((t,i)=>({...t,relative_change:points[i].relative_from_front===null||points[i+1].relative_from_front===null?null:points[i].relative_from_front-points[i+1].relative_from_front})):null;
   note(row.id,'RANK17','ORDINAL_OBSERVATION',rankRefs,known?[]:['LOCATED_FIELD_PATH_UNAVAILABLE']);
   note(row.id,'RANK18','ORDINAL_TRANSITIONS_NOT_ACCELERATION',rankRefs,known?[]:['LOCATED_FIELD_PATH_UNAVAILABLE']);
   note(row.id,'RANK44','DISTANCE_DELTA_NOT_CAUSAL_RESPONSE',[ident.evidence_id,old.ref,now.ref],distance===null?['CONDITIONS_UNAVAILABLE']:[]);
   note(row.id,'RANK67','GEOMETRY_CONTEXT_ONLY',[ident.evidence_id,...contextRefs],geom?[]:['GEOMETRY_UNAVAILABLE']);
   historical.push({horse:row.id,event:event.id,points,raw_ordinal:rawOrdinal,transitions,first_checkpoint:points?.[0]??null,first_observed_leader:points?points[0].rank===1:null,observed_ahead_count:points?points[0].field_count-points[0].rank:null,observed_behind_count:points?points[0].rank-1:null,distance_delta_m:distance,distance_kind:distance===null?'UNKNOWN':distance>0?'EXTENSION':distance<0?'SHORTENING':'SAME_DISTANCE',geometry_same:geom?eq(event.geometry.value,target.geometry.value):null,class_label_same:cls?event.class_label.value===target.class_label.value:null,field_strength:null,finish:f(event.id,row.id,'finish')?.value??null,finish_clock:f(event.id,row.id,'finish_clock')?.value??null,final600:f(event.id,row.id,'individual_final3f')?.value??null,weight:f(event.id,row.id,'weight')?.value??null,refs:uniq([...rankRefs,...contextRefs].filter(k=>get(k))),acceleration:null,physical_gain:null,individual_intermediate_clock:null});
  }
 }
 const relations=[],byRoot=new Map();
 for(const rel of s.relations.filter(x=>x.type==='OPPONENT_LATER_PRIOR_TO_CUTOFF')){
  const q=o.followups.find(z=>z.subject===rel.subject_id&&z.opponent===rel.opponent_id&&z.reference_event===rel.reference_event&&z.followup_event===rel.followup_event);
  const peer=rel.opponent_id,event=rel.followup_event,required=rel.evidence_ids??[];
  const fin=f(event,peer,'finish'),ident=f(event,peer,'historical_runner_identity'),oldIdent=f(rel.reference_event,peer,'historical_runner_identity');
  const valid=!!q&&required.every(k=>get(k))&&!!ident&&!!oldIdent&&!!fin;
  const es=valid?[...required,...['finish','margin_to_winner','finish_clock','individual_final3f','checkpoint_positions','weight','historical_runner_identity'].map(k=>f(event,peer,k)?.evidence_id),...['conditions','course_geometry','historical_field_count'].map(k=>f(event,null,k)?.evidence_id),f(rel.reference_event,peer,'weight')?.evidence_id]:[];
  const rr=note(rel.subject_id,'RANK37','LATER_RESULT_CONTEXT',es,valid?[]:['RELATION_OR_FINISH_UNAVAILABLE']);
  const state=valid?(fin.value===1?'OBSERVED_WIN':'OBSERVED_NONWIN'):'HELD_OR_MISSING';
  const out={subject:rel.subject_id,peer,reference:rel.reference_event,event,state,finish:valid?fin.value:null,margin:valid?f(event,peer,'margin_to_winner')?.value??null:null,clock:valid?f(event,peer,'finish_clock')?.value??null:null,final600:valid?f(event,peer,'individual_final3f')?.value??null:null,positions:valid?f(event,peer,'checkpoint_positions')?.value??null:null,weight:valid?f(event,peer,'weight')?.value??null:null,field_count:valid?f(event,null,'historical_field_count')?.value??null:null,conditions:valid?f(event,null,'conditions')?.value??null:null,observation_root:valid?fin.root:null,roots:rr.roots,stable_strength:null,large_defeat:null};
  relations.push(out);if(valid){const k=fin.root;const group=byRoot.get(k)??{root:k,peer,event,state,links:[]};group.links.push({subject:out.subject,reference:out.reference});byRoot.set(k,group);}
 }
 const baseline=withdraw===null?analyzeCurrentV25(loaded.parent,name):null;
 const profiles=active.map(h=>{const hist=historical.filter(z=>z.horse===h.id);const starts=hist.filter(z=>z.first_checkpoint!==null);return {horse:h.id,starts:starts.map(z=>({event:z.event,...z.first_checkpoint,ahead:z.observed_ahead_count,behind:z.observed_behind_count})),state:starts.length?'OBSERVED_RELATIVE_POSITIONS_ONLY':'UNKNOWN_ROLE',current_role:null,leader_seen:starts.some(z=>z.first_observed_leader),refs:uniq(starts.flatMap(z=>z.refs))}});
 const runners=o.runners.map(h=>{
  const hist=historical.filter(z=>z.horse===h.id);
  if(h.status!=='ACTIVE')return {horse:h.id,status:h.status,historical:hist,WIN:null,PLACE:null,grade:null};
  const others=profiles.filter(z=>z.horse!==h.id),own=profiles.find(z=>z.horse===h.id);
  const rosterRefs=target.rows.map(z=>z.identity.ref).concat([targetMeta.active_count_ref,targetMeta.field_count_ref]);
  note(h.id,'RANK58','FIELD_RELATIVE_FIRST_OBSERVATION',own.refs,own.starts.length?[]:['POSITION_UNKNOWN']);
  note(h.id,'RANK65','ALL_ACTIVE_COMPETITORS_NOT_FIXED_ROLE',[...rosterRefs,...profiles.flatMap(z=>z.refs)],rosterComplete?[]:['CURRENT_ROSTER_COUNT_UNVERIFIED']);
  const missing=['CURRENT_PACE','INDIVIDUAL_LOAD','FIELD_STRENGTH','NO_PROVEN_CONDITION_RESPONSE',...(rosterComplete?[]:['CURRENT_ROSTER_COUNT_UNVERIFIED']),...(others.some(z=>!z.starts.length)?['UNKNOWN_ACTIVE_RIVAL']:[])];
  // Preserve historical outcome observation, never turn a two/three-runner order into a current win claim.
  const winObs=hist.filter(z=>z.finish===1).map(z=>({event:z.event,finish:z.finish}));
  const placeObs=hist.filter(z=>z.finish!==null).map(z=>({event:z.event,finish:z.finish,field_count:f(z.event,null,'historical_field_count')?.value??null}));
  const pair=baseline?.runners.find(z=>z.horse===h.id)?.WIN;
  const peer=relations.filter(z=>z.subject===h.id&&z.observation_root!==null).map(z=>z.observation_root);
  for(const item of ['EYE04','EYE14','EYE15'])note(h.id,item,'REVIEW_ONLY_NO_CANONICAL_RETURN',[],['INDEPENDENT_CURRENT_RELEVANCE_UNPROVEN']);
  return {horse:h.id,status:h.status,historical:hist,position:own,competitors:others.map(z=>z.horse),branches:[{condition:'IF_PAST_RELATIVE_POSITION_RECURS',participants:profiles.map(z=>z.horse),state:'CONDITIONAL_NOT_PACE_PREDICTION'},{condition:'IF_ACTIVE_RIVAL_CHANGES_POSITION_OR_UNKNOWN_ROLE',participants:profiles.map(z=>z.horse),state:'OPEN_COUNTER'}],WIN:{state:'UNRESOLVED',past_wins:winObs,pair_repeat_support:pair?.conditional_relative_support??[],required:'FINISH_AHEAD_OF_EVERY_ACTIVE_RIVAL',counter:others.map(z=>z.horse),missing:[...missing,'WIN_STANDARD']},PLACE:{state:'UNRESOLVED',past_finishes:placeObs,required:'SPECIFIED_PLACE_THRESHOLD_AND_FEASIBLE_FINISH_POSITION',counter:others.map(z=>z.horse),missing:[...missing,'PLACE_THRESHOLD']},peer_observation_roots:uniq(peer),eye04:'HELD',eye14:'HELD',eye15:'HELD',grade:null};
 });
 return {name,status:'RESEARCH_PARTIAL',roster:{registered:registered?.value??null,active_count:activeCount?.value??null,active:active.map(h=>h.id),complete:rosterComplete},runners,profiles,historical,trace,relations,unique_later_observations:[...byRoot.values()],ordinal_paths:historical.filter(z=>z.points).length,followup_links:o.followups.length,withdrawal:withdraw?{source_id:withdraw,kind:'RESEARCH_WITHHOLD_ONLY',authenticated:false}:null,formal:false,grade:null};
}
