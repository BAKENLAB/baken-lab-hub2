import {runGenerated} from './v15-research.mjs';
import {toCommonV16} from './synthetic-generator-v16.mjs';
const uniq=a=>[...new Set(a)].sort();
const facts=(h,k)=>h.items[k]?.facts??[];
const hypotheses=(h,k)=>h.items[k]?.hypotheses??[];
const same=(a,b)=>['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility'].every(k=>a[k]!=null&&a[k]===b[k]);
// Conditional research conclusions, not a calibrated prediction or SABC/EYE selection.
// Scenarios are assumptions derived from observed alternatives; no probabilities.
export function synthesizeV16(packet,common,{useEye=true}={}){
 const field=packet.target.entrants.map(x=>x.id),rows=common.merged;
 if(rows.length!==field.length||field.some(id=>!rows.some(h=>h.horse_id===id)))throw Error('ROSTER');
 const profiles=rows.map(h=>{
 const h58=facts(h,'58').flatMap(f=>f.value.segment_positions??[]);
 const early=facts(h,'59')[0];
 return {id:h.horse_id,early_top3:early?.value.early_top3??'UNKNOWN',any_top3:early?.value.top3_any_corner??'UNKNOWN',latest_refs:early?.evidence_ids??[],matched_lead:h58.filter(x=>x.conditions_match&&x.positions[0]?.rank_max===1).map(x=>x.race_id)};
 });
 const leaders=profiles.filter(x=>x.matched_lead.length).map(x=>x.id);
 return rows.map(h=>{
 const id=h.horse_id,eye=common.eye.find(x=>x.horse_id===id),own=packet.history.flatMap(r=>r.rows.filter(x=>x.id===id).map(x=>({r,x})));
 const p58=facts(h,'58'),p35=facts(h,'35'),p99=facts(h,'99');
 const hist=p58.flatMap(f=>(f.value.segment_positions??[]).map(v=>({v,refs:f.evidence_ids})));
 const comparison=p35.map(f=>({v:f.value,refs:f.evidence_ids}));
 const routes=[],consumed=[];
 const trace=(item_ids,root,role,route)=>consumed.push({item_ids,root,role,route});
 for(const {r,x} of own){
 const pos=hist.find(q=>q.v.race_id===r.id);
 const matched=p99.some(f=>(f.value.matched_runs??[]).some(v=>v.race_id===r.id))&&same(r.conditions,packet.target.conditions);
 const comparisons=comparison.filter(q=>q.v.shared_race===r.id&&q.v.comparable_conditions===true);
 const peers=r.rows.filter(z=>z.id!==id),card=packet.target.entrants.find(z=>z.id===id);
 const weightsMatch=peers.every(z=>{const a=packet.target.entrants.find(t=>t.id===z.id);return a&&card.kg-a.kg===x.kg-z.kg;});
 const core=matched&&!!pos&&comparisons.length===field.length-1&&weightsMatch;
 const root=JSON.stringify([r.id,id]);
 const refs=uniq([...(pos?.refs??[]),...comparisons.flatMap(q=>q.refs),...p99.flatMap(q=>q.evidence_ids)]);
 const early=pos?.v.positions[0]?.rank_min,last=pos?.v.positions.at(-1)?.rank_min;
 const outcomes={win:x.finish===1,place:x.finish<=3};
 const make=(kind,mechanism,scenario,state,reason,items,extra={})=>{
 const route={id:root+'|'+kind+'|'+mechanism+'|'+scenario,horse_id:id,root,kind,mechanism,scenario,state,reason,items,refs,...extra};routes.push(route);
 if(state!=='UNKNOWN')trace(items.filter(k=>['35','58','99','EYE-02'].includes(k)),root,state,route.id);
 };
 // Each historical placing/win stays factual regardless of present applicability.
 for(const kind of ['WIN','PLACE']){
 const attained=kind==='WIN'?outcomes.win:outcomes.place;
 if(!attained)continue;
 if(early===1){
 const rivals=leaders.filter(q=>q!==id);
 make(kind,'LEAD','SETTLE',core?'CONDITIONAL_SUPPORT':'UNKNOWN',core?'Matched observed lead and outcome, conditional on securing similar early position; rival response unconfirmed.':'Missing essential match, positions, opponent coverage or relative weights.',['35','58','61','99'],{rivals});
 if(rivals.length)make(kind,'LEAD','CONTEST', 'UNKNOWN','Other observed lead candidates: easy lead witness does not establish contested route.',['58','65'],{rivals});
 }else if(early!=null){
 make(kind,'NON_LEAD','POSITION_REPRODUCED',core?'CONDITIONAL_SUPPORT':'UNKNOWN',core?'Observed non-leading position and attained result against same field; conditionally transferable, not proof of current finish.':'Essential comparison or position not established.',['35','58','99']);
 }
 }
 if(core&&early===1&&!outcomes.win)make('WIN','LEAD','SETTLE','COUNTER_CONTEXT','Recorded early lead did not win; limits repeatability, not proof of no current win.',['35','58','99']);
 if(core&&early===1&&!outcomes.place)make('PLACE','LEAD','SETTLE','COUNTER_CONTEXT','Recorded lead did not place; applies to lead pathway only.',['35','58','99']);
 // EYE02 uses actual subject-specific observed transitions, not a peer-only flag.
 const discoveries=useEye?(eye?.items.find(e=>e.eye_item_id==='EYE-02')?.observed_facts??[]).filter(o=>o.type==='FINISH_POSITION_CONTENT'&&o.value.race_id===r.id&&o.value.condition_match===true&&o.value.transitions.some(t=>t.definite_gain>0)):[];
 if(discoveries.length&&core&&outcomes.place&&early>last){
 make('PLACE','ADVANCE','MIDRACE_PROGRESS_AVAILABLE','CONDITIONAL_SUPPORT','Subject advanced in observed comparable race and placed; conditional alternative to maintaining the lead.',['17','18','35','58','99','EYE-02'],{refs:uniq([...refs,...discoveries.flatMap(o=>o.evidence_ids)]),root_reused:true});
 if(outcomes.win)make('WIN','ADVANCE','MIDRACE_PROGRESS_AVAILABLE','CONDITIONAL_SUPPORT','Subject advanced and won in observed comparable race; does not prove current acceleration or pace.',['17','18','35','58','99','EYE-02'],{refs:uniq([...refs,...discoveries.flatMap(o=>o.evidence_ids)]),root_reused:true});
 }
 }
 // No-win alternative: every rival has separately been beaten by the subject
 // in matched comparisons, and the subject placed. Cross-race pairwise support
 // is not a joint finish order. Record a conditional hypothesis only.
 if(!own.some(q=>q.x.finish===1)){
 const ahead=routes.filter(r=>r.kind==='PLACE'&&r.state==='CONDITIONAL_SUPPORT');
 const matches=comparison.filter(q=>q.v.comparable_conditions===true&&q.v.outcome==='AHEAD'&&ahead.some(r=>JSON.parse(r.root)[0]===q.v.shared_race));
 const beaten=uniq(matches.flatMap(q=>q.v.pair_ids.filter(p=>p!==id)));
 if(ahead.length&&field.filter(p=>p!==id).every(p=>beaten.includes(p))){
 const route={id:id+'|WIN|CROSS_RACE_ALTERNATIVE',horse_id:id,root:null,roots:uniq(ahead.map(r=>r.root)),kind:'WIN',mechanism:'CROSS_RACE_ALTERNATIVE',scenario:'JOINT_TRANSFER_UNESTABLISHED',state:'CONDITIONAL_HYPOTHESIS',reason:'Subject has placed and beaten each rival separately in matched contexts; joint transfer and actual win remain unproven.',items:['35','58','99'],refs:uniq(matches.flatMap(q=>q.refs))};routes.push(route);trace(route.items,route.roots.join('|'),route.state,route.id);
 }
 }
 const supporting=routes.filter(r=>r.state==='CONDITIONAL_SUPPORT'),counter=routes.filter(r=>r.state==='COUNTER_CONTEXT'),unk=routes.filter(r=>r.state==='UNKNOWN');
 const by=kind=>supporting.filter(r=>r.kind===kind).map(r=>r.id);
 const mechanism_review=uniq(routes.map(r=>r.kind+'|'+r.mechanism+'|'+r.scenario)).map(k=>{const a=routes.filter(r=>r.kind+'|'+r.mechanism+'|'+r.scenario===k),s=a.filter(r=>r.state==='CONDITIONAL_SUPPORT'),c=a.filter(r=>r.state==='COUNTER_CONTEXT');return {key:k,status:s.length?(c.length?'MIXED':'CONDITIONAL_SUPPORT'):c.length?'COUNTER_CONTEXT':a.some(r=>r.state==='CONDITIONAL_HYPOTHESIS')?'CONDITIONAL_HYPOTHESIS':'UNKNOWN',support:s.map(r=>r.id),counter:c.map(r=>r.id),roots:uniq(a.flatMap(r=>r.root?[r.root]:r.roots??[]))};});
 const observed=own.map(({r,x})=>({race:r.id,finish:x.finish,margin_tenths:x.margin_tenths,root:JSON.stringify([r.id,id])}));
 const current=routes.filter(r=>r.mechanism==='ADVANCE'),fieldEarly=profiles.map(p=>({id:p.id,early:p.early_top3,any:p.any_top3,refs:p.latest_refs}));
 const perspectives={
 A:{status:observed.some(r=>r.finish<=3)?'SUPPORT':'UNKNOWN',historical:observed,items:['35','99']},
 B:{status:supporting.length?'SUPPORT':'UNKNOWN',routes:supporting.map(r=>r.id),essential_unknown:unk.map(r=>r.id),peripheral_unknown:['unmeasured current workout not used for historical conditional route'],items:['58','99']},
 C:{status:comparison.some(q=>q.v.comparable_conditions&&q.v.outcome==='AHEAD')?(comparison.some(q=>q.v.comparable_conditions&&q.v.outcome==='BEHIND')?'MIXED':'SUPPORT'):comparison.some(q=>q.v.comparable_conditions&&q.v.outcome==='BEHIND')?'COUNTER':'UNKNOWN',direct:comparison,items:['35']},
 D:{status:supporting.length&&counter.length?'MIXED':supporting.length?'SUPPORT':counter.length?'COUNTER':'UNKNOWN',fieldEarly,lead_candidates:leaders,routes:routes.map(r=>r.id),items:['58','59','61','65']},
 E:{status:current.length&&counter.length?'MIXED':current.length?'SUPPORT':counter.length?'COUNTER':'UNKNOWN',eye_return:current.map(r=>r.id),counter:counter.map(r=>r.id),items:['EYE-02','58','99']}
 };
 return {id,observed,routes,mechanism_review,winning_conditional:by('WIN'),placing_conditional:by('PLACE'),perspectives,consumed,formal:false,current_strength:null,candidate_rank:null,eye_candidate:null};
 });
}
export function analyzeV16(packet,options={}){const common=runGenerated(toCommonV16(packet));return {common,decisions:synthesizeV16(packet,common,options),formal:false};}
