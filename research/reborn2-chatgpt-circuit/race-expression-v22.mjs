// V22 partial research: mixed historical fields; no forecasts, official admissions or ranking.
import {fixtureV21,validateV21,analyzeV21} from './race-expression-v21.mjs';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sum=a=>a.reduce((s,x)=>s+x,0);
const stamp=(r,k)=>r.date+'T'+r[k];
const idsOf=p=>p.target.entrants.map(x=>x.id).sort();
const roots=(r,id)=>['fixture-v2:result:'+r.id+':'+id,'fixture-v2:pos:'+r.id+':'+id];
const row=(r,id)=>r.rows.find(x=>x.id===id);
const scopeKeys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
function scope(r,t,m){
 const missing=scopeKeys.filter(k=>r.conditions[k]==null||t.conditions[k]==null);
 const differences=scopeKeys.filter(k=>!missing.includes(k)&&r.conditions[k]!==t.conditions[k]);
 for(const k of ['points','phases','straight_m'])if(!eq(m.geometry[r.id][k],m.geometry[t.id][k]))differences.push(k);
 if(r.field_count!==t.entrants.length)differences.push('field_count');
 return {missing,differences,state:missing.length?'UNKNOWN':differences.length?'UNESTABLISHED':'CONTEXT_MATCH_ONLY'};
}
function checkpoints(r,m,h){
 const points=r.lap_segment_m.map((_,i)=>sum(r.lap_segment_m.slice(0,i+1)));
 const clocks=m.clocks[r.id][h.id];const positions=points.map((_,i)=>1+r.rows.filter(x=>m.clocks[r.id][x.id][i]<clocks[i]).length);
 return points.map((at_m,i)=>({at_m,rank:positions[i],clock_tenths:clocks[i],segment_tenths:clocks[i]-(clocks[i-1]??0),transition:i===0?'FIRST_OBSERVATION':positions[i]<positions[i-1]?'GAIN':positions[i]>positions[i-1]?'RETREAT':'HOLD',lead_change:i===0?null:positions[i]===1&&positions[i-1]!==1?'GAIN_OR_REGAIN_LEAD':positions[i]!==1&&positions[i-1]===1?'LOSE_LEAD':null}));
}
function dedup(rows,m){const by=new Map();for(const r of rows){const k=m.families[r.id];if(!by.has(k))by.set(k,[]);by.get(k).push(r);}return [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1]);}
function familySignature(r,m){return JSON.stringify({date:r.date,start:r.start,conditions:scopeKeys.map(k=>r.conditions[k]),geometry:m.geometry[r.id],laps:r.lap_tenths,segments:r.lap_segment_m,rows:r.rows.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(h=>({id:h.id,kg:h.kg,finish:h.finish,clock:h.clock_tenths,final3f:h.final3f_tenths,gap:h.margin_tenths,positions:h.corners,checkpoints:m.clocks[r.id][h.id]}))});}
function uniqueFamilies(rows,m){return dedup(rows,m).map(f=>{const a=f.slice().sort((x,y)=>x.id.localeCompare(y.id));return {r:a[0],aliases:a.map(x=>x.id),conflict:new Set(a.map(x=>familySignature(x,m))).size!==1};});}
function cyclic(edges,ids){const adj=new Map(ids.map(h=>[h,[]]));for(const [a,b] of edges)adj.get(a).push(b);
 const can=(a,b)=>{const seen=new Set(),q=[...adj.get(a)];while(q.length){const x=q.pop();if(x===b)return true;if(seen.has(x))continue;seen.add(x);q.push(...adj.get(x));}return false;};
 return ids.filter(x=>can(x,x));}
