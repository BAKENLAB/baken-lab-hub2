// Synthetic-only V23 extension; never derived from the incomplete Work clock packet.
import {cleanV22} from './conditional-field-v22.mjs';
import {analyzeCapabilityV22} from './capability-depth-v22.mjs';
const sum=a=>a.reduce((s,x)=>s+x,0),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const row=(r,id)=>r.rows.find(x=>x.id===id);
const keys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
function comparable(a,b,m){
 const missing=keys.filter(k=>a.conditions[k]==null||b.conditions[k]==null),different=keys.filter(k=>!missing.includes(k)&&a.conditions[k]!==b.conditions[k]);
 for(const k of ['points','phases','straight_m','first_corner_m'])if(!eq(m.geometry[a.id][k],m.geometry[b.id][k]))different.push(k);
 if(a.field_count!==b.field_count)different.push('field_count');
 if(!eq(a.lap_segment_m,b.lap_segment_m))different.push('segments');
 return {missing,different,matched:!missing.length&&!different.length};
}
function phases(r,m,id){
 const ends=r.lap_segment_m.map((_,i)=>sum(r.lap_segment_m.slice(0,i+1))),points=m.geometry[r.id].phases,clock=id===null?ends.map((_,i)=>sum(r.lap_tenths.slice(0,i+1))):m.clocks[r.id][id];let prev=0;
 return points.map(end=>{const now=clock[ends.indexOf(end)],v=now-prev;prev=now;return v;});
}
function pair(a,b,m,id,other,peer){
 const x=row(a,id),y=row(b,other),u=row(a,peer),v=row(b,peer),s=comparable(a,b,m);
 const relativeWeights=[x.kg-u.kg,y.kg-v.kg],weightMatch=u.kg===v.kg&&x.kg===y.kg&&relativeWeights[0]===relativeWeights[1];
 const peerPhases=[phases(a,m,peer),phases(b,m,peer)],envelope=[phases(a,m,null),phases(b,m,null)],sameRoster=eq(a.rows.map(x=>x.id).sort(),b.rows.map(x=>x.id).sort());
 const measuredMatch=u.clock_tenths===v.clock_tenths&&u.final3f_tenths===v.final3f_tenths&&eq(peerPhases[0],peerPhases[1]);
 const state=!s.matched||!weightMatch?'UNKNOWN_CONTEXT':!measuredMatch?'PEER_MEASURED_PERFORMANCE_DIFFERS':!eq(envelope[0],envelope[1])?'PEER_CLOCK_MATCH_RACE_LOAD_DIFFERS':'PEER_MEASURED_PROFILE_MATCH_ONLY';
 return {races:[a.id,b.id],peer,subject:id,other,scope:s,weightMatch,relativeWeights,peer_clocks:[u.clock_tenths,v.clock_tenths],peer_final600:[u.final3f_tenths,v.final3f_tenths],peer_finishes:[u.finish,v.finish],peer_phases:peerPhases,leader_envelopes:envelope,same_roster:sameRoster,state,relative_gaps:[x.clock_tenths-u.clock_tenths,y.clock_tenths-v.clock_tenths],peer_form_stable:null,common_peer_quality:null,inferred_current_order:null,combined_margin:null,roots:[...new Set([a,b].flatMap(r=>['v22:race:'+r.id,'v22:geometry:'+r.id,'v22:clock:'+r.id+':'+peer,'v22:clock:'+r.id+':'+(r===a?id:other)]))].sort()};
}
function eye04Review(p,m,id){
 const out=[];
 for(const r of p.history.filter(r=>row(r,id)&&row(r,id).finish>1)){
  const own=row(r,id),winner=r.rows.find(x=>x.finish===1);
  for(const q of p.history.filter(q=>q.date>r.date&&row(q,winner.id))){
   const later=row(q,winner.id),s=comparable(r,q,m),matched=s.matched&&winner.kg===later.kg;
   out.push({eye:'EYE-04',race:r.id,peer:winner.id,later_race:q.id,observed_gap_tenths:own.clock_tenths-winner.clock_tenths,later_finish:later.finish,later_field:q.field_count,scope:s,state:!matched?'UNKNOWN_CONTEXT':later.finish===1?'SUPPORT_LATER_WIN_CONTEXT':'COUNTER_TO_REPEATED_WIN_ONLY',strong_peer:null,narrow_gap:null,current_benefit:null,formal:false,roots:['v22:race:'+r.id,'v22:race:'+q.id,'v22:geometry:'+r.id,'v22:geometry:'+q.id,'v22:clock:'+r.id+':'+id,'v22:clock:'+r.id+':'+winner.id,'v22:clock:'+q.id+':'+winner.id]});
  }
 }
 return out;
}
export function analyzeOpponentV23(packet,meta){
 const {p,m}=cleanV22(packet,meta),base=analyzeCapabilityV22(packet,meta),ids=p.target.entrants.map(h=>h.id).sort(),bound=new Set(base.evidence.map(e=>e.id));
 const decisions=base.decisions.map(h=>{
  const comparisons=ids.filter(x=>x!==h.id).flatMap(other=>p.history.filter(r=>row(r,h.id)).flatMap(a=>p.history.filter(b=>b.id!==a.id&&row(b,other)).flatMap(b=>a.rows.filter(x=>x.id!==h.id&&x.id!==other&&row(b,x.id)).map(x=>pair(a,b,m,h.id,other,x.id)))));
  const review=eye04Review(p,m,h.id);
  const paths=h.views.D.joint_capacity_paths.map(path=>({...path,opponent_context:comparisons.filter(c=>c.races.includes(path.scenario.slice(6))).map(c=>({peer:c.peer,other:c.other,state:c.state,current_order:null,roots:c.roots})),opponent_strength_established:false}));
  return {...h,views:{...h.views,C:{...h.views.C,common_peer_context:comparisons},D:{...h.views.D,joint_capacity_paths:paths,eye04_review:review},E:{...h.views.E,eye14:{state:'HELD',reason:'NO_VALIDATED_TRANSITION_AND_COMPARABLE_FIELD_STRENGTH'},eye15:{state:'HELD',reason:'NO_INDEPENDENT_JOINT_IMPROVEMENT_MECHANISMS'}}}};
 });
 const roots=decisions.flatMap(h=>[...h.views.C.common_peer_context.flatMap(x=>x.roots),...h.views.D.eye04_review.flatMap(x=>x.roots)]),unbound=[...new Set(roots)].filter(x=>!bound.has(x));
 if(unbound.length)throw Error('V23_OPPONENT_ROOT_UNBOUND');
 return {...base,decisions,opponent_root_check:{distinct:new Set(roots).size,unbound},evaluation_policy:'SABC_ONLY_NO_ASSIGNMENT',formal:false};
}
