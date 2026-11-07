/**
 * Official NAR prior-race corner source adapter.
 *
 * Not a public endpoint. Does not run until an authorized pre-CLAIM worker calls it.
 * Fetches only past race RESULTS, and extracts only prior-run position facts.
 * Do not use this from a result-refresh worker; this code must NEVER write data.
 */
import {load} from 'npm:cheerio@1.0.0';
import {officialNarPastResultUrl} from './nar-prior-corners.mjs';

const clean=(v)=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const iso=(x)=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
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
   resultRows.push({horseNo:no,horseName:cells[3]});
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
 return {raceHeaderText,cornerRows,knownHorseNos:horseNumbers};
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
 const parsed=extractNarPriorCornerHtml(new TextDecoder().decode(bytes),priorRace);
 // The downstream pure parser validates EXACT URL, race, official heading,
 // horse numbers, all corner rows, and as-of before use.
 return {sourceUrl,sourceCheckedAt,...parsed};
}
