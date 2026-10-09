// Offline pilot only. No DB, network, models, READY changes or production dispatch.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseNarHorseHistory} from './baseline/nar-history-rescue.mjs';
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const hash=x=>createHash('sha256').update(x).digest('hex');
const key=x=>JSON.stringify([x.race_date,clean(x.track).replace(/^J(?=札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)/,''),x.race_no]);
const fields=['race_name','distance','going','finish','time_raw','final3f','weight_carried'];
export function admitHorse(entry,race,evidence) {
  const raw=entry.raw;
  const base={horse_no:raw.horse_no,horse_name:raw.horse_name,current:null,recent_runs:[],history_candidates:[],production_dispatch_allowed:false};
  const incomplete=reason=>({...base,identity_status:'UNVERIFIED',reason,history_candidates:raw.recent_card_slots.map(r=>({raw:r,status:'OFFICIAL_MATCH_INCOMPLETE',reason}))});
  if(raw.status!=='ACTIVE')return {...base,identity_status:'UNVERIFIED',history_candidates:raw.recent_card_slots.map(r=>({raw:r,status:'INELIGIBLE',reason:'CURRENT_NOT_ACTIVE'}))};
  if(!evidence?.cardBytes || !evidence?.profileBytes || evidence.fetch?.status!==200 ||
    hash(evidence.cardBytes)!==evidence.cardHash || hash(evidence.profileBytes)!==evidence.fetch.sha256)
    return incomplete('OFFICIAL_BYTES_OR_HASH_MISSING');
  // Re-extract the archived documents. A forged JSON verification flag, body,
  // row, current attribute or DOM link cannot substitute for the HTML bytes.
  const parsed=spawnSync('python',[fileURLToPath(new URL('./extract-evidence.py',import.meta.url)),'--stdout'],{encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024});
  if(parsed.status!==0)return incomplete('ARCHIVED_DOM_EXTRACTION_FAILED');
  let archive;try{archive=JSON.parse(parsed.stdout);}catch{return incomplete('ARCHIVED_DOM_EXTRACTION_FAILED');}
  const archived=archive.runners.find(h=>h.raw.horse_no===raw.horse_no);
  if(JSON.stringify(archived)!==JSON.stringify(entry) || JSON.stringify(archive.race)!==JSON.stringify(race) ||
     archive.card.sha256!==evidence.cardHash || archive.card.download_completed_at!==evidence.cardCapturedAt ||
     archived.profile_html_sha256!==hash(evidence.profileBytes))
    return incomplete('EXTRACTED_FACTS_NOT_BOUND_TO_ARCHIVE');
  const fetched=Date.parse(evidence.fetch.fetched_at), cardAt=Date.parse(evidence.cardCapturedAt);
  if(!Number.isFinite(fetched)||!Number.isFinite(cardAt)||fetched>=Date.parse(race.post_time)-180000||cardAt>=Date.parse(race.post_time)-180000)
    return incomplete('CAPTURE_NOT_PRE_RACE');
  const link=entry.horse_link_evidence;
  if(/取消|除外/.test(entry.current?.status_text?.join(' ')??''))return incomplete('OFFICIAL_CURRENT_NOT_ACTIVE');
  if(!link || link.horse_no!==raw.horse_no || link.horse_ref!==raw.profile_url ||
     link.deba_source_ref!==race.official_url || evidence.fetch.url!==link.horse_ref ||
     !entry.profile || entry.profile.url!==link.horse_ref || entry.profile.fetched_at!==evidence.fetch.fetched_at)
    return incomplete('OFFICIAL_IDENTITY_LINK_MISSING');
  // The caller supplies DOM extraction from the archived HTML, never RAW flags.
  const current={horse_no:raw.horse_no,horse_name:raw.horse_name,identity_refs:[link.horse_ref],horse_link_evidence:link};
  let official;
  try{official=parseNarHorseHistory(entry.profile,current,race);}catch(e){return incomplete(e.code||e.message);}
  const candidates=raw.recent_card_slots.map(r=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.race_date??'') || r.race_date>=race.race_date)
      return {raw:r,status:'INELIGIBLE',reason:'UNDATED_OR_NOT_PRIOR'};
    if(!Number.isInteger(r.race_no))return {raw:r,status:'OFFICIAL_MATCH_INCOMPLETE',reason:'RACE_NUMBER_MISSING'};
    const o=official.find(o=>key(o)===key(r));
    if(!o)return {raw:r,status:'OFFICIAL_MATCH_INCOMPLETE',reason:'NOT_IN_OFFICIAL_LATEST_FIVE'};
    const mapped={...r,distance:r.distance_m,time_raw:r.time,weight_carried:r.weight_kg};
    const conflicts=fields.filter(k=>mapped[k]!=null && o[k]!=null && clean(mapped[k])!==clean(o[k]));
    // Margin in RAW includes the winner name; compare the explicitly numeric component.
    const margin=clean(r.margin).match(/^-?\d+(?:\.\d+)?(?=\s|$)/)?.[0];
    if(margin && o.margin && clean(margin)!==clean(o.margin))conflicts.push('margin');
    if(conflicts.length)return {raw:r,status:'MISMATCH',conflicts};
    return {raw:r,status:'OFFICIAL_MATCHED',official:o};
  });
  // Any conflicting RAW record blocks that race; never copy unverified RAW fields.
  const blocked=new Set(candidates.filter(c=>c.status==='MISMATCH').map(c=>key(c.raw)));
  const recent=official.filter(o=>!blocked.has(key(o))).map(o=>({...o,
    identity_verified_by:'OFFICIAL_HORSE_REF',identity_source_ref:link.horse_ref,
    surface:o.surface??null,early_pos:null,final_turn_pos:null}));
  return {...base,identity_status:'OFFICIAL_PROFILE_LINK_MATCHED',current:entry.current,
    current_source_ref:race.official_url,history_candidates:candidates,recent_runs:recent,
    note:'Official-profile records only. RAW passing order, surface and jockey are not copied. Not production acceptance.'};
}
