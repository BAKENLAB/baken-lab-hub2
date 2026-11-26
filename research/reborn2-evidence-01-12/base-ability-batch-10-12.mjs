// Batch historical 10/11/12 evidence consumer, JRA research only.
// Ordered position gains do NOT measure acceleration; distance comparisons do NOT establish fatigue.
// Direct past matchups describe results, not opponent quality or future win probability.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length%2?b[i]:(b[i-1]+b[i])/2;};
const rd=x=>x===null?null:Math.round(x*1000)/1000;
const key=(...a)=>JSON.stringify(a);
const items=['10','11','12'];
export function extendBase1012({base,pace,target}){
 if(base?.scoring_authorized!==false||pace?.scoring_authorized!==false||pace.individual_split_measured!==false||base.target_date!==target?.target_date||!Array.isArray(base.runners)||!Array.isArray(pace.rows)||!Array.isArray(target.roster)||base.runners.length!==target.roster.length)throw Error('INPUT');
 const hm=new Map(base.runners.map(h=>[h.horse_no,h]));
 if(hm.size!==target.roster.length||target.roster.some(h=>!hm.has(h.horse_no)))throw Error('ROSTER');
 const refs=new Map(base.runners.map(h=>[h.horse_no,new Set([...h.item01.visible_condition_evidence,...h.item01.other_condition_evidence].flatMap(c=>c.source_refs))]));
 const seen=new Set(),valid=[],unknown=[];
 for(const r of pace.rows){
  const k=key(r.horse_no,r.source_ref);
  if(seen.has(k))throw Error('DUPLICATE');seen.add(k);
  if(!refs.get(r.horse_no)?.has(r.source_ref)||r.prior_date>=target.target_date||r.final_grade_effect!==null)throw Error('UNBOUND');
  if(!r.position||!r.pace||!r.relative_final3f){unknown.push({horse_no:r.horse_no,ref:r.source_ref,reason:'PACE_POSITION_OR_F3_UNVERIFIED'});continue;}
  const seq=[...r.position.ordered_corner_positions,r.position.finish],n=r.relative_final3f.compared;
  if(!Number.isInteger(n)||n<2||seq.length<3||seq.some(x=>!Number.isInteger(x)||x<1||x>n)||!finite(r.relative_final3f.field_median_residual_seconds)||!Number.isInteger(r.relative_final3f.field_rank)||r.relative_final3f.field_rank<1||r.relative_final3f.field_rank>n||r.pace.scope!=='RACE_LEADER_PASSAGE_ONLY')throw Error('POSITION_GATE');
  const d=seq.slice(1).map((v,i)=>seq[i]-v);
  const patterns=[];
  for(let a=0;a<d.length;a++)for(let b=a+2;b<d.length;b++)if(d[a]>0&&d[b]>0&&d.slice(a+1,b).some(v=>v<=0))patterns.push([a,b]);
  valid.push({...r,seq,d,pattern_status:seq.length<4?'INSUFFICIENT_RECORDED_POSITIONS':patterns.length?'TWO_SEPARATED_POSITION_GAINS_OBSERVED':'NO_SEPARATED_GAIN_OBSERVED',patterns,field_size:n,finish_percentile:(n-r.position.finish)/(n-1),f3_percentile:(n-r.relative_final3f.field_rank)/(n-1)});
 }
 const byRace=new Map(),byHorse=new Map();
 for(const r of valid){
  const a=byRace.get(r.source_ref)??[];a.push(r);byRace.set(r.source_ref,a);
  const b=byHorse.get(r.horse_no)??[];b.push(r);byHorse.set(r.horse_no,b);
 }
 const matches=[];
 for(const [ref,a] of byRace)for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
  const x=a[i],y=a[j];
  if(x.horse_id===y.horse_id||x.prior_date!==y.prior_date||x.field_size!==y.field_size||key(x.conditions.track,x.conditions.surface,x.conditions.distance,x.conditions.going,x.conditions.class_name)!==key(y.conditions.track,y.conditions.surface,y.conditions.distance,y.conditions.going,y.conditions.class_name)||x.position.finish===y.position.finish)throw Error('SHARED_RACE_CONFLICT');
  const first=x.position.finish<y.position.finish?x:y,second=first===x?y:x;
  matches.push({source_ref:ref,date:x.prior_date,conditions:x.conditions,first_horse_no:first.horse_no,second_horse_no:second.horse_no,first_finish:first.position.finish,second_finish:second.position.finish,field_size:x.field_size,first_final3f:first.relative_final3f.reported_final3f_seconds,second_final3f:second.relative_final3f.reported_final3f_seconds,meaning:'DIRECT_HISTORICAL_FINISH_ORDER',opponent_strength:'UNVALIDATED',current_scenario:'UNVALIDATED'});
 }
 const runners=base.runners.map(h=>{
  const history=byHorse.get(h.horse_no)??[];
  const gain=history.map(r=>({source_ref:r.source_ref,date:r.prior_date,conditions:r.conditions,sequence:r.seq,position_gains:r.d,pattern_status:r.pattern_status,observed_pattern_pairs:r.patterns,individual_acceleration_measured:false,corner_labels:null}));
  const groups=new Map();
  for(const r of history){const c=r.conditions,k=key(c.track,c.surface,c.going,c.class_name),v=groups.get(k)??[];v.push(r);groups.set(k,v);}
  const distance=[];
  for(const group of groups.values()){
   const ds=new Map();for(const r of group){const a=ds.get(r.conditions.distance)??[];a.push(r);ds.set(r.conditions.distance,a);}
   if(ds.size<2)continue;
   const parts=[...ds].sort((a,b)=>a[0]-b[0]).map(([distance_m,a])=>({distance_m,n:a.length,median_finish_percentile:rd(med(a.map(r=>r.finish_percentile))),median_final3f_percentile:rd(med(a.map(r=>r.f3_percentile))),median_last_to_finish_gain:rd(med(a.map(r=>r.position.last_to_finish_gain))),sources:a.map(r=>({ref:r.source_ref,date:r.prior_date,race_last600_seconds:r.pace.last600_seconds}))}));
   // Two samples per distance is a provisional descriptive minimum, not a validated cutoff or fatigue determination.
   const repeated=parts.filter(a=>a.n>=2).length>=2;
   distance.push({conditions:{track:group[0].conditions.track,surface:group[0].conditions.surface,going:group[0].conditions.going,class_name:group[0].conditions.class_name},parts,status:repeated?'REPEATED_DISTANCE_CONTEXT':'SPARSE_DISTANCE_CONTEXT',fatigue_cause:'UNESTABLISHED',pace_weight_eligibility_adjusted:false,course_layout_verified:false});
  }
  const pair=matches.filter(x=>x.first_horse_no===h.horse_no||x.second_horse_no===h.horse_no);
  return {...h,item01:{...h.item01,batch_context:{
   '10':{status:gain.some(x=>x.pattern_status!=='INSUFFICIENT_RECORDED_POSITIONS')?'POSITION_PATTERN_PROXY_CONSUMED':'MISSING',observations:gain,individual_acceleration_measured:false},
   '11':{status:distance.length?'DISTANCE_CONTEXT_CONSUMED':'MISSING',comparisons:distance,fatigue_cause:'UNESTABLISHED'},
   '12':{status:pair.length?'DIRECT_MATCHUP_CONTEXT_CONSUMED':'NO_SHARED_PAST_RACE_IN_SAMPLE',comparisons:pair,opponent_strength:'UNVALIDATED',current_win_ability:'UNVALIDATED'}},current_ability:null,final_grade_effect:null}};
 });
 const gainEligible=runners.flatMap(h=>h.item01.batch_context['10'].observations).filter(x=>x.pattern_status!=='INSUFFICIENT_RECORDED_POSITIONS');
 const gains=gainEligible.filter(x=>x.pattern_status==='TWO_SEPARATED_POSITION_GAINS_OBSERVED');
 const dist=runners.flatMap(h=>h.item01.batch_context['11'].comparisons);
 return {...base,runners,batch_coverage:{valid_pace_rows:valid.length,unknown_pace_rows:unknown.length,pattern_eligible:gainEligible.length,pattern_positive:gains.length,pattern_positive_horses:runners.filter(h=>h.item01.batch_context['10'].observations.some(x=>x.pattern_status==='TWO_SEPARATED_POSITION_GAINS_OBSERVED')).length,distance_cohorts:dist.length,repeated_distance_cohorts:dist.filter(x=>x.status==='REPEATED_DISTANCE_CONTEXT').length,distance_horses:runners.filter(h=>h.item01.batch_context['11'].comparisons.length).length,shared_race_count:new Set(matches.map(x=>x.source_ref)).size,matchups:matches.length,matchup_horses:runners.filter(h=>h.item01.batch_context['12'].comparisons.length).length},complete_items:0,scoring_authorized:false,final_grade_connected:false};
}
