import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const fail=x=>{throw Error('RESEARCH_'+x)};
export const meaningful=x=>typeof x==='string'&&x.trim().length>=8&&!/^(CHECKED|CONFIRMED|PASS|確認済み|実施済み)[。.\s]*$/i.test(x.trim());
export const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const setEqual=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));
const timestamp=x=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const isoDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export function forbidMarketsOrTargetResults(x){
 if(!x||typeof x!=='object')return;
 for(const [k,v] of Object.entries(x)){
  if(/^(odds|popularity|market|market_odds|win_odds|target_result|target_results|official_results|payouts?|結果|人気|オッズ)$/i.test(k))fail('MARKET_OR_TARGET_RESULT_FIELD_'+k);
  forbidMarketsOrTargetResults(v);
 }
}
export function sourceOK(s,cutoff,{official=true}={}){
 if(!s||s.verified!==true||!timestamp(s.known_at)||Date.parse(s.known_at)>cutoff||!/^([a-f0-9]{64})$/.test(s.sha256??''))return false;
 try{const u=new URL(s.ref);return u.protocol==='https:'&&!u.username&&!u.password&&(!official||['www.jra.go.jp','www.keiba.go.jp'].includes(u.hostname));}catch{return false;}
}
export function verifyRecord(record,cutoff){
 if(!sourceOK(record?.source,cutoff,{official:false}))return false;
 const {source,...body}=record;return source.sha256===digest(body);
}
export function validateInput(input){
 forbidMarketsOrTargetResults(input);
 const allowed=['mode','race','captured_at','input_frozen_at','roster','history','supplemental','baseline','rubric','reviews','eye_review'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k)))fail('INPUT_KEYS');
 const {race:r}=input;
 if(!r||!isoDay(r.race_date)||!Number.isInteger(r.race_no)||r.race_no<1||!r.track||r.race_id!==[r.race_date,r.track,r.race_no].join('/')||!timestamp(r.post_time)||!['芝','ダート'].includes(r.surface)||!Number.isInteger(r.distance)||r.distance<1)fail('RACE');
 if(!timestamp(input.captured_at)||!timestamp(input.input_frozen_at)||Date.parse(input.captured_at)>Date.parse(input.input_frozen_at)||Date.parse(input.input_frozen_at)>=Date.parse(r.post_time))fail('ASOF_CUTOFF');
 const cutoff=Date.parse(input.captured_at),all=input.roster;
 if(!Array.isArray(all)||all.length<1||all.length>24||new Set(all.map(h=>h.horse_id)).size!==all.length||new Set(all.map(h=>h.horse_no)).size!==all.length)fail('ROSTER');
 for(const h of all){if(typeof h.horse_id!=='string'||!h.horse_id||!Number.isInteger(h.horse_no)||!h.horse_name||!['ACTIVE','CANCELLED','EXCLUDED'].includes(h.status)||!sourceOK(h.identity_source,cutoff))fail('ROSTER_IDENTITY_OR_STATUS');}
 const active=all.filter(h=>h.status==='ACTIVE');if(!active.length)fail('NO_ACTIVE_HORSES');
 if(!Array.isArray(input.history)||!Array.isArray(input.supplemental??[]))fail('HISTORY');
 const byHorse=new Map(active.map(h=>[h.horse_id,[]])),excluded=[];const seen=new Map();
 for(const h of input.history){
  const roster=all.find(r=>r.horse_id===h.horse_id);
  if(!roster||h.horse_name!==roster.horse_name)fail('HISTORY_HORSE_IDENTITY');
  if(!isoDay(h.race_date)||h.race_date>=r.race_date)fail('FUTURE_OR_TARGET_RACE_HISTORY');
  if(!h.track||!Number.isInteger(h.race_no)||h.race_no<1||!sourceOK(h.source,cutoff))fail('UNVERIFIED_HISTORICAL_RACE');
  const key=[h.horse_id,h.race_date,h.track,h.race_no].join('/');
  if(seen.has(key)){if(digest(seen.get(key))!==digest(h))fail('CONFLICTING_HISTORY');excluded.push({key,reason:'DUPLICATE_IDENTICAL_HISTORY'});continue;}seen.set(key,h);
  if(h.race_type!=='平地'||!Number.isInteger(h.finish)||h.finish<1||!Number.isInteger(h.field_size)||h.finish>h.field_size){excluded.push({key,reason:'NON_FLAT_NON_FINISH_OR_EVENT'});continue;}
  if(!Number.isInteger(h.distance)||h.distance<1||!['芝','ダート'].includes(h.surface))fail('HISTORY_FORMAT');
  if(!byHorse.has(h.horse_id)){excluded.push({key,reason:'NOT_CURRENT_ACTIVE'});continue;}
  const early=Number.isInteger(h.early_pos)&&h.early_pos>0&&h.early_pos<=h.field_size?h.early_pos:null;
  const final=Number.isInteger(h.final_turn_pos)&&h.final_turn_pos>0&&h.final_turn_pos<=h.field_size?h.final_turn_pos:null;
  byHorse.get(h.horse_id).push({...h,early_pos:early,final_turn_pos:final,key,dependency:key,
   evidence_id:'run:'+digest([key,h.source.sha256]).slice(0,24)});
 }
 for(const [id,runs] of byHorse){runs.sort((a,b)=>b.race_date.localeCompare(a.race_date)||b.race_no-a.race_no);byHorse.set(id,runs.slice(0,4));for(const h of runs.slice(4))excluded.push({key:h.key,reason:'OUTSIDE_CURRENT_FOUR_HISTORY_WINDOW'});}
 for(const s of input.supplemental??[]){if(!active.some(h=>h.horse_id===s.horse_id)||!sourceOK(s.source,cutoff,{official:s.kind!=='EVAL_COURSE'}))fail('SUPPLEMENT_IDENTITY_ASOF');if(!s.prior_key||!byHorse.get(s.horse_id).some(h=>h.key===s.prior_key))fail('SUPPLEMENT_NOT_BOUND_TO_VERIFIED_PRIOR');}
 const baseline=input.baseline;
 if(baseline){if(!verifyRecord(baseline,Date.parse(input.input_frozen_at))||!Array.isArray(baseline.runners)||!setEqual(baseline.runners.map(h=>h.horse_id),active.map(h=>h.horse_id))||!setEqual(baseline.runners.map(h=>h.rank),active.map((_,i)=>i+1)))fail('BASELINE_ASOF_OR_FIELD');
  for(const h of baseline.runners)if(!finite(h.score)||h.score<0||h.score>100)fail('BASELINE_SCORE');
  if(!Array.isArray(baseline.top5)||!setEqual(baseline.top5,baseline.runners.filter(h=>h.rank<=5).map(h=>h.horse_id)))fail('BASELINE_TOP5');
  if(baseline.eye!==null&&(!active.some(h=>h.horse_id===baseline.eye)||baseline.top5.includes(baseline.eye)))fail('BASELINE_EYE');
 }
 for(const review of input.reviews??[])if(!verifyRecord(review,Date.parse(input.input_frozen_at)))fail('ASSESSMENT_NOT_LOCKED_ASOF');
 if(input.eye_review&&!verifyRecord(input.eye_review,Date.parse(input.input_frozen_at)))fail('EYE_REVIEW_NOT_LOCKED_ASOF');
 return {active,byHorse,excluded,cutoff,input_sha256:digest(input)};
}
