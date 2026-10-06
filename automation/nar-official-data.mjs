// Uses the EXISTING read-only nar-schedule-probe -> NAR DebaTable path.
// Does not invoke local-data-refresh (which writes race and market tables).
import {load} from "npm:cheerio@1.0.0";
import {ContextError,NAR_TRACK_CODES as codes} from './local-worker-data.mjs';
import {attachDomHorseLinks,parseNarHorseHistory,narHorseUrl} from './nar-history-rescue.mjs';
const endpoint = 'https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/nar-schedule-probe';
const clean = s => String(s ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
const sexAgePattern = /^(?:牡|牝|セ|セン|騙|騸|せん)\d+$/;
function currentRunnerSlice(cells) {
  const normalized=cells.map(clean);
  const pastIndex=normalized.findIndex(s=>/\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}/.test(s));
  return normalized.slice(0,pastIndex>=0?pastIndex:normalized.length);
}
function currentRunnerStatus(cells) {
  const currentText=currentRunnerSlice(cells).join(' ');
  return /取消/.test(currentText)?'CANCELLED':/除外/.test(currentText)?'EXCLUDED':'ACTIVE';
}
function hasCurrentPositiveOdds(cells) {
  return currentRunnerSlice(cells).some(s=>/^\d+(?:\.\d+)?\s*\(\d+人気\)$/.test(s));
}
export function parseCurrentAttributes(cells) {
  const normalized = cells.map(clean);
  const sexAge = normalized.find(s=>sexAgePattern.test(s));
  let weight = null;
  for (const cell of normalized) {
    // Same current-card weight + career-count cell as local-data-refresh.
    // Independent of sex_age detection: one missing field cannot hide another.
    const match = cell.match(/^(?:[▲△☆◇]\s*)?(\d{2}(?:\.\d+)?)\s+(?:\d+\s*-\s*){3}\d+(?:\s|$)/);
    if (match && Number(match[1]) >= 40 && Number(match[1]) <= 70) {
      weight = Number(match[1]); break;
    }
  }
  return {sex_age:sexAge ? sexAge.replace(/^(?:セン|せん|騸|騙)/,'セ') : null,weight_carried:weight};
}
export function parseNarProbe(probe,race,fetchedAt) {
  const expected = new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
  expected.searchParams.set('k_babaCode',codes[race.track]);
  expected.searchParams.set('k_raceDate',race.race_date.replaceAll('-','/'));
  expected.searchParams.set('k_raceNo',String(race.race_no));
  let actual;
  try { actual = new URL(probe.url); } catch { throw new ContextError('OFFICIAL_FIELD_UNVERIFIED'); }
  if (!codes[race.track] || !probe.ok || probe.status !== 200 || actual.origin !== expected.origin ||
      actual.pathname !== expected.pathname || [...expected.searchParams].some(([k,v])=>actual.searchParams.get(k)!==v) ||
      !Array.isArray(probe.rows) || !Array.isArray(probe.links) || probe.rows.length >= 120 ||
      probe.links.length >= 150 || probe.truncated || /成績表|レース結果/.test(probe.title ?? ''))
    throw new ContextError('OFFICIAL_RESPONSE_TRUNCATED_OR_INVALID');
  const rows = probe.rows.map(r=>({i:r.i,cells:r.cells.map(clean)}));
  const main = rows.map((r,index)=>{
    const jockeyIndex = r.cells.findIndex(s=>/^.+[（(][^）)]+[）)]$/.test(s) && !/^[\d(]/.test(s));
    const nums = r.cells.slice(0,jockeyIndex-1).filter(s=>/^\d+$/.test(s)).map(Number);
    return {index,jockeyIndex,horseNo:nums.at(-1)};
  }).filter(r=>r.jockeyIndex>=1 && r.horseNo>=1 && r.horseNo<=20);
  const runners = main.map((m,i)=>{
    const cells = rows[m.index].cells;
    const name = cells[m.jockeyIndex-1];
    const following = rows.slice(m.index+1,main[i+1]?.index ?? rows.length);
    // Dated past-run rows are never a source of current race attributes.
    const attrs = parseCurrentAttributes(following.filter(r=>
      !r.cells.some(s=>/\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}/.test(s)))
      .flatMap(r=>r.cells));
    const status=currentRunnerStatus(cells);
    if(status!=='ACTIVE' && hasCurrentPositiveOdds(cells)) throw new ContextError('OFFICIAL_FIELD_STATUS_CONFLICT');
    return {horse_no:m.horseNo,horse_name:name,jockey:cells[m.jockeyIndex].replace(/\s*[（(][^）)]+[）)]$/,''),
      ...attrs,status,
      identity_refs:[]}; // Global link text cannot establish DOM ownership.
  });
  // Restrict condition parsing to the race header, never past-run or market text.
  const header=clean(probe.body).split(runners[0]?.horse_name ?? '\u0000')[0];
  const course=header.match(/(ダート|芝)\s*(\d{3,4})\s*m(?:\s*[（(](右|左|直)[^）)]*[）)])?/);
  const going=header.match(/馬場\s*[:：]?\s*(不良|稍重|良|重)/);
  const weather=header.match(/天候\s*[:：]?\s*(晴|曇|雨|雪)/);
  const conditions={};
  if(course){conditions.surface=course[1];conditions.distance=Number(course[2]);if(course[3])conditions.turn=course[3];}
  if(going)conditions.going=going[1];if(weather)conditions.weather=weather[1];
  return {race_date:race.race_date,track:race.track,race_no:race.race_no,circuit:'LOCAL',
    source:'NAR_OFFICIAL_DEBA',source_ref:actual.href,fetched_at:fetchedAt,
    runners,conditions,history:[]};
}
export function parseNarDomDiagnostic(diagnostic,race) {
  if(!Array.isArray(diagnostic.runners) || diagnostic.runners.length>20 ||
    typeof diagnostic.race_header_text!=='string' || diagnostic.runners.some(r=>
      !Array.isArray(r.current_attribute_cells) || !r.jockey_text ||
      !['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)))
    throw new ContextError('DOM_CURRENT_ATTRIBUTES_UNVERIFIED');
  const header=clean(diagnostic.race_header_text);
  const identity=header.replace(/\s/g,'').match(/(\d{4})年(\d{1,2})月(\d{1,2})日\([^)]*\)(.+?)第(\d+)競走/);
  const expectedDate=race.race_date.split('-').map(Number);
  if(!identity || expectedDate.some((n,i)=>Number(identity[i+1])!==n) ||
    identity[4]!==race.track || Number(identity[5])!==race.race_no)throw new ContextError('DOM_RACE_HEADER_MISMATCH');
  const course=header.match(/(ダート|芝)\s*(\d{3,4})\s*m(?:\s*[（(](右|左|直)[^）)]*[）)])?/);
  const going=header.match(/馬場\s*[:：]?\s*(不良|稍重|良|重)/),weather=header.match(/天候\s*[:：]?\s*(晴|曇|雨|雪)/);
  const conditions={};
  if(course){conditions.surface=course[1];conditions.distance=Number(course[2]);if(course[3])conditions.turn=course[3];}
  if(going)conditions.going=going[1];if(weather)conditions.weather=weather[1];
  const expected=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
  expected.searchParams.set('k_babaCode',codes[race.track]);expected.searchParams.set('k_raceDate',race.race_date.replaceAll('-','/'));
  expected.searchParams.set('k_raceNo',String(race.race_no));
  // DOM-owned runner records are already segmented. Never parse attribute rows as horses.
  const snapshotRunners=diagnostic.runners.map(r=>{
    const currentCells=Array.isArray(r.current_row_cells)?r.current_row_cells.map(c=>c?.text):[];
    if(r.status!=='ACTIVE' && currentCells.length && hasCurrentPositiveOdds(currentCells))
      throw new ContextError('OFFICIAL_FIELD_STATUS_CONFLICT');
    return {horse_no:r.horse_no,horse_name:clean(r.horse_name),status:r.status,
      jockey:clean(r.jockey_text).replace(/\s*[（(][^）)]+[）)]$/,''),
      ...parseCurrentAttributes(r.current_attribute_cells),identity_refs:[]};
  });
  const snapshot={race_date:race.race_date,track:race.track,race_no:race.race_no,circuit:'LOCAL',
    source:'NAR_OFFICIAL_DEBA',source_ref:expected.href,fetched_at:diagnostic.fetched_at,conditions,history:[],
    runners:snapshotRunners};
  return attachDomHorseLinks(snapshot,diagnostic);
}

