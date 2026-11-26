// REBORN2 02–06: deterministic historical research analysis.
// No rank, score, market, target outcome, production release, or fabricated missing values.
// The SQL reader supplies candidate provenance; this module checks consistency, not independent official authenticity.
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const int=(v,min,max)=>Number.isInteger(num(v))&&num(v)>=min&&num(v)<=max;
const clock=v=>{const m=typeof v==='string'&&/^(\d+):([0-5]\d)\.(\d)$/.exec(v);return m?Number(m[1])*600+Number(m[2])*10+Number(m[3]):null;};
const f3=v=>num(v)>0&&Math.abs(num(v)*10-Math.round(num(v)*10))<1e-6?Math.round(num(v)*10):null;
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const median=a=>{const b=a.slice().sort((a,b)=>a-b),i=Math.floor(b.length/2);return b.length?(b.length%2?b[i]:(b[i-1]+b[i])/2):null;};
const items=['02','03','04','05','06'];
const missing=reason=>({status:'MISSING',reason});
const obs=(value,scope)=>({status:'RESEARCH_OBSERVATION',value,scope});
function fullField(r){
 const a=r.full_field;if(!Array.isArray(a)||!int(r.field_size,1,24)||a.length!==r.field_size||r.archive_n!==r.field_size||new Set(a.map(x=>x.horse_no)).size!==a.length||a.some(x=>!int(x.horse_no,1,24)||!int(x.finish,1,a.length)||clock(x.time_raw)===null))return null;
 const me=a.find(x=>x.horse_no===r.prior_no);
 if(!me||me.finish!==r.finish||clock(me.time_raw)!==clock(r.time_raw)||f3(me.final3f)!==f3(r.final3f))return null;
 const sorted=a.slice().sort((x,y)=>x.finish-y.finish);
 // Dead heat and nonfinishers need explicit statuses; fail closed in this first path.
 if(sorted.some((x,i)=>x.finish!==i+1||i>0&&clock(x.time_raw)<clock(sorted[i-1].time_raw)))return null;
 return sorted;
}
export function analyzeJra0206({targetDate,roster,rows}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||!Array.isArray(roster)||!roster.length||new Set(roster).size!==roster.length||!roster.every(x=>int(x,1,24))||!Array.isArray(rows))throw Error('INPUT');
 const seen=new Set(),out=[],excluded=[];
 for(const r of rows){
  const token=/^\/JRADB\/accessU\.html\?CNAME=pw01dud[01]0(\d{10})\/[0-9A-F]{2}$/.exec(r.horse_ref??'')?.[1];
  const ref=/^\/JRADB\/accessS\.html\?CNAME=pw01sde\d{14}(\d{8})\/[0-9A-F]{2}$/.exec(r.prior_ref??'');
  // Official CNAME lengths vary; explicit date suffix still required below.
  const sourceOk=/^\/JRADB\/accessS\.html\?CNAME=pw01sde[0-9]+\/[0-9A-F]{2}$/.test(r.prior_ref??'')&&r.prior_ref.split('/').at(-2)?.endsWith(r.prior_date?.replaceAll('-',''));
  const t=stamp(r.runner_checked),post=stamp(r.post_at);
  const k=JSON.stringify([r.horse_no,r.prior_ref]);
  if(!roster.includes(r.horse_no)||!token||!sourceOk||!/^\d{4}-\d{2}-\d{2}$/.test(r.prior_date??'')||r.prior_date>=targetDate||!Number.isFinite(t)||!Number.isFinite(post)||t>=post||!int(r.prior_no,1,24)||!int(r.finish,1,24)||!int(r.field_size,r.finish,24)||!int(r.distance,600,5000)||!['芝','ダート'].includes(r.surface)||!r.going||!r.class_name){excluded.push({horse_no:r.horse_no,ord:r.ord,reason:'NON_RACE_OR_UNBOUND_CARD'});continue;}
  if(seen.has(k))throw Error('DUPLICATE_PRIOR');seen.add(k);
  const c=clock(r.time_raw),f=f3(r.final3f);
  const conditions={track:r.prior_track,surface:r.surface,distance:r.distance,going:r.going,class_name:r.class_name};
  const a={'02':missing('INDEPENDENT_RESULT_NOT_MATCHED'),'03':missing('FULL_FIELD_UNVERIFIED'),'04':missing('FULL_FIELD_UNVERIFIED'),'05':missing('INDEPENDENT_RESULT_NOT_MATCHED'),'06':missing('INDEPENDENT_RESULT_NOT_MATCHED')};
  const archive= r.matches===1&&r.archive_horse_no===r.prior_no&&r.archive_finish===r.finish&&stamp(r.archive_checked)<=t&&r.archive_surface===r.surface&&r.archive_distance===r.distance&&r.archive_going===r.going&&c!==null&&clock(r.archive_clock)===c&&f!==null&&f3(r.archive_f3)===f;
  const classMatch=archive&&r.archive_class===r.class_name;
  const field=archive?fullField(r):null;
  if(archive){
   a['02']=obs({finish:r.finish,field_size:r.field_size,win:r.finish===1,top3:r.finish<=3},'CARD_AND_ARCHIVE_MATCH');
   a['05']=obs({elapsed_seconds:c/10,conditions,course_benchmark:null},'RAW_CLOCK_CARD_AND_ARCHIVE_MATCH');
   a['06']=obs({final3f_seconds:f/10,measurement:'OFFICIAL_REPORTED_OR_ESTIMATED',relative_rank:null},'CARD_AND_ARCHIVE_MATCH');
  }
  if(field){
   const winner=clock(field[0].time_raw),delta=c-winner,next=field[r.finish];
   const cardgap=num(r.card_gap);
   // For a winner the card may use a runner-up margin rather than winner-gap. Do not reinterpret that as positive losing margin.
   if(r.finish===1||cardgap===null||cardgap>=0&&Math.abs(cardgap*10-delta)<1e-6)a['03']=obs({rounded_gap_seconds:delta/10,winner_seconds:winner/10,official_literal_margin:r.archive_margin??null},'FULL_FIELD_RECOMPUTED');
   else a['03']=missing('CARD_GAP_CONFLICT');
   a['04']=next?obs({rounded_gap_to_next_seconds:(clock(next.time_raw)-c)/10,next_finish:next.finish},'FULL_FIELD_RECOMPUTED'):missing('NO_NEXT_CLASSIFIED_FINISHER');
   a['05']=obs({elapsed_seconds:c/10,conditions,within_race_median_residual_seconds:(c-median(field.map(x=>clock(x.time_raw))))/10,course_benchmark:null},'WITHIN_RACE_COMPARISON_NOT_COURSE_INDEX');
   const fs=field.map(x=>f3(x.final3f));
   if(fs.every(x=>x!==null))a['06']=obs({final3f_seconds:f/10,relative_rank:1+fs.filter(x=>x<f).length,tied_count:fs.filter(x=>x===f).length,compared:fs.length,median_residual_seconds:(f-median(fs))/10,measurement:'OFFICIAL_REPORTED_OR_ESTIMATED'},'FULL_FIELD_COMPARISON');
  }
  out.push({horse_no:r.horse_no,horse_id:token,prior_no:r.prior_no,prior_ref:r.prior_ref,prior_date:r.prior_date,source_checked_at:r.runner_checked,archive_checked_at:r.archive_checked??null,conditions,source_match:archive,class_match:classMatch,archive_class:r.archive_class??null,field_match:!!field,items:a,card_only:!archive?{finish:r.finish,field_size:r.field_size,elapsed_seconds:c===null?null:c/10,final3f_seconds:f===null?null:f/10,source_ref:r.prior_ref,status:'UNVERIFIED_CANDIDATE'}:null});
 }
 const runners=roster.map(h=>{const history=out.filter(x=>x.horse_no===h).sort((a,b)=>b.prior_date.localeCompare(a.prior_date));return {horse_no:h,history,ability_inputs:Object.fromEntries(items.map(i=>[i,history.filter(x=>x.items[i].status==='RESEARCH_OBSERVATION').map(x=>({source_ref:x.prior_ref,prior_date:x.prior_date,conditions:x.conditions,...x.items[i]}))])),assessment_status:'RESEARCH_INPUT_ONLY_NO_FINAL_GRADE'};});
 const coverage=Object.fromEntries(items.map(i=>[i,{rows:out.filter(x=>x.items[i].status==='RESEARCH_OBSERVATION').length,horses:runners.filter(h=>h.ability_inputs[i].length).length}]));
 return {circuit:'JRA',targetDate,roster_n:roster.length,rows:out,excluded,runners,coverage,source_matched:out.filter(x=>x.source_match).length,class_matched:out.filter(x=>x.class_match).length,field_matched:out.filter(x=>x.field_match).length,scoring_authorized:false};
}
