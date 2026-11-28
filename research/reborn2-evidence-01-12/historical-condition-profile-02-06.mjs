// REBORN2 research 02–06 performance profiles; feeds the future 01 integrated assessment.
// No scores/ranks, final SABC, current ability or release claim. No cross-condition pooling of elapsed clocks or gaps.
// Observed evidence remains separate by condition and source tier. Recency is explicit, not an invented decay factor.
const keys=['track','surface','distance','going','class_name'],items=['02','03','04','05','06'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Math.round(x*1000)/1000;
const id=x=>/^\/JRADB\/accessU\.html\?CNAME=pw01dud[01]0(\d{10})\/[0-9A-F]{2}$/.exec(x??'')?.[1];
const ref=x=>typeof x==='string'?x.replace(/^\/JRADB\/accessS\.html\?CNAME=/,''):null;
const stats=a=>{const b=a.filter(finite).sort((a,b)=>a-b),n=b.length;if(!n)return null;return {n,min:round(b[0]),median:round(n%2?b[Math.floor(n/2)]:(b[n/2-1]+b[n/2])/2),max:round(b[n-1])};};
function summarize(rows){
 const values=k=>rows.map(r=>r.items[k]).filter(v=>v!==null&&v!==undefined);
 const f=values('02'),w=values('03'),n=values('04'),c=values('05'),s=values('06');
 const finish=f.filter(x=>Number.isInteger(x.finish)&&Number.isInteger(x.field_size)&&x.finish>=1&&x.finish<=x.field_size);
 const finishPct=finish.filter(x=>x.field_size>1).map(x=>(x.field_size-x.finish)/(x.field_size-1));
 const speed=c.map(x=>x.within_race_median_residual_seconds).filter(finite);
 const last=s.map(x=>x.median_residual_seconds).filter(finite);
 return {
 '02':{observed_n:finish.length,wins:finish.length?finish.filter(x=>x.finish===1).length:null,top3:finish.length?finish.filter(x=>x.finish<=3).length:null,relative_finish_percentile:stats(finishPct)},
 '03':{observed_n:w.length,gap_seconds:stats(w.map(x=>x.rounded_gap_seconds))},
 '04':{observed_n:n.length,gap_seconds:stats(n.map(x=>x.rounded_gap_to_next_seconds))},
 '05':{observed_n:c.length,elapsed_seconds:stats(c.map(x=>x.elapsed_seconds)),relative_clock_seconds:stats(speed),faster_than_race_median:speed.length?speed.filter(x=>x<0).length:null,course_benchmark:null},
 '06':{observed_n:s.length,reported_final3f_seconds:stats(s.map(x=>x.final3f_seconds)),relative_final3f_seconds:stats(last),faster_than_race_median:last.length?last.filter(x=>x<0).length:null,relative_final3f_rank_percentile:stats(s.filter(x=>Number.isInteger(x.compared)&&x.compared>1&&Number.isInteger(x.relative_rank)&&x.relative_rank>=1&&x.relative_rank<=x.compared).map(x=>(x.compared-x.relative_rank)/(x.compared-1)))}
 };
}
export function profile0206({target,card,extension}){
 if(card?.scoring_authorized!==false||extension?.scoring_authorized!==false||target.target_date!==card.targetDate||!Array.isArray(target.roster)||!Array.isArray(card.rows)||!Array.isArray(extension.runners)||keys.some(k=>target[k]==null)||target.roster.length!==target.field_size)throw Error('INPUT');
 const roster=new Map(target.roster.map(x=>[x.horse_no,id(x.horse_ref)]));
 if(roster.size!==target.field_size||[...roster.values()].some(x=>!x)||new Set(roster.values()).size!==roster.size)throw Error('ROSTER');
 const groups=new Map([...roster.keys()].map(h=>[h,[]])),seen=new Set(),cardKeys=new Set(card.rows.map(r=>JSON.stringify([r.horse_no,ref(r.prior_ref)])));
 function add(r,tier){
  if(!roster.has(r.horse_no)||roster.get(r.horse_no)!==r.horse_id||!/^pw01sde\d+\/[0-9A-F]{2}$/.test(r.source_ref??'')||!/^\d{4}-\d{2}-\d{2}$/.test(r.prior_date??'')||r.prior_date>=target.target_date||!r.source_ref.split('/')[0].endsWith(r.prior_date.replaceAll('-',''))||keys.some(k=>r.conditions?.[k]==null))throw Error('UNBOUND');
  const k=JSON.stringify([r.horse_no,r.source_ref]);if(seen.has(k))throw Error('DUPLICATE');seen.add(k);
  if(tier==='ARCHIVE_ID_MATCH'&&cardKeys.has(k))throw Error('OVERLAP');
  const differences=keys.filter(k=>target[k]!==r.conditions[k]);if(r.class_conflict&&!differences.includes('class_name'))differences.push('class_name');
  const days=(Date.parse(target.target_date)-Date.parse(r.prior_date))/86400000;if(!Number.isInteger(days)||days<=0)throw Error('DATE');
  groups.get(r.horse_no).push({...r,days_since:days,tier,visible_match:differences.length===0,differences});
 }
 for(const r of card.rows){if(r.source_match!==true)continue;add({horse_no:r.horse_no,horse_id:r.horse_id,source_ref:ref(r.prior_ref),prior_date:r.prior_date,conditions:r.conditions,class_conflict:r.class_match!==true,items:Object.fromEntries(items.map(k=>[k,r.items[k]?.status==='RESEARCH_OBSERVATION'?r.items[k].value:null]))},'CARD_ARCHIVE_CROSSCHECK');}
 for(const h of extension.runners){for(const r of h.history){if(r.card_overlap!==false||r.status!=='ARCHIVE_ID_MATCH_RESEARCH_ONLY'||r.final_grade_effect!==null)throw Error('ARCHIVE_GATE');add(r,'ARCHIVE_ID_MATCH');}}
 const runners=[...groups].map(([horse_no,history])=>{
  const bins=new Map();
  for(const r of history){const k=JSON.stringify([r.tier,r.class_conflict===true,keys.map(x=>r.conditions[x])]);const a=bins.get(k)??[];a.push(r);bins.set(k,a);}
  const profiles=[...bins.values()].map(a=>{const b=a.slice().sort((x,y)=>y.prior_date.localeCompare(x.prior_date));return {tier:b[0].tier,conditions:b[0].conditions,visible_match:b[0].visible_match,condition_differences:b[0].differences,history_n:b.length,most_recent_date:b[0].prior_date,days_since_latest:b[0].days_since,source_refs:b.map(r=>r.source_ref),metrics:summarize(b),current_relevance_validated:false};});
  return {horse_no,historical_runs:history.length,visible_condition_profiles:profiles.filter(x=>x.visible_match),other_condition_profiles:profiles.filter(x=>!x.visible_match),current_ability_status:'UNVALIDATED',final_grade_effect:null};
 });
 const coverage=Object.fromEntries(items.map(k=>[k,{observations:[...groups.values()].flat().filter(r=>r.items[k]!=null).length,horses:runners.filter(h=>[...h.visible_condition_profiles,...h.other_condition_profiles].some(p=>p.metrics[k].observed_n>0)).length,visible_condition_horses:runners.filter(h=>h.visible_condition_profiles.some(p=>p.metrics[k].observed_n>0)).length}]));
 return {target_date:target.target_date,circuit:'JRA',runners,coverage,history_n:[...groups.values()].reduce((s,a)=>s+a.length,0),profile_horses:runners.filter(h=>h.historical_runs>0).length,final_grade_connected:false,scoring_authorized:false};
}
