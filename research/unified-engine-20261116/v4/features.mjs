import {enrichHorse,readPacket,sha} from '../v3/enrich.mjs';import {horseId} from '../v3/query.mjs';import {rivalsForHorse} from '../v3/supplemental.mjs';import {decode} from './packet.mjs';import {verifyEvalCache} from '../v3/eval.mjs';import {forbidMarketsOrTargetResults} from '../input.mjs';
export const pick=r=>{const out=Object.fromEntries(['race_date','track','race_no','horse_no','horse_name','horse_ref','conditions','post_time','frozen_at','source_checked_at','history_updated_at','past_runs'].map(k=>[k,r[k]]));forbidMarketsOrTargetResults(out);return out;};
export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export const age=(r,p)=>(Date.parse(r.race_date)-Date.parse(p.race_date))/86400000;
export function recover(r,base,extra){
 const f=enrichHorse(r,base.rows),excluded=[];const priors=[...f.priors];
 for(const x of extra.rows.filter(x=>x.race_key===[r.race_date,r.track,r.race_no].join('/')&&x.horse_no===r.horse_no)){
  if(x.horse_id!==horseId(r.horse_ref)||horseId(x.horse_ref)!==x.horse_id||x.archive_horse_name!==r.horse_name||x.race_type!=='平地'||x.race_date>=r.race_date||age(r,x)>540||![x.source_checked_at,x.created_at,x.updated_at].every(t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<Date.parse(r.post_time))||!Number.isInteger(x.finish)||x.finish<1||x.finish>x.field_size)throw Error('V4_ARCHIVE_IDENTITY_ASOF');
  const original=f.priors.filter(p=>p.baseline.race_date===x.race_date&&p.baseline.track===x.track&&p.baseline.source_ref?.includes(x.source_ref));
  if(original.some(p=>p.match_status==='CONFLICT')){excluded.push({run_id:x.run_id,reason:'ORIGINAL_ARCHIVE_CONFLICT_NOT_RESOLVED'});continue;}
  if(priors.some(p=>p.archive?.run_id===x.run_id))continue;
  const corners=typeof x.corner_positions==='string'?x.corner_positions.match(/\d+/g)?.map(Number):null,valid=!!corners?.length&&corners.every(n=>n>=1&&n<=x.field_size);
  const old=original.find(p=>p.match_status==='MATCHED');
  const p={...old?.baseline,race_date:x.race_date,track:x.track,surface:x.surface,distance:x.distance,finish:x.finish,field_size:x.field_size,final3f:x.final3f,early_pos:valid?corners[0]:null,final_turn_pos:valid?corners.at(-1):null,corner_positions:valid?corners:[],margin_to_winner:old?.baseline.margin_to_winner??null,source_ref:x.source_ref};
  priors.push({baseline:p,archive:{...x,horse_name:x.archive_horse_name,horse_no:x.prior_horse_no,corners:x.corner_positions,layout:x.course_layout},match_status:'MATCHED',reason:'SEPARATE_ARCHIVE_IDENTITY_AND_EXPLICIT_FLAT_ASOF_RECONSTRUCTION',flat:true,evaluation_eligible:true,positions_verified:valid,relative3f_verified:x.full_field===true&&x.field_rows===x.field_size&&x.timed_rows===x.field_size&&x.final3f_rank===x.calculated_final3f_rank,strict_frozen_input_proven:false,source_mode:'ADDITIONAL_ARCHIVE_NOT_ORIGINAL_SNAPSHOT'});
 }
 priors.sort((a,b)=>b.baseline.race_date.localeCompare(a.baseline.race_date));
 const seen=new Set(),h=priors.filter(p=>p.match_status==='MATCHED'&&p.evaluation_eligible&&age(r,p.baseline)<=540&&!seen.has(p.archive.run_id)&&seen.add(p.archive.run_id)).slice(0,5);
 return {...f,priors,scoring_priors:h,excluded,attrs:{...f.attrs,going:f.attrs.going??r.conditions.going??null,weather:f.attrs.weather??r.conditions.weather??null,layout:f.attrs.layout??r.conditions.course_layout??null},strict_asof_proven:false};
}
const layout=x=>({OUTER:'外',INNER:'内',STRAIGHT:'直','外':'外','内':'内','直':'直'}[x]??null);
export function resolveCourse(rows,track,surface,distance,officialLayout){
 const candidates=rows.map((x,i)=>({x,i})).filter(v=>v.x[0]===track&&v.x[1]===surface&&v.x[3]===distance);
 if(candidates.length===1){const x=candidates[0];if(officialLayout&&x.x[2]&&layout(officialLayout)!==x.x[2])return {index:null,reason:'EXPLICIT_LAYOUT_CONFLICT'};return {index:x.i,reason:'UNIQUE_CATALOG_TUPLE_NOT_DOM_GEOMETRY_CERTIFICATION'};}
 const wanted=layout(officialLayout),match=candidates.filter(v=>wanted&&v.x[2]===wanted);return match.length===1?{index:match[0].i,reason:'EXPLICIT_LAYOUT_MATCH'}:{index:null,reason:candidates.length?'AMBIGUOUS_LAYOUT':'COURSE_NOT_IN_NORMAL_CATALOG'};
}
const GRADES={5:'S',4:'A',3:'B',2:'C',1:'E'};
export function evalEvidence(r,f,cache,manifest){
 if(!cache)return {status:'UNKNOWN',reason:'PRIVATE_CACHE_ABSENT',matches:[]};
 if(Date.parse(manifest.observed_at)>=Date.parse(r.post_time))return {status:'UNKNOWN',reason:'CACHE_AFTER_TARGET',matches:[]};
 const target=resolveCourse(cache.targets,r.track,r.conditions.surface,r.conditions.distance,f.attrs.layout??r.conditions.course_layout);if(target.index===null)return {status:'UNKNOWN',reason:target.reason,matches:[]};
 const matches=[],reasons=[];for(const h of f.scoring_priors){const a=h.archive,src=resolveCourse(cache.sources,a.track,a.surface,a.distance,a.layout);if(src.index===null){reasons.push(src.reason);continue;}const pair=cache.pairs.find(p=>p[0]===target.index&&p[1]===src.index);if(pair)matches.push({run_id:a.run_id,race_id:a.race_id,grade:GRADES[pair[2]],resolution:src.reason,finish:h.baseline.finish,margin:h.baseline.margin_to_winner});else reasons.push('PAIR_NOT_IN_NORMAL_CATALOG');}
 return {status:matches.length?'AVAILABLE':'UNKNOWN',reason:matches.length?target.reason:reasons[0]??'NO_CONFIRMED_FLAT_HISTORY',matches,original_rowwise_verified:false};
}
export function loadInputs(root,stem){const p=readPacket(new URL('v3/enrichment/'+stem+'.payload.json',root)),rv=readPacket(new URL('v3/enrichment/'+stem+'.rivals.payload.json',root)),ex=decode(new URL('v4/enrichment/'+stem+'.payload.json',root));return {base:p,rivals:rv,extra:ex};}
