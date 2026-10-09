import {readFile,writeFile} from 'node:fs/promises';

const sourceUrl=new URL('./SAGA11_PRERACE_SHADOW_2026-10-10.json',import.meta.url);
const outputUrl=new URL('./SAGA11_PRERACE_REAUDIT_2026-10-10.json',import.meta.url);
const raceNoFetchedAt='2026-10-10T00:49:16+09:00';
const officialRaceNos={
  1:[7,12,10,4,5],2:[7,5,3,11,12],3:[7,9,8,3,4],4:[7,4,9,8,8],
  5:[7,9,8,9,9],6:[7,5,7,9,10],7:[7,5,9,3,4],8:[7,6,7,8,8],
  9:[7,6,7,9,3],10:[3,7,10,8,8],11:[7,4,9,10,8],
};
const profileRef=id=>`https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=${id}`;
const banned=/(^|_)(odds?|popularity|market|predicted_market)($|_)|人気|オッズ|単勝|市場/i;

function rejectBanned(value,path='root'){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    if(banned.test(key))throw new Error(`BANNED_FIELD:${path}.${key}`);
    rejectBanned(child,`${path}.${key}`);
  }
}

export const COMPACT_V1_RACE_NO_FINDING={
  required:true,
  reason:'recent_runs.race_no is retained in COMPACT_V1 and required as an integer by the existing LOCAL history identity, duplicate and official-witness checks',
  evidence_files:[
    'validation/build-ooi2-compact-input.mjs',
    'production-snapshot/automation/local-worker-data.mjs',
    'production-snapshot/automation/nar-history-rescue.mjs',
  ],
};

export function supplementRaceNos(source){
  const copy=structuredClone(source);
  let filled=0;
  for(const runner of copy.runners){
    const values=officialRaceNos[runner.horse_no];
    if(!values||values.length!==runner.recent_card_entries.length)throw new Error(`RACE_NO_WITNESS_MISSING:${runner.horse_no}`);
    runner.recent_card_entries=runner.recent_card_entries.map((run,index)=>{
      const officialRaceNo=values[index];
      if(!Number.isInteger(officialRaceNo)||officialRaceNo<1||officialRaceNo>12)throw new Error(`RACE_NO_INVALID:${runner.horse_no}:${index}`);
      if(run.race_no!==null&&run.race_no!==officialRaceNo)throw new Error(`RACE_NO_CONFLICT:${runner.horse_no}:${index}`);
      if(run.race_no===null)filled++;
      const {race_no_missing_reason,...rest}=run;
      return {...rest,race_no:officialRaceNo,race_no_evidence:{source:'NAR_OFFICIAL_HORSE_PROFILE',source_ref:profileRef(runner.lineage_id),fetched_at:raceNoFetchedAt}};
    });
  }
  copy.schema_version='lab-shadow-prerace-proof-v2-race-no-audited';
  copy.race_no_audit={...COMPACT_V1_RACE_NO_FINDING,initial_null_count:filled,remaining_null_count:0,verified_count:55,fetched_at:raceNoFetchedAt};
  return copy;
}

export function createRefreshProcedure(base){
  return {
    mode:'READ_ONLY_OFFICIAL_REAUDIT',
    race:{race_date:base.race.race_date,track:base.race.track,race_no:base.race.race_no,post_time:base.race.post_time},
    source_ref:base.race.official_url,
    steps:[
      'GET the exact NAR DebaTable URL with cache disabled and a bounded timeout',
      'record fetched_at from the local clock immediately after the response is received',
      'reject responses fetched at or after post_time',
      'parse target weather and going only from the current-race header',
      'parse every current runner status as ACTIVE, CANCELLED or EXCLUDED',
      'compare refreshed ACTIVE horse numbers and names with the captured field',
      'retain all prior 55 history rows unchanged; do not ingest odds, popularity or target result',
      'emit READY only when every hard gate passes; otherwise emit BLOCKED with reasons',
    ],
    request_policy:{method:'GET',cache:'no-store',redirect:'error',timeout_ms:15000,max_attempts:3,retry_statuses:[429,500,502,503,504],honor_retry_after:true,max_retry_after_ms:5000},
    prohibited_actions:['database_write','queue_claim','save','finish','model_call','deployment'],
  };
}

export function auditOfficialRefresh(base,refresh){
  rejectBanned(refresh);
  const blockers=[];
  const fetched=Date.parse(refresh.fetched_at),post=Date.parse(base.race.post_time);
  if(!Number.isFinite(fetched)||fetched>=post)blockers.push('NOT_PROVEN_PRE_RACE');
  if(refresh.source_ref!==base.race.official_url)blockers.push('OFFICIAL_URL_MISMATCH');
  for(const key of ['surface','distance','turn','class_name','going','weather'])if(refresh.conditions?.[key]===null||refresh.conditions?.[key]===undefined||refresh.conditions?.[key]==='')blockers.push(`TARGET_${key.toUpperCase()}_MISSING`);
  const runners=Array.isArray(refresh.runners)?refresh.runners:[];
  if(!runners.length||runners.some(r=>!Number.isInteger(r.horse_no)||!['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status)))blockers.push('FIELD_STATUS_UNVERIFIED');
  const refreshedActive=runners.filter(r=>r.status==='ACTIVE').map(r=>r.horse_no).sort((a,b)=>a-b);
  const capturedNames=new Map(base.runners.map(r=>[r.horse_no,r.horse_name]));
  if(runners.some(r=>capturedNames.get(r.horse_no)!==r.horse_name))blockers.push('FIELD_IDENTITY_CONFLICT');
  if(new Set(runners.map(r=>r.horse_no)).size!==runners.length)blockers.push('FIELD_DUPLICATE_HORSE_NO');
  const status={status:blockers.length?'BLOCKED':'READY',blockers:[...new Set(blockers)],fetched_at:refresh.fetched_at,active_runner_nos:refreshedActive,
    cancelled_runner_nos:runners.filter(r=>r.status==='CANCELLED').map(r=>r.horse_no),excluded_runner_nos:runners.filter(r=>r.status==='EXCLUDED').map(r=>r.horse_no)};
  return status;
}

const source=JSON.parse(await readFile(sourceUrl,'utf8'));
const result=supplementRaceNos(source);
result.refresh_procedure=createRefreshProcedure(result);
result.status='BLOCKED';
result.blockers=['TARGET_GOING_NOT_YET_PUBLISHED','TARGET_WEATHER_NOT_YET_PUBLISHED'];
result.completeness={history_rows:55,history_race_nos_verified:55,runner_identities_verified:11,target_conditions_required:6,target_conditions_present:4,field_status_recheck_pending:true};
await writeFile(outputUrl,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,race_no_audit:result.race_no_audit,blockers:result.blockers},null,2));
