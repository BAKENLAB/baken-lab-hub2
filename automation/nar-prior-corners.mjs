/**
 * Read-only NAR official RACE RESULT corner evidence parser.
 *
 * IMPORTANT:
 * - This module does not fetch any race, start a CLAIM, write to a DB, or rank a horse.
 * - The caller supplies bounded HTML-extracted corner rows from the exact official
 *   past-race RaceMarkTable and its independently validated heading.
 * - It emits only prior corner positions, never target result, odds or payouts.
 * - In a real fetch, sourceCheckedAt is assigned by the authenticated server,
 *   not copied from an untrusted HTML string.
 */
const CODES=Object.freeze({
  '盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21',
  '金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28',
  '高知':'31','佐賀':'32','門別':'36'
});
const norm=(x)=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const iso=(x)=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))?String(x):null;
const millis=(x)=>typeof x==='string' && Number.isFinite(Date.parse(x)) ? Date.parse(x):null;
const num=(x)=>Number.isInteger(Number(x)) && Number(x)>=1 && Number(x)<=24 ? Number(x):null;

export function checkOfficialPastRaceSource({sourceUrl,priorRace,targetRaceDate,targetPostTime,sourceCheckedAt,raceHeaderText}) {
  if(!priorRace || !iso(priorRace.raceDate) || !iso(targetRaceDate) ||
     !CODES[priorRace.track] || !num(priorRace.raceNo) ||
     priorRace.raceDate>=targetRaceDate)throw new Error('PRE_RACE_IDENTITY_OR_DATE_INVALID');
  const checked=millis(sourceCheckedAt),post=millis(targetPostTime);
  if(checked===null || post===null || checked>=post)throw new Error('SOURCE_AFTER_TARGET_POST');
  let url;try{url=new URL(sourceUrl);}catch{throw new Error('UNTRUSTED_RACE_RESULT_URL');}
  if(url.protocol!=='https:' || url.hostname!=='www.keiba.go.jp' ||
    url.pathname!=='/KeibaWeb/TodayRaceInfo/RaceMarkTable' ||
    url.username || url.password || url.hash || url.searchParams.size!==3 ||
    url.searchParams.get('k_babaCode')!==CODES[priorRace.track] ||
    url.searchParams.get('k_raceDate')!==priorRace.raceDate.replaceAll('-','/') ||
    url.searchParams.get('k_raceNo')!==String(priorRace.raceNo))
      throw new Error('UNTRUSTED_RACE_RESULT_URL');
  const header=norm(raceHeaderText);
  const dateString=priorRace.raceDate.split('-').map(Number);
  const dateRe=new RegExp(dateString[0]+'年0?'+dateString[1]+'月0?'+dateString[2]+'日');
  const numRe=new RegExp('第0?'+priorRace.raceNo+'競走');
  if(!dateRe.test(header)||!numRe.test(header)||!header.includes(priorRace.track)||
     !header.includes('競走成績'))throw new Error('RACE_RESULT_HEADING_MISMATCH');
  return {raceDate:priorRace.raceDate,track:priorRace.track,raceNo:Number(priorRace.raceNo),
    sourceUrl:url.href,sourceCheckedAt};
}

/** Parentheses are a same-position group; commas and dashes only separate groups.
 * Assign 1,2,3,3,5,5,7... after a pair at rank 3.
 */
export function parseNarCornerOrder(text,{knownHorseNos}={}) {
  if(typeof text!=='string' || !text.trim() || text.length>4000)throw new Error('CORNERS_MISSING_OR_OVERSIZED');
  const raw=norm(text).replace(/[、，]/g,',').replace(/[－–—−]/g,'-');
  const tokens=[...raw.matchAll(/\(\d+(?:,\d+)+\)|\d+|[,;-]+/g)];
  if(!tokens.length||tokens.map(m=>m[0]).join('')!==raw)throw new Error('CORNERS_UNRECOGNIZED');
  const available=knownHorseNos?new Set(knownHorseNos.map(num)) : null;
  if(available && (available.has(null)||available.size!==knownHorseNos.length))throw new Error('OFFICIAL_FIELD_INVALID');
  let expectGroup=true, rank=1;const order=new Map();
  for(const t of tokens) {
    const s=t[0],separator=/^[,;-]+$/.test(s);
    if(separator===expectGroup)throw new Error('CORNERS_DELIMITER_CONFLICT');
    if(separator){expectGroup=true;continue;}
    const members=s.startsWith('(')?s.slice(1,-1).split(',').map(Number):[Number(s)];
    if(!members.length || members.some(n=>!num(n)||(available&&!available.has(n))||order.has(n)))
      throw new Error('CORNERS_HORSE_NUMBER_CONFLICT');
    for(const member of members)order.set(member,rank);
    rank+=members.length;expectGroup=false;
  }
  if(expectGroup||order.size<2||order.size>24)throw new Error('CORNERS_PARTIAL_OR_INVALID');
  return Object.fromEntries([...order].map(([horse_no,position])=>[String(horse_no),position]));
}

export function buildVerifiedPriorCornerEvidence({
  sourceUrl,priorRace,targetRaceDate,targetPostTime,
  sourceCheckedAt,raceHeaderText,cornerRows,knownHorseNos
}) {
  const source=checkOfficialPastRaceSource({sourceUrl,priorRace,
    targetRaceDate,targetPostTime,sourceCheckedAt,raceHeaderText});
  if(!Array.isArray(cornerRows)||cornerRows.length>4 || cornerRows.length<1 ||
     !Array.isArray(knownHorseNos)||knownHorseNos.length<2||knownHorseNos.length>24)
      throw new Error('OFFICIAL_CORNERS_UNVERIFIED');
  const turns=[];
  const labelRe=/^(?:第)?([1-4])(?:角|コーナー)$/;
  for(const row of cornerRows){
    if(!Array.isArray(row)||row.length!==2)throw new Error('OFFICIAL_CORNERS_UNVERIFIED');
    const m=norm(row[0]).match(labelRe);
    if(!m || turns.some(x=>x.corner===Number(m[1])))throw new Error('OFFICIAL_CORNER_LABEL_INVALID');
    const positions=parseNarCornerOrder(row[1],{knownHorseNos});
    turns.push({corner:Number(m[1]),positions});
  }
  turns.sort((a,b)=>a.corner-b.corner);
  if(new Set(turns.map(t=>t.corner)).size!==turns.length)throw new Error('OFFICIAL_CORNER_LABEL_INVALID');
  const earliest=turns[0],latest=turns.at(-1);
  const each=knownHorseNos.map(horseNo=>{
    const n=String(horseNo);const one=earliest.positions[n]??null,last=latest.positions[n]??null;
    return {prior_horse_no:Number(horseNo),first_recorded_corner:earliest.corner,
      early_pos:one,final_recorded_corner:latest.corner,final_turn_pos:last,
      corner_positions:turns.map(x=>({corner:x.corner,position:x.positions[n]??null})),
      evidence_status:one!==null&&last!==null?'OFFICIAL_CORNER_POSITIONS_VERIFIED':'PARTIAL_CORNER_COVERAGE'};
  });
  return {
    source:'NAR_OFFICIAL_PAST_RACE_RESULT',
    source_ref:source.sourceUrl,source_checked_at:source.sourceCheckedAt,
    prior_race:{race_date:source.raceDate,track:source.track,race_no:source.raceNo},
    future_result_included:false,market_used:false,scoring_effect:0,
    field_size:knownHorseNos.length,
    positions_covered:each.filter(x=>x.evidence_status==='OFFICIAL_CORNER_POSITIONS_VERIFIED').length,
    runners:each
  };
}
