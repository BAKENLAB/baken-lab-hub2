/**
 * LAB REBORN 0.4 — independent 2024-fitted evidence model.
 * Coefficients must be supplied from learned-2024-reborn-v04-coefficients.json.
 * Fit on 2024 only, evaluated separately on 2025 and 2026 as-of archives.
 * Candidate uses NO old LAB score, rank, production grade, odds or target result.
 *
 * IMPORTANT: this is an independent statistical comparator, NOT a replacement
 * for the detailed per-run 5-axis candidate REBORN v0.3. Archive feature set
 * is coarser and does not yet include opponent quality/pace. Score = 100 x
 * UNCAlIBRATED logit index, NOT win probability or original LAB 100 grade.
 */
const finite=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(+x)?+x:null;
const clip=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const round=(v,d=2)=>Math.round(v*10**d)/10**d;
const levels=new Set(["MAIDEN","CLASS1","CLASS2_3","OPEN_GRADED"]);
const sides=new Set(["芝","ダート"]);
const sigs=(r)=>{
 const n4=finite(r.n4),p4=finite(r.podium4),m=finite(r.mean_gap4);
 if(n4===null||p4===null||n4<0||p4<0||p4>n4||n4>8)return null;
 for(const name of ["near_close46","recent_sameclass_close","recent_near_top3",
  "old_same_track_top3","recent_3f_close","recent_consistent"]){
  if(typeof r[name]!=="boolean")return null;
 }
 return [
  "P"+Math.min(3,p4),"H"+Math.min(3,n4),
  "M"+(m===null?"NONE":m<=0.5?"A":m<=1?"B":m<=2?"C":"D"),
  ...(r.near_close46===true?["CLOSE46"]:[]),
  ...(r.recent_sameclass_close===true?["CLASS_CLOSE"]:[]),
  ...(r.recent_near_top3===true?["NEAR_PODIUM"]:[]),
  ...(r.old_same_track_top3===true?["OLD_COURSE"]:[]),
  ...(r.recent_3f_close===true?["FAST_CLOSE"]:[]),
  ...(r.recent_consistent===true?["REPEAT"]:[])
 ];
};
export function prepareRebornV04(model){
 if(!model||model.id!=="LAB_REBORN_V04_ASOF_2024_FIT"||
    model.status!=="FROZEN_BEFORE_VALIDATION"||
    model.training!=="2024-01-01/2024-12-31"||
    !Array.isArray(model.cohort)||model.cohort.length!==8||
    !Array.isArray(model.coeffs)||model.coeffs.length!==152) return null;
 const cohort=new Map(),weight=new Map();
 for(const c of model.cohort){
  const p=finite(c.p),key=[c.segment,c.surface].join("|");
  if(!levels.has(c.segment)||!sides.has(c.surface)||p===null||p<=0||p>=1||cohort.has(key))return null;
  cohort.set(key,p);
 }
 for(const c of model.coeffs){
  const n=finite(c.coefficient),key=[c.segment,c.surface,c.signal].join("|");
  if(!cohort.has([c.segment,c.surface].join("|"))||n===null||Math.abs(n)>0.85||weight.has(key))return null;
  weight.set(key,n);
 }
 return {cohort,weight};
}
export function evaluateRebornV04(row,prepared){
 if(!prepared||!levels.has(row?.segment)||!sides.has(row?.surface))return null;
 const features=sigs(row);if(features===null)return null;
 const p=prepared.cohort.get([row.segment,row.surface].join("|"));if(p===undefined)return null;
 const contributions=features.map(name=>({
  feature:name,logit_delta:prepared.weight.get([row.segment,row.surface,name].join("|"))??0
 }));
 const logit=Math.log(p/(1-p))+contributions.reduce((a,b)=>a+b.logit_delta,0);
 const rate=1/(1+Math.exp(-logit));
 return {horse_no:finite(row.horse_no),horse_name:row.horse_name,
  independent_score_100:round(rate*100,2),
  independent_rate:round(rate,6),
  features:contributions,
  training:"2024_ONLY",
  status:"UNCalIBRATED_RESEARCH",
  original_lab_used:false};
}
export function rankRebornV04(rows,locked){
 const prepared=prepareRebornV04(locked);
 if(!prepared)return {status:"INVALID_LOCKED_MODEL",runners:[],production_write:false};
 if(!Array.isArray(rows)||rows.length<6)return {status:"INCOMPLETE_FIELD",runners:[],production_write:false};
 const ctx=rows[0],ids=new Set();
 const fieldSize=finite(ctx.field_size);
 if(fieldSize===null||fieldSize!==rows.length){
  return {status:"INCOMPLETE_FIELD",runners:[],production_write:false};
 }
 for(const x of rows){
  const num=finite(x.horse_no);
  if(num===null||num<1||ids.has(num)||
     x.race_date!==ctx.race_date||x.track!==ctx.track||+x.race_no!==+ctx.race_no||
     finite(x.field_size)!==fieldSize||
     typeof x.horse_name!=="string")return {status:"INVALID_FIELD_IDENTITIES",runners:[],production_write:false};
  ids.add(num);
 }
 const scored=rows.map(x=>evaluateRebornV04(x,prepared));
 if(scored.some(x=>x===null||x.horse_no===null))return {status:"MISSING_REQUIRED_FEATURES",runners:[],production_write:false};
 scored.sort((a,b)=>b.independent_rate-a.independent_rate||a.horse_no-b.horse_no);
 scored.forEach((x,i)=>x.reborn_rank=i+1);
 return {status:"RESEARCH_READY",model:locked.id,runners:scored,
  top5:scored.slice(0,5),production_write:false,
  previous_frozen_modified:false,calibrated_probability:false};
}
