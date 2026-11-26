const finite=Number.isFinite;
const traceIds=['17','18','19','21','22','28','30'];
const before=(a,b)=>Number.isFinite(Date.parse(a))&&Date.parse(a)<=Date.parse(b);

export function assessContext({items,runPairs,targetDate,cutoff,ratings=[]}) {
  const units=[];
  for(const id of traceIds) for(const observation of items[id]){
    let unit=units.find(x=>x.evidence_id===observation.evidence_id);
    if(!unit){unit={evidence_id:observation.evidence_id,dimensions:{}};units.push(unit);}
    (unit.dimensions[id]??=[]).push(observation.value);
  }
  const findings={};
  const add=(id,evidence_id,value)=>(findings[id]??=[]).push({evidence_id,status:'HISTORICAL_CONTEXT',value});
  for(const {run,id,context} of runPairs){
    if(!context || context.verified!==true || context.source_ref!==run.source_ref ||
      context.prior_no!==run.prior_no || context.horse_id!==run.horse_id || !run.horse_id ||
      !before(context.observed_at,cutoff)) continue;
    const unit=units.find(x=>x.evidence_id===id)?.dimensions??{};
    const loss=finite(context.last_corner)&&run.finish>0 ? run.finish-context.last_corner:null;
    const pace=finite(context.early_pace_residual_seconds)&&context.pace_benchmark_verified===true;
    const cohort=Array.isArray(context.forward_rival_finishes)&&context.forward_rival_finishes.length>=2 &&
      context.forward_rival_finishes.every(n=>Number.isInteger(n)&&n>0);
    const relative=finite(context.relative_final3f_seconds);
    if(pace&&cohort&&unit['19']&&unit['17']&&run.finish>0)
      add('20',id,{early_pace_residual_seconds:context.early_pace_residual_seconds,
        rival_finishes:context.forward_rival_finishes,finish:run.finish,favor_or_disadvantage:null});
    if(pace&&cohort&&context.early_group_documented===true&&loss>0&&relative)
      add('23',id,{hypothesis:'EARLY_PACE_PRESSURE_POSSIBLE',position_loss:loss,causation:null});
    if(loss>0&&relative) add('24',id,{position_loss:loss,relative_final3f_seconds:context.relative_final3f_seconds,cause:null});
    if(loss<0&&run.finish>1&&relative&&context.relative_final3f_seconds<0&&finite(run.gap_winner)&&pace)
      add('25',id,{late_gain:-loss,winner_gap_seconds:run.gap_winner,unused_energy:null});
    const incident=context.incident;
    if(incident?.verified===true && incident.horse_id===run.horse_id && incident.result_ref===run.source_ref &&
        incident.document_ref && incident.role==='SUFFERED' && incident.finding &&
        before(incident.published_at,incident.checked_at) && before(incident.checked_at,cutoff)){
      add('26',id,{finding:incident.finding,document_ref:incident.document_ref,phase:incident.phase??null});
      if(incident.phase==='BEFORE_LAST_CORNER'&&loss<0&&relative&&finite(run.gap_winner))
        add('27',id,{observed_late_gain:-loss,winner_gap_seconds:run.gap_winner,causation:null});
    }
    if(run.finish>1&&context.current_relevance_verified===true&&context.opposition_verified===true &&
        findings['25']?.some(x=>x.evidence_id===id))
      add('29',id,{hypothesis:'TRANSFERABLE_LATE_RECOVERY',winner_gap_seconds:run.gap_winner});
    if(context.special_condition_verified===true&&context.comparable_baseline_n>=3 &&
        finite(context.residual_vs_own_baseline_seconds)&&context.residual_vs_own_baseline_seconds>0)
      add('31',id,{residual_seconds:context.residual_vs_own_baseline_seconds,rebound:null});
    if(context.current_relevance_verified===true && findings['29']?.some(x=>x.evidence_id===id))
      add('15',id,{hypothesis:'LATE_RECOVERY_RELEVANT_TODAY',alternatives:['PACE_SETUP','ABILITY_DEFICIT'],grade_effect:null});
    for(const r of ratings.filter(r=>r.verified===true && r.horse_id===run.horse_id &&
        r.performance_ref===run.source_ref && r.performance_date===run.race_date &&
        r.performance_date<targetDate && before(r.published_at,r.observed_at) && before(r.observed_at,cutoff) &&
        r.source_ref && r.version && finite(r.value))){
      add('16',id,{rating:r.value,scope:r.scope??null,source_ref:r.source_ref,version:r.version});
    }
  }
  return {units,findings,consumed:traceIds.filter(id=>units.some(x=>Object.hasOwn(x.dimensions,id)))};
}

// The propositions are confined to the observed historical performance.
export function judgeHistoricalContext(units, findings){
  return units.map(unit=>{
    const dimensions=unit.dimensions;
    const changes=(dimensions['18']??[]).flat();
    const support=[],counter=[];
    if(changes.some(x=>x.gain>0)) support.push('OBSERVED_POSITION_GAIN');
    if(changes.some(x=>x.gain<0)) counter.push('OBSERVED_POSITION_LOSS');
    if(dimensions['21']?.length) support.push('OBSERVED_RECOVERY');
    if(dimensions['30']?.length) support.push('HISTORICAL_WIN');
    if(dimensions['28']?.length) counter.push('HISTORICAL_DEFEAT');
    if(findings['25']?.some(r=>r.evidence_id===unit.evidence_id))support.push('OBSERVED_LATE_GAIN_WITH_FASTER_FINAL3F');
    if(findings['24']?.some(r=>r.evidence_id===unit.evidence_id))counter.push('OBSERVED_LATE_POSITION_LOSS');
    return {evidence_id:unit.evidence_id,support,counter,status:support.length?
      (counter.length?'MIXED':'HISTORICAL_SUPPORT'):(counter.length?'HISTORICAL_COUNTEREVIDENCE':'UNDETERMINED'),
      current_ability:null};
  });
}
