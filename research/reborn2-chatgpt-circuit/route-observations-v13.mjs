// Research propositions, not a scoring or probability system.
const uniq=a=>[...new Set(a)].sort();
const validRank=(n,size)=>Number.isInteger(n)&&n>=1&&n<=size;
const compare=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function leaderWindows(splits){
 if(!Array.isArray(splits)||!splits.length)return null;
 let last=0;for(const s of splits){if(s.start_m!==last||!Number.isInteger(s.end_m)||s.end_m<=last||!Number.isInteger(s.elapsed_tenths)||s.elapsed_tenths<=0)return null;last=s.end_m;}
 const window=(start,end)=>{const a=splits.filter(s=>s.start_m>=start&&s.end_m<=end);return a.length&&a[0].start_m===start&&a.at(-1).end_m===end?a.reduce((n,s)=>n+s.elapsed_tenths,0):null;};
 const early=window(0,600),late=window(last-600,last);
 return {distance_m:last,early600_tenths:early,last600_tenths:late,late_minus_early_tenths:early!==null&&late!==null&&last>=1200?late-early:null,measurement_scope:'RACE_LEADER_NOT_INDIVIDUAL',interpolated:false};
}
export function observedRoutePropositions({horse,kind,scenario,history,partialMatch,card,typed,peerContext,traceRead}){
 const id=horse.horse_id, read=(item,obs,reason)=>{if(obs.length)traceRead({consumer:'observedRoutePropositions',consumer_item_id:'100',horse_no:horse.horse_no,item_id:item,value:obs,reason});};
 const vals=(item,r)=>typed?.items?.[item]?.observations?.filter(o=>o.value.race_id===r)??[];
 const facts=[],supports=[],counters=[],unknowns=[],peerEvidence=[],shapeSupports=[],shapeCounters=[],shapeUnknowns=[];
 const pred=n=>kind==='WIN'?n===1:n<=3;
 for(const g of history){const f=g.record.fact,r=g.record.race_id;if(!validRank(f.finish,f.field_size)||f.start_status!=='FINISHED')continue;
  const same=partialMatch(g);
  const pp=vals('17',r),ll=vals('19',r),tt=vals('18',r);
  const positions=pp.length===1?pp[0].value.positions:[],complete=positions.length===4&&positions.every((p,i)=>p.segment===i+1&&p.rank_min===p.rank_max&&validRank(p.rank_min,f.field_size));
  const lead=positions.find(p=>p.segment===1)?.rank_min??null,last=positions.find(p=>p.segment===4)?.rank_min??null;
  const early=lead===null?'UNKNOWN':lead===1?'LEAD':lead<=3?'FORWARD':'OUTSIDE_TOP3';
  const pattern=complete?(last<lead?'GAIN':last>lead?'LOSS':'STABLE'):'UNKNOWN';
  const lap=ll.length===1?leaderWindows(ll[0].value.splits):null;
  read('17',pp,'Historical observed initial and final corner ranks determine route pattern only');
  read('18',tt,'Actual adjacent transitions consumed; not individual acceleration');
  read('19',ll,'Leader windows used as historical race context, no individual split or current forecast');
  const refs=uniq([...g.evidence_ids,...(card?.evidence_ids??[]),...pp.flatMap(o=>o.evidence_ids),...tt.flatMap(o=>o.evidence_ids),...ll.flatMap(o=>o.evidence_ids)]);
  const event={race_id:r,finish:f.finish,field_size:f.field_size,same_recorded_conditions:same,early_position:early,first_corner:lead,fourth_corner:last,position_pattern:pattern,adjacent_transitions:tt.flatMap(o=>o.value.transitions??[]),leader_windows:lap,evidence_ids:refs,scope:'HISTORICAL_FICTIONAL_OBSERVATION',current_effect:null};
  facts.push(event);
  if(!same)continue;
  if(scenario!=='CONDITION_MATCH_ONLY'){unknowns.push({code:'HISTORICAL_CONTEST_OR_YIELD_NOT_WITNESSED',race_id:r,observed_early:early,observed_pattern:pattern,evidence_ids:refs});continue;}
  const proposition={code:kind==='WIN'?'RECORDED_CONDITION_WIN_REACH':'RECORDED_CONDITION_TOP3_REACH',...event,formal_comparability:false};
  (pred(f.finish)?supports:counters).push({...proposition,polarity:pred(f.finish)?'SUPPORT':'COUNTER',scope:'OBSERVED_FINISH_REACH_ONLY_NOT_CURRENT_STRENGTH'});
  if(complete){
   const routeCode=early==='LEAD'?'EARLY_LEAD_ROUTE':early==='FORWARD'?'FORWARD_ROUTE':'OUTSIDE_TOP3_ROUTE';
   (pred(f.finish)?supports:counters).push({...event,code:routeCode,polarity:pred(f.finish)?'SUPPORT':'COUNTER',scope:'OBSERVED_POSITION_AND_FINISH_NOT_CAUSAL'});
     if(lap?.late_minus_early_tenths!=null){
    const paceShape=lap.late_minus_early_tenths>0?'LEADER_LAST600_SLOWER':lap.late_minus_early_tenths<0?'LEADER_LAST600_FASTER':'LEADER_600_EQUAL';
    const e={...event,code:routeCode+'|'+paceShape,position_route:routeCode,leader_shape:paceShape,polarity:pred(f.finish)?'SUPPORT':'COUNTER',scope:'OBSERVED_FINISH_UNDER_MEASURED_LEADER_SHAPE_NOT_CAUSAL',current_effect:null};
    (pred(f.finish)?shapeSupports:shapeCounters).push(e);
   }else shapeUnknowns.push({race_id:r,code:'EQUAL_DISTANCE_LEADER_WINDOWS_MISSING',position_route:routeCode,evidence_ids:refs});
  }else{unknowns.push({code:'COMPLETE_POSITION_PATTERN_MISSING',race_id:r,evidence_ids:refs});shapeUnknowns.push({race_id:r,code:'COMPLETE_POSITION_PATTERN_MISSING',evidence_ids:refs});}
 }
 // An identified opponent's later result supports or contradicts ONLY a narrow
 // retrospective peer-performance proposition, never the subject's current win ability.
 for(const p of peerContext??[]){
  const v=p.value,prior=facts.find(r=>r.race_id===v.prior_race_id),own=history.find(g=>g.record.race_id===v.prior_race_id);
  if(!prior||!own||!Number.isInteger(v.peer_finish)||v.peer_finish<1||v.source_availability!=='FICTIONAL_LINKED_PARTIAL_NO_FULL_FIELD')continue;
  const relation=v.peer_prior_finish==null?'UNKNOWN':v.peer_prior_finish<own.record.fact.finish?'PEER_AHEAD':v.peer_prior_finish>own.record.fact.finish?'PEER_BEHIND':'TIE_OR_UNKNOWN';
  if(scenario!=='CONDITION_MATCH_ONLY')continue;
  const e={code:'IDENTIFIED_PAST_PEER_LATER_TOP3',race_id:v.prior_race_id,peer_id:v.peer_id,later_race_id:v.later_race_id,peer_later_finish:v.peer_finish,prior_relation:relation,polarity:v.peer_finish<=3?'SUPPORT':'COUNTER',scope:'PARTIAL_PEER_RESULT_NOT_SUBJECT_WIN_SUPPORT',evidence_ids:p.evidence_ids,current_effect:null};
  peerEvidence.push(e);
 }
 read('37',peerEvidence,'Observed later finish meets or fails the retrospective peer-top3 proposition; subject strength unvalidated');
 if(!facts.length)unknowns.push({code:'NO_HISTORICAL_RESULT',evidence_ids:[]});
 if(!supports.length&&!counters.length)unknowns.push({code:'NO_APPLICABLE_FINISH_ROUTE_OBSERVATION',evidence_ids:[]});
 const frontFacts=facts.filter(x=>x.same_recorded_conditions&&x.position_pattern!=='UNKNOWN');
 const families=['EARLY_LEAD_ROUTE','FORWARD_ROUTE','OUTSIDE_TOP3_ROUTE'].map(code=>{const s=supports.filter(x=>x.code===code),c=counters.filter(x=>x.code===code);return {code,support_race_ids:s.map(x=>x.race_id),counter_race_ids:c.map(x=>x.race_id),historical_status:s.length&&c.length?'MIXED':s.length?'SUPPORT':c.length?'COUNTER':'UNKNOWN'};});
 const shapeFamilies=uniq([...shapeSupports,...shapeCounters].map(x=>x.code)).map(code=>{const s=shapeSupports.filter(x=>x.code===code),c=shapeCounters.filter(x=>x.code===code);return {code,support_race_ids:s.map(x=>x.race_id),counter_race_ids:c.map(x=>x.race_id),historical_status:s.length&&c.length?'MIXED':s.length?'SUPPORT':'COUNTER'};});
 return {scope:'HISTORICAL_RESEARCH_ONLY',leader_shape_support:shapeSupports,leader_shape_counter:shapeCounters,leader_shape_families:shapeFamilies,leader_shape_unknowns:shapeUnknowns,historical_observations:facts,finish_and_position_support:supports,finish_and_position_counter:counters,route_families:families,peer_proposition_support:peerEvidence.filter(x=>x.polarity==='SUPPORT'),peer_proposition_counter:peerEvidence.filter(x=>x.polarity==='COUNTER'),unknowns,scenario_witness_status:scenario==='CONDITION_MATCH_ONLY'?'NOT_REQUIRED':'UNKNOWN',current_support_strength:null,formal_effect:null};
}
