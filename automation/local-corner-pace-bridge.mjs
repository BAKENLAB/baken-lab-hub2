/**
 * Research-only bridge: verified historic LOCAL corners -> descriptive field pace.
 * No network, DB, CLAIM, SAVE, FROZEN, market, rank mutation.
 * Inputs must come from the authenticated official pre-CLAIM acquisition chain.
 */
import {officialNarPastResultUrl} from './nar-prior-corners.mjs';
import {buildLocalFieldPaceEvidence} from './local-field-pace.mjs';
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const pos=x=>Number.isInteger(x)&&x>=1&&x<=24;
const key=h=>[h.race_date,h.track,Number(h.race_no)].join('/');
const pastKey=h=>[h.raceDate,h.track,Number(h.raceNo)].join('/');
export function bridgeLocalOfficialCorners({targetRace,officialRunners,cornerPacket,conditions={},clock=()=>Date.now()}){
 if(!targetRace||!Array.isArray(officialRunners)||!officialRunners.length||
    !officialRunners.every(r=>Number.isInteger(r.horse_no)&&r.horse_no>=1&&r.horse_no<=24&&
      typeof r.horse_name==='string'&&r.horse_name.trim()&&Array.isArray(r.recent_runs))||
    new Set(officialRunners.map(r=>r.horse_no)).size!==officialRunners.length)
   throw new TypeError('OFFICIAL_ROSTER_REQUIRED');
 const post=time(targetRace.postTime),now=clock();
 if(post===null||!Number.isFinite(now))throw new TypeError('INVALID_TARGET_TIME');
 const runners=officialRunners.map(r=>({...r,recent_runs:r.recent_runs.map(h=>({...h}))}));
 const reports=[];
 if(now>=post)return {status:'SKIPPED_POST_TIME',applied:0,ignored:0,runners,
   field_pace_evidence:buildLocalFieldPaceEvidence(runners,conditions),
   rankChanged:false,claimStarted:false,saveAuthorized:false,reports};
 if(cornerPacket?.status!=='PREFETCH_ONLY'||cornerPacket.raceDate!==targetRace.raceDate||
    cornerPacket.raceTrack!==targetRace.track||Number(cornerPacket.raceNo)!==Number(targetRace.raceNo)||
    !Array.isArray(cornerPacket.evidence)||cornerPacket.claimStarted!==false||
    cornerPacket.saveAuthorized!==false||cornerPacket.marketUsed!==false||
    cornerPacket.targetResultUsed!==false||cornerPacket.rankChanged!==false)
   throw new TypeError('UNTRUSTED_PREFETCH_PACKET');
 const roster=new Map(runners.map(r=>[r.horse_no,r]));
 const seen=new Set();let applied=0,ignored=0;
 for(const e of cornerPacket.evidence){
  const reject=reason=>{ignored++;reports.push({horseNo:e?.horseNo,pastRace:e?.pastRace,reason});};
  if(!e||!Number.isInteger(e.horseNo)||!roster.has(e.horseNo)||
     !Number.isInteger(e.pastHorseNo)||e.pastHorseNo<1||e.pastHorseNo>24||
     e.source!=='NAR_OFFICIAL_PAST_RACE_RESULT'||
     e.rankingEffect!=='NONE_UNTIL_REVIEWED'||!e.pastRace||
     e.pastRace.raceDate>=targetRace.raceDate||!pos(e.earlyPos)||!pos(e.finalTurnPos)||
     !time(e.sourceCheckedAt)||time(e.sourceCheckedAt)>now||time(e.sourceCheckedAt)>=post){
    reject('INVALID_OR_STALE');continue;
  }
  const id=[e.horseNo,pastKey(e.pastRace)].join('/');
  if(seen.has(id)){reject('DUPLICATE_HISTORY');continue;}
  seen.add(id);
  try{if(e.sourceRef!==officialNarPastResultUrl(e.pastRace)){
    reject('SOURCE_RACE_MISMATCH');continue;
  }}catch{reject('SOURCE_RACE_MISMATCH');continue;}
  const r=roster.get(e.horseNo);
  if(norm(r.horse_name)!==norm(e.horseName)||
     !['OFFICIAL_HORSE_REF','OFFICIAL_RACE_HORSE_NO'].includes(e.identityVerifiedBy)||
     typeof e.horseRef!=='string'||
     !e.horseRef.startsWith('https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?')){
    reject('HORSE_IDENTITY_MISMATCH');continue;
  }
  const matches=r.recent_runs.filter(h=>key(h)===pastKey(e.pastRace));
  if(matches.length!==1){reject('HISTORY_ROW_NOT_UNIQUE');continue;}
  const run=matches[0];
  if((run.early_pos!=null&&run.early_pos!==e.earlyPos)||
     (run.final_turn_pos!=null&&run.final_turn_pos!==e.finalTurnPos)){
    reject('HISTORICAL_POSITION_CONFLICT');continue;
  }
  if(run.early_pos!=null&&run.final_turn_pos!=null){reject('ALREADY_COVERED');continue;}
  run.early_pos=e.earlyPos;run.final_turn_pos=e.finalTurnPos;applied++;
  reports.push({horseNo:e.horseNo,pastRace:e.pastRace,reason:'OFFICIAL_CORNERS_ADDED'});
 }
 return {status:'DESCRIPTIVE_SHADOW_ONLY',applied,ignored,runners,
   field_pace_evidence:buildLocalFieldPaceEvidence(runners,conditions),
   rankChanged:false,claimStarted:false,saveAuthorized:false,reports};
}
