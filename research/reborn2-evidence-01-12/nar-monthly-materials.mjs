import { createHash } from 'node:crypto';
import { parseCsv, normalizeNarRows } from './nar-csv-candidate.mjs';
import { materialPacket, raceLaps } from './archive-materials.mjs';

const tidy = s => String(s ?? '').normalize('NFKC').trim();
const key = (...values) => JSON.stringify(values);
const timestamp = s => typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;

const trackCodes={盛岡:10,水沢:11,浦和:18,船橋:19,大井:20,川崎:21,金沢:22,笠松:23,名古屋:24,園田:27,姫路:28,高知:31,佐賀:32,門別:36};
function resultMatches(ref, track, date, raceNo) {
  try {
    const url=new URL(ref);
    return url.origin==='https://www.keiba.go.jp' &&
      url.pathname==='/KeibaWeb/TodayRaceInfo/RaceMarkTable' &&
      url.searchParams.size===3 && url.searchParams.get('k_babaCode')===String(trackCodes[track]) &&
      url.searchParams.get('k_raceDate')===date.replaceAll('-','/') &&
      url.searchParams.get('k_raceNo')===String(raceNo);
  } catch {return false;}
}

// Headers must be pinned from the authorized sample, independently of the input.
function read(bytes, header, width) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 25_000_000 ||
      bytes[0] !== 239 || bytes[1] !== 187 || bytes[2] !== 191) throw Error('UTF8_BOM_REQUIRED');
  const rows = parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!Array.isArray(header) || header.length !== width ||
      key(rows.shift()) !== key(header) || rows.some(r=>r.length!==width)) throw Error('CSV_SCHEMA');
  return rows;
}

export function supplyNarMonthly({raceBytes,horseBytes,headers,targetDate,cutoff,postTime,
  source,roster,witnesses}) {
  const asOf=timestamp(cutoff), post=timestamp(postTime), acquired=timestamp(source?.acquiredAt);
  if (![asOf,post,acquired].every(Number.isFinite) || acquired>asOf || asOf>=post ||
      !source?.ref) throw Error('CSV_ASOF_UNPROVEN');
  const raceIndex=new Map(), fields=new Map(), rejected=[];
  const races=read(raceBytes,headers.races,66);
  const horses=read(horseBytes,headers.horses,36);
  const target=targetDate.replaceAll('-','');
  const raceKey=r=>key(...r.slice(0,3).map(tidy));
  for (const row of races) {
    const id=raceKey(row);
    if (raceIndex.has(id)) throw Error('DUPLICATE_RACE');
    raceIndex.set(id,row);
  }
  let excluded=0;
  for (const row of horses) {
    if (!/^\d{8}$/.test(tidy(row[1]))) throw Error('INVALID_CARD_DATE');
    if (tidy(row[1])>=target) {excluded++;continue;}
    const id=raceKey(row), race=raceIndex.get(id);
    if (!race) throw Error('ORPHAN_HORSE_ROW');
    if (tidy(race[0])==='帯広ば') continue;
    const list=fields.get(id)??[];
    list.push(row);
    fields.set(id,list);
  }
  const records=[];
  const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
  if (new Set(roster.map(r=>r.horseId)).size!==roster.length) throw Error('DUPLICATE_ROSTER_ID');
  for (const witness of witnesses) {
    const {currentNo,horseId,track,date,raceNo,priorNo,officialResultRef,checkedAt}=witness;
    if (date>=targetDate) {rejected.push({currentNo,reason:'NON_PRIOR_WITNESS'});continue;}
    const current=roster.filter(r=>r.horseNo===currentNo && r.horseId===horseId);
    if (current.length!==1 || !/^\d{1,30}$/.test(horseId??'') ||
        witness.basis!=='OFFICIAL_RESULT_ROW_AND_PROFILE' || !resultMatches(officialResultRef,track,date,raceNo) ||
        !(timestamp(checkedAt)<=asOf)) {rejected.push({currentNo,reason:'IDENTITY_OR_TIME_UNVERIFIED'});continue;}
    const id=key(track,date.replaceAll('-',''),String(raceNo));
    const field=fields.get(id);
    if (!field) {rejected.push({currentNo,reason:'PRIOR_RACE_MISSING'});continue;}
    const normalized=field.map(row=>normalizeNarRows(raceIndex.get(id),row,targetDate));
    const {race}=normalized[0];
    const runners=normalized.map(x=>x.horse);
    const h=runners.find(x=>x.horse_no===priorNo);
    const sameHorse=h && h.horse_name===tidy(witness.horseName) && h.birth_date===witness.birthDate &&
      h.sire===tidy(witness.sire) && h.dam===tidy(witness.dam) && h.finish===witness.finish;
    if (!sameHorse) {rejected.push({currentNo,reason:'RESULT_OR_PROFILE_MISMATCH'});continue;}
    const eligible=runners.filter(r=>r.finish!==null);
    const knownStatuses=field.every((row,i)=>runners[i].finish!==null || /^(中止|取消|除外)$/.test(tidy(row[31])));
    const winners=eligible.filter(r=>r.finish===1);
    const complete=runners.length===race.field_size && new Set(runners.map(r=>r.horse_no)).size===runners.length;
    const timed=complete && knownStatuses && winners.length===1 && eligible.every(r=>r.elapsed_seconds>0) &&
      eligible.every(r=>r.elapsed_seconds>=winners[0].elapsed_seconds);
    const winner=timed?winners[0].elapsed_seconds:null;
    const nextRank=Math.min(...eligible.filter(r=>r.finish>h.finish).map(r=>r.finish));
    const next=eligible.filter(r=>r.finish===nextRank);
    const gap=(later,earlier)=> later>=earlier ? Math.round((later-earlier)*10)/10 : null;
    records.push({current_no:currentNo,prior_no:priorNo,horse_id:horseId,race_date:date,track,race_no:raceNo,
      source_ref:source.ref,source_checked_at:source.acquiredAt,official_result_ref:officialResultRef,
      identity_checked_at:checkedAt,identity_status:'PINNED_OFFICIAL_WITNESS_MATCH',
      finish:h.finish,elapsed_seconds:h.elapsed_seconds,final3f:h.final3f,margin_literal:h.margin_literal,
      surface:race.surface,distance:race.distance,going:race.going,class_name:race.class_name,
      gap_winner:timed&&h.elapsed_seconds!==null?gap(h.elapsed_seconds,winner):null,
      gap_next:timed&&h.elapsed_seconds!==null&&next.length===1?gap(next[0].elapsed_seconds,h.elapsed_seconds):null,
      race_laps:raceLaps(race.race_laps_candidate,race.distance,winner),lap_scope:'RACE_LEVEL_ONLY',
      corner_orders_raw:race.corner_orders_candidate,corners:null,incident:null});
  }
  return {...materialPacket({circuit:'LOCAL',targetDate,roster:roster.map(r=>r.horseNo),records}),
    rejected,excluded_same_or_future_horse_rows:excluded,
    input_audit:{race_rows:races.length,horse_rows:horses.length,race_sha256:sha256(raceBytes),
      horse_sha256:sha256(horseBytes),acquired_at:source.acquiredAt,cutoff}};
}