export function mixedConstraintsV22(p,m){
 validateV21(p,m);const ids=idsOf(p),t=p.target,groups=uniqueFamilies(p.history,m),points=[...m.geometry[t.id].points,t.conditions.distance_m];
 return points.map(at_m=>{
 const pairs=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
 const [a,b]=[ids[i],ids[j]],shared=groups.filter(g=>g.aliases.some(id=>{const r=p.history.find(x=>x.id===id);return row(r,a)&&row(r,b);}));
 const witnesses=shared.map(({r,aliases,conflict})=>{const x=row(r,a),y=row(r,b),s=scope(r,t,m),k=r.lap_segment_m.findIndex((_,n)=>sum(r.lap_segment_m.slice(0,n+1))===at_m),w=x&&y?[t.entrants.find(h=>h.id===a).kg-x.kg,t.entrants.find(h=>h.id===b).kg-y.kg]:null;
 const comparable=!conflict&&x&&y&&k>=0&&s.state==='CONTEXT_MATCH_ONLY'&&w.every(z=>z===0);
 return {race:r.id,family:m.families[r.id],aliases,shared_roster:r.rows.length===ids.length&&r.rows.every(h=>ids.includes(h.id))?'FULL':'PARTIAL',scope:s,weight_deltas:w,state:conflict?'CONFLICTING_FAMILY':comparable?'COMPARABLE_HISTORICAL':'UNESTABLISHED',observed_order:x&&y&&k>=0?(m.clocks[r.id][a][k]<m.clocks[r.id][b][k]?[a,b]:[b,a]):null,roots:x&&y?[...roots(r,a),...roots(r,b)]:[],causal_effect:null};});
 const orders=witnesses.filter(w=>w.state==='COMPARABLE_HISTORICAL').map(w=>w.observed_order),distinct=new Set(orders.map(x=>x[0]));
 pairs.push({a,b,state:witnesses.some(w=>w.state==='CONFLICTING_FAMILY')||distinct.size>1?'CONFLICT':distinct.size===1?'HISTORICAL_DIRECTION_ONLY':shared.length?'UNKNOWN_CONTEXT':'UNKNOWN_NO_SHARED_HISTORY',direction:distinct.size===1&&!witnesses.some(w=>w.state==='CONFLICTING_FAMILY')?orders[0]:null,witnesses,current_order:null});
 }
 const edges=pairs.filter(q=>q.state==='HISTORICAL_DIRECTION_ONLY').map(q=>q.direction),cycles=cyclic(edges,ids);
 return {at_m,pairs,cycle_members:cycles,unassigned:ids.filter(h=>!edges.some(e=>e.includes(h))),transitivity_assumed:false,total_order:null,actual_feasibility:null,probability:null};});
}
function priorReferences(r,p,m){
 const refs=uniqueFamilies(p.history.filter(q=>stamp(q,'published')<stamp(r,'start')&&m.families[q.id]!==m.families[r.id]),m).filter(g=>!g.conflict&&scope(g.r,{...r,entrants:r.rows},m).state==='CONTEXT_MATCH_ONLY'&&eq(g.r.lap_segment_m,r.lap_segment_m));
 return {race_ids:refs.map(g=>g.r.id),n:refs.length,phase_samples:m.geometry[r.id].phases.map((end,i)=>{const start=m.geometry[r.id].phases[i-1]??0;return {start_m:start,end_m:end,values:refs.map(g=>g.r.lap_tenths.reduce((a,z,j)=>{const x=sum(g.r.lap_segment_m.slice(0,j+1));return a+(x>start&&x<=end?z:0);},0))};}),calibrated_pace:null};
}
function jointHistory(p,m,id){return uniqueFamilies(p.history,m).filter(g=>!g.conflict&&row(g.r,id)).map(({r,aliases})=>{const h=row(r,id),path=checkpoints(r,m,h),opponents=r.rows.filter(x=>x.id!==id).sort((a,b)=>a.id.localeCompare(b.id)).map(x=>({id:x.id,finish:x.finish,clock_delta_tenths:x.clock_tenths-h.clock_tenths,roots:roots(r,x.id),quality:null}));
 const earlier=p.history.filter(q=>row(q,id)&&stamp(q,'published')<stamp(r,'start')).sort((a,b)=>stamp(b,'start').localeCompare(stamp(a,'start')))[0];
 const rest=earlier?(Date.parse(r.date)-Date.parse(earlier.date))/86400000:null;
 return {race:r.id,aliases,roots:[...roots(r,id),...opponents.flatMap(x=>x.roots)],historical:{conditions:r.conditions,geometry:m.geometry[r.id],field:r.field_count,kg:h.kg,rest_days:rest,leader_envelope:{scope:'RACE_NOT_INDIVIDUAL',laps:r.lap_tenths,segments:r.lap_segment_m,reference:priorReferences(r,p,m)},individual:{clock_tenths:h.clock_tenths,final3f_tenths:h.final3f_tenths,margin_tenths:h.margin_tenths,finish:h.finish,path},opponents},observed_capacity:{WIN:h.finish===1?'OBSERVED_WIN':'OBSERVED_NONWIN',PLACE:h.finish<=3&&h.finish<r.field_count?'OBSERVED_COMPETITIVE_PLACE':'NOT_OBSERVED_COMPETITIVE_PLACE',advance:path.some(x=>x.transition==='GAIN'),retreat:path.some(x=>x.transition==='RETREAT'),lead_lost:path.some(x=>x.lead_change==='LOSE_LEAD'),lead_regained:path.some((x,i)=>x.lead_change==='GAIN_OR_REGAIN_LEAD'&&path.slice(0,i).some(y=>y.lead_change==='LOSE_LEAD')),causal_load:null,opponent_quality:null}};
 });}
