// Partial fictional observations only. No full-field adapter, no formal evaluation.
import {readFileSync} from 'node:fs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
import {inspectEye15} from './eye-01-15.mjs';
import {leaderWindows} from './route-observations-v13.mjs';
import {fictionalTime} from './fictional-research-context.mjs';
const load=n=>JSON.parse(readFileSync(new URL(n,import.meta.url)));
const catalog=load('./catalog-115.json').items;
export const input=()=>load('./gemini-four-partial-pinned.json');
const unique=a=>[...new Set(a)].sort();
const time=s=>fictionalTime(typeof s==='string'&&s.length===16?s+':00':s);
const stamp={fixture_only:true,official_evidence:false,formal_admission:false};
const key=(...p)=>JSON.stringify(p);
const state=(s,c)=>s.length&&c.length?'MIXED':s.length?'SUPPORT':c.length?'COUNTER':'UNKNOWN';
function reject(x){if(!x||typeof x!=='object')return;for(const [k,v] of Object.entries(x)){if(/^(expected.*|odds|popularity|rank_candidate|target_outcome)$/i.test(k))throw Error('FORBIDDEN_INPUT');reject(v);}}
function admitted(r,t){return r.id!==t.id&&Number.isFinite(time(r.published))&&time(r.published)<time(t.date+'T'+t.published);}
const validRow=(r,x)=>Number.isInteger(x.finish)&&x.finish>0&&(!Number.isInteger(r.field)||x.finish<=r.field);
const partialPosition=(r,x)=>Number.isInteger(r.field)&&Array.isArray(x.corners)&&x.corners.length===4&&x.corners.every(n=>Number.isInteger(n)&&n>=1&&n<=r.field);
const root=(r,h)=>key('RESULT',r,h);
export function replayCase(c,{returnEye=true,scenario=null}={}){
 reject(c);const t=c.target;if(t.actual_laps!==null||t.field_complete!==false)throw Error('PARTIAL_PRESTART_BOUNDARY');
 if(new Set(c.history.map(r=>r.id)).size!==c.history.length||c.history.some(r=>new Set(r.rows.map(x=>x.id)).size!==r.rows.length))throw Error('DUPLICATE_RESULT');
 const target={...stamp,circuit:'FIXTURE',race_id:t.id,cutoff:t.date+'T'+t.published+':00'};
 const roster=c.entrants.map((h,i)=>({horse_id:h.id,horse_no:i+1}));
 // Only compare times where reported winner gaps and clocks agree; do not repair the source.
 const raceConsistent=r=>{
 const w=r.rows.filter(x=>x.finish===1);
 if(w.length>1||new Set(r.rows.map(x=>x.finish)).size!==r.rows.length)return false;
 if(r.rows.some(x=>!validRow(r,x)||x.clock!=null&&(!Number.isInteger(x.clock)||x.clock<=0)||x.margin!=null&&(!Number.isInteger(x.margin)||x.margin<0)))return false;
 if(w.length===1&&Number.isInteger(w[0].clock)&&r.rows.some(x=>Number.isInteger(x.clock)&&(x.clock<w[0].clock||Number.isInteger(x.margin)&&x.clock-w[0].clock!==x.margin)))return false;
 const timed=r.rows.filter(x=>Number.isInteger(x.clock)).slice().sort((a,b)=>a.finish-b.finish);
 return timed.every((x,i)=>!i||x.clock>=timed[i-1].clock);
 };
 const rows=c.history.filter(r=>admitted(r,t)&&raceConsistent(r)).flatMap(r=>r.rows.map(x=>({r,x})));
 const groups=[],trace=[];const push=(kind,h,r,fact,event_key)=>groups.push({...stamp,event_key,evidence_ids:[event_key],record:{...stamp,kind,horse_id:h,race_id:r,fact}});
 for(const {r,x} of rows){
 const cond={distance_m:r.distance,going:r.going,course_id:null,course_version:null,surface:null,class_key:r.grade??null};
 push(roster.some(h=>h.horse_id===x.id)?'RESULT':'PEER_RESULT',x.id,r.id,{...cond,start_status:'FINISHED',finish:x.finish,field_size:r.field??null,clock_tenths:x.clock??null,winner_gap_tenths:x.margin??null,final3f_tenths:x.final3f??null},root(r.id,x.id));
 if(partialPosition(r,x))push('POSITIONS',x.id,r.id,{field_size:r.field,positions:x.corners.map((n,i)=>({segment:i+1,rank_min:n,rank_max:n}))},key('POSITIONS',r.id,x.id));
 }
 const intake={...stamp,accepted:groups};
 const typed=analyzeTyped01to32({target,roster,intake,traceRead:x=>trace.push(x)});
 const horses=roster.map(h=>{
 const id=h.horse_id,own=rows.filter(q=>q.x.id===id),peers=roster.filter(q=>q.horse_id!==id);
 const direct=[],indirect=[],route=[],counter=[],follow=[];
 for(const {r,x} of own){
 const refs=[root(r.id,id)];
 const match=r.distance===t.distance&&r.going===t.going;
 const p=partialPosition(r,x);
 if(match)route.push({race:r.id,finish:x.finish,win:x.finish===1?'SUPPORT':'COUNTER',place:x.finish<=3?'SUPPORT':'COUNTER',route:p?(x.corners[0]===1?'LEAD':x.corners[0]<=3?'FORWARD':'OUTSIDE_TOP3'):'UNKNOWN',position_change:p?x.corners[0]-x.corners[3]:null,roots:refs,formal_comparable:false});
 for(const peer of peers){const y=r.rows.find(z=>z.id===peer.horse_id&&validRow(r,z));
 if(y)direct.push({peer:peer.horse_id,race:r.id,order:Math.sign(y.finish-x.finish),gap_tenths:Number.isInteger(y.clock)&&Number.isInteger(x.clock)?y.clock-x.clock:null,roots:[...refs,root(r.id,y.id)],current_comparison:null});
 for(const common of r.rows.filter(z=>z.id!==id&&!roster.some(q=>q.horse_id===z.id)&&validRow(r,z))){
 for(const {r:a,x:b} of rows.filter(q=>q.x.id===peer.horse_id&&q.r.id!==r.id)){
 const z=a.rows.find(y=>y.id===common.id&&validRow(a,y));if(!z||![x.clock,common.clock,b.clock,z.clock].every(Number.isInteger))continue;
 const ownGap=x.clock-common.clock,peerGap=b.clock-z.clock;
 indirect.push({peer:peer.horse_id,common:common.id,races:[r.id,a.id],own_gap:ownGap,peer_gap:peerGap,margin_direction:Math.sign(peerGap-ownGap),condition_differences:['distance','going','field'].filter(k=>r[k]!==a[k]),missing:['venue','course_version','class_rule','historical_weight'],comparable:false,transitive_order:null,roots:[...refs,root(r.id,common.id),root(a.id,b.id),root(a.id,z.id)]});
 }
 }
 }
 for(const p of r.rows.filter(z=>z.id!==id&&validRow(r,z)))for(const {r:a,x:b} of rows.filter(q=>q.x.id===p.id&&time(q.r.published)>time(r.published)&&q.r.id!==r.id)){
 // No proof of promotion or stronger field; later winning is a narrow retrospective context for own previous route.
 follow.push({prior_race_id:r.id,peer_id:p.id,own_finish:x.finish,peer_prior_finish:p.finish,peer_finish:b.finish,later_race_id:a.id,shared_followup_key:root(a.id,p.id),roots:[...refs,root(r.id,p.id),root(a.id,p.id)],scope:'PAST_SUBJECT_ROUTE_CONTEXT_ONLY',promotion_verified:false});
 }
 if(p&&x.corners[0]<=3&&x.corners[3]>x.corners[0]&&x.finish>3)counter.push({race:r.id,kind:'OBSERVED_FORWARD_POSITION_LOSS',roots:refs,current_cause:null});
 }
 const rank=typed.find(q=>q.horse_id===id);
 const items=catalog.filter(d=>!d.id.startsWith('EYE-')).map(d=>{const a=rank.items[d.id];let facts=a?.observations.map(o=>({value:o.value,evidence_ids:o.evidence_ids}))??[];
 if(d.id==='35')facts=direct.map(v=>({value:v,evidence_ids:v.roots}));
 if(d.id==='36')facts=indirect.map(v=>({value:v,evidence_ids:v.roots}));
 if(d.id==='37'&&returnEye)facts=follow.map(v=>({value:v,evidence_ids:v.roots}));
 return {item_id:d.id,finding:{facts,hypotheses:[],counterevidence:[],unknowns:a?.unknowns??['PARTIAL_KERNEL_NOT_INVOKED']},evidence_ids:unique(facts.flatMap(q=>q.evidence_ids))};
 });
 const claims={direct,indirect,route,counter,follow};
 return {...h,items,claims};
 });
 // Discover through the common EYE kernel using a separate research input; return only linked original roots.
 const withDiscovery=horses.map(h=>({...h,items:h.items.map(i=>i.item_id==='37'?{...i,finding:{...i.finding,facts:h.claims.follow.map(v=>({value:v,evidence_ids:v.roots}))}}:i)}));
 const eye=inspectEye15({target,roster,rankAudit:{runners:withDiscovery},intake,catalog,traceRead:x=>trace.push(x)});
 const decisions=horses.map(h=>{
 const {direct,indirect,route,counter,follow}=h.claims;
 const e=eye.find(q=>q.horse_id===h.horse_id).items.find(i=>i.eye_item_id==='EYE-05');
 const returned=returnEye?follow.filter(f=>e.original_event_keys.includes(f.shared_followup_key)):[];
 const peerRoots=new Map();for(const f of returned){const k=f.shared_followup_key;if(!peerRoots.has(k))peerRoots.set(k,{root:k,finish:f.peer_finish,peer_top3_proposition:f.peer_finish<=3?'SUPPORT':'COUNTER',prior_routes:[]});const q=peerRoots.get(k);if(!q.prior_routes.includes(f.prior_race_id))q.prior_routes.push(f.prior_race_id);}
 const priorContext=route.map(r=>({...r,peer_context:[...peerRoots.values()].filter(p=>p.prior_routes.includes(r.race)),win_ability:null}));
 const comparisons=roster.filter(x=>x.horse_id!==h.horse_id).map(p=>{
 const d=direct.filter(x=>x.peer===p.horse_id),i=indirect.filter(x=>x.peer===p.horse_id);
 return {peer:p.horse_id,direct:d,indirect:i,conflict:d.some(x=>i.some(y=>x.order*y.margin_direction<0)),current_order:null};
 });
 let hypothetical=null;
 if(scenario!==null){
 if(scenario.kind!=='HYPOTHETICAL_NOT_TARGET'||!Array.isArray(scenario.same_style_ids)||scenario.same_style_ids.some(id=>!roster.some(q=>q.horse_id===id))||new Set(scenario.same_style_ids).size!==scenario.same_style_ids.length)throw Error('SCENARIO_SCOPE');
 const lead=route.some(x=>x.route==='LEAD'&&x.win==='SUPPORT'),late=route.some(x=>x.route==='OUTSIDE_TOP3'&&x.place==='SUPPORT'&&x.position_change>0);
 const competitors=scenario.same_style_ids.filter(id=>id!==h.horse_id).length;
 hypothetical={scope:scenario.kind,lead_route:lead?(competitors?'EASY_LEAD_PRECONDITION_NOT_MET':'EASY_LEAD_PRECONDITION_ASSUMED'):'UNKNOWN',late_place_route:late?(scenario.contested_pace===true?'CONTESTED_PACE_HYPOTHESIS_RELEVANT':'PACE_PRECONDITION_UNKNOWN'):'UNKNOWN',win_effect:null};
 }
 return {id:h.horse_id,comparisons,priorContext,peer_roots:[...peerRoots.values()],forward_counter:counter,win_history:state(route.filter(r=>r.win==='SUPPORT'),route.filter(r=>r.win==='COUNTER')),place_history:state(route.filter(r=>r.place==='SUPPORT'),route.filter(r=>r.place==='COUNTER')),hypothetical,current_strength:null};
 });
 const laps=c.history.filter(r=>Array.isArray(r.reported_laps)).map(r=>{const l=r.reported_laps;const grid=l.length*200===r.distance&&l.every(n=>Number.isInteger(n)&&n>0);const sum=l.reduce((a,b)=>a+b,0);return {race:r.id,sum,reported:r.reported_total,arithmetic:grid&&sum===r.reported_total?{...leaderWindows(l.map((n,i)=>({start_m:i*200,end_m:(i+1)*200,elapsed_tenths:n}))),measurement_scope:'UNVERIFIED_LAP_KIND_ARITHMETIC_ONLY'}:null,usable:false,reason:'LAP_KIND_AND_BASELINE_UNVERIFIED'};});
 const ledger=horses.flatMap(h=>catalog.map(d=>{const isEye=d.id.startsWith('EYE-'),e=eye.find(q=>q.horse_id===h.horse_id).items.find(i=>i.eye_item_id===d.id),r=h.items.find(i=>i.item_id===d.id);return {horse:h.horse_id,item:d.id,execution:isEye?'COMMON_EYE_ITEM_BRANCH':Number(d.id)<=32?'COMMON_TYPED_SECTION': ['35','36','37'].includes(d.id)?'PARTIAL_COMPARISON_BRANCH':'NOT_INVOKED_PARTIAL',outputs:isEye?e.observed_facts.length:r.finding.facts.length,reads:trace.filter(x=>x.horse_no===h.horse_no&&x.item_id===d.id).length,formal:false};}));
 return {decisions,ledger,laps,held:c.history.filter(r=>!admitted(r,t)).map(r=>r.id),result_conflicts:c.history.filter(r=>admitted(r,t)&&!raceConsistent(r)).map(r=>r.id),held_incidents:c.history.filter(r=>r.incident).map(r=>r.incident.id),additional_held:(c.additional??[]).map(x=>x.type),target_field_complete:false,formal:false};
}
export function work14Gate(){const w=load('./work14-time-receipt-pinned.json');const rows=w.patches.flatMap(p=>p.paths.map(path=>({file:p.original_file,sha:p.original_sha256,path,reported:p.expected_value,replacement:p.replacement})));if(rows.length!==52||new Set(rows.map(r=>key(r.file,r.path))).size!==52||rows.some(r=>r.replacement!==null))throw Error('RECEIPT_CONFLICT');
 const resolve=({file,sha,path,reported})=>{const row=rows.find(r=>r.file===file&&r.path===path);return {verified_time:null,admitted:false,reason:row&&row.sha===sha&&row.reported===reported?'OLD_INVALID_TIME':'UNVERIFIED_OR_MISMATCH'};};
 return {rows,resolve,zip_verified:false,diagnostic_gates:Array.from({length:118},(_,i)=>({synthetic_index:i+1,verified_time:null,admitted:false})),jc_prestart:false,formal:false};
}
