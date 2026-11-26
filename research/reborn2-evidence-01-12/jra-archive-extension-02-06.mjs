// Research archive extension for historical 02–06. Distinct from prestart raw source verification.
// The current card is authoritative for roster linkage, not proof that archive-only past results are independently authenticated.
// Exclude every overlapping card run; previously validated card path handles it, including conflicts.
const id=x=>/^\/JRADB\/accessU\.html\?CNAME=pw01dud[01]0(\d{10})\/[0-9A-F]{2}$/.exec(x??'')?.[1];
const n=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const i=(x,a,b)=>Number.isInteger(n(x))&&n(x)>=a&&n(x)<=b;
const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const clock=x=>{const m=/^(\d+):([0-5]\d)\.(\d)$/.exec(x??'');return m?Number(m[1])*600+Number(m[2])*10+Number(m[3]):null;};
const k=(h,r)=>JSON.stringify([h,r]);
const ids=['02','03','04','05','06'],fields=['track','surface','distance','going','class_name'];
export function extendArchive0206({target,roster,rows,cardRows}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(target?.target_date??'')||fields.some(k=>target[k]===null||target[k]===undefined)||!Array.isArray(roster)||!roster.length||new Set(roster).size!==roster.length||!Array.isArray(rows)||!Array.isArray(cardRows))throw Error('INPUT');
 const cardKeys=new Set(cardRows.filter(r=>typeof r.prior_ref==='string').map(r=>k(r.horse_no,r.prior_ref.split('CNAME=')[1])));
 const seen=new Set(),used=[],excluded=[],all=[];
 for(const r of rows){
  const key=k(r.current_no,r.source_ref);
  if(!roster.includes(r.current_no)||!id(r.horse_ref)||id(r.horse_ref)!==r.horse_id||id(r.prior_horse_ref)!==r.horse_id||!/^pw01sde\d+\/[0-9A-F]{2}$/.test(r.source_ref??'')||!r.source_ref.split('/')[0].endsWith(r.race_date?.replaceAll('-',''))||!/^\d{4}-\d{2}-\d{2}$/.test(r.race_date??'')||r.race_date>=target.target_date||!(time(r.source_checked_at)<=time(r.runner_checked))||!(time(r.runner_checked)<time(r.post_at))||n(r.duplicate_n)!==1||!i(r.finish,1,24)||!i(r.field_size,r.finish,24)||!i(r.prior_no,1,24)||!i(r.distance,600,5000)||!['芝','ダート'].includes(r.surface)||!r.track||!r.going||!r.class_name){excluded.push({horse_no:r.current_no,source_ref:r.source_ref,reason:'IDENTITY_TIME_OR_FIELD_GATE'});continue;}
  if(seen.has(key))throw Error('DUPLICATE');seen.add(key);
  const c=clock(r.time_raw),f=n(r.final3f),full=['n','unique_n','distinct_finish','clock_n'].every(x=>n(r[x])===r.field_size)&&n(r.min_finish)===1&&n(r.max_finish)===r.field_size&&n(r.bad_clock_n)===0&&c!==null&&c>0&&n(r.winner_clock)>0&&c>=Math.round(n(r.winner_clock)*10);
  const allF3=full&&n(r.f3_n)===r.field_size&&f>0&&i(r.f3_rank,1,r.field_size);
  const next=n(r.next_clock),winner=n(r.winner_clock),items={
   '02':{finish:r.finish,field_size:r.field_size},
   '03':full?{rounded_gap_seconds:(c-Math.round(winner*10))/10}:null,
   '04':full&&r.finish<r.field_size&&next!==null&&Math.round(next*10)>=c?{rounded_gap_to_next_seconds:(Math.round(next*10)-c)/10}:null,
   '05':c!==null&&c>0?{elapsed_seconds:c/10,within_race_median_residual_seconds:full&&n(r.clock_median)!==null?Math.round((c/10-n(r.clock_median))*100)/100:null,course_benchmark:null}:null,
   '06':f>0&&c!==null&&f<c/10?{final3f_seconds:f,relative_rank:allF3?n(r.f3_rank):null,compared:allF3?r.field_size:null,median_residual_seconds:allF3&&n(r.f3_median)!==null?Math.round((f-n(r.f3_median))*100)/100:null}:null
  };
  const differences=fields.filter(x=>r[x]!==target[x]),context=differences.length===0?'VISIBLE_FIVE_MATCH':r.surface===target.surface&&r.distance===target.distance&&r.class_name===target.class_name?'SURFACE_DISTANCE_CLASS_MATCH':'OTHER';
  const row={horse_no:r.current_no,horse_id:r.horse_id,source_ref:r.source_ref,source_checked_at:r.source_checked_at,prior_date:r.race_date,days_since:(Date.parse(target.target_date)-Date.parse(r.race_date))/86400000,conditions:Object.fromEntries(fields.map(x=>[x,r[x]])),context,differences,items,full_field_clock_validated:full,archive_complete:r.archive_complete===true,card_overlap:cardKeys.has(key),status:'ARCHIVE_ID_MATCH_RESEARCH_ONLY',current_relevance_validated:false,final_grade_effect:null};
  all.push(row);
  if(!row.card_overlap)used.push(row);
 }
 const runners=roster.map(h=>{const history=used.filter(x=>x.horse_no===h).sort((a,b)=>b.prior_date.localeCompare(a.prior_date));return {horse_no:h,history,assessments:Object.fromEntries(ids.map(id=>{const a=history.filter(x=>x.items[id]!==null);const exact=a.filter(x=>x.context==='VISIBLE_FIVE_MATCH');return [id,{historical_count:a.length,visible_condition_count:exact.length,most_recent_visible:exact[0]?{date:exact[0].prior_date,days_since:exact[0].days_since,value:exact[0].items[id],source_ref:exact[0].source_ref}:null,status:exact.length?'HISTORICAL_CONDITION_EVIDENCE':a.length?'HISTORICAL_CONTEXT_ONLY':'MISSING',final_grade_effect:null}];}))};});
 return {all_rows:all.length,additional_rows:used.length,card_overlap:all.length-used.length,excluded,runners,coverage:Object.fromEntries(ids.map(id=>[id,{rows:used.filter(x=>x.items[id]!==null).length,horses:runners.filter(h=>h.assessments[id].historical_count>0).length,visible_horses:runners.filter(h=>h.assessments[id].visible_condition_count>0).length}])),scoring_authorized:false,final_assessment_connected:false};
}
