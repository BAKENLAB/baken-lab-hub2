// V22 continuation: narrowly defined conditional propositions, never current forecasts.
import {validateV21,fixtureV21,eyeInputsV21} from './race-expression-v21.mjs';
import {analyzeV22} from './race-expression-v22.mjs';
import {analyzeV19} from './field-interaction-v19.mjs';
import {runGenerated} from './v15-research.mjs';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),uniq=a=>[...new Set(a)].sort(),sum=a=>a.reduce((s,x)=>s+x,0);
const row=(r,id)=>r.rows.find(h=>h.id===id),stamp=(r,k)=>r.date+'T'+r[k];
const roots=(r,h)=>['fixture-v2:result:'+r.id+':'+h,'fixture-v2:pos:'+r.id+':'+h];
const scopeKeys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
const signature=(r,m)=>JSON.stringify([r.date,r.start,scopeKeys.map(k=>r.conditions[k]),m.geometry[r.id],r.lap_segment_m,r.lap_tenths,r.rows.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(h=>[h.id,h.kg,h.finish,h.clock_tenths,h.margin_tenths,h.final3f_tenths,h.corners,m.clocks[r.id][h.id]]),m.incidents.filter(i=>i.race_id===r.id).map(({race_id,...x})=>x).sort((a,b)=>a.victim.localeCompare(b.victim))]);
export function cleanV22(packet,meta){
 validateV21(packet,meta);const p=structuredClone(packet),m=structuredClone(meta),groups=new Map(),excluded=[],duplicates=[];
 for(const r of p.history){const f=m.families[r.id];if(!groups.has(f))groups.set(f,[]);groups.get(f).push(r);}
 const keep=[];for(const [family,rs] of groups){rs.sort((a,b)=>stamp(a,'published').localeCompare(stamp(b,'published'))||a.id.localeCompare(b.id));if(new Set(rs.map(r=>signature(r,m))).size>1){excluded.push({family,ids:rs.map(r=>r.id),reason:'SAME_FAMILY_CONFLICT'});continue;}keep.push(rs[0]);if(rs.length>1)duplicates.push({family,retained:rs[0].id,excluded:rs.slice(1).map(r=>r.id)});}
 p.history=keep.sort((a,b)=>stamp(a,'start').localeCompare(stamp(b,'start'))||a.id.localeCompare(b.id));const valid=new Set(keep.map(r=>r.id));m.incidents=m.incidents.filter(x=>valid.has(x.race_id));
 return {p,m,excluded,duplicates};
}
function compatibility(r,q,m){
 const missing=scopeKeys.filter(k=>r.conditions[k]==null||q.conditions[k]==null),diff=scopeKeys.filter(k=>!missing.includes(k)&&r.conditions[k]!==q.conditions[k]);
 for(const k of ['points','phases','straight_m','first_corner_m'])if(!eq(m.geometry[r.id][k],m.geometry[q.id][k]))diff.push(k);
 return {missing,diff,compatible:missing.length===0&&diff.length===0};
}
function indirect(p,m,a,b){
 const out=[];for(const r of p.history.filter(r=>row(r,a)))for(const q of p.history.filter(q=>q.id!==r.id&&row(q,b))){
 const x=row(r,a),y=row(q,b),s=compatibility(r,q,m);
 for(const z of r.rows.filter(h=>h.id!==a&&h.id!==b&&row(q,h.id))){
 const v=row(q,z.id),sameWeight=x.kg-z.kg===y.kg-v.kg&&z.kg===v.kg;
 out.push({peer:z.id,races:[r.id,q.id],scope:s,field_counts:[r.field_count,q.field_count],relative_weight_match:sameWeight,comparison:s.compatible&&r.field_count===q.field_count&&sameWeight?'COMPARABLE_RECORDED_CONTEXT':'UNESTABLISHED',gaps_tenths:[x.clock_tenths-z.clock_tenths,y.clock_tenths-v.clock_tenths],roots:uniq([...roots(r,a),...roots(r,z.id),...roots(q,b),...roots(q,z.id)]),inferred_order:null,combined_margin:null,peer_form_stability:null});
 }}return out;
}
function role(h){const path=h.historical.individual.path;return path[0].rank===1?'EARLY_LEAD':path.slice(1).some(x=>x.rank===1)?'NONLEAD_TO_LEAD':'NONLEAD_NO_LEAD';}
function phaseClock(r,m,id){const ends=r.lap_segment_m.map((_,i)=>sum(r.lap_segment_m.slice(0,i+1))),cl=m.clocks[r.id][id];let last=0;return m.geometry[r.id].phases.map(end=>{const t=cl[ends.indexOf(end)],delta=t-last;last=t;return {end_m:end,elapsed_tenths:delta};});}
function roleWitness(h,transfer,r,p,m,assumedRole,assumedLeader){
 const id=h.historical.individual,own=transfer.peers.find(x=>x.id===assumedLeader),leaderRow=row(r,assumedLeader),subject=p.target.entrants.find(x=>x.id===h.subject);
 const observedRole=role(h),roleFit=observedRole===assumedRole,scope=compatibility(r,p.target,m),weightFit=subject.kg===h.historical.kg,fieldFit=r.field_count===p.target.entrants.length;
 const leaderObserved=!!leaderRow&&leaderRow.corners[0]===1,leaderFit=assumedRole==='EARLY_LEAD'||leaderObserved;
 // Nonlead witness against a different leader is evidence of the role, not the named matchup.
 const baseFit=scope.compatible&&weightFit&&fieldFit&&roleFit;
 const status=baseFit?'MATCHED_ROLE_CONTEXT':!scope.compatible||!weightFit||!fieldFit?'TRANSFER_UNESTABLISHED':'ROLE_DIFFERS';
 const WIN=baseFit?(id.finish===1?'SUPPORT':'COUNTER'):'UNKNOWN';
 const PLACE=baseFit?(id.finish<=3&&id.finish<r.field_count?'SUPPORT':'COUNTER'):'UNKNOWN';
 return {race:r.id,observed_role:observedRole,role_fit:roleFit,scope,weight_fit:weightFit,field_fit:fieldFit,rest_delta:transfer.rest_delta,rest_applicability:null,leader_match:leaderFit?'OBSERVED_NAMED_ROLE':'NAMED_LEADER_UNESTABLISHED',named_peer_shared:own?.shared??null,status,WIN,PLACE,meaning:'HISTORICAL_ROLE_CAPACITY_WITNESS_ONLY',named_matchup_WIN:baseFit&&leaderFit?WIN:'UNKNOWN',named_matchup_PLACE:baseFit&&leaderFit?PLACE:'UNKNOWN',phase_clocks:phaseClock(r,m,h.subject),individual:id,opponents:h.historical.opponents,roots:uniq([...h.roots,'fixture-v2:laps:'+r.id,'fixture-v2:race:'+r.id,'fixture-v2:card:'+h.subject,'fixture-v2:geometry']),actual_viability:null};
}
function scenarioPaths(p,m,base){
 const ids=p.target.entrants.map(h=>h.id).sort(),eligible=base.decisions.filter(h=>h.views.A.joint_history.some(q=>role(q)==='EARLY_LEAD')).map(h=>h.id).sort();
 const scenarios=eligible.map(leader=>({id:'LEAD:'+leader,leader,assumption:'ONE_EARLY_OBSERVED_LEADER_HYPOTHESIS',other_slots:ids.filter(x=>x!==leader).map(id=>({id,alternatives:['NONLEAD_TO_LEAD','NONLEAD_NO_LEAD'],response:'UNASSIGNED'})),contrary_directions:base.constraints[0].pairs.filter(q=>q.direction?.[1]===leader).map(q=>({peer:q.direction[0],witnesses:q.witnesses})),historical_cycle_if_imposed:base.constraints[0].cycle_members,actual_feasibility:null,probability:null}));
 scenarios.push({id:'UNKNOWN',leader:null,assumption:'NO_ASSIGNED_LEADER',other_slots:ids.map(id=>({id,response:'UNASSIGNED'})),actual_feasibility:null,probability:null});
 const decisions=base.decisions.map(h=>{const histories=h.views.A.joint_history.map(q=>({...q,subject:h.id}));const paths=scenarios.map(s=>{if(!s.leader)return {scenario:s.id,roles:[],actual_viability:null};const roles=h.id===s.leader?['EARLY_LEAD']:['NONLEAD_TO_LEAD','NONLEAD_NO_LEAD'];return {scenario:s.id,roles:roles.map(assumed_role=>{const witnesses=histories.map(q=>roleWitness(q,h.views.B.joint_transfer.find(t=>t.race===q.race),p.history.find(r=>r.id===q.race),p,m,assumed_role,s.leader));return {assumed_role,witnesses,WIN:{support:witnesses.filter(x=>x.WIN==='SUPPORT').map(x=>x.race),counter:witnesses.filter(x=>x.WIN==='COUNTER').map(x=>x.race),unknown:witnesses.filter(x=>x.WIN==='UNKNOWN').map(x=>x.race)},PLACE:{support:witnesses.filter(x=>x.PLACE==='SUPPORT').map(x=>x.race),counter:witnesses.filter(x=>x.PLACE==='COUNTER').map(x=>x.race),unknown:witnesses.filter(x=>x.PLACE==='UNKNOWN').map(x=>x.race)},required:['ASSUMED_ROLE_ACTUALLY_OCCURS','UNASSIGNED_RIVALS_RESOLVED','CURRENT_APPLICABILITY_ESTABLISHED'],current_outcome:null};}),actual_viability:null};});
 const relations=ids.filter(id=>id!==h.id).map(id=>({id,indirect:indirect(p,m,h.id,id),direct:base.constraints.at(-1).pairs.find(x=>[x.a,x.b].includes(h.id)&&[x.a,x.b].includes(id))}));
 return {...h,views:{...h.views,C:{...h.views.C,relations},D:{...h.views.D,role_paths:paths},E:{...h.views.E,current_outcome:null}}};});
 return {scenarios,decisions};
}
export function analyzeV22Continuation(packet,meta,{disabled=[]}={}){
 const {p,m,excluded,duplicates}=cleanV22(packet,meta),base=analyzeV22(p,m,{disabled}),prior=analyzeV19(p),options={versioned:true,allowExternalPeers:true,v21Evidence:eyeInputsV21(p,m),mechanisms:prior.mechanisms};
 const eye10=base.eye.flatMap(h=>h.items.filter(e=>e.eye_item_id==='EYE-10').flatMap(e=>e.observed_facts.filter(x=>x.type==='SANDWICH_WITH_GEOMETRY'&&x.value.first_turn.length>0).map(x=>({horse_id:h.horse_id,kind:'V22_SANDWICH',roots:x.evidence_ids}))));
 const all=runGenerated(p,{...options,researchReturn:[...prior.returns,...base.returns,...(disabled.includes('EYE-10')?[]:eye10)]}),{scenarios,decisions}=scenarioPaths(p,m,base),bound=new Set(all.evidence_index.map(x=>x.evidence_id));
 for(const h of decisions){const returned=all.merged.find(x=>x.horse_id===h.id).items['73'].hypotheses.filter(x=>x.value.research_return==='EYE-10');h.views.B.sandwich=returned;h.views.D.sandwich_context=returned.map(x=>({proposition:x.value.proposition,state:x.value.state,roots:x.evidence_ids,actual_benefit:null}));}
 const refs=uniq([...base.constraints.flatMap(q=>q.pairs.flatMap(x=>x.witnesses.flatMap(w=>w.roots))),...decisions.flatMap(h=>[...h.views.C.relations.flatMap(x=>x.indirect.flatMap(y=>y.roots)),...h.views.D.role_paths.flatMap(x=>x.roles.flatMap(y=>y.witnesses.flatMap(z=>z.roots))),...h.views.D.sandwich_context.flatMap(x=>x.roots)])]);
 const unbound=refs.filter(x=>!bound.has(x));if(unbound.length)throw Error('V22_CONT_UNBOUND:'+unbound);
 return {...base,common:all.merged,eye:all.eye,audit:all.ledger,decisions,scenarios,quarantine:{excluded,duplicates},root_check:{distinct:refs.length,unbound},formal:false,semantic_proof_complete:false};
}
export function sandwichFixtureV22(){const {packet:p,meta:m}=fixtureV21(2400,8),last=id=>p.history.filter(r=>row(r,id)).sort((a,b)=>stamp(b,'start').localeCompare(stamp(a,'start')))[0],front=id=>row(last(id),id).corners.some(x=>x<=3),ids=p.target.entrants.map(x=>x.id),yes=ids.filter(front),no=ids.filter(id=>!front(id));if(yes.length<2||!no.length)throw Error('V22_SANDWICH_FIXTURE');const [a,b]=yes,h=no[0],order=[a,h,b,...ids.filter(id=>![a,h,b].includes(id))];for(const x of p.target.entrants)x.draw=order.indexOf(x.id)+1;return {p,m,subject:h};}
