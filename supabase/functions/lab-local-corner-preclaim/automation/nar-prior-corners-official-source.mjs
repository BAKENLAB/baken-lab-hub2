/**
 * Official NAR prior-race corner source adapter.
 *
 * Not a public endpoint. Does not run until an authorized pre-CLAIM worker calls it.
 * Fetches only past race RESULTS, and extracts only prior-run position facts.
 * Do not use this from a result-refresh worker; this code must NEVER write data.
 */
import {load} from 'npm:cheerio@1.0.0';
import {officialNarPastResultUrl} from './nar-prior-corners.mjs';
import {validateOfficialNarRaceLaps} from './nar-official-lap-evidence.mjs';

const clean=(v)=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const iso=(x)=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Optional, only if official HTML has one unambiguous distance, winning time
 * and a literal ハロンタイム row. Missing/ambiguous values stay unavailable. */
export function extractOfficialRaceLapFields($){
 const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
 const body=norm($('body').text());
 // Race-header distance, not later horse records or payouts.
 const header=body.slice(0,Math.min(1800,Math.max(900,body.indexOf('競走成績')+400)));
 const distanceCandidates=[...header.matchAll(/(?:ダート|ダ|芝|障害)(?:右|左)?([0-9,]{3,5})m/g)]
   .map(x=>Number(x[1].replaceAll(',',''))).filter(x=>x>=600&&x<=4000);
 const distances=[...new Set(distanceCandidates)];
 if(distances.length!==1)return null;
 const tableRows=[];
 $('table').each((_,table)=>{
  const rs=$(table).find('tr').toArray();
  const head=rs.map(x=>$(x).find('th').map((_,c)=>norm($(c).text())).get());
  const hi=head.findIndex(row=>row.includes('着順')&&row.includes('馬番')&&row.includes('馬名')&&row.some(x=>x==='タイム'||x==='走破タイム'));
  if(hi<0)return;
  const ti=head[hi].findIndex(x=>x==='タイム'||x==='走破タイム');
  let winnerTime=null;
  for(const tr of rs.slice(hi+1)){
   const cells=$(tr).find('th,td').map((_,c)=>norm($(c).text())).get();
   if(cells[0]==='1'&&cells.length===head[hi].length){
    winnerTime=cells[ti];break;
   }
  }
  if(winnerTime)tableRows.push(winnerTime);
 });
 if(tableRows.length!==1)return null;
 const laps=[];
 $('table tr').each((_,tr)=>{
  const cells=$(tr).find('th,td').map((_,c)=>norm($(c).text())).get();
  if(cells[0]!=='ハロンタイム'||cells.length<2)return;
  const data=cells.slice(1).join('-');
  if(!/^\d{1,2}\.\d(?:-\d{1,2}\.\d){2,19}$/.test(data))return;
  laps.push(data.split('-'));
 });
 if(laps.length!==1)return null;
 return {distance:distances[0],winnerTime:tableRows[0],halonTimes:laps[0]};
}

function sourceError(code){const error=new Error(code);error.code=code;return error;}

