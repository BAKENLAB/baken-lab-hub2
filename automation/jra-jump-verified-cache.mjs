// Server-only verified history cache. Persistent store is an injected trusted port;
// no production table is created and no historical prediction is written here.
import {resultIdentity} from './jra-jump-official-history.mjs';
const need=(v,c)=>{if(!v)throw Error('JUMP_'+c)};
const hex=/^[a-f0-9]{64}$/;
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':x!==null&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x));
const version='JUMP_RESULT_V2';
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('')}
function verifyResult(ref,asOf,result){
 const r=resultIdentity(ref);
 need(r&&date(asOf)&&r.race_date<asOf,'CACHE_ASOF');
 need(result&&result.source_ref===ref&&result.race_date===r.race_date&&result.track===r.track&&result.race_no===r.race_no&&typeof result.jump==='boolean','CACHE_IDENTITY');
 const p=result.official_proof;
 need(p?.parser_version===version&&hex.test(p.html_sha256??'')&&p.source_url==='https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(ref)&&Number.isFinite(Date.parse(p.fetched_at))&&Date.parse(p.fetched_at)>=Date.parse(r.race_date+'T00:00:00+09:00'),'CACHE_PROVENANCE');
 if(result.jump){
  need(['未勝利','オープン'].includes(result.class_name)&&Number.isInteger(result.distance)&&result.distance>0&&Number.isInteger(result.registered_count)&&Number.isInteger(result.not_started_count)&&result.not_started_count>=0&&Array.isArray(result.rows)&&result.rows.length>=1&&result.rows.length+result.not_started_count===result.registered_count,'CACHE_FIELD_COUNT');
  need(new Set(result.rows.map(x=>x.horse_no)).size===result.rows.length&&new Set(result.rows.map(x=>x.horse_id)).size===result.rows.length&&result.rows.some(x=>x.finish===1),'CACHE_DUPLICATE_OR_WINNER');
  need(result.rows.every(x=>x.verified===true&&x.source_ref===ref&&x.race_date===r.race_date&&x.track===r.track&&x.race_type==='障害'&&x.class_name===result.class_name&&x.distance===result.distance&&x.field_size===result.registered_count&&/^\d{10}$/.test(x.horse_id??'')&&typeof x.jockey==='string'&&x.jockey&&Number.isInteger(x.horse_no)&&x.horse_no>=1&&x.horse_no<=result.registered_count&&['FINISHED','DNF','DISQUALIFIED'].includes(x.result_status)&&(x.result_status==='FINISHED'?Number.isInteger(x.finish)&&x.finish>=1&&x.finish<=result.registered_count&&Number.isFinite(x.gap_seconds)&&x.gap_seconds>=0:x.finish===null)&&(x.final_turn_pos===null||Number.isInteger(x.final_turn_pos)&&x.final_turn_pos>=1&&x.final_turn_pos<=result.registered_count)),'CACHE_RUN_EVIDENCE');
 }
 // Whitelist only ability evidence; never store market fields or raw HTML.
 const base={...r,source_ref:ref,jump:result.jump,official_proof:{parser_version:version,html_sha256:p.html_sha256,fetched_at:p.fetched_at,source_url:p.source_url}};
 if(!result.jump)return base;
 return {...base,class_name:result.class_name,distance:result.distance,registered_count:result.registered_count,not_started_count:result.not_started_count,rows:result.rows.map(x=>Object.fromEntries(['horse_id','horse_no','jockey','finish','result_status','final_turn_pos','field_size','verified','race_type','race_date','track','class_name','distance','source_ref','gap_seconds'].map(k=>[k,x[k]])))};
}
export function makeVerifiedResultReader({store,hash=digest,clock=()=>new Date().toISOString(),refreshDays=7,maxFetch=240}){
 need(typeof store?.get==='function'&&typeof store?.append==='function'&&typeof hash==='function'&&Number.isInteger(refreshDays)&&refreshDays>=1&&Number.isInteger(maxFetch)&&maxFetch>=1,'CACHE_DEPENDENCIES');
 const counts={hits:0,misses:0,refreshes:0,fetched:0};
 const inFlight=new Map();
 async function read({ref,asOf,readOfficial}){
  const r=resultIdentity(ref);need(r&&date(asOf)&&r.race_date<asOf,'CACHE_ASOF');
  const now=clock(), key=[version,r.race_date,r.track,r.race_no,ref].join('|');
  need(Number.isFinite(Date.parse(now)),'CACHE_CLOCK');
  const cached=await store.get(key);
  if(cached!==null&&cached!==undefined){
   need(cached.key===key&&hex.test(cached.digest??'')&&cached.digest===await hash(canon(cached.result)),'CACHE_INTEGRITY');
   const normalized=verifyResult(ref,asOf,cached.result);
   need(canon(normalized)===canon(cached.result)&&Date.parse(normalized.official_proof.fetched_at)<=Date.parse(now),'CACHE_SCHEMA');
   const age=(Date.parse(now)-Date.parse(normalized.official_proof.fetched_at))/86400000;
   const raceAge=(Date.parse(now)-Date.parse(r.race_date+'T00:00:00+09:00'))/86400000;
   if(raceAge>refreshDays||age<1/24){counts.hits++;return clone(normalized)}
   counts.refreshes++;
  }else counts.misses++;
  need(counts.fetched<maxFetch,'CACHE_FETCH_BUDGET');
  counts.fetched++;
  const result=verifyResult(ref,asOf,await readOfficial(ref,asOf));
  need(Date.parse(result.official_proof.fetched_at)<=Date.parse(clock()),'CACHE_FUTURE_PROOF');
  // Source corrections create immutable versions; never overwrite prior evidence.
  const record={key,digest:await hash(canon(result)),result};
  await store.append(clone(record));
  return clone(result);
 }
 return {stats:()=>({...counts}),async read(args){
  const id=args?.ref+'|'+args?.asOf;
  if(inFlight.has(id))return clone(await inFlight.get(id));
  const job=read(args);inFlight.set(id,job);
  try{return clone(await job)}finally{inFlight.delete(id)}
 }};
}
