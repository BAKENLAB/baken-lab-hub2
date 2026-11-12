/**
 * Conservative pre-race causal review of race-wide historical evidence.
 * Never labels a defeat "caused by pace" without both official corner positions
 * and independent official sectional splits from the SAME past race.
 * Produces review hypotheses only; no score, ranking, CLAIM or save.
 */
const valid=x=>Number.isFinite(x)&&x>0;
const key=h=>JSON.stringify([h.past_race?.race_date,h.past_race?.track,h.past_race?.race_no]);
export function reviewHistoricalPaceCausality(packet) {
 if(!packet||!['JRA','LOCAL'].includes(packet.circuit)||
 !Array.isArray(packet.runners)||packet.runners.length===0||
 packet.runners.some(r=>!Number.isInteger(r.horse_no)||!Array.isArray(r.history))||
 new Set(packet.runners.map(r=>r.horse_no)).size!==packet.runners.length)
 throw new Error('INVALID_CAUSAL_REVIEW_PACKET');
 const runners=packet.runners.map(r=>{
  const races=new Map();
  for(const h of r.history){
   if(!h?.past_race?.race_date||!h.past_race.track||
     !Number.isInteger(h.past_race.race_no))continue;
   const id=key(h),prev=races.get(id)??{positions:null,laps:null,source_refs:[]};
   const p=h.positions,l=h.laps;
   if(Array.isArray(h.lap_lengths))prev.lap_lengths=h.lap_lengths;
   if(p&&Number.isInteger(p.early_pos)&&p.early_pos>0&&
     Number.isInteger(p.final_turn_pos)&&p.final_turn_pos>0)
     prev.positions=p;
   if(Array.isArray(l)&&l.length>=6&&l.every(x=>valid(x)&&x<60))
     prev.laps=l;
   if(typeof h.source_ref==='string')prev.source_refs.push(h.source_ref);
   races.set(id,prev);
  }
  const reviews=[...races].map(([race_id,x])=>{
   const pos=x.positions;
   const movement=pos?pos.early_pos-pos.final_turn_pos:null;
   // Splits are whole-field pace, never the horse's individual sectionals.
   // Three or fewer splits would overlap the compared windows; require six.
   // A verified split-length array is needed for unequal sections (e.g. 1700m
   // with a 100m first segment). Without it, the pace hypothesis is withheld.
   const segmentLengths=x.lap_lengths;
   const equalLengths=!segmentLengths || (Array.isArray(segmentLengths) &&
     segmentLengths.length===x.laps?.length && segmentLengths.every(n=>n===200));
   const first=x.laps?.length>=6 && equalLengths?x.laps.slice(0,3):null;
   const last=x.laps?.length>=6 && equalLengths?x.laps.slice(-3):null;
   const early=first?first.reduce((a,b)=>a+b,0):null;
   const late=last?last.reduce((a,b)=>a+b,0):null;
   const pattern=early!==null&&late!==null?
     early+0.5<late?'EARLY_FASTER':late+0.5<early?'LATE_FASTER':'BALANCED':null;
   return {race_id,early_pos:pos?.early_pos??null,final_turn_pos:pos?.final_turn_pos??null,
     corner_gain:movement,field_pace_pattern:pattern,
     causal_status:pos&&pattern?'CONTEXT_SUPPORTED_CAUSE_UNPROVEN':'INSUFFICIENT_INDEPENDENT_EVIDENCE',
     hypothesis:pos&&pattern&&movement!==null?
       movement>=3?'POSITION_GAINED_CHECK_OPPONENT_AND_FINISH':
       movement<=-3?'POSITION_LOST_CHECK_OPPONENT_AND_FINISH':
       'POSITION_STABLE_CHECK_FINISH_AND_CLASS':'NO_CAUSAL_CLAIM',
     source_refs:[...new Set(x.source_refs)]};
  });
  return {horse_no:r.horse_no,horse_name:r.horse_name,
   historical_races:reviews,verified_context_count:reviews.filter(x=>x.causal_status==='CONTEXT_SUPPORTED_CAUSE_UNPROVEN').length,
   scoring_delta:0};
 });
 return {circuit:packet.circuit,race_date:packet.race_date,
  runners,full_field_reviewed:runners.length,
  context_supported_horses:runners.filter(r=>r.verified_context_count>0).length,
  causes_proven:0,rank_changed:false,market_used:false,
  result_used:false,save_authorized:false,stage:'CAUSAL_HYPOTHESES_ONLY'};
}
