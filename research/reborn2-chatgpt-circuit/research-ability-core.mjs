// Shared research primitives. No score, odds, grade or prediction.
export const uniq=a=>[...new Set(a)];
export function dependencyReader(all,withdraw=null,extra=()=>[]){
 const memo=new Map();
 function get(id,stack=new Set()){
  if(memo.has(id))return memo.get(id);
  const e=all.get(id);
  if(!e||id===withdraw||stack.has(id))return null;
  const next=new Set(stack).add(id);
  const deps=uniq([...(e.depends_on??[]),...extra(e)]).filter(k=>k!==id);
  const result=deps.every(k=>get(k,next))?e:null;
  memo.set(id,result);return result;
 }
 const lineage=ids=>{const seen=new Set();function walk(id){if(seen.has(id)||!get(id))return;seen.add(id);const e=all.get(id);for(const k of [...(e.depends_on??[]),...extra(e)])walk(k);}ids.filter(Boolean).forEach(walk);return [...seen].map(id=>all.get(id));};
 return {get,lineage};
}
export function relativePosition(rank,count){
 if(!Number.isInteger(rank)||!Number.isInteger(count)||rank<1||rank>count)return null;
 return {rank,field_count:count,relative_from_front:count>1?(rank-1)/(count-1):null,horses_ahead_of_subject:rank-1,horses_behind_subject:count-rank};
}
export function ordinalPath(ranks){
 if(!Array.isArray(ranks))return null;
 const transitions=ranks.slice(1).map((v,i)=>({from_index:i,to_index:i+1,ordinal_gain:ranks[i]-v,kind:ranks[i]>v?'RANK_GAIN':ranks[i]<v?'RANK_LOSS':'RANK_UNCHANGED'}));
 const gains=transitions.filter(t=>t.ordinal_gain>0),losses=transitions.filter(t=>t.ordinal_gain<0);
 const recovery=losses.some(l=>gains.some(g=>g.from_index>l.from_index));
 return {transitions,recovery,pattern:recovery?'LOSS_THEN_RECOVERY':gains.length&&losses.length?'GAIN_THEN_LOSS':gains.length?'ADVANCE':losses.length?'RETREAT':'MAINTAIN'};
}
export const signedGap=(subject,rival)=>Number.isFinite(subject)&&Number.isFinite(rival)?rival-subject:null;
export function conditionDelta(old,now){return Number.isFinite(old)&&Number.isFinite(now)?now-old:null;}
export function winPlaceRequirements(rivals,threshold=null){
 return {WIN:{required:'FINISH_AHEAD_OF_EVERY_ACTIVE_RIVAL',rivals},PLACE:{required:'FINISH_WITHIN_SPECIFIED_THRESHOLD',threshold,rivals,allowed_ahead:threshold===null?null:threshold-1}};
}

 // Conditional rank envelope only: assumes the relative order of observed current rivals from one past race repeats.
export function repeatEnvelope(ownFinish,observedRivals,unobserved,threshold=null){
 if(!Number.isInteger(ownFinish))return null;
 const ahead=observedRivals.filter(r=>r.finish<ownFinish).length;
 const behind=observedRivals.length-ahead;
 const min=1+ahead,max=min+unobserved.length;
 return {assumption:'IF_PAST_RELATIVE_ORDER_AMONG_CURRENT_RIVALS_REPEATS',known_ahead:ahead,known_behind:behind,unknown_rivals:unobserved,conditional_finish_range:[min,max],win:{required_reversals:ahead,unknown_rivals_to_beat:unobserved,possible_under_repeat:min===1,guaranteed_under_repeat:max===1},place:threshold===null?null:{hypothetical_threshold:threshold,required_reversals_if_unknown_behind:Math.max(0,min-threshold),possible_under_repeat:min<=threshold,guaranteed_under_repeat:max<=threshold},prediction:false};
}