async function readDirectOfficialRace(fetchImpl,race,signal,now) {
  const expected=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
  expected.searchParams.set('k_babaCode',codes[race.track]);
  expected.searchParams.set('k_raceDate',race.race_date.replaceAll('-','/'));
  expected.searchParams.set('k_raceNo',String(race.race_no));
  const response=await fetchImpl(expected,{method:'GET',signal,redirect:'error',cache:'no-store',
    headers:{'user-agent':'Mozilla/5.0 BAKEN-LAB/2.0','accept':'text/html,application/xhtml+xml',
      'accept-language':'ja-JP,ja;q=0.9','cache-control':'no-cache'}});
  if(!response.ok || !response.body)throw new ContextError('OFFICIAL_READ_FAILED');
  if(Number(response.headers.get('content-length'))>2097152)throw new ContextError('OFFICIAL_RESPONSE_TOO_LARGE');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>2097152)throw new ContextError('OFFICIAL_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const $=load(new TextDecoder().decode(bytes));
  const rows=[];
  $('table tr').each((index,el)=>{
    const pairs=$(el).find('th,td').toArray()
      .map(cell=>({el,text:clean($(cell).text())})).filter(p=>p.text);
    if(pairs.length)rows.push({index,cells:pairs.map(p=>p.text),pairs});
  });
  const mainRows=rows.filter(row=>{
    const jockeyIndex=row.cells.findIndex(cell=>/^.+[（(][^）)]+[）)]$/.test(cell)&&!/^([\d(])/.test(cell));
    if(jockeyIndex<1)return false;
    const nums=row.cells.slice(0,jockeyIndex-1).filter(cell=>/^\d+$/.test(cell)).map(Number);
    const no=nums.at(-1);
    return Number.isInteger(no)&&no>=1&&no<=20;
  });
  if(!mainRows.length||mainRows.length>20)throw new ContextError('OFFICIAL_READ_UNVERIFIED');
  const runners=[],seen=new Set();
  for(let pos=0;pos<mainRows.length;pos++){
    const main=mainRows[pos],nextIndex=mainRows[pos+1]?.index??Number.MAX_SAFE_INTEGER;
    const jockeyIndex=main.cells.findIndex(cell=>/^.+[（(][^）)]+[）)]$/.test(cell)&&!/^([\d(])/.test(cell));
    const horseName=clean(main.cells[jockeyIndex-1]),jockeyRaw=clean(main.cells[jockeyIndex]);
    const nums=main.cells.slice(0,jockeyIndex-1).filter(cell=>/^\d+$/.test(cell)).map(Number);
    const horseNo=nums.at(-1);
    if(!Number.isInteger(horseNo)||horseNo<1||horseNo>20||!horseName||seen.has(horseNo))
      throw new ContextError('OFFICIAL_READ_UNVERIFIED');
    seen.add(horseNo);
    const following=rows.filter(row=>row.index>main.index&&row.index<nextIndex);
    const attrs=parseCurrentAttributes(following.filter(row=>
      !row.cells.some(s=>/\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}/.test(s))).flatMap(row=>row.cells));
    const horseCell=main.pairs[jockeyIndex-1]?.el;
    const refs=[];
    if(horseCell)$(horseCell).find('a').each((_i,a)=>{
      const href=$(a).attr('href'); if(!href)return;
      try{refs.push(narHorseUrl(href,expected.href));}catch{}
    });
    const identity_refs=[...new Set(refs)];
    const status=currentRunnerStatus(main.cells);
    if(status!=='ACTIVE' && hasCurrentPositiveOdds(main.cells))
      throw new ContextError('OFFICIAL_FIELD_STATUS_CONFLICT');
    runners.push({
      horse_no:horseNo,horse_name:horseName,
      jockey:jockeyRaw.replace(/\s*[（(][^）)]+[）)]$/,''),
      ...attrs,
      status,
      identity_refs:identity_refs.length===1?identity_refs:[],
      horse_link_evidence:identity_refs.length===1?{
        horse_no:horseNo,row_index:main.index,horse_cell_index:jockeyIndex-1,
        deba_source_ref:expected.href,horse_ref:identity_refs[0]
      }:null
    });
  }
  const body=clean($('body').text()),lead=body.split(runners[0]?.horse_name??'\u0000')[0];
  if(!lead.includes(race.track) ||
     !(lead.includes(String(race.race_no)+'R')||lead.includes('第'+String(race.race_no)+'競走')))
    throw new ContextError('OFFICIAL_READ_UNVERIFIED');
  const course=lead.match(/(ダート|芝)\s*(\d{3,4})\s*m(?:\s*[（(](右|左|直)[^）)]*[）)])?/);
  const going=lead.match(/馬場\s*[:：]?\s*(不良|稍重|良|重)/);
  const weather=lead.match(/天候\s*[:：]?\s*(晴|曇|雨|雪)/);
  const conditions={};
  if(course){conditions.surface=course[1];conditions.distance=Number(course[2]);if(course[3])conditions.turn=course[3];}
  if(going)conditions.going=going[1];
  if(weather)conditions.weather=weather[1];
  return {
    race_date:race.race_date,track:race.track,race_no:race.race_no,circuit:'LOCAL',
    source:'NAR_OFFICIAL_DEBA',source_ref:expected.href,fetched_at:new Date(now()).toISOString(),
    runners,conditions,history:[]
  };
}