export function analyzeV22(p,m,{disabled=[]}={}){
 validateV21(p,m);const prior=analyzeV21(p,m,{disabled}),constraints=mixedConstraintsV22(p,m),ids=idsOf(p);
 const decisions=ids.map(id=>{const base=prior.decisions.find(x=>x.id===id),history=jointHistory(p,m,id);
 const latest=history.slice().sort((a,b)=>stamp(p.history.find(x=>x.id===b.race),'start').localeCompare(stamp(p.history.find(x=>x.id===a.race),'start')))[0];
 const rest=latest?(Date.parse(p.target.date)-Date.parse(p.history.find(x=>x.id===latest.race).date))/86400000:null;
 const transfer=history.map(h=>{const r=p.history.find(x=>x.id===h.race),s=scope(r,p.target,m),weight_delta=p.target.entrants.find(x=>x.id===id).kg-h.historical.kg,peers=ids.filter(x=>x!==id).map(x=>({id:x,shared:!!row(r,x)}));return {race:h.race,scope:s,weight_delta,rest_days:rest,rest_delta:rest===null||h.historical.rest_days===null?null:rest-h.historical.rest_days,peers,WIN:'UNKNOWN_CURRENT',PLACE:'UNKNOWN_CURRENT',historical_WIN:h.observed_capacity.WIN,historical_PLACE:h.observed_capacity.PLACE,actual_viability:null};});
 return {id,views:{...base.views,A:{...base.views.A,joint_history:history},B:{...base.views.B,joint_transfer:transfer},C:{...base.views.C,mixed_constraints:constraints.map(c=>({at_m:c.at_m,pairs:c.pairs.filter(x=>x.a===id||x.b===id),cycle_member:c.cycle_members.includes(id)}))},D:{...base.views.D,mixed_field_paths:transfer},E:{...base.views.E,unknown_current_outcome:true}},rank:null,formal:false};});
 return {...prior,constraints,decisions,scope:'SYNTHETIC_PARTIAL_V22',formal:false,release_eligible:false,semantic_proof_complete:false};
}
// Actual synthetic mixed rosters, with coherent identity remapping of rows/clocks.
// D has independent history; A>B, B>C, C>A at first checkpoint, none meets D.
export function mixedFixtureV22(){const {packet:p,meta:m}=fixtureV21(900,4);
 const rosters=[['D','E','F','G','H'],['A','B','E','F'],['B','C','E','F'],['C','A','E','F']];
 p.history.forEach((r,i)=>{const sorted=r.rows.slice().sort((a,b)=>a.corners[0]-b.corners[0]),mapping=new Map(sorted.map((x,j)=>[x.id,'FIXTURE-'+rosters[i][j]])),old=m.clocks[r.id];m.clocks[r.id]=Object.fromEntries(Object.entries(old).map(([id,c])=>[mapping.get(id),c]));for(const h of r.rows){h.id=mapping.get(h.id);const target=p.target.entrants.find(x=>x.id===h.id);if(target)h.kg=target.kg;}});
 m.incidents=[];validateV21(p,m);return {packet:p,meta:m};}
