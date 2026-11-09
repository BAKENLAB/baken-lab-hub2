/**
 * Pure, read-only handoff from independently verified historical evidence into
 * a race-wide review packet. Does not score, rank, CLAIM or save.
 * All evidence must be observed before the target race starts.
 */
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const num=x=>Number.isInteger(x)&&x>0&&x<=24;
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
function reject(reason){return {accepted:false,reason};}
export function prepareHistoricalRaceReview({targetRace,runners,evidence}) {
 if(!targetRace||!iso(targetRace.race_date)||!date(targetRace.post_time)||
 !['JRA','LOCAL'].includes(targetRace.circuit)||!Array.isArray(runners)||
 !Array.isArray(evidence))throw new Error('INVALID_REVIEW_INPUT');
 const post=date(targetRace.post_time);
 const active=runners.filter(r=>r.status==='ACTIVE');
 if(!active.length||new Set(active.map(r=>r.horse_no)).size!==active.length||
 active.some(r=>!num(r.horse_no)||!clean(r.horse_name)))throw new Error('INVALID_ACTIVE_FIELD');
 const known=new Map(active.map(r=>[r.horse_no,r]));
 const rows=new Map(active.map(r=>[r.horse_no,[]]));
 const excluded=[];const dedup=new Set();
 for(const e of evidence){
  const horse=known.get(e?.horse_no);
  if(!horse){excluded.push(reject('NOT_ACTIVE_RUNNER'));continue;}
  if(clean(horse.horse_name)!==clean(e.horse_name)){excluded.push(reject('HORSE_NAME_MISMATCH'));continue;}
  if(!iso(e.past_race_date)||e.past_race_date>=targetRace.race_date){
   excluded.push(reject('NOT_HISTORICAL'));continue;
  }
  const checked=date(e.source_checked_at);
  if(checked===null||checked>=post){excluded.push(reject('NOT_PRE_RACE_AS_OF'));continue;}
  if(!['NAR_OFFICIAL_PAST_RACE_RESULT','JRA_OFFICIAL_HISTORY','JRA_OFFICIAL_LAP'].includes(e.source)||
    typeof e.source_ref!=='string'||!e.source_ref.startsWith('https://')){
   excluded.push(reject('SOURCE_UNVERIFIED'));continue;
  }
  const prior=e.past_race;
  if(!prior||prior.race_date!==e.past_race_date||!prior.track||!num(prior.race_no)){
   excluded.push(reject('PAST_RACE_IDENTITY_MISSING'));continue;
  }
  const key=JSON.stringify([e.horse_no,e.past_race_date,prior.track,prior.race_no,e.source]);
  if(dedup.has(key)){excluded.push(reject('DUPLICATE_SOURCE'));continue;}
  dedup.add(key);
  const positions=Number.isInteger(e.early_pos)&&e.early_pos>0&&
    Number.isInteger(e.final_turn_pos)&&e.final_turn_pos>0?
    {early_pos:e.early_pos,final_turn_pos:e.final_turn_pos}:null;
  const laps=Array.isArray(e.lap_splits)&&e.lap_splits.length>0&&
    e.lap_splits.every(v=>Number.isFinite(v)&&v>0&&v<60)?
    [...e.lap_splits]:null;
  if(!positions&&!laps){excluded.push(reject('NO_VERIFIED_PACE_FACTS'));continue;}
  rows.get(e.horse_no).push({past_race:prior,positions,laps,
   source:e.source,source_ref:e.source_ref,source_checked_at:e.source_checked_at});
 }
 const field=active.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
   history:rows.get(r.horse_no),missing:rows.get(r.horse_no).length===0}));
 const withPositions=field.filter(r=>r.history.some(h=>h.positions)).length;
 const withLaps=field.filter(r=>r.history.some(h=>h.laps)).length;
 return {circuit:targetRace.circuit,race_date:targetRace.race_date,
  field_size:active.length,position_covered_horses:withPositions,
  lap_covered_horses:withLaps,whole_field_position_coverage:withPositions===active.length,
  whole_field_lap_coverage:withLaps===active.length,
  runners:field,excluded_count:excluded.length,
  excluded_reasons:excluded.reduce((a,x)=>(a[x.reason]=(a[x.reason]??0)+1,a),{}),
  ranking_changed:false,betting_data_used:false,save_authorized:false,
  interpretation:'EVIDENCE_ONLY_REQUIRES_CAUSAL_REVIEW'};
}
