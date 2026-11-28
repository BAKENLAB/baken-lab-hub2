// LOCAL 02–06: research-only link of prestart official identity witnesses and archived result rows.
// Does not claim a complete field, independent fresh official replay or final ability grade.
const codes={盛岡:10,水沢:11,浦和:18,船橋:19,大井:20,川崎:21,金沢:22,笠松:23,名古屋:24,園田:27,姫路:28,高知:31,佐賀:32,門別:36};
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const int=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const clock=x=>{const m=typeof x==='string'&&/^(\d+):([0-5]\d)\.(\d)$/.exec(x);return m?Number(m[1])*600+Number(m[2])*10+Number(m[3]):null;};
const missing=reason=>({status:'MISSING',reason});
const obs=(value,scope)=>({status:'RESEARCH_OBSERVATION',value,scope});
export function analyzeLocal0206({targetDate,roster,rows}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||!Array.isArray(roster)||!roster.length||roster.some(n=>!int(n,1,24))||new Set(roster).size!==roster.length||!Array.isArray(rows))throw Error('INPUT');
 const seen=new Set(),identity=new Map(),reverse=new Map(),out=[],excluded=[];
 for(const r of rows){
  const id=/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})$/.exec(r.horse_ref??'')?.[1];
  const checked=stamp(r.source_checked_at),asOf=stamp(r.as_of),captured=stamp(r.captured_at),post=stamp(r.official_post_time);
  const expected='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode='+codes[r.prior_track]+'&k_raceDate='+r.prior_date?.replaceAll('-','%2F')+'&k_raceNo='+r.prior_race_no;
  if(!r.id||r.target_date!==targetDate||!roster.includes(r.current_no)||!id||!Object.hasOwn(codes,r.prior_track)||!int(r.prior_race_no,1,14)||!int(r.prior_no,1,24)||!/^\d{4}-\d{2}-\d{2}$/.test(r.prior_date??'')||r.prior_date>=targetDate||r.source_ref!==expected||![checked,asOf,captured,post].every(Number.isFinite)||checked>asOf||asOf>captured||captured>=post){excluded.push({horse_no:r.current_no,reason:'WITNESS_UNBOUND'});continue;}
  const k=JSON.stringify([r.current_no,r.prior_date,r.prior_track,r.prior_race_no]);
  if(seen.has(k))throw Error('DUPLICATE_PRIOR');seen.add(k);
  if(identity.has(r.current_no)&&identity.get(r.current_no)!==id||reverse.has(id)&&reverse.get(id)!==r.current_no)throw Error('IDENTITY_CONFLICT');
  identity.set(r.current_no,id);reverse.set(id,r.current_no);
  const a={'02':missing('RESULT_ROW_UNVERIFIED'),'03':missing('WINNER_CLOCK_UNVERIFIED'),'04':missing('FULL_FIELD_NOT_PROVEN'),'05':missing('CLOCK_UNVERIFIED'),'06':missing('FINAL3F_NOT_IN_SETTLEMENT')};
  const s=r.settlement,field=s?.rows,settled=stamp(s?.settled_at);
  let candidateGap=null;
  if(Number(r.settlement_matches)===1&&s?.source==='NAR_OFFICIAL_RACEMARK'&&Number.isFinite(settled)&&settled<=asOf&&Array.isArray(field)&&field.every(x=>int(x.horse_no,1,24))&&new Set(field.map(x=>x.horse_no)).size===field.length){
   const me=field.find(x=>x.horse_no===r.prior_no&&x.horse_name===r.horse_name);
   if(me&&int(me.finish,1,24)){
    a['02']=obs({finish:me.finish,win:me.finish===1,top3:me.finish<=3,field_size:null},'STORED_ID_WITNESS_AND_EXACT_SETTLEMENT_ROW');
    const c=clock(me.time_raw);
    if(c!==null&&c>0){
     a['05']=obs({elapsed_seconds:c/10,conditions:null,course_benchmark:null},'RAW_SETTLEMENT_CLOCK_ONLY');
     const wins=field.filter(x=>x.finish===1);
     if(wins.length===1&&clock(wins[0].time_raw)>0&&clock(wins[0].time_raw)<=c)candidateGap={rounded_gap_seconds:(c-clock(wins[0].time_raw))/10,status:'CANDIDATE_NOT_ADMITTED',reason:'FULL_FIELD_AND_PARSER_VALIDATION_UNRESOLVED'};
    }
   }
  }
  out.push({horse_no:r.current_no,horse_id:id,prior_date:r.prior_date,prior_ref:r.source_ref,source_checked_at:r.source_checked_at,settled_at:s?.settled_at??null,items:a,winner_gap_candidate:candidateGap});
 }
 const items=['02','03','04','05','06'];
 const runners=roster.map(h=>({horse_no:h,ability_inputs:Object.fromEntries(items.map(i=>[i,out.filter(x=>x.horse_no===h&&x.items[i].status==='RESEARCH_OBSERVATION').map(x=>({prior_ref:x.prior_ref,prior_date:x.prior_date,...x.items[i]}))])),assessment_status:'RESEARCH_INPUT_ONLY_NO_FINAL_GRADE'}));
 return {circuit:'LOCAL',targetDate,rows:out,excluded,runners,coverage:Object.fromEntries(items.map(i=>[i,{rows:out.filter(x=>x.items[i].status==='RESEARCH_OBSERVATION').length,horses:runners.filter(h=>h.ability_inputs[i].length).length}])),scoring_authorized:false};
}
