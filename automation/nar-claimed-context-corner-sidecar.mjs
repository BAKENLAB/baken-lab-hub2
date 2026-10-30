// BAKEN LAB | Research-only shadow sidecar for LOCAL claimed-context input.
// Converts a *single already-fetched* official DebaTable into separate, witnessed
// running-style evidence WITHOUT fabricating past race numbers or adding official
// 'history' records. No production deploy, no score/rank/EYE/bet mutation.
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';
const canonical=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const allowed=['逃','先','差','追','?'];

export function attachResearchCornerSidecar({snapshot,domRows,diagnosedRunners,raceHeader}){
 if(!snapshot||!Array.isArray(snapshot.runners)||
    !Array.isArray(domRows)||!Array.isArray(diagnosedRunners)||
    typeof raceHeader!=='string') throw Error('SIDECAR_INVALID_INPUT');
 const race={race_date:snapshot.race_date,track:snapshot.track,
    race_no:snapshot.race_no,circuit:snapshot.circuit};
 const sourceRef=snapshot.source_ref;
 if(!/^(?:https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/TodayRaceInfo\/DebaTable\?)/.test(sourceRef))
    throw Error('SIDECAR_OFFICIAL_SOURCE_REQUIRED');
 const inspected=[];
 const field=[];
 for(const item of snapshot.runners){
  const candidates=diagnosedRunners.filter(r=>r.horse_no===item.horse_no &&
    canonical(r.horse_name)===canonical(item.horse_name));
  const matched=candidates.length===1?candidates[0]:null;
  const identity=Array.isArray(item.identity_refs) && item.identity_refs.length===1?
     item.identity_refs[0]:null;
  const link=matched?.horse_cell_links?.length===1?
    matched.horse_cell_links[0]?.href:null;
  let stableLink=false;
  if(typeof link==='string' && identity){
    try{stableLink=new URL(link,sourceRef).href===identity}catch{}
  }
  const hle=item.horse_link_evidence;
  const evidenceMatches=hle?.horse_no===item.horse_no &&
    hle?.row_index===matched?.row_index && hle?.horse_ref===identity &&
    hle?.deba_source_ref===sourceRef;
  const trusted=item.status==='ACTIVE'&&!!matched&&stableLink&&evidenceMatches;
  const selected={horse_no:item.horse_no,horse_name:item.horse_name,
     source:sourceRef,current_style:item.running_style_reference??['?'],
     prior:[],shadow_style:['?'],reason:'UNVERIFIED_IDENTITY'};
  if(trusted){
    const runner={horse_no:item.horse_no,horse_name:item.horse_name,status:'ACTIVE',
      identity_refs:[identity],row_index:matched.row_index,current_source_ref:sourceRef,
      recent_runs:[],running_style_reference:item.running_style_reference??['?']};
    const columns=captureOwnedDebaPriorColumns({
      rows:domRows,diagnosedRunners:diagnosedRunners.map(r=>({
        horse_no:r.horse_no,row_index:r.row_index})),
      horseNo:item.horse_no,debaSourceRef:sourceRef});
    const raw=extractOwnedDebaPastCorners({race,cardSourceRef:sourceRef,
      cardHeader:raceHeader,runner,columns});
    const shadow=buildDebaRunningStyleShadow({context:{race,runners:[runner]},
      priorEvidence:raw}).runners[0];
    selected.prior=raw.map(p=>({
      race_date:p.race_date,slot:p.slot,
      early_pos:p.early_pos,final_turn_pos:p.final_turn_pos,
      source_ref:p.source_ref,official_horse_ref:p.identity_source_ref}));
    selected.shadow_style=shadow.shadow_style;
    selected.reason=shadow.evidence_status;
  }
  if(!selected.shadow_style.every(s=>allowed.includes(s)))throw Error('SIDECAR_INVALID_STYLE');
  inspected.push(selected);
  // Existing snapshot and runner are left unchanged. The sidecar is attached
  // under new research-only keys, not under recent_runs or history.
  field.push({...item,shadow_card_corner_evidence:selected.prior,
    shadow_running_style_reference:selected.shadow_style,
    shadow_card_evidence_status:selected.reason});
 }
 return {snapshot:{...snapshot,runners:field},audits:inspected,
   base_history_untouched:true,ranks_untouched:true,
   pre_race_only:true,provisional:true};
}
