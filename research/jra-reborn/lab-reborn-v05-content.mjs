import {rankRebornV04} from "./lab-reborn-v04-independent-learned.mjs";

/**
 * LAB REBORN V05: independent 2024-fit content trial.
 * Content signals extracted from PRE-TARGET archived previous races only by
 * REBORN_V05_STRICT_ASOF_CONTENT.sql; NEVER from the target race result.
 * Research only; DO NOT save to official_predictions or production LAB.
 */
const n=x=>x===null||x===undefined||!Number.isFinite(+x)?null:+x;
const logit=p=>Math.log(p/(1-p));
const logistic=v=>1/(1+Math.exp(-v));
const round=(x,d=2)=>Math.round(x*10**d)/10**d;
const signals=[
 ["LATE_GAIN","late_position_gain"],
 ["FRONT_HOT","hot_front_survivor"],
 ["HIDDEN_CLOSER","overlooked_closer"]
];
export function verifyContentModel(model){
 if(!model||model.id!=="REBORN_V05_CONTENT_2024_LOCKED"||
    model.training!=="2024-01-01/2024-12-31"||model.preholdout!==true||
    model.prior_model!=="LAB_REBORN_V04_ASOF_2024_FIT"||
    !Array.isArray(model.coefficients)||model.coefficients.length!==24)return null;
 const map=new Map();
 for(const r of model.coefficients){
  const key=[r.segment,r.surface,r.signal].join("|"),x=n(r.coefficient);
  if(!signals.some(z=>z[0]===r.signal)||!["芝","ダート"].includes(r.surface)||
     !["CLASS1","CLASS2_3","MAIDEN","OPEN_GRADED"].includes(r.segment)||
     map.has(key)||x===null||Math.abs(x)>0.35)return null;
  map.set(key,x);
 }
 return map.size===24?map:null;
}
export function rankRebornV05(rows,content,lockedV4,lockedV5){
 const check=verifyContentModel(lockedV5);
 if(!check)return {status:"INVALID_V05_MODEL",runners:[],production_write:false};
 const base=rankRebornV04(rows,lockedV4);
 if(base.status!=="RESEARCH_READY")
  return {status:"V04_"+base.status,runners:[],production_write:false};
 if(!Array.isArray(content)||content.length!==rows.length)
  return {status:"INCOMPLETE_CONTENT",runners:[],production_write:false};
 const byNo=new Map();
 for(const r of content){
  const no=n(r.horse_no);
  if(no===null||byNo.has(no)||signals.some(([,key])=>typeof r[key]!=="boolean"))
   return {status:"INVALID_CONTENT_FLAGS",runners:[],production_write:false};
  byNo.set(no,r);
 }
 const source=new Map(rows.map(r=>[+r.horse_no,r]));
 const scored=base.runners.map(x=>{
  const raw=source.get(x.horse_no),c=byNo.get(x.horse_no);
  if(!raw||!c||c.race_date!==raw.race_date||c.track!==raw.track||
     +c.race_no!==+raw.race_no||c.surface!==raw.surface||
     c.segment!==raw.segment)
   return null;
  const contributions=signals.map(([label,key])=>({
   name:label,was_true:c[key],delta:c[key]?
     check.get([raw.segment,raw.surface,label].join("|")):0
  }));
  const correction=contributions.reduce((acc,v)=>acc+v.delta,0);
  const originalRate=x.independent_rate;
  if(!(originalRate>0&&originalRate<1))return null;
  const rate=logistic(logit(originalRate)+correction);
  return {...x,base_v04_rank:x.reborn_rank,
    base_v04_score:x.independent_score_100,
    reborn_v05_score:round(rate*100,2),reborn_v05_rate:round(rate,6),
    content_contributions:contributions,
    content_adjustment_logit:round(correction,6)};
 });
 if(scored.some(x=>x===null))return {status:"INVALID_CONTENT_IDENTITIES",runners:[],production_write:false};
 scored.sort((a,b)=>b.reborn_v05_rate-a.reborn_v05_rate||a.horse_no-b.horse_no);
 scored.forEach((x,i)=>x.reborn_rank=i+1);
 return {status:"RESEARCH_READY",model:"LAB_REBORN_V05_2024_LOCKED_CONTENT",
  runners:scored,top5:scored.slice(0,5),candidate_area:"UNRESTRICTED_REPLAY",
  content_validation:"PRE_TARGET_ARCHIVE_REQUIRED",
  correction_is_validated:false,production_write:false,
  previous_frozen_modified:false,calibrated_probability:false};
}
