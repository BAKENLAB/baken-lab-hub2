/**
 * HYOGO URBAN KEIBA official ability-test pre-race evidence.
 * Research-only; never obtains a CLAIM or writes a FROZEN prediction.
 * Uses the official ability index and bounded detail pages, not betting markets.
 */
export const HYOGO_ABILITY_SOURCE = 'HYOGO_OFFICIAL_ABILITY_TEST';
const ORIGIN = 'https://www.sonoda-himeji.jp';
const ID_PATH = /^\/data\/ability\/detail\/[1-9]\d{0,5}\/?$/;
const norm = x => String(x ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
const strip = s => decode(String(s ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function decode(s) {
 return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, x => {
  const named = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '};
  if (named[x.toLowerCase()]) return named[x.toLowerCase()];
  if (/^&#x/i.test(x)) return String.fromCodePoint(parseInt(x.slice(3, -1),16));
  if (/^&#\d+;/.test(x)) return String.fromCodePoint(Number(x.slice(2,-1)));
  return x;
 });
}
const dateOnly = x => {
 const m = String(x ?? '').match(/(20\d\d)[\/年.-](\d{1,2})[\/月.-](\d{1,2})/);
 if (!m) return null;
 const d = m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
 return Number.isFinite(Date.parse(d+'T00:00:00Z')) &&
  new Date(d+'T00:00:00Z').toISOString().slice(0,10) === d ? d : null;
};
function sourceUrl(s) {
 try {
  const u = new URL(s);
  return u.origin===ORIGIN && ID_PATH.test(u.pathname) &&
   !u.search && !u.hash && !u.username && !u.password ? u.href : null;
 } catch { return null; }
}
export function parseHyogoAbilityIndex(html, base=ORIGIN+'/data/ability') {
 if (typeof html !== 'string' || html.length > 2_000_000) return [];
 const urls = [], seen = new Set();
 const re = /<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1/gi;
 for (const m of html.matchAll(re)) {
  let url;
  try {url = sourceUrl(new URL(decode(m[2]),base).href);} catch {continue;}
  if (url && !seen.has(url)) {urls.push(url);seen.add(url);}
 }
 return urls;
}
const num = s => /^\d+$/.test(norm(s)) ? Number(norm(s)) : null;
function seconds(s) {
 const m=norm(s).match(/^(\d{1,2})[,：:](\d{2})\.(\d)$/);
 if (!m || Number(m[2]) >= 60) return null;
 return Number(m[1])*60+Number(m[2])+Number(m[3])/10;
}
export function parseHyogoAbilityDetail(html, url) {
 const source_ref = sourceUrl(url);
 if (!source_ref || typeof html !== 'string' || html.length > 2_000_000)
  return {status:'UNVERIFIED_SOURCE',entries:[]};
 const beforeTables=html.split(/<table\b/i)[0] ?? '';
 const header=strip(beforeTables);
 const event_date=dateOnly(header);
 const venue=/西脇トレーニングセンター/.test(header)?'西脇トレーニングセンター':
  /園田競馬場/.test(header)?'園田競馬場':null;
 const going=(header.match(/馬場状態\s*[：:]\s*(不良|稍重|重|良)/)??[])[1]??null;
 if (!event_date || !venue || !going) return {status:'DETAIL_HEADER_UNVERIFIED',entries:[]};
 const entries=[];
 for (const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
  const prefix=strip(html.slice(Math.max(0,match.index-1500),match.index));
  const sections=[...prefix.matchAll(/(ゲート検査|能力検査|発走検査|自主参加)/g)];
  const table=match[0];
  // The REAL official page puts the section label in a <th colspan> INSIDE
  // its own table. Never infer from the preceding table's heading.
  const ownSection=[...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
   .map(m=>norm(strip(m[1])))
   .find(x=>['ゲート検査','能力検査','発走検査','自主参加'].includes(x));
  const section=ownSection??sections.at(-1)?.[1];
  if (!section) continue;
  const heads=[...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
   .map(m=>norm(strip(m[1])));
  // Some official tables use a td-based header row.
  const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
   .map(m=>[...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
    .map(c=>strip(c[1]))).filter(c=>c.length>=6);
  if (!rows.length) continue;
  const first=rows[0].map(norm);
  const labels=heads.length>=6?heads:first;
  if (!['馬名','齢','距離','タイム','体重','きゅう舎'].every(x=>labels.includes(x)))
   continue;
  for (const cells of rows) {
   if (norm(cells[0])==='馬名') continue;
   const horse_name=strip(cells[0]),age=num(cells[1]),distance=num(cells[2]);
   const time_seconds=seconds(cells[3]),body_weight=num(cells[4]);
   const trainer=strip(cells[5]),passed=norm(cells[6]??'')==='合格';
   if (!horse_name || !Number.isInteger(age) || age<2 || age>20 ||
       ![800,820,1000,1200,1400,1500,1600,1700,1800,1870].includes(distance) ||
       !trainer || (cells[6] && !['合格','不合格'].includes(norm(cells[6]))))
    continue;
   entries.push({horse_name,age,distance,time_seconds,body_weight,trainer,
    section,passed,source_ref,event_date,venue,going});
  }
 }
 return {status:entries.length?'PARSED':'NO_VALID_TABLE_ROWS',
  event_date,venue,going,source_ref,entries};
}
function normalizedAge(r) {
 if (Number.isInteger(r.age)) return r.age;
 const m=norm(r.sex_age).match(/(\d{1,2})$/);
 return m?Number(m[1]):null;
}
function identity(r,e) {
 const age=normalizedAge(r);
 return norm(r.horse_name)===norm(e.horse_name) && age===e.age &&
  !!norm(r.trainer) && norm(r.trainer)===norm(e.trainer);
}
function validRace(race) {
 if (!race || !['園田','姫路'].includes(race.track) ||
  !/^\d{4}-\d\d-\d\d$/.test(race.race_date) ||
  typeof race.post_time!=='string' || typeof race.observation_at!=='string') return false;
 const at=Date.parse(race.observation_at),post=Date.parse(race.post_time);
 return Number.isFinite(at)&&Number.isFinite(post)&&at<post &&
  new Date(at+9*3600000).toISOString().slice(0,10)===race.race_date;
}
export function matchHyogoAbilityEvidence({race,runners,details}) {
 if (!validRace(race) || !Array.isArray(runners) || runners.length===0 ||
     runners.length>20 || !Array.isArray(details))
  return {status:'UNVERIFIED_RACE_OR_FIELD',evidence:[]};
 const eligible=details.flatMap(d=>d?.status==='PARSED'?d.entries:[])
  .filter(e=>e.section==='能力検査' && e.passed && e.time_seconds!==null &&
   e.event_date<race.race_date && sourceUrl(e.source_ref));
 const evidence=[];
 for (const r of runners) {
  const matches=eligible.filter(e=>identity(r,e)).sort((a,b)=>
   b.event_date.localeCompare(a.event_date));
  if (!matches.length) continue;
  // Official source lacks a stable horse ID; never treat name alone as identity.
  // Ambiguous same-day duplicates cannot be matched safely.
  const e=matches[0];
  if (matches.some(x=>x.event_date===e.event_date && x.source_ref!==e.source_ref))
   continue;
  const peers=eligible.filter(x=>x.source_ref===e.source_ref &&
   x.section===e.section && x.distance===e.distance);
  const validPeers=peers.filter(x=>x.time_seconds!==null);
  const fasterOrEqual=validPeers.filter(x=>x.time_seconds<=e.time_seconds).length;
  evidence.push({horse_no:r.horse_no,horse_name:r.horse_name,
   source:HYOGO_ABILITY_SOURCE,identity_method:'EXACT_NAME_AGE_TRAINER_NOT_STABLE_HORSE_ID',
   category:'能力検査',event_date:e.event_date,source_ref:e.source_ref,
   venue:e.venue,going:e.going,distance:e.distance,
   time_seconds:e.time_seconds,body_weight:e.body_weight,
   age:e.age,trainer:e.trainer,passed:true,
   same_session_distance_peer_count:validPeers.length,
   same_session_faster_or_equal_count:fasterOrEqual,
   as_of:race.observation_at,valid_for_provisional_comparison:true,
   official_race_result:false});
 }
 return {status:'READY_RESEARCH_ONLY',source:HYOGO_ABILITY_SOURCE,
  evidence,unmatched_horse_count:runners.length-evidence.length,
  production_rank_effect:false,frozen_modified:false,market_used:false};
}
/**
 * Explicit bounded caller; optional, never invoked implicitly by a scheduler.
 * getPage must be provided by a server-side trusted fetch adapter.
 */
export async function collectHyogoAbilityBeforeRace({
 race,runners,getPage,maxDetailPages=18,indexPages=3
}={}) {
 if (!validRace(race)||!Array.isArray(runners)||!runners.length||
    typeof getPage!=='function'||!Number.isInteger(indexPages)||
    indexPages<1||indexPages>3||!Number.isInteger(maxDetailPages)||
    maxDetailPages<1||maxDetailPages>24)
  return {status:'UNVERIFIED_INPUT',evidence:[]};
 const list=[],visited=new Set(),errors=[];
 for (let n=1;n<=indexPages;n++) {
  const url=ORIGIN+'/data/ability'+(n===1?'':'?p='+n);
  try {
   const html=await getPage(url);
   for(const ref of parseHyogoAbilityIndex(html,url))
    if(!visited.has(ref)){visited.add(ref);list.push(ref);}
  } catch {errors.push('INDEX_UNAVAILABLE_'+n);}
 }
 const details=[];
 for(const url of list.slice(0,maxDetailPages)) {
  try {details.push(parseHyogoAbilityDetail(await getPage(url),url));}
  catch {errors.push('DETAIL_UNAVAILABLE');}
 }
 const result=matchHyogoAbilityEvidence({race,runners,details});
 return {...result,inspected_detail_pages:details.length,index_links_discovered:list.length,
  incomplete_index:errors.length>0,errors,
  claim_started:false,prediction_saved:false};
}
