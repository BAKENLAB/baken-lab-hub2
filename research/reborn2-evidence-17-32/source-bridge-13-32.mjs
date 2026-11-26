// REBORN2 13–32: offline source-to-analysis-material bridge, NOT a scorer.
// Consumes exact SELECT results from 01–12 research readers. No network, no writes.
// A candidate is not admitted evidence; never authorize grading or infer missing fields.
const n = x => x===null||x===undefined||x==='' ? null : Number.isFinite(Number(x))?Number(x):null;
const positive=x=>n(x)!==null&&n(x)>0;
const nonnegative=x=>n(x)!==null&&n(x)>=0;
const validRank=x=>Number.isInteger(n(x))&&n(x)>=1&&n(x)<=24;
const key=r=>JSON.stringify([r.current_no,r.race_date,r.track,r.race_no]);
const ticks=x=>positive(x)&&Math.abs(n(x)*10-Math.round(n(x)*10))<1e-6?Math.round(n(x)*10):null;
function verifiedLaps(laps,distance,winner){
  if(!Array.isArray(laps)||!Number.isInteger(n(distance))||n(distance)<600||laps.length!==Math.ceil(n(distance)/200)||ticks(winner)===null||laps.some(v=>ticks(v)===null))return null;
  return laps.reduce((s,v)=>s+ticks(v),0)===ticks(winner)?laps.map(n):null;
}
function normalize(circuit,r){
  const j=circuit==='JRA';
  const t=j?r.source_checked_at:r.corner_checked_at;
  const date=j?r.race_date:r.prior_date;
  const track=j?r.track:r.prior_track;
  const raceNo=n(j?r.race_no:r.prior_race_no);
  const source=j?r.source_ref:r.corner_source_ref;
  const settlement=j?null:r.settlement_candidate;
  const clock=j?n(r.elapsed_seconds):typeof settlement?.time_raw==='string'&&/^\d+:[0-5]\d\.\d$/.test(settlement.time_raw)?Number(settlement.time_raw.split(':')[0])*60+Number(settlement.time_raw.split(':')[1]):null;
  const gap=j?n(r.gap_winner):null;
  const rawJra=j&&typeof r.corner_positions==='string'&&/^\d+(?:\s+\d+)*$/.test(r.corner_positions)?r.corner_positions.split(/\s+/).map(n):null;
  const localCorners=!j&&Array.isArray(r.corners)&&r.corners.length&&r.corners.every(c=>Number.isInteger(n(c.corner))&&validRank(c.position))&&new Set(r.corners.map(c=>n(c.corner))).size===r.corners.length?r.corners.map(c=>({label:n(c.corner),rank:n(c.position)})).sort((a,b)=>a.label-b.label):null;
  const lp=r.verified_race_lap_candidate;
  const laps=j?verifiedLaps(typeof r.halon_times==='string'?r.halon_times.split(/\s*-\s*/):null,r.distance,positive(clock)&&nonnegative(gap)?clock-gap:null):
    lp?.status==='VERIFIED_RACE_LEVEL_LAPS'&&lp.finish_time_reconciled===true&&lp.individual_horse_sectionals===false&&lp.sourceRef===source&&lp.pastRace?.raceDate===date&&lp.pastRace?.track===track&&n(lp.pastRace?.raceNo)===raceNo&&Number.isFinite(Date.parse(lp.sourceCheckedAt))&&Date.parse(lp.sourceCheckedAt)<=Date.parse(t)?verifiedLaps(lp.segments?.map(x=>x.seconds),lp.distance_m,lp.winner_time_seconds):null;
  return {current_no:n(r.current_no),race_date:date,track,race_no:raceNo,prior_no:n(r.prior_no),source_ref:source,source_checked_at:t,
    identity_status:j?'ARCHIVE_IDENTITY_CANDIDATE':'STORED_OFFICIAL_HORSE_REF_WITNESS',
    finish:j?n(r.finish):n(settlement?.finish),clock,gap_winner:gap,gap_next:j?n(r.gap_next):null,final3f:j?n(r.final3f):null,
    raw_corner_sequence:rawJra?.every(validRank)?rawJra:null,named_corners:localCorners,
    laps,lap_scope:laps?'RACE_LEVEL_ONLY':null,conditions:j&&positive(r.distance)&&r.surface&&r.going&&r.class_name?{distance:n(r.distance),surface:r.surface,going:r.going,class_name:r.class_name}:null,
    field_size:null,incident:null,official_rating:null,benchmark:null,opponent_context:null};
}
export function sourceBridge({circuit,targetDate,roster,rows}){
  if(!['JRA','LOCAL'].includes(circuit)||!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||!Array.isArray(roster)||!roster.length||!roster.every(validRank)||new Set(roster).size!==roster.length||!Array.isArray(rows))throw Error('BAD_INPUT');
  const grouped=new Map(roster.map(x=>[x,[]])),seen=new Set();
  for(const r of rows){
    const p=normalize(circuit,r),k=key(p);
    if(!grouped.has(p.current_no)||!/^\d{4}-\d{2}-\d{2}$/.test(p.race_date)||p.race_date>=targetDate||!p.track||!validRank(p.prior_no)||!Number.isInteger(p.race_no)||p.race_no<1||p.race_no>14||!p.source_ref||!Number.isFinite(Date.parse(p.source_checked_at))||seen.has(k))throw Error('UNBOUND_OR_DUPLICATE_PRIOR');
    seen.add(k);grouped.get(p.current_no).push(p);
  }
  const defs={
    '13':{need:'multiple comparable runs, field context and validated clock benchmark',ok:()=>false,partial:p=>positive(p.clock)&&p.conditions},
    '14':{need:'nonoverlapping comparable histories and benchmark',ok:()=>false,partial:p=>positive(p.clock)&&p.conditions},
    '15':{need:'supported latent-ability chain and current relevance',ok:()=>false,partial:p=>nonnegative(p.gap_winner)||positive(p.final3f)||p.named_corners},
    '16':{need:'dated official rating, stable identity and version',ok:()=>false,partial:()=>false},
    '17':{need:'official named corners and actual starter field',ok:()=>false,partial:p=>p.named_corners?.length||p.raw_corner_sequence?.length},
    '18':{need:'comparable labeled positions, consistent field',ok:()=>false,partial:p=>p.named_corners?.length>=2||p.raw_corner_sequence?.length>=2},
    '19':{need:'reconciled race laps plus matched pace benchmark',ok:()=>false,partial:p=>p.laps},
    '20':{need:'race pace benchmark, full field, positions and result',ok:()=>false,partial:p=>p.laps&&(p.named_corners||p.raw_corner_sequence)},
    '21':{need:'three chronological comparable observations, actual field',ok:()=>false,partial:p=>p.named_corners?.length>=3||p.raw_corner_sequence?.length>=3},
    '22':{need:'named corners, interval positions, consistent participants',ok:()=>false,partial:p=>p.named_corners?.length>=2||p.raw_corner_sequence?.length>=2},
    '23':{need:'matched early pace, early rivals, later performance',ok:()=>false,partial:p=>p.laps&&(p.named_corners||p.raw_corner_sequence)&&positive(p.final3f)},
    '24':{need:'late positions, full-field final3f and supported causes',ok:()=>false,partial:p=>positive(p.final3f)&&(p.named_corners||p.raw_corner_sequence)},
    '25':{need:'late gain, relative final3f, winner gap and pace',ok:()=>false,partial:p=>positive(p.final3f)&&nonnegative(p.gap_winner)&&(p.named_corners||p.raw_corner_sequence)},
    '26':{need:'official dated incident role, phase and identity',ok:()=>false,partial:()=>false},
    '27':{need:'incident plus later performance and comparable context',ok:()=>false,partial:()=>false},
    '28':{need:'full-field finish context, literal margin, clock gaps',ok:()=>false,partial:p=>positive(p.finish)&&nonnegative(p.gap_winner)},
    '29':{need:'defeat plus supported context and current relevance',ok:()=>false,partial:p=>p.finish>1&&(nonnegative(p.gap_winner)||positive(p.final3f))},
    '30':{need:'win, clock benchmark, opposition and pace',ok:()=>false,partial:p=>p.finish===1&&positive(p.clock)},
    '31':{need:'comparable history and verified today conditions',ok:()=>false,partial:p=>positive(p.clock)&&p.conditions},
    '32':{need:'actual most recent two official starts and comparable context',ok:()=>false,partial:p=>positive(p.clock)&&p.conditions}
  };
  const runners=roster.map(no=>{
    const materials=grouped.get(no);
    const items=Object.fromEntries(Object.entries(defs).map(([id,d])=>{
      const evidence=materials.filter(d.partial);
      return [id,{status:evidence.length?'PARTIAL_CANDIDATE':'MISSING',candidate_keys:evidence.map(key),missing_gate:d.need,analysis_admitted:false}];
    }));
    return {horse_no:no,materials,items};
  });
  const coverage=Object.fromEntries(Object.keys(defs).map(id=>[id,{partial:runners.filter(h=>h.items[id].status==='PARTIAL_CANDIDATE').length,admitted:0,missing:runners.filter(h=>h.items[id].status==='MISSING').length}]));
  return {circuit,targetDate,roster_n:roster.length,prior_rows:rows.length,coverage,runners,status:'RESEARCH_CANDIDATE_ONLY',scoring_authorized:false};
}
