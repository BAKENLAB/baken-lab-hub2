/**
 * BAKEN LAB | JRA 2025-trained, 2026-validated 100-point research index.
 *
 * Fitted coefficients MUST come from trained-2025-coefficients-v01.json.
 * Never read target race finish/odds/popularity in features, scoring or rank.
 * Data extraction is a separate, strictly as-of SQL function.
 *
 * This 0..100 index = 100 * an uncalibrated, base-rate-derived forecast score,
 * NOT literal certainty, win probability, or production LAB grade.
 * Can only be used on properly validated all-runner feature sets.
 */
const num=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
const round=(x,d=3)=>Math.round(x*10**d)/10**d;
const clamp=(x,low,high)=>Math.max(low,Math.min(high,x));
const bindings=[
 ["CLOSE_4TO6","near_close46"],
 ["NEAR_PODIUM","recent_near_top3"],
 ["SAMECLASS_CLOSE","recent_sameclass_close"],
 ["OLDER_COURSE_PODIUM","old_same_track_top3"],
 ["FAST_CLOSE","recent_3f_close"],
];
const segments=new Set(["MAIDEN","CLASS1","CLASS2_3","OPEN_GRADED"]);
function failed(reason){return {status:reason,official_ranking_modified:false,
 original_frozen_modified:false,score_calibrated:false,runners:[]};}
function prepare(coefficients){
 if(coefficients?.model!=="JRA_ASOF_2025_RESIDUAL_V01"||
    coefficients.train_from!=="2025-01-01"||
    coefficients.train_to!=="2025-12-31"||
    coefficients.global_damping!==0.6||
    coefficients.smoothing_additional_n!==150||
    !Array.isArray(coefficients.coefficients)||
    coefficients.coefficients.length!==62)return null;
 const map=new Map();
 for(const c of coefficients.coefficients){
  if(!segments.has(c.segment)||!bindings.some(x=>x[0]===c.signal)||
     !Number.isInteger(Number(c.rate_group))||num(c.uplift)===null)return null;
  const key=[c.segment,c.rate_group,c.signal].join("|");
  if(map.has(key))return null;
  map.set(key,Number(c.uplift));
 }
 return map;
}
function scoreOne(f,coefficientMap){
 const p=num(f.base_rate);
 if(!segments.has(f.segment)||p===null||p<0||p>1)return null;
 const bucket=Math.floor(p*5),signals=[];
 let sum=0;
 for(const [name,field] of bindings){
  // Missing evidence never means zero ability; it simply adds no adjustment.
  const active=f[field]===true;
  const uplift=active?(coefficientMap.get([f.segment,bucket,name].join("|"))??0):0;
  sum+=uplift;
  signals.push({signal:name,available:f[field]!==null&&f[field]!==undefined,
    active,learned_adjustment:round(uplift,5)});
 }
 const change=clamp(0.6*sum,-0.10,0.10);
 const adjusted=clamp(p+change,0.01,0.95);
 return {
  horse_no:Number(f.horse_no),horse_name:f.horse_name,
  baseline_rate:round(p,6),research_rate:round(adjusted,6),
  score_100:round(adjusted*100,2),
  score_delta_100:round((adjusted-p)*100,2),
  signals,
 };
}
/**
 * Expected inputs: one verified entire entry field, each row with
 * race_date, track, race_no, horse_no, horse_name, base_rate, segment
 * and the five strict history-derived flags.
 */
export function rankWithLocked2025Evidence(field,lockedModel){
 const coefficients=prepare(lockedModel);
 if(!coefficients)return failed("INVALID_OR_UNLOCKED_MODEL");
 if(!Array.isArray(field)||field.length<2)return failed("INCOMPLETE_FIELD");
 const sample=field[0],keys=field.map(f=>Number(f.horse_no));
 if(!sample.race_date||!sample.track||!Number.isInteger(Number(sample.race_no))||
    new Set(keys).size!==keys.length||keys.some(n=>!Number.isInteger(n)||n<1)||
    field.some(f=>f.race_date!==sample.race_date||f.track!==sample.track||
      Number(f.race_no)!==Number(sample.race_no)||typeof f.horse_name!=="string"))
      return failed("INVALID_OR_MIXED_RACE_ROSTER");
 const scored=field.map(f=>scoreOne(f,coefficients));
 if(scored.some(x=>x===null))return failed("MISSING_BASE_RATE_OR_SEGMENT");
 const original=[...scored].sort((a,b)=>b.baseline_rate-a.baseline_rate||
    Number(field.find(f=>+f.horse_no===a.horse_no)?.mean_gap4??999)-
    Number(field.find(f=>+f.horse_no===b.horse_no)?.mean_gap4??999)
    ||a.horse_no-b.horse_no);
 const revised=[...scored].sort((a,b)=>b.research_rate-a.research_rate||
    b.baseline_rate-a.baseline_rate||a.horse_no-b.horse_no);
 const baseline=new Map(original.map((x,i)=>[x.horse_no,i+1]));
 const study=new Map(revised.map((x,i)=>[x.horse_no,i+1]));
 const runners=scored.map(x=>({...x,baseline_rank:baseline.get(x.horse_no),
    research_rank:study.get(x.horse_no)})).sort((a,b)=>a.research_rank-b.research_rank);
 return {status:"RESEARCH_READY",model:lockedModel.model,
  race_date:sample.race_date,track:sample.track,race_no:Number(sample.race_no),
  official_ranking_modified:false,original_frozen_modified:false,
  score_calibrated:false,
  score_definition:"100 * historical-top3-rate-derived uncalibrated research score",
  training_window:"2025",validation_window:"2026",
  runners,top5:runners.filter(x=>x.research_rank<=5),
  top5_changes:runners.filter(x=>(x.baseline_rank<=5)!==(x.research_rank<=5))
    .map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,
      baseline_rank:x.baseline_rank,research_rank:x.research_rank}))};
}