/** Extract bounded, count-checked tables; no payout/odds content is returned. */
export function extractNarPriorCornerHtml(html,priorRace) {
 if(typeof html!=='string'||html.length<60||html.length>524288)throw sourceError('HTML_SIZE_INVALID');
 const $=load(html);
 const body=clean($('body').text());
 if(body.length<100||!body.includes('全馬コーナー通過順'))throw sourceError('CORNER_SECTION_MISSING');
 const resultHeader=body.match(/(\d{4}年\d{1,2}月\d{1,2}日)[\s\S]{0,180}?(第\d+競走)[\s\S]{0,80}?(競走成績)/);
 if(!resultHeader)throw sourceError('RESULT_HEADER_MISSING');
 const raceHeaderText=resultHeader[0];
 // The official finish table has stable header labels
 // 着順 / 枠 / 馬番 / 馬名. Other tables (including payouts) are ignored.
 const resultRows=[];
 $('table').each((_,table)=>{
  const rows=$(table).find('tr').toArray();
  if(!rows.some(el=>{
   const headers=$(el).find('th').map((_j,e)=>clean($(e).text())).get();
   return headers.some(h=>h==='着順')&&headers.some(h=>h==='馬番')&&headers.some(h=>h==='馬名');
  }))return;
  for(const tr of rows){
   const cells=$(tr).find('th,td').map((_j,el)=>clean($(el).text())).get();
   if(cells.length<4 || !/^\d{1,2}$/.test(cells[0]) || !/^\d{1,2}$/.test(cells[2]))continue;
   const no=Number(cells[2]);
   if(no<1||no>24||!cells[3])continue;
   // Stable horse ID must be explicitly linked by the official result row;
   // neither the name nor a previous horse number can substitute for identity.
   const refs=$(tr).find('a[href]').map((_,a)=>$(a).attr('href')).get()
    .map(href=>{try{
     const u=new URL(href,'https://www.keiba.go.jp');
     if(u.protocol!=='https:'||u.hostname!=='www.keiba.go.jp'||
       u.pathname!=='/KeibaWeb/DataRoom/HorseMarkInfo'||
       u.searchParams.getAll('k_lineageLoginCode').length!==1||
       !/^[0-9]{1,30}$/.test(u.searchParams.get('k_lineageLoginCode')??'')||
       [...u.searchParams.keys()].some(k=>!['k_lineageLoginCode','k_activeCode'].includes(k)))return null;
     return u.searchParams.get('k_lineageLoginCode');
    }catch{return null;}}).filter(Boolean);
   resultRows.push({horseNo:no,horseName:cells[3],finish:Number(cells[0]),
    officialHorseId:refs.length===1?refs[0]:null});
  }
 });
 const horseNumbers=[...new Set(resultRows.map(x=>x.horseNo))];
 if(horseNumbers.length<2||horseNumbers.length>24||horseNumbers.length!==resultRows.length)
   throw sourceError('RESULT_HORSE_NUMBERS_UNVERIFIED');
 const cornerRows=[];
 $('table tr').each((_,el)=>{
  const values=$(el).find('th,td').map((_j,cell)=>clean($(cell).text())).get();
  if(values.length!==2)return;
  if(/^(?:第)?[1-4](?:角|コーナー)$/.test(values[0]))cornerRows.push(values);
 });
 if(!cornerRows.length||cornerRows.length>4)throw sourceError('CORNERS_UNAVAILABLE');
 // Preserve official past-result horse names for a second identity cross-check.
 // Horse numbers alone are not identity evidence across different races.
 const officialHorseNames=Object.fromEntries(resultRows.map(x=>[String(x.horseNo),x.horseName]));
 const officialFinishers=resultRows.filter(r=>
   Number.isInteger(r.finish)&&r.finish>=1&&r.finish<=24&&r.officialHorseId)
   .map(({horseNo,horseName,finish,officialHorseId})=>
     ({horseNo,horseName,finish,officialHorseId}));
 return {raceHeaderText,cornerRows,knownHorseNos:horseNumbers,officialHorseNames,officialFinishers};
}

export async function readNarOfficialPriorCorners({
 priorRace,targetRaceDate,targetPostTime,
 clock=()=>Date.now(),fetchImpl=fetch,signal
}) {
 if(!iso(priorRace?.raceDate)||!iso(targetRaceDate)||priorRace.raceDate>=targetRaceDate)
   throw sourceError('NOT_A_PAST_RACE');
 const post=Date.parse(targetPostTime);
 if(!Number.isFinite(post)||clock()>=post)throw sourceError('AFTER_TARGET_POST');
 const sourceUrl=officialNarPastResultUrl(priorRace);
 const response=await fetchImpl(sourceUrl,{
   method:'GET',redirect:'error',cache:'no-store',signal,
   headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'ja-JP,ja;q=0.9'}
 });
 if(!response?.ok||!response.body)throw sourceError('OFFICIAL_RESULT_UNAVAILABLE');
 const len=Number(response.headers?.get?.('content-length')??0);
 if(len>262144)throw sourceError('RESULT_TOO_LARGE');
 // Limit the actual stream, not just its possibly missing content-length header.
 let sum=0;const chunks=[];const reader=response.body.getReader();
 try {
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   sum+=value.byteLength;if(sum>262144)throw sourceError('RESULT_TOO_LARGE');
   chunks.push(value);
  }
 }finally{await reader.cancel();}
 const bytes=new Uint8Array(sum);let at=0;
 for(const part of chunks){bytes.set(part,at);at+=part.byteLength;}
 const sourceCheckedAt=new Date(clock()).toISOString();
 if(clock()>=post)throw sourceError('AFTER_TARGET_POST');
 const html=new TextDecoder().decode(bytes);
 const parsed=extractNarPriorCornerHtml(html,priorRace);
 // Supplement the existing verified corner fetch; no extra network request.
 let officialRaceLaps=null;
 try{
  const fields=extractOfficialRaceLapFields(load(html));
  if(fields)officialRaceLaps=validateOfficialNarRaceLaps({
   past:priorRace,targetDate:targetRaceDate,targetPostTime,sourceUrl,
   sourceCheckedAt,...fields
  });
 }catch{/* Missing/ambiguous official race splits remain unverified. */}
 // The downstream pure parser validates EXACT URL, race, official heading,
 // horse numbers, all corner rows, and as-of before use.
 return {sourceUrl,sourceCheckedAt,...parsed,officialRaceLaps};
}
