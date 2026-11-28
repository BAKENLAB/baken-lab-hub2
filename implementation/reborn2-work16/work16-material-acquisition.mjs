import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const DIRECT_MEASUREMENT_UNAVAILABLE = new Set([
  '07','08','10','11','15','23','24','25','55','56','68','71','72','73','EYE-06'
]);
const ACQUIRED_GROUPS = new Set(['history','peer']);
const MISSING_GROUPS = new Set(['rating','incident','day','people','training','pedigree','travel']);

export function classifyItem(item) {
  if (DIRECT_MEASUREMENT_UNAVAILABLE.has(item.id)) return {
    status:'DIRECT_NOT_PUBLISHED',
    japaneseStatus:'取得不能',
    supply:'PARTIAL_ALTERNATIVE_ONLY',
    alternative:'通過順・上がり・走破時計・レースラップ・公式裁決・反復条件別成績を別々の観測として供給する。個馬区間時計、余力、耐性、因果へ変換しない。'
  };
  if (ACQUIRED_GROUPS.has(item.group)) return {
    status:'EXISTING_EVIDENCE_CONNECTED',japaneseStatus:'取得済み',supply:'PARTIAL'
  };
  if (MISSING_GROUPS.has(item.group)) return {
    status:'ROUTE_KNOWN_NOT_ACQUIRED',japaneseStatus:'未取得',supply:'BLOCKED_UNTIL_FETCHED'
  };
  return {status:'ROUTE_AVAILABLE',japaneseStatus:'取得可能',supply:'PARTIAL_OR_PENDING'};
}

export function prestartFieldGate(snapshot, race) {
  const errors=[];
  if (!snapshot || snapshot.source!=='NAR_OFFICIAL_DEBA') errors.push('OFFICIAL_CARD_REQUIRED');
  if (!snapshot?.fetched_at || Date.parse(snapshot.fetched_at)>=Date.parse(race.post_time)) errors.push('PRESTART_TIME_REQUIRED');
  if (!Array.isArray(snapshot?.runners)||snapshot.runners.length===0) errors.push('FIELD_REQUIRED');
  const seen=new Set();
  for (const r of snapshot?.runners??[]) {
    if (!Number.isInteger(r.horse_no)||seen.has(r.horse_no)||!r.horse_name||
        !['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)) errors.push('FIELD_STATUS_CONFLICT');
    seen.add(r.horse_no);
  }
  const active=(snapshot?.runners??[]).filter(r=>r.status==='ACTIVE');
  return {
    pass:errors.length===0,
    errors:[...new Set(errors)],
    listedCount:snapshot?.runners?.length??0,
    activeCount:active.length,
    activeHorseNos:active.map(r=>r.horse_no).sort((a,b)=>a-b),
    rule:'発走前公式出馬表の同一版にある全掲載馬と状態を固定する。発走後の実発走頭数は必須条件にしない。'
  };
}

export function historicalRaceGate(rows) {
  const required=['race_id','horse_id','horse_no','horse_name','status','source_ref','observed_at'];
  const missing=[];
  for (const [index,row] of (rows??[]).entries()) for (const key of required)
    if (row?.[key]===null||row?.[key]===undefined||String(row[key]).trim()==='') missing.push({index,key});
  return {pass:Array.isArray(rows)&&rows.length>0&&missing.length===0,missing};
}

export function buildMatrix(sourceMap, inventory) {
  if (sourceMap?.items?.length!==115) throw new Error('SOURCE_MAP_NOT_115');
  const items=sourceMap.items.map(item=>({...item,...classifyItem(item)}));
  const counts=Object.fromEntries(['取得済み','取得可能','未取得','取得不能'].map(s=>
    [s,items.filter(i=>i.japaneseStatus===s).length]));
  const digest=createHash('sha256').update(JSON.stringify(items)).digest('hex');
  return {
    schema:'REBORN2_WORK16_MATERIAL_ACQUISITION_1',fixedEngine:'V48',
    guards:{targetRaceResultUsed:false,marketUsed:false,productionChanged:false},
    counts:{total:items.length,...counts},inventory,itemDigest:digest,items
  };
}

if (import.meta.url===`file://${process.argv[1]}`) {
  const sourceMap=JSON.parse(await readFile(new URL('../reborn2-pilot/work04-source-map.json',import.meta.url),'utf8'));
  const inventory=JSON.parse(await readFile(new URL('./work16-existing-assets.json',import.meta.url),'utf8'));
  process.stdout.write(JSON.stringify(buildMatrix(sourceMap,inventory),null,2)+'\n');
}
