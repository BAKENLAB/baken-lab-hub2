import {createHash} from 'node:crypto';
import {runGenerated} from './v15-research.mjs';
import {validateGenerated} from './synthetic-generator-v15.mjs';
import {analyzeV18,heterogeneous} from './circular-v18.mjs';
import {prototypePacket} from './allfield-prototype-v17.mjs';
import {toCommonV16} from './synthetic-generator-v16.mjs';
const uniq=a=>[...new Set(a)].sort();
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const row=(r,id)=>r?.rows.find(x=>x.id===id);
const ref=(r,id)=>'fixture-v2:result:'+r+':'+id;
const posref=(r,id)=>'fixture-v2:pos:'+r+':'+id;
const facts=(h,k)=>h.items[k]?.facts??[];
const cond=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility'];
const observation=(r,x)=>({race:r.id,finish:x.finish,field:r.field_count,beaten:r.field_count-x.finish,relative_finish:r.field_count>1?(r.field_count-x.finish)/(r.field_count-1):null,gap_tenths:x.margin_tenths,clock_tenths:x.clock_tenths,final3f_tenths:x.final3f_tenths,positions:x.corners,early:x.corners[0],last:x.corners.at(-1),normalized_early:r.field_count>1?(x.corners[0]-1)/(r.field_count-1):null,roots:[ref(r.id,x.id),posref(r.id,x.id)],source_family:r.id==='FK-GEN-4'?'CONTROLLED_CLONE_FK-GEN-3':r.id});
function scope(a,b){
 const missing=cond.filter(k=>a[k]==null||b[k]==null||a[k]===''||b[k]===''),different=cond.filter(k=>!missing.includes(k)&&a[k]!==b[k]);
 const hard=different.filter(k=>['surface','grade','rule_version','eligibility'].includes(k));
 return {missing,different,state:missing.length?'UNKNOWN':hard.length?'NOT_APPLICABLE_TO_CURRENT_CLAIM':different.length?'PARTIAL_HYPOTHESIS':'MATCHED_HISTORICAL',actual_current_suitability:null};
}
function normalize(p){
 const x=structuredClone(p);x.target.entrants.sort((a,b)=>a.runner-b.runner);
 x.history.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const r of x.history)r.rows.sort((a,b)=>a.runner-b.runner);
 const c=validateGenerated(x,{allowExternalPeers:true});if(!c.valid)throw Error('V19_INPUT:'+c.errors.join(','));return x;
}
const run=(p,rr=[],mechanisms=[])=>runGenerated(p,{allowExternalPeers:true,versioned:true,researchReturn:rr,mechanisms});
function returns(common,disabled){
 const rs=[];
 for(const h of common.eye)for(const e of h.items){
  if(disabled.includes(e.eye_item_id))continue;
  for(const f of e.observed_facts){
   const kind=f.type==='OBSERVED_RANK_RECOVERY'?'POSITION_RECOVERY':f.type==='RETURN_TO_CONDITION'?'CONDITION_RETURN':f.type==='SHARE_WITH_STYLE_AND_PACE'?'FIELD_SHARE':null;
   if(kind)rs.push({horse_id:h.horse_id,eye:e.eye_item_id,kind,race_id:f.value.race_id??null,source_refs:uniq(f.evidence_ids??[])});
   if(f.type==='PEER_FOLLOWUP'){
    const v=f.value,prefix=v.peer_id+'|FIXTURE|';
    if(typeof v.shared_followup_key==='string'&&v.shared_followup_key.startsWith(prefix))rs.push({horse_id:h.horse_id,eye:e.eye_item_id,kind:'PEER_FOLLOWUP',race_id:v.prior_race_id,later_race:v.shared_followup_key.slice(prefix.length),peer_id:v.peer_id,source_refs:uniq(f.evidence_ids??[])});
   }
  }
 }
 return [...new Map(rs.map(r=>[JSON.stringify([r.horse_id,r.kind,r.race_id,r.later_race,r.peer_id]),r])).values()];
}
function profile(p,h){
 const id=h.horse_id,observed=facts(h,'58').flatMap(f=>f.value.segment_positions??[]).map(z=>{const r=p.history.find(q=>q.id===z.race_id),x=row(r,id);if(!r||!x)throw Error('PROFILE_BIND');return {...observation(r,x),applicability:scope(r.conditions,p.target.conditions),weight_match:x.kg===p.target.entrants.find(t=>t.id===id).kg};});
 const matched=observed.filter(o=>o.applicability.state==='MATCHED_HISTORICAL'&&o.weight_match);
 const recent=observed.slice().sort((a,b)=>p.history.find(x=>x.id===b.race).date.localeCompare(p.history.find(x=>x.id===a.race).date))[0]??null;
 return {id,observed,matched,lead:matched.filter(o=>o.early===1).map(o=>o.race),forward:matched.filter(o=>o.early>1&&o.early<=3&&o.early<o.field).map(o=>o.race),advance:matched.filter(o=>o.early>o.last).map(o=>o.race),latest:recent,unknown:matched.length===0,any_corner_top3:recent?recent.positions.some(x=>x<=3):null};
}
function scenarios(profiles){
 const leaders=profiles.filter(x=>x.lead.length).map(x=>x.id),forward=profiles.filter(x=>x.forward.length).map(x=>x.id),unknown=profiles.filter(x=>x.unknown).map(x=>x.id),ids=profiles.map(x=>x.id),out=[];
 const make=(id,leader,pressure,pace,challengers)=>out.push({id,leader,pressure,pace_hypothesis:pace,challengers,roster:ids,unknown_profiles:unknown,assumed:true,probability:null,actual_pace:null,assumptions:[leader?'Only one leader at early checkpoint':'Leader not assigned',pressure==='CONTEST'?'Named challengers try to advance; leader may change':'No other runner insists on early lead',pace==='UNRESOLVED'?'No pace assertion':'Pace is independent scenario assumption, not inferred from challenger count']});
 for(const id of leaders){
  const rivals=uniq([...leaders,...forward,...unknown].filter(x=>x!==id));
  make('SETTLE:'+id,id,'SETTLE','UNRESOLVED',[]);
  if(rivals.length){make('CONTEST-SUSTAIN:'+id,id,'CONTEST','SUSTAINED_PRESSURE_POSSIBLE',rivals);make('CONTEST-EASE:'+id,id,'CONTEST','PRESSURE_EASES_POSSIBLE',rivals);}
 }
 // Unknown / unobserved lead alternative remains even when no known lead.
 make('LEADER-UNKNOWN',null,'UNRESOLVED','UNRESOLVED',[]);
 return {leaders,forward,unknown,scenarios:out,exclusive_scenarios:true,pace_inferred_from_count:false};
}
function comparisons(p,id,h){
 const card=p.target.entrants.find(x=>x.id===id),rivals=p.target.entrants.filter(x=>x.id!==id);
 const direct=[],indirect=[],later=[];
 for(const f of facts(h,'35')){
  const v=f.value,r=p.history.find(x=>x.id===v.shared_race),x=row(r,id),y=row(r,v.pair_ids[1]),t=rivals.find(a=>a.id===y?.id);if(!x||!y||!t)continue;
  const s=scope(r.conditions,p.target.conditions),weight=x.kg-y.kg===card.kg-t.kg;
  direct.push({rival:y.id,race:r.id,observed:x.finish<y.finish?'AHEAD':'BEHIND',gap_tenths:x.clock_tenths-y.clock_tenths,field:r.field_count,scope:s,relative_weight_matched:weight,roots:[ref(r.id,id),ref(r.id,y.id)],state:s.state==='MATCHED_HISTORICAL'&&weight?(x.finish<y.finish?'CONDITIONAL_SUPPORT':'SCOPED_COUNTER'):s.state==='PARTIAL_HYPOTHESIS'?'APPLICABILITY_UNESTABLISHED':'UNKNOWN'});
 }
 for(const f of facts(h,'36')){
  const v=f.value,[a,b]=v.race_links.map(k=>p.history.find(r=>r.id===k)),x=row(a,id),q=row(a,v.common_peer_id),y=row(b,v.other_id),z=row(b,v.common_peer_id),t=rivals.find(r=>r.id===v.other_id);if(!x||!q||!y||!z||!t||a.id===b.id)continue;
  const scopes=[scope(a.conditions,p.target.conditions),scope(b.conditions,p.target.conditions),scope(a.conditions,b.conditions)],weights=x.kg-q.kg===y.kg-z.kg&&x.kg-y.kg===card.kg-t.kg;
  const signs=[Math.sign(x.finish-q.finish),Math.sign(y.finish-z.finish)];
  indirect.push({rival:v.other_id,peer:v.common_peer_id,races:[a.id,b.id],signs,scopes,roots:[ref(a.id,id),ref(a.id,q.id),ref(b.id,y.id),ref(b.id,z.id)],state:scopes.every(s=>s.state==='MATCHED_HISTORICAL')&&weights&&signs[0]!==signs[1]?(signs[0]<0?'CONDITIONAL_SUPPORT':'SCOPED_COUNTER'):'APPLICABILITY_UNESTABLISHED',missing:['COMMON_PEER_FORM_STABILITY','JOINT_FIELD_ORDER']});
 }
 for(const f of facts(h,'37')){
  if(f.value.research_return)continue;
  const v=f.value,a=p.history.find(r=>r.id===v.prior_race_id),b=p.history.find(r=>v.shared_followup_key===v.peer_id+'|FIXTURE|'+r.id),x=row(a,id),y=row(a,v.peer_id),z=row(b,v.peer_id),ownLater=row(b,id);if(!x||!y||!z||b.date<=a.date)continue;
  const sa=scope(a.conditions,p.target.conditions),sb=scope(b.conditions,a.conditions);
  const priorAhead=x.finish<y.finish,weight=ownLater&&ownLater.kg-z.kg===x.kg-y.kg;
  let state='NEUTRAL_CONTEXT',reason='Later result alone does not establish subject effect';
  if(sa.state!=='MATCHED_HISTORICAL'||sb.state!=='MATCHED_HISTORICAL'){state='APPLICABILITY_UNESTABLISHED';reason='Conditions not established as comparable';}
  else if(priorAhead&&ownLater&&weight&&ownLater.finish>z.finish){state='SCOPED_COUNTER';reason='Same pair reverses order in later matched race';}
  else if(priorAhead&&z.finish===1){state='CONDITIONAL_SUPPORT';reason='Subject beat a later winner in matched conditions; no current class or victory inference';}
  else if(!priorAhead){reason='Subject did not beat this peer in reference race; later win not a positive subject route';}
  later.push({prior:a.id,later:b.id,peer:y.id,priorAhead,later_finish:z.finish,state,reason,roots:uniq([ref(a.id,id),ref(a.id,y.id),ref(b.id,y.id),...(ownLater?[ref(b.id,id)]:[])]),actual_current_suitability:null});
 }
 return {direct,indirect,later,rivalCoverage:rivals.map(r=>({id:r.id,direct:direct.some(x=>x.rival===r.id&&['CONDITIONAL_SUPPORT','SCOPED_COUNTER'].includes(x.state)),indirect:indirect.some(x=>x.rival===r.id&&['CONDITIONAL_SUPPORT','SCOPED_COUNTER'].includes(x.state))}))};
}
const state=(s,c,u,a)=>s.length&&c.length?'MIXED':c.length?'SCOPED_COUNTER':s.length?'CONDITIONAL_SUPPORT':a.length?'APPLICABILITY_UNESTABLISHED':u.length?'UNKNOWN':'NO_SUPPORT_OBSERVED';
const view=(s=[],c=[],u=[],a=[],neutral=[])=>({state:state(s,c,u,a),support:s,counter:c,unknown:u,unestablished:a,neutral,actual_current_suitability:null});
function evaluate(p,common,field,profiles,old){
 return profiles.map(pr=>{
  const id=pr.id,h=common.merged.find(x=>x.horse_id===id),comp=comparisons(p,id,h),prior=old?.find(x=>x.id===id);
  const own=pr.observed,matching=pr.matched,good=matching.filter(o=>o.finish<=3&&o.beaten>0),last=matching.filter(o=>o.finish===o.field),partial=own.filter(o=>o.applicability.state==='PARTIAL_HYPOTHESIS'),held=own.filter(o=>!['MATCHED_HISTORICAL','PARTIAL_HYPOTHESIS'].includes(o.applicability.state));
  const conditionReturn=facts(h,'43').filter(f=>f.value.research_return==='EYE-07').map(f=>({value:f.value,roots:f.evidence_ids,positive:f.value.relative_finish>f.value.previous_relative_finish&&f.value.relative_finish>0,negative:f.value.relative_finish<f.value.previous_relative_finish}));
  const scopedSupport=comp.direct.filter(x=>x.state==='CONDITIONAL_SUPPORT'),scopedCounter=comp.direct.filter(x=>x.state==='SCOPED_COUNTER'),pair=comp.indirect.filter(x=>x.state==='CONDITIONAL_SUPPORT'),pairCounter=comp.indirect.filter(x=>x.state==='SCOPED_COUNTER');
  const laterSupport=comp.later.filter(x=>x.state==='CONDITIONAL_SUPPORT'),laterCounter=comp.later.filter(x=>x.state==='SCOPED_COUNTER');
  const derived100=h.items['100'].hypotheses.flatMap(x=>x.value.winning_paths??[]);
  const peerReturn=facts(h,'37').filter(f=>f.value.research_return==='EYE-05');
  const review=h.items['73'].hypotheses.filter(f=>f.value.research_return==='EYE-03').map(f=>({value:f.value,roots:f.evidence_ids}));
  const cases=field.scenarios.map(s=>{
   const isLead=s.leader===id,challenger=s.challengers.includes(id),otherLeader=s.leader&&s.leader!==id;
   const compatible=[],conflicts=[],unknown=[],conditional=[];
   for(const o of matching){
    const lead=o.early===1,progress=o.early>o.last,competitive=o.finish<=3&&o.beaten>0;
    const path=lead?'LEAD':progress?'ADVANCE':'NONLEAD';
    const roots=o.roots;
    if((lead&&otherLeader&&!challenger)||(!lead&&isLead)){conflicts.push({race:o.race,path,reason:'Historical early position conflicts with assigned scenario role',roots,scope:'PATH_CONFLICT_NOT_ABILITY_COUNTER'});continue;}
    if(o.finish===o.field){conflicts.push({race:o.race,path,reason:'Finished last in historical field; raw top3 does not establish competitive placing',roots,scope:'HISTORICAL_COUNTER_CONTEXT'});continue;}
    if(!competitive){unknown.push({race:o.race,path,reason:'No top3 competitive historical witness in this run',roots});continue;}
    if(s.pressure==='CONTEST'&&(lead||challenger)){conditional.push({race:o.race,path,kind:o.finish===1?'WIN':'PLACE',roots,reason:'Position pattern observed, but pressure persistence and rival responses not measured',state:'APPLICABILITY_UNESTABLISHED'});continue;}
    if(s.leader===null){conditional.push({race:o.race,path,kind:o.finish===1?'WIN':'PLACE',roots,reason:'Early field order unresolved',state:'APPLICABILITY_UNESTABLISHED'});continue;}
    compatible.push({race:o.race,path,kind:o.finish===1?'WIN':'PLACE',roots,reason:'Matched historical position/result pattern compatible with assigned early role; other runners and current finish unproven',state:'CONDITIONAL_SUPPORT'});
   }
   // No prior win is required, but beating a single rival cannot establish
   // whole-field viability. Require competitive matched placing + actual current rival.
   const noWinAlternative=good.filter(o=>o.finish!==1).flatMap(o=>scopedSupport.filter(e=>e.race===o.race).map(e=>({race:o.race,path:'PAIRWISE_ALTERNATIVE',kind:'WIN',roots:uniq([...o.roots,...e.roots]),rival:e.rival,reason:'Competitive placing ahead of current rival; other rivals and role transfer unresolved',state:'APPLICABILITY_UNESTABLISHED'})));
   conditional.push(...noWinAlternative);
   if(!matching.length)unknown.push({reason:'No matched condition history or relative weight witness'});
   if(field.unknown.some(x=>x!==id))unknown.push({reason:'Unresolved rival early profile',rivals:field.unknown.filter(x=>x!==id)});
   const others=comp.rivalCoverage.filter(x=>!x.direct&&!x.indirect).map(x=>x.id);
   if(others.length)unknown.push({reason:'Pairwise comparison coverage missing',rivals:others});
   return {scenario:s.id,role:isLead?'ASSUMED_LEADER':challenger?'POSSIBLE_CHALLENGER':s.leader?'NONLEAD_OR_YIELD':'UNRESOLVED',support:compatible,unestablished:conditional,counter:conflicts,unknown,rival_edges:comp.direct,other_runners:s.roster.filter(x=>x!==id),actual_win_viability:'NOT_ESTABLISHED',joint_winner:null};
  });
  const unestablished=[...partial,...held,...own.filter(o=>!o.weight_match)],missing=own.length?[]:[{reason:'NO_HISTORY'}];
  const A=view(good,last,missing,unestablished);
  const B=view(good, last,missing,unestablished,conditionReturn);
  const C=view([...scopedSupport,...pair],[...scopedCounter,...pairCounter],comp.rivalCoverage.filter(x=>!x.direct&&!x.indirect),[...comp.direct,...comp.indirect].filter(x=>x.state==='APPLICABILITY_UNESTABLISHED'));
  const D=view(cases.flatMap(c=>c.support),cases.flatMap(c=>c.counter.filter(x=>x.scope==='HISTORICAL_COUNTER_CONTEXT')),cases.flatMap(c=>c.unknown),cases.flatMap(c=>c.unestablished));
  const E=view([...laterSupport,...conditionReturn.filter(x=>x.positive)], [...laterCounter,...conditionReturn.filter(x=>x.negative),...review.map(x=>({...x,reason:'Position loss observed before recovery; not a current ability rejection'}))],missing,comp.later.filter(x=>x.state==='APPLICABILITY_UNESTABLISHED'),[...comp.later.filter(x=>x.state==='NEUTRAL_CONTEXT'),...conditionReturn.filter(x=>!x.positive&&!x.negative),...review]);
  return {id,history:own,profile:{lead:pr.lead,forward:pr.forward,advance:pr.advance,latest:pr.latest,unknown:pr.unknown},comparisons:comp,conditionReturn,recoveryReview:review,peerReturn,derived100,scenarios:cases,views:{A,B,C,D,E},priorV18:prior?{perspectives:Object.fromEntries(Object.entries(prior.perspectives).map(([k,v])=>[k,v.status])),counter_routes:prior.routes.filter(x=>x.state==='COUNTER_CONTEXT'),historical_facts:prior.observed}:null,rank:null,formal:false};
 });
}
export function analyzeV19(packet,{disabled=[],compareV18=false,reserve=[]}={}){
 const p=normalize(packet),first=run(p);
 // Bounded synthetic reserve discovery includes new peer histories even
 // where no earlier follow-up existed. A peer must share an actual earlier
 // race with a current horse, not merely match name or fixture ID.
 const all=normalize({...p,history:[...p.history,...reserve]});
 const candidates=new Set(p.target.entrants.map(x=>x.id));
 const found=all.history.filter(r=>!p.history.some(x=>x.id===r.id)&&r.rows.some(y=>p.history.some(q=>q.date<r.date&&row(q,y.id)&&q.rows.some(x=>x.id!==y.id&&candidates.has(x.id)))));
 const expanded=normalize({...p,history:[...p.history,...found]});
 const visible=found.length?run(expanded):first,rr=returns(visible,disabled);
 const mechanisms=analyzeV18(expanded,{disabled}).mechanisms.filter(m=>m.eye_id==='EYE-02'&&m.applicability.scope==='MATCHED_CONDITIONS');
 const final=run(expanded,rr,mechanisms);
 const profiles=final.merged.map(h=>profile(expanded,h)),field=scenarios(profiles);
 const old=compareV18?analyzeV18(p).after:null;
 const decisions=evaluate(expanded,final,field,profiles,old);
 const audit=final.ledger.map(l=>{const eye=l.item.startsWith('EYE-'),get=c=>eye?c.eye.find(x=>x.horse_id===l.horse).items.find(x=>x.eye_item_id===l.item):c.merged.find(x=>x.horse_id===l.horse).items[l.item];return {id:l.horse,item:l.item,output:l.output_count,reads:l.instrumented_reads,changed:digest(get(first))!==digest(get(final)),missing:l.output_count===0,semantic_proof:false};});
 const traces=final.trace.filter(x=>/Return$/.test(x.consumer));
 // A joint scenario is mutually exclusive with another leader assignment.
 // Within it, path constraints share exactly one leader; eventual wins
 // remain mutually exclusive and no route counts enter a score.
 const conflicts=field.scenarios.map(s=>({scenario:s.id,leader:s.leader,exclusive_win:'ONE_WINNER_UNLESS_DEAD_HEAT_NOT_MODELED',other_lead_paths_incompatible:profiles.filter(x=>s.leader&&x.id!==s.leader&&x.lead.length).map(x=>x.id),nonlead_compatible_subjects:profiles.filter(x=>x.id!==s.leader).map(x=>x.id)}));
 return {scope:'SYNTHETIC_RESEARCH_ONLY',raw_version_initial:digest(p),raw_version_final:digest(expanded),returned_version:digest([rr,mechanisms]),mechanisms,disclosed:found.map(r=>r.id),held:reserve.filter(r=>!found.some(x=>x.id===r.id)).map(r=>r.id),returns:rr,traces,field,conflicts,decisions,audit,formal:false,release_eligible:false};
}
export const prototype=()=>toCommonV16(prototypePacket());
export {heterogeneous};
