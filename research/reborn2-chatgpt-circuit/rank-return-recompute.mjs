import {historyDenominators} from './evidence-semantics.mjs';
// Independent research re-computation of typed observations only. No legacy mutation or final ability decision.
export function recomputeReturned({intake,returned}){
 return returned.runners.map(h=>{
  const own=intake.accepted.filter(g=>g.record.horse_id===h.horse_id&&h.horse_id!==null);
  const returnedRoots=new Set(h.returned.map(x=>x.event_key));
  const affected=own.filter(g=>returnedRoots.has(g.event_key));
  const entries={};
  const push=(id,kind,value,groups)=>{
   if(!entries[id])entries[id]=[];
   entries[id].push({kind,value,evidence_ids:[...new Set(groups.flatMap(x=>x.evidence_ids))].sort(),original_event_keys:[...new Set(groups.map(x=>x.event_key))].sort(),status:'STRUCTURAL_RESEARCH_CANDIDATE',final_consumption:false});
  };
  const result=own.filter(g=>g.record.kind==='RESULT'),resultByRace=new Map(result.map(g=>[g.record.race_id,g]));
  for(const g of affected){
   const f=g.record.fact;
   if(g.record.kind==='RESULT'){
    push('02','START_AND_FINISH',{race_id:g.record.race_id,start_status:f.start_status,finish:f.finish,field_size:f.field_size??null},[g]);
    if(f.start_status==='FINISHED'){
     if(f.winner_gap_tenths!=null||f.margin_reference==='WINNER')push('03','WINNER_MARGIN',{race_id:g.record.race_id,gap_tenths:f.winner_gap_tenths??null,official_margin:f.margin_reference==='WINNER'?f.official_margin:null},[g]);
     if(f.clock_tenths!=null)push('05','DISPLAY_CLOCK',{race_id:g.record.race_id,clock_tenths:f.clock_tenths,dead_heat_group:f.dead_heat_group??null},[g]);
    }
   }
   if(g.record.kind==='POSITIONS'){
    const q=f.positions.slice().sort((a,b)=>a.segment-b.segment);
    push('17','POSITION_RANGES',{race_id:g.record.race_id,positions:q,field_size:f.field_size},[g]);
    const changes=q.slice(1).flatMap((p,i)=>p.segment===q[i].segment+1?[{from:q[i].segment,to:p.segment,gain_min:q[i].rank_min-p.rank_max,gain_max:q[i].rank_max-p.rank_min}]:[]);
    if(changes.length)push('18','POSITION_CHANGE',{race_id:g.record.race_id,changes,individual_speed_measured:false},[g]);
    const rec=changes.flatMap((x,i)=>x.gain_max<0?changes.slice(i+1).filter(y=>y.gain_min>0).map(y=>({loss:x,recovery:y})):[]);
    const r=resultByRace.get(g.record.race_id);
    if(rec.length&&r)push('21','RECOVERY_OBSERVATION',{race_id:g.record.race_id,rec,finish:r.record.fact.finish,cause:null},[g,r]);
   }
  }
  if(affected.some(g=>g.record.kind==='RESULT')){
    const starts=result.filter(g=>['FINISHED','DNF_STARTED','DQ_STARTED'].includes(g.record.fact.start_status));
    const observed=historyDenominators(result.map(g=>g.record.fact));
    push('12','HISTORICAL_WIN_AND_NONWIN',{...observed,coverage:'INCOMPLETE_HISTORY_POSSIBLE',wins_observed:starts.filter(g=>g.record.fact.finish===1).map(g=>g.record.race_id),nonwins_observed:starts.filter(g=>g.record.fact.finish!==1).map(g=>g.record.race_id),current_winning_ability:null},result);
  }
  return {horse_no:h.horse_no,horse_id:h.horse_id,items:entries,recomputed_item_ids:Object.keys(entries).sort(),still_pending_rank_items:h.rerun_required_rank_items.filter(id=>!entries[id]),final_consumption:[]};
 });
}