export function createNarOfficialReader({fetchImpl = fetch, now = Date.now} = {}) {
  let bound=null;
  const live=race=>{if(!(Date.parse(race.post_time)>now()+180000))throw new ContextError('PRE_RACE_DEADLINE');};
  async function get(url,race,signal) {
    live(race);
    const response=await fetchImpl(url,{method:'GET',signal,redirect:'error',cache:'no-store'});
    if(!response.ok || !response.body)throw new ContextError('OFFICIAL_READ_FAILED');
    if(Number(response.headers.get('content-length'))>262144)throw new ContextError('OFFICIAL_RESPONSE_TOO_LARGE');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>262144)throw new ContextError('OFFICIAL_RESPONSE_TOO_LARGE');chunks.push(value);}}
    finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    live(race);
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(!data.ok || data.truncated || !Number.isFinite(Date.parse(data.fetched_at)) ||
      Date.parse(data.fetched_at)>now() || now()-Date.parse(data.fetched_at)>60000)
      throw new ContextError('OFFICIAL_READ_UNVERIFIED');
    return data;
  }
  return {
    async readRace(race, options, signal) {
      bound=null;
      if (options.limit !== 5 || !codes[race.track] ||
          !(Date.parse(race.post_time) > now()+180000)) throw new ContextError('PRE_RACE_DEADLINE');
      let attached=null,primaryError=null;
      try{
        attached=await readDirectOfficialRace(fetchImpl,race,signal,now);
      }catch(e){primaryError=e;}
      if(!attached){
        try{
          const url = new URL(endpoint);
          url.searchParams.set('type','horse_cells');url.searchParams.set('track',race.track);
          url.searchParams.set('race_date',race.race_date);url.searchParams.set('race_no',String(race.race_no));
          const diagnostic=await get(url,race,signal);
          attached=parseNarDomDiagnostic(diagnostic,race);
        }catch(e){
          throw primaryError instanceof ContextError?primaryError:e;
        }
      }
      // Callers cannot replace the DOM-bound horse URL through the returned object.
      bound={race:structuredClone(race),snapshot:structuredClone(attached)};
      return attached;
    },
    async readHistory(current,options,signal) {
      live(options.race);
      if(options.limit!==5 || options.before!==options.race.race_date || !bound ||
        ['race_date','track','race_no','circuit','post_time'].some(k=>bound.race[k]!==options.race[k]))
        throw new ContextError('HORSE_HISTORY_UNVERIFIED');
      const original=bound.snapshot.runners.find(r=>r.horse_no===current.horse_no);
      if(!original || original.status!=='ACTIVE' || clean(original.horse_name)!==clean(current.horse_name) ||
        !original.horse_link_evidence || original.horse_link_evidence.horse_ref!==current.horse_link_evidence?.horse_ref)
        throw new ContextError('HORSE_HISTORY_UNVERIFIED');
      const ref=original.horse_link_evidence.horse_ref;
      const url=new URL(endpoint);url.searchParams.set('type','horse_profile');
      url.searchParams.set('lineage_code',new URL(ref).searchParams.get('k_lineageLoginCode'));
      const active=new URL(ref).searchParams.get('k_activeCode');
      // Profile endpoint supports marks with the observed lineage parameter.
      // Additional active parameter is not silently dropped from identity.
      if(active!==null)throw new ContextError('HORSE_HISTORY_UNSUPPORTED_LINK');
      const profile=await get(url,options.race,signal);
      return parseNarHorseHistory(profile,original,options.race);
    }
  };
}

