import {sha} from './enrich.mjs';
export const EXPECTED=Object.freeze({S:444,A:554,B:366,C:379,D:0,E:199});
const grades={5:'S',4:'A',3:'B',2:'C',1:'E'};
export function verifyEvalCache(x){const counts={S:0,A:0,B:0,C:0,D:0,E:0},seen=new Set();for(const row of x.pairs){if(row.length!==4||!grades[row[2]]||!x.targets[row[0]]||!x.sources[row[1]])throw Error('EVAL_PAIR_SHAPE');const key=row.slice(0,2).join('/');if(seen.has(key))throw Error('EVAL_DUPLICATE');seen.add(key);counts[grades[row[2]]]++;}if(x.scope!=='NORMAL_ALL_1942'||x.pairs.length!==1942||Object.keys(EXPECTED).some(k=>EXPECTED[k]!==counts[k]))throw Error('EVAL_COUNTS');return {counts,rows:x.pairs.length,observed_at:x.observed_at,sha256:sha(x),rowwise_original_verified:false,classifications:'USER_WORKBOOK_COUNTS_CONFIRMED_CACHE_COUNTS_MATCHED',source_url:'https://eval-sign.netlify.app/db/sheets/'};}
export function evalForHorse(r,facts,cache,manifest){
 if(!cache||!manifest)return {status:'UNKNOWN',reason:'LICENSED_CACHE_NOT_SUPPLIED'};
 if(Date.parse(manifest.observed_at)>=Date.parse(r.post_time))return {status:'UNKNOWN',reason:'EVAL_ACQUIRED_AFTER_TARGET'};
 const layout={OUTER:'外',INNER:'内',STRAIGHT:'直','外':'外','内':'内','直':'直'};
 const targetLayout=layout[facts.attrs.layout];if(!targetLayout)return {status:'UNKNOWN',reason:'TARGET_LAYOUT_NOT_VERIFIED'};
 const target=cache.targets.findIndex(t=>t[0]===r.track&&t[1]===r.conditions.surface&&t[2]===targetLayout&&t[3]===r.conditions.distance);
 const evidence=[];for(const p of facts.priors.filter(p=>p.match_status==='MATCHED'&&p.flat)){
  const priorLayout=layout[p.archive.layout];if(!priorLayout)continue;
  const source=cache.sources.findIndex(t=>t[0]===p.archive.track&&t[1]===p.archive.surface&&t[2]===priorLayout&&t[3]===p.archive.distance);
  const pair=cache.pairs.find(v=>v[0]===target&&v[1]===source);if(pair)evidence.push({prior_run_id:p.archive.run_id,grade:grades[pair[2]]});
 }return evidence.length?{status:'AVAILABLE',value:evidence,shared_budget:'course_affinity',reason:'COUNTS_MATCHED_NOT_ORIGINAL_ROWWISE_ATTESTED'}:{status:'UNKNOWN',reason:'EXACT_LAYOUT_COURSE_PAIR_UNAVAILABLE'};
}
