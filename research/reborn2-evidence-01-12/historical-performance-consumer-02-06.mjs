// 02–06 research consumer: interprets only explicitly supported same-race evidence.
// Never substitutes these observations for today's ability grade or cross-course benchmark.
const ids=['02','03','04','05','06'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const side=x=>x<0?'FASTER_THAN_RACE_MEDIAN':x>0?'SLOWER_THAN_RACE_MEDIAN':'EQUAL_TO_RACE_MEDIAN';
export function consume0206(packet){
 if(packet?.scoring_authorized!==false||!['JRA','LOCAL'].includes(packet.circuit)||!Array.isArray(packet.runners))throw Error('INPUT');
 const runners=packet.runners.map(h=>{
  const outputs=[];
  for(const id of ids){
   if(!Array.isArray(h.ability_inputs?.[id]))throw Error('MISSING_ITEM_TRACE');
   for(const e of h.ability_inputs[id]){
    const ref=e.source_ref??e.prior_ref;
    if(e.status!=='RESEARCH_OBSERVATION'||!ref||!e.prior_date||e.prior_date>=packet.targetDate)throw Error('UNBOUND_OBSERVATION');
    const v=e.value;let finding=null;
    if(id==='02'&&Number.isInteger(v.finish)&&v.finish>0){
      if(Number.isInteger(v.field_size)&&v.field_size>=v.finish)finding={type:'OBSERVED_FINISH_POSITION',value:v.finish,field_size:v.field_size,finish_half:v.finish*2<=v.field_size?'UPPER_HALF':'LOWER_HALF'};
      else finding={type:'OBSERVED_FINISH_WITHOUT_FIELD_SIZE',value:v.finish,field_size:null};
    }
    if(id==='03'&&finite(v.rounded_gap_seconds)&&v.rounded_gap_seconds>=0)finding={type:'DEMONSTRATED_WINNER_CLOCK_GAP',seconds:v.rounded_gap_seconds,not_length_margin:true};
    if(id==='04'&&finite(v.rounded_gap_to_next_seconds)&&v.rounded_gap_to_next_seconds>=0)finding={type:'DEMONSTRATED_NEXT_FINISHER_CLOCK_GAP',seconds:v.rounded_gap_to_next_seconds,not_length_margin:true};
    if(id==='05'&&finite(v.elapsed_seconds)){
      finding=finite(v.within_race_median_residual_seconds)?{type:'RELATIVE_RACE_CLOCK',comparison:side(v.within_race_median_residual_seconds),residual_seconds:v.within_race_median_residual_seconds,elapsed_seconds:v.elapsed_seconds,cross_race_validated:false}:{type:'RAW_ELAPSED_ONLY',elapsed_seconds:v.elapsed_seconds};
    }
    if(id==='06'&&finite(v.final3f_seconds)){
      finding=finite(v.median_residual_seconds)&&Number.isInteger(v.relative_rank)&&Number.isInteger(v.compared)?{type:'RELATIVE_FINAL3F',comparison:side(v.median_residual_seconds),rank:v.relative_rank,compared:v.compared,residual_seconds:v.median_residual_seconds,seconds:v.final3f_seconds}:{type:'RAW_FINAL3F_ONLY',seconds:v.final3f_seconds};
    }
    if(!finding)throw Error('UNINTERPRETABLE_OBSERVATION');
    outputs.push({item:id,source_ref:ref,prior_date:e.prior_date,dependency_group:JSON.stringify([ref,'SAME_RACE_PERFORMANCE']),scope:e.scope,finding,assessment_status:'HISTORICAL_PERFORMANCE_EVIDENCE_CONSUMED',today_applicability:'UNVALIDATED',final_grade_effect:null});
   }
  }
  return {horse_no:h.horse_no,outputs};
 });
 return {circuit:packet.circuit,targetDate:packet.targetDate,runners,coverage:Object.fromEntries(ids.map(i=>[i,{observations:runners.reduce((s,h)=>s+h.outputs.filter(x=>x.item===i).length,0),horses:runners.filter(h=>h.outputs.some(x=>x.item===i)).length}])),final_assessment_connected:false,scoring_authorized:false};
}
