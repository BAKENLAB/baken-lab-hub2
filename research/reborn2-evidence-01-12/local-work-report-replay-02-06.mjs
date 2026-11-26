// Offline research replay of Work's two validated NAR reports; not raw ZIP or prestart replay.
const digits=x=>String(x??'').replace(/\D/g,'');
const clock=x=>{const m=/^(\d{1,2})([0-5]\d)(\d)$/.exec(String(x));return m?Number(m[1])*600+Number(m[2])*10+Number(m[3]):null;};
const f3=x=>/^\d{2}\.\d$/.test(String(x))?Math.round(Number(x)*10):null;
const integer=x=>/^\d+$/.test(String(x))?Number(x):null;
const median=a=>{const b=a.slice().sort((a,b)=>a-b),i=Math.floor(b.length/2);return b.length%2?b[i]:(b[i-1]+b[i])/2;};
export function replayNarWorkReport({race,results,identities,replayAt}){
 if(race?.circuit!=='LOCAL'||!/^\d{4}-\d{2}-\d{2}$/.test(race.date)||!Number.isInteger(race.field_size)||race.field_size<2||race.field_size>24||!Number.isInteger(race.track_code)||!Number.isInteger(race.race_no)||!Number.isFinite(Date.parse(replayAt))||!Array.isArray(results)||!Array.isArray(identities)||results.length!==race.field_size||identities.length!==race.field_size)throw Error('FIELD_OR_TIME');
 const ref='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode='+race.track_code+'&k_raceDate='+race.date.replaceAll('-','%2F')+'&k_raceNo='+race.race_no;
 if(race.source_ref!==ref)throw Error('SOURCE');
 if(new Set(results.map(x=>integer(x['馬番']))).size!==race.field_size||new Set(identities.map(x=>integer(x.horse_no))).size!==race.field_size||new Set(identities.map(x=>x.lineage_login_code)).size!==race.field_size)throw Error('DUPLICATE');
 const rows=results.map(r=>{
 const no=integer(r['馬番']),i=identities.find(x=>integer(x.horse_no)===no);
 if(!i||no<1||no>24||i.horse_name!==r['馬名']||i.identity_result!=='PASS'||r['全項目一致']!=='True'||r['公式URL']!==ref||!/^\d{1,30}$/.test(i.lineage_login_code)||!Number.isFinite(Date.parse(i.checked_at_jst))||Date.parse(i.checked_at_jst)>Date.parse(replayAt)||digits(i.csv_birth)!==digits(i.profile_birth)||digits(i.csv_birth).length!==8||['color','sire','dam','damsire'].some(k=>!i['csv_'+k]||i['csv_'+k]!==i['profile_'+k]))throw Error('IDENTITY_OR_COMPARISON');
 const profile='https://www.keiba.go.jp/KeibaWeb/DataRoom/RaceHorseInfo?k_lineageLoginCode='+i.lineage_login_code+'&k_activeCode=1';
 if(i.profile_url!==profile)throw Error('PROFILE_REF');
 const c=clock(r['タイム(raw)']),f=f3(r['上がり3F']),finish=integer(r['着順']);
 if(c===null||c<=0||f===null||f<=0||f>=c||finish===null||finish<1||finish>race.field_size)throw Error('RESULT_VALUE');
 return {horse_no:no,horse_id:i.lineage_login_code,finish,clock:c,final3f:f,margin:r['着差']||null,profile_checked_at:i.checked_at_jst};
 }).sort((a,b)=>a.finish-b.finish);
 if(rows.some((r,i)=>r.finish!==i+1||i>0&&r.clock<rows[i-1].clock))throw Error('ORDER_OR_DEAD_HEAT_UNSUPPORTED');
 const cm=median(rows.map(r=>r.clock)),fm=median(rows.map(r=>r.final3f));
 const outputs=rows.map((r,i)=>({horse_no:r.horse_no,horse_id:r.horse_id,prior_ref:ref,prior_date:race.date,checked_at:r.profile_checked_at,items:{
 '02':{finish:r.finish,field_size:rows.length},
 '03':{rounded_gap_seconds:(r.clock-rows[0].clock)/10,official_literal_margin:r.margin},
 '04':i+1<rows.length?{rounded_gap_to_next_seconds:(rows[i+1].clock-r.clock)/10,next_finish:rows[i+1].finish}:null,
 '05':{elapsed_seconds:r.clock/10,within_race_median_residual_seconds:(r.clock-cm)/10,course_benchmark:null},
 '06':{final3f_seconds:r.final3f/10,relative_rank:1+rows.filter(x=>x.final3f<r.final3f).length,compared:rows.length,median_residual_seconds:(r.final3f-fm)/10}
 },status:'WORK_REPORT_CROSSCHECKED_RETROSPECTIVE_OBSERVATION',target_applicability:'NOT_TESTED',final_grade_effect:null}));
 return {race,outputs,coverage:Object.fromEntries(['02','03','04','05','06'].map(k=>[k,outputs.filter(r=>r.items[k]!==null).length])),raw_zip_replayed:false,prestart_prediction_verified:false,scoring_authorized:false};
}
