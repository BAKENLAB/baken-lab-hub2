/**
 * Dormant read-only acquisition adapter. Reuses Deno/Cheerio convention
 * already present in NAR archive source. No DB, CLAIM or prediction writes.
 * Caller must provide independently verified prior race/expected roster.
 */
import {load} from 'npm:cheerio@1.0.0/slim';
import {officialHorseId,officialRaceCore,parseJraStewardsReport} from './jra-official-stewards-incident-link.mjs';
import {parseJraOfficialIncidents} from './jra-official-incident-evidence.mjs';
const clean=v=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const fail=status=>({status,verified:false,packets:[],market_used:false,rank_effect:'NONE',prediction_saved:false});
const countOk=n=>Number.isInteger(n)&&n>=1&&n<=24;
function priorUrl(ref,kind){
 if(!officialRaceCore(ref,kind))return null;
 try{const u=new URL(ref,'https://www.jra.go.jp');
  return u.origin==='https://www.jra.go.jp'&&u.pathname==='/JRADB/accessS.html'&&u.searchParams.size===1&&!u.hash&&!u.username&&!u.password?u.href:null;
 }catch{return null;}
}
function matchHeader(s,prior,includeDate){
 const t=clean(s),[y,m,d]=prior.raceDate.split('-').map(Number);
 return t.includes(prior.track)&&new RegExp('(?:^|[^0-9])'+prior.raceNo+'\\s*(?:R|レース)(?=[^0-9]|$)|第\\s*'+prior.raceNo+'競走','i').test(t)&&(!includeDate||new RegExp(y+'年\\s*0?'+m+'月\\s*0?'+d+'日').test(t));
}
export function extractJraResultIncidentHtml(html,priorRace,expectedRoster){
 if(typeof html!=='string'||html.length<100||html.length>2_000_000||!Array.isArray(expectedRoster)||!countOk(expectedRoster.length))return fail('BAD_RESULT_INPUT');
 const $=load(html);$('script,style,noscript').remove();
 const tables=$('table').filter((_,t)=>{
  const hs=$(t).find('th').map((i,h)=>clean($(h).text())).get();
  return ['着順','馬番','馬名'].every(x=>hs.includes(x));
 }).toArray();
 if(tables.length!==1)return fail('RESULT_TABLE_NOT_UNIQUE');
 // Date/venue/race identity must appear before the result table; a navigation
 // link to another race cannot establish the result identity by itself.
 const titleNodes=$('h1,h2,h3,.race_header,.race_header_data,.race_data,.race_head').filter((_,e)=>!$(e).closest('table').length).map((_,e)=>clean($(e).text())).get();
 const header=titleNodes.join(' ');
 if(!matchHeader(header,priorRace,true))return fail('RESULT_HEADER_UNVERIFIED');
 const runners=[];
 $(tables[0]).find('tbody tr').each((_,tr)=>{
  const td=$(tr).children('td').toArray();
  if(td.length<4)return;
  const no=Number(clean($(td[2]).text()));
  const links=$(td[3]).find('a[href]').toArray().filter(a=>officialHorseId($(a).attr('href')));
  if(!countOk(no)||links.length!==1)return;
  const link=$(links[0]),horseRef=link.attr('href'),horseName=clean(link.text());
  if(horseName)runners.push({horseNo:no,horseName,horseRef});
 });
 const key=h=>[h.horseNo,clean(h.horseName),officialHorseId(h.horseRef)].join('|');
 const actualKeys=runners.map(key),expectedKeys=expectedRoster.map(key);
 if(runners.length!==expectedRoster.length||new Set(actualKeys).size!==runners.length||
    new Set(runners.map(h=>h.horseNo)).size!==runners.length||
    new Set(runners.map(h=>officialHorseId(h.horseRef))).size!==runners.length||
    expectedRoster.some(h=>!officialHorseId(h.horseRef))||
    new Set(expectedKeys).size!==expectedKeys.length||
    actualKeys.some(k=>!expectedKeys.includes(k)))return fail('FULL_ROSTER_ID_MISMATCH');
 const headings=$('h2,h3,h4,h5,h6,dt').filter((_,e)=>clean($(e).text())==='競走中の出来事等').toArray();
 let sectionStatus='MISSING',sectionRows=[];
 if(headings.length===1){
  const h=$(headings[0]),choices=[h.next(),h.parent().next()].filter(x=>x.length);
  const lists=[];
  for(const el of choices){
   if(el.is('h2,h3,h4,h5,h6,dt')||el.find('h2,h3,h4,h5,h6,dt').length)continue;
   const l=el.is('ul,ol')?el:el.find('ul,ol');
   if(l.length===1&&l.children().length===l.children('li').length){
    const rows=l.children('li').map((_,li)=>clean($(li).text())).get();
    if(rows.length&&rows.every(Boolean))lists.push(rows);
   }else if(l.length===0&&/^(?:なし|該当なし|特になし|特記事項なし)[。.]?$/.test(clean(el.text())))lists.push([clean(el.text())]);
  }
  const unique=[...new Map(lists.map(x=>[JSON.stringify(x),x])).values()];
  if(unique.length===1){
   sectionRows=unique[0];
   sectionStatus=sectionRows.every(s=>/^(?:なし|該当なし|特になし|特記事項なし)[。.]?$/.test(s))?'EXPLICIT_NONE':'PRESENT';
  }
 }
 return {verified:true,runners,sectionStatus,sectionRows};
}
export function extractJraReportIncidentHtml(html,priorRace){
 if(typeof html!=='string'||html.length<100||html.length>2_000_000)return fail('BAD_REPORT_INPUT');
 const $=load(html);$('script,style,noscript').remove();
 const headings=$('h1,h2,h3,h4,title').map((_,e)=>clean($(e).text())).get();
 const exactTitle=new RegExp('^'+priorRace.track+'\\s*'+priorRace.raceNo+'\\s*(?:R|レース)\\s*裁決レポート$','i');
 const popupHeadings=$('body div,body p,body span,body strong,body b,body th,body td').filter((_,e)=>{
  const v=clean($(e).text());
  return v.length<=70&&exactTitle.test(v)&&!$(e).closest('nav,footer,[hidden],[aria-hidden="true"]').length;
 }).map((_,e)=>clean($(e).text())).get();
 const semantic=matchHeader(headings.join(' '),priorRace,false)&&headings.some(s=>s.includes('裁決レポート'));
 if(!semantic&&!popupHeadings.length)return fail('REPORT_HEADER_UNVERIFIED');
 // Historic official report pages use BR-delimited prose, not P nodes.
 // Split the DOM at real line boundaries without reinterpreting the text.
 const paras=$('body p').map((_,e)=>clean($(e).text())).get().filter(Boolean);
 if(!paras.length){
  const body=$('body').clone();
  body.find('nav,footer,script,style,noscript,button,[hidden],[aria-hidden="true"]').remove();
  body.find('br').each((_,el)=>{$(el).replaceWith('\n');});
  for(const line of body.text().split(/\n+/).map(clean).filter(Boolean)){
   if(line.length<=2000)paras.push(line);
  }
 }
 // Refuse flattened body fallback or instructional boilerplate.
 const paragraphs=paras.filter(s=>/^\d{1,2}番|^(?:発走後|最後の直線|決勝線手前|[1-4]コーナー|これは|この件は|また)|進路に影響あり|追いづら|逃避|進路が狭くな/.test(s)&&!/^※|^裁決委員|^審議において/.test(s));
 if(!paragraphs.length||paragraphs.length>100)return fail('REPORT_PARAGRAPHS_UNAVAILABLE');
 return {verified:true,paragraphs};
}
async function readOfficial(url,{fetchImpl,clock,post,reserveMs,timeoutMs}){
 if(clock()+reserveMs>=post)throw Error('DEADLINE');
 const r=await fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'ja-JP,ja;q=0.9'}});
 if(!r?.ok||r.url!==url||!r.body)throw Error('HTTP_OR_URL_REJECTED');
 const type=r.headers.get('content-type')??'';
 if(!/text\/html|application\/xhtml\+xml/i.test(type)||Number(r.headers.get('content-length')??0)>2_000_000)throw Error('CONTENT_REJECTED');
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>2_000_000)throw Error('HTML_OVERSIZE');chunks.push(x.value);}}finally{await reader.cancel();}
 if(size<100||clock()+reserveMs>=post)throw Error('HTML_OR_DEADLINE_REJECTED');
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const charset=/utf-8/i.test(type)?'utf-8':/euc-jp/i.test(type)?'euc-jp':'shift_jis';
 return {html:new TextDecoder(charset).decode(bytes),checkedAt:new Date(clock()).toISOString()};
}
export async function acquireJraIncidentPackets({targetRace,priorRace,expectedRoster,reportRef,fetchImpl=fetch,clock=()=>Date.now(),reserveMs=180000,timeoutMs=9000}={}){
 const now=clock(),post=Date.parse(targetRace?.postTime??'');
 if(!Number.isFinite(post)||!Number.isFinite(now)||!Number.isInteger(reserveMs)||reserveMs<180000||!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>15000||now+reserveMs>=post||!(priorRace?.raceDate<targetRace?.raceDate))return fail('PRECLAIM_DEADLINE_OR_DATE');
 const url=priorUrl(priorRace.sourceRef,'result');
 if(!url)return fail('RESULT_URL_UNVERIFIED');
 const reportUrl=reportRef?priorUrl(reportRef,'report'):null;
 if(reportRef&&(!reportUrl||officialRaceCore(reportUrl,'report')!==officialRaceCore(url,'result')))return fail('REPORT_URL_UNVERIFIED');
 const cfg={fetchImpl,clock,post,reserveMs,timeoutMs},packets=[],failures=[];
 let a,r;
 try{a=await readOfficial(url,cfg);r=extractJraResultIncidentHtml(a.html,priorRace,expectedRoster);}catch(e){return fail('OFFICIAL_RESULT_FETCH_UNAVAILABLE');}
 if(!r.verified)return r;
 const common={raceDate:priorRace.raceDate,track:priorRace.track,raceNo:priorRace.raceNo,raceKey:priorRace.raceKey,verifiedOfficialResponse:true,fullFieldVerified:true,expectedRunnerCount:expectedRoster.length,runners:r.runners};
 const result=parseJraOfficialIncidents({targetRace,priorRace,source:{...common,url,checkedAt:a.checkedAt,sectionStatus:r.sectionStatus,sectionRows:r.sectionRows},clock});
 if(result.verified)packets.push(result);else failures.push(result.status);
 if(reportUrl){
  try{
   const report=await readOfficial(reportUrl,cfg),body=extractJraReportIncidentHtml(report.html,priorRace);
   if(body.verified){const p=parseJraStewardsReport({targetRace,priorRace,source:{...common,url:reportUrl,checkedAt:report.checkedAt,paragraphs:body.paragraphs},clock});if(p.verified)packets.push(p);else failures.push(p.status);}
   else failures.push(body.status);
  }catch{failures.push('OFFICIAL_REPORT_FETCH_UNAVAILABLE');}
 }else failures.push('REPORT_LINK_NOT_SUPPLIED');
 if(clock()+reserveMs>=post)return fail('PRECLAIM_DEADLINE');
 return {status:packets.length?'INCIDENT_ACQUISITION_REVIEW_ONLY':'INCIDENT_SOURCES_UNAVAILABLE',verified:packets.length>0,packets,failures,rank_effect:'NONE',market_used:false,prediction_saved:false};
}
