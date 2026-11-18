/**
 * Staged, pure hand-off for independently obtained LOCAL official corner evidence.
 * The authorised pre-CLAIM worker injects an append-only store. This code does not
 * connect to a DB, fetch races, claim a job, change ranking, or authorize FROZEN.
 */
import {createHash} from 'node:crypto';
import {officialNarPastResultUrl} from './nar-prior-corners.mjs';

const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const finiteTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const int=(x,lo=1,hi=24)=>Number.isInteger(x)&&x>=lo&&x<=hi;
function canonical(x) {
 if(x===null||typeof x!=='object')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const raceOf=x=>({
 raceDate:x?.raceDate??x?.race_date,
 track:x?.track,
 raceNo:Number(x?.raceNo??x?.race_no),
 postTime:x?.postTime??x?.post_time
});
function rosterOf(runners){
 if(!Array.isArray(runners)||runners.length<1||runners.length>20)throw Error('ROSTER_UNVERIFIED');
 const out=runners.map(r=>({
  horseNo:Number(r.horseNo??r.horse_no),
  horseName:norm(r.horseName??r.horse_name),
  status:r.status??'ACTIVE'
 }));
 if(out.some(r=>!int(r.horseNo,1,20)||!r.horseName||r.status!=='ACTIVE')||
    new Set(out.map(r=>r.horseNo)).size!==out.length)throw Error('ROSTER_UNVERIFIED');
 return out.map(({horseNo,horseName})=>({horseNo,horseName})).sort((a,b)=>a.horseNo-b.horseNo);
}
function witnessesOf(runners){
 const m=new Map();
 for(const r of runners){
  const horseNo=Number(r.horseNo??r.horse_no);
  const recent=r.verifiedRecentRuns;
  if(!Array.isArray(recent))throw Error('OFFICIAL_WITNESSES_REQUIRED');
  m.set(horseNo,recent);
 }
 return m;
}
function identityRef(ref){
 try {
  const u=new URL(ref);
  return u.protocol==='https:'&&u.hostname==='www.keiba.go.jp'&&
    u.pathname==='/KeibaWeb/DataRoom/HorseMarkInfo'&&
    !u.username&&!u.password&&!u.hash&&
    u.searchParams.getAll('k_lineageLoginCode').length===1&&
    /^[0-9]{1,30}$/.test(u.searchParams.get('k_lineageLoginCode')??'')&&
    [...u.searchParams.keys()].every(k=>k==='k_lineageLoginCode'||k==='k_activeCode');
 }catch{return false;}
}
function sanitizePacket(packet,race,roster,witnesses,now){
 if(packet?.status!=='PREFETCH_ONLY'||packet.raceDate!==race.raceDate||
    packet.raceTrack!==race.track||packet.raceNo!==race.raceNo||
    packet.claimStarted!==false||packet.saveAuthorized!==false||
    packet.marketUsed!==false||packet.targetResultUsed!==false||
    packet.rankChanged!==false||!Array.isArray(packet.evidence)||packet.evidence.length>200)
  throw Error('INVALID_PREFETCH_PACKET');
 const horses=new Map(roster.map(r=>[r.horseNo,r.horseName]));
 const keys=new Set(), evidence=[];
 for(const item of packet.evidence){
  const h=horses.get(item?.horseNo),past=item?.pastRace;
  if(!h||h!==norm(item.horseName)||!past||!date(past.raceDate)||
     past.raceDate>=race.raceDate||!int(past.raceNo,1,14)||
     !int(item.pastHorseNo)||!int(item.earlyPos)||!int(item.finalTurnPos)||
     item.source!=='NAR_OFFICIAL_PAST_RACE_RESULT'||
     item.rankingEffect!=='NONE_UNTIL_REVIEWED'||!identityRef(item.horseRef)||
     !['OFFICIAL_HORSE_REF','OFFICIAL_RACE_HORSE_NO'].includes(item.identityVerifiedBy)||
     !finiteTime(item.sourceCheckedAt)||finiteTime(item.sourceCheckedAt)>now||
     finiteTime(item.sourceCheckedAt)>=finiteTime(race.postTime))
    throw Error('UNVERIFIED_CORNER_EVIDENCE');
  if(item.sourceRef!==officialNarPastResultUrl(past))throw Error('UNVERIFIED_CORNER_SOURCE');
  const w=(witnesses.get(item.horseNo)||[]).filter(v=>
    v.raceDate===past.raceDate&&v.track===past.track&&Number(v.raceNo)===past.raceNo&&
    Number(v.pastHorseNo)===item.pastHorseNo&&v.horseRef===item.horseRef&&
    v.identityVerifiedBy===item.identityVerifiedBy&&
    ['NAR_OFFICIAL_HISTORY','NAR_OFFICIAL_RESCUE'].includes(v.source));
  if(w.length!==1)throw Error('OFFICIAL_HISTORY_WITNESS_MISMATCH');
  if(!Array.isArray(item.corners)||item.corners.length<1||item.corners.length>4)
    throw Error('CORNERS_INVALID');
  const corners=item.corners.map(c=>{
    if(!int(c.corner,1,4)||!int(c.position))throw Error('CORNERS_INVALID');
    return {corner:c.corner,position:c.position};
  });
  if(new Set(corners.map(c=>c.corner)).size!==corners.length||
     corners.some((c,i)=>i>0&&c.corner<=corners[i-1].corner)||
     corners[0].position!==item.earlyPos||
     corners.at(-1).position!==item.finalTurnPos)throw Error('CORNERS_INVALID');
  const k=[item.horseNo,past.raceDate,past.track,past.raceNo].join('/');
  if(keys.has(k))throw Error('DUPLICATE_CORNER_EVIDENCE');
  keys.add(k);
  evidence.push({
    horseNo:item.horseNo,horseName:norm(item.horseName),horseRef:item.horseRef,
    identityVerifiedBy:item.identityVerifiedBy,
    pastRace:{raceDate:past.raceDate,track:past.track,raceNo:past.raceNo},
    pastHorseNo:item.pastHorseNo,earlyPos:item.earlyPos,finalTurnPos:item.finalTurnPos,
    corners,source:item.source,sourceRef:item.sourceRef,
    sourceCheckedAt:item.sourceCheckedAt,rankingEffect:'NONE_UNTIL_REVIEWED'
  });
 }
 if(evidence.length!==packet.linkedRunEvidence)throw Error('CORNER_EVIDENCE_COUNT_MISMATCH');
 evidence.sort((a,b)=>a.horseNo-b.horseNo||
   b.pastRace.raceDate.localeCompare(a.pastRace.raceDate)||
   a.pastRace.raceNo-b.pastRace.raceNo);
 return {
  status:'PREFETCH_ONLY',raceDate:race.raceDate,raceTrack:race.track,raceNo:race.raceNo,
  linkedRunEvidence:evidence.length,evidence,
  claimStarted:false,saveAuthorized:false,targetResultUsed:false,
  marketUsed:false,rankChanged:false
 };
}

/** The capture must run only within a separately authorized pre-CLAIM phase. */
export async function stageLocalCornerSnapshot({
 race,officialRunners,packet,store,clock=()=>Date.now()
}){
 const target=raceOf(race),now=clock(),post=finiteTime(target.postTime);
 if(!date(target.raceDate)||!target.track||!int(target.raceNo,1,14)||
    post===null||!Number.isFinite(now))throw Error('TARGET_RACE_INVALID');
 if(now>=post)return {status:'SKIPPED_POST_TIME',inserted:false};
 if(typeof store?.insertIfAbsent!=='function')throw Error('STORE_ADAPTER_REQUIRED');
 let active,payload;
 try{
  active=rosterOf(officialRunners);
  payload=sanitizePacket(packet,target,active,witnessesOf(officialRunners),now);
 }catch(e){
  return {status:'REJECTED_UNVERIFIED_EVIDENCE',inserted:false,
   reason:e instanceof Error?e.message:'INVALID_EVIDENCE'};
 }
 if(payload.linkedRunEvidence===0)return {status:'SKIPPED_NO_EVIDENCE',inserted:false};
 const evidence={schemaVersion:'LOCAL_OFFICIAL_CORNERS_1',packet:payload};
 const asOf=new Date(now).toISOString();
 const row={
  circuit:'LOCAL',race_date:target.raceDate,track:target.track,race_no:target.raceNo,
  official_post_time:new Date(post).toISOString(),
  as_of:asOf,source_kind:'LOCAL_OFFICIAL_CORNERS',source_version:'LOCAL_CORNER_1',
  source_status:'PARTIAL',active_runner_count:active.length,
  official_roster_digest:digest({race:target,roster:active}),
  payload_digest:digest(evidence),evidence,
  data_quality:{linkedPriorRuns:payload.linkedRunEvidence,officialRosterCount:active.length}
 };
 try {
  const result=await store.insertIfAbsent(row);
  return {status:result?.inserted?'STORED':'ALREADY_STORED',
   inserted:Boolean(result?.inserted),rosterDigest:row.official_roster_digest};
 }catch{
  return {status:'OPTIONAL_STORE_FAILED',inserted:false};
 }
}

/**
 * Called only after the normal CLAIM/lease/official field checks succeeded.
 * Every fetched row is still checked independently; null means no safe overlay.
 */
export async function lookupLocalCornerSnapshot({
 race,officialRunners,store,clock=()=>Date.now()
}){
 const target=raceOf(race),now=clock(),post=finiteTime(target.postTime);
 if(!date(target.raceDate)||!target.track||!int(target.raceNo,1,14)||
    !Number.isFinite(now)||post===null||now>=post)return null;
 if(typeof store?.findLatest!=='function')return null;
 let active;
 try{active=rosterOf(officialRunners);}catch{return null;}
 const rosterDigest=digest({race:target,roster:active});
 let row;
 try {
  row=await store.findLatest({
   circuit:'LOCAL',race_date:target.raceDate,track:target.track,race_no:target.raceNo,
   source_kind:'LOCAL_OFFICIAL_CORNERS',official_roster_digest:rosterDigest,
   before:new Date(now).toISOString()
  });
 }catch{return null;}
 if(!row||!row.evidence||typeof row.evidence!=='object'||
    Array.isArray(row.evidence)||row.evidence.schemaVersion!=='LOCAL_OFFICIAL_CORNERS_1')
    return null;
 const capture=finiteTime(row.captured_at),asOf=finiteTime(row.as_of);
 if(row.circuit!=='LOCAL'||row.race_date!==target.raceDate||
    row.track!==target.track||Number(row.race_no)!==target.raceNo||
    row.source_kind!=='LOCAL_OFFICIAL_CORNERS'||
    row.source_version!=='LOCAL_CORNER_1'||
    !['READY','PARTIAL'].includes(row.source_status)||
    row.official_roster_digest!==rosterDigest||
    row.active_runner_count!==active.length||
    finiteTime(row.official_post_time)!==post||
    capture===null||asOf===null||asOf>capture||capture>now||
    capture>=post)return null;
 try{if(row.payload_digest!==digest(row.evidence))return null;}
 catch{return null;}
 // Revalidate the projected packet against this same race; no trusted caller
 // can turn this optional material into the core ranking or save gate.
 const packet=row.evidence?.packet;
 if(packet?.status!=='PREFETCH_ONLY'||packet.raceDate!==target.raceDate||
    packet.raceTrack!==target.track||Number(packet.raceNo)!==target.raceNo||
    packet.marketUsed!==false||packet.targetResultUsed!==false||
    packet.rankChanged!==false||packet.claimStarted!==false||
    packet.saveAuthorized!==false||!Array.isArray(packet.evidence)||
    packet.evidence.length>200||
    packet.evidence.length!==packet.linkedRunEvidence||
    packet.evidence.some(e=>{
      const h=active.find(r=>r.horseNo===e?.horseNo);
      const when=finiteTime(e?.sourceCheckedAt);
      return !h||h.horseName!==norm(e.horseName)||!e.pastRace||
       !date(e.pastRace.raceDate)||e.pastRace.raceDate>=target.raceDate||
       !int(e.pastRace.raceNo,1,14)||!int(e.pastHorseNo)||
       !int(e.earlyPos)||!int(e.finalTurnPos)||!identityRef(e.horseRef)||
       !when||when>asOf||when>=post||e.rankingEffect!=='NONE_UNTIL_REVIEWED'||
       e.source!=='NAR_OFFICIAL_PAST_RACE_RESULT';
    }))return null;
 return structuredClone(packet);
}
