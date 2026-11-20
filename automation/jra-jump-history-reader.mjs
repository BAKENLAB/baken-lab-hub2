// Server-side join: only a fully witnessed schedule and fully decoded results qualify.
// A cache may only provide records previously verified from JRA official result HTML.
// Missing coverage blocks the review; it must never become "first-time".
import {resultIdentity,verifyCalendar} from './jra-jump-official-history.mjs';
const need=(b,c)=>{if(!b)throw Error('JUMP_'+c)};
const id=s=>String(s??'').match(/pw01dud\d{2}(\d{10})/)?.[1]??null;
const clean=s=>String(s??'').normalize('NFKC').replace(/[\s▲△◇☆★]/g,'');
const raceKey=r=>[r.race_date,r.track,r.race_no].join('|');
export function makeJumpHistoryReader({calendarReader,resultReader,maxResults=20000,maxTotalResults=35000,maxYears=12}){
 need(typeof calendarReader==='function'&&typeof resultReader==='function','HISTORY_DEPENDENCIES');
 return async raw=>{
  const r=raw?.race,day=r?.race_date;
  need(/^\d{4}-\d{2}-\d{2}$/.test(day??'')&&r?.field_payload?.race?.race_type==='障害','HISTORY_RACE');
  const entries=r.field_payload.runners.filter(e=>e.status==='ACTIVE');
  const horses=entries.map(e=>({...e,horse_id:id(e.horse_ref)}));
  need(horses.length>=5&&horses.every(e=>e.horse_id&&e.jockey)&&new Set(horses.map(e=>e.horse_id)).size===horses.length,'HISTORY_ENTRY');
  const since=new Date(Date.parse(day)-365*86400000).toISOString().slice(0,10);
  // Exhaustive coverage from birth year, not a guessed "first hurdle" date.
  const years=horses.map(h=>Number(h.horse_id.slice(0,4)));
  need(years.every(y=>y>=1986&&y<=Number(day.slice(0,4))),'HORSE_BIRTH_YEAR');
  const from=[since,...years.map(y=>y+'-01-01')].sort()[0];
  // Each verified year is an independent bounded official calendar witness.
  // A single 2018-to-2026 request exceeds the collector request budget and
  // may exceed the previous 20,000-race limit. Never shorten the horizon.
  const startYear=Number(from.slice(0,4)),endYear=Number(day.slice(0,4));
  need(endYear>=startYear&&endYear-startYear+1<=maxYears,'HISTORY_YEAR_LIMIT');
  const windows=[];
  for(let y=startYear;y<=endYear;y++){
   const a=y===startYear?from:y+'-01-01';
   const b=y===endYear?day:(y+1)+'-01-01';
   if(a<b)windows.push({from:a,to:b});
  }
  need(windows.length>0&&windows[0].from===from&&windows.at(-1).to===day,'HISTORY_WINDOWS');
  const allRows=[],sources=[];
  for(const w of windows){
   const calendar=await calendarReader(w.from,w.to);
   need(calendar?.from===w.from&&calendar.to===w.to&&
     typeof calendar.source_ref==='string'&&calendar.source_ref.trim()&&
     Array.isArray(calendar.rows)&&calendar.rows.length<=maxResults,'HISTORY_CALENDAR');
   // A witnessed year may have no races in synthetic fixtures or a genuinely
   // non-racing period. Missing witness and missing data always cause refusal.
   need(calendar.rows.every(x=>x.race_date>=w.from&&x.race_date<w.to&&
     resultIdentity(x.cname)&&raceKey(resultIdentity(x.cname))===raceKey(x)),
     'HISTORY_CALENDAR_SCOPE');
   allRows.push(...calendar.rows);
   sources.push({from:w.from,to:w.to,source_ref:calendar.source_ref,count:calendar.rows.length});
   need(allRows.length<=maxTotalResults,'HISTORY_TOTAL_BUDGET');
  }
  need(allRows.length>0,'HISTORY_CALENDAR_EMPTY');
  const expected=new Set(allRows.map(x=>raceKey(x)));
  need(expected.size===allRows.length,'HISTORY_CALENDAR_DUPLICATE');
  const calendar={rows:allRows,source_ref:sources.map(x=>x.source_ref).join(' | '),sources};
  const out=horses.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,horse_id:h.horse_id,profile_verified:true,profile_complete:true,as_of_date:day,profile_source:calendar.source_ref,calendar_sources:sources,runs:[],jockey:{name:h.jockey,verified:true,complete_365day_schedule:true,as_of_date:day,source_ref:calendar.source_ref,starts:[]}}));
  for(const x of calendar.rows){
   const res=await resultReader(x.cname,day);
   need(res&&raceKey(res)===raceKey(x)&&res.source_ref===x.cname&&typeof res.jump==='boolean','HISTORY_RESULT_ID');
   if(!res.jump)continue;
   need(Array.isArray(res.rows)&&res.rows.length>0&&new Set(res.rows.map(y=>y.horse_id)).size===res.rows.length,'HISTORY_RESULT_ROWS');
   for(const a of res.rows){
    need(a.verified===true&&a.race_type==='障害'&&a.race_date===x.race_date&&a.track===x.track&&a.source_ref===x.cname&&a.horse_id&&a.jockey&&['FINISHED','DNF','DISQUALIFIED'].includes(a.result_status),'HISTORY_ROW_EVIDENCE');
    for(const h of out){
     if(h.horse_id===a.horse_id)h.runs.push(a);
     if(x.race_date>=since&&clean(a.jockey)===clean(h.jockey.name))h.jockey.starts.push(a);
    }
   }
  }
  for(const h of out){h.runs.sort((a,b)=>b.race_date.localeCompare(a.race_date)||a.source_ref.localeCompare(b.source_ref));h.jump_start_count=h.runs.length}
  return {race_key:day.replaceAll('-','')+'_'+r.track+'_'+r.race_no+'R',as_of_date:day,horses:out};
 };
}
