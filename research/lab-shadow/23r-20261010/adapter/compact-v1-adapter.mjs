// Offline draft adapter. Never verifies, dispatches, scores, fetches or persists.
import {auditRace} from '../revalidate-23r-rowspan.mjs';
import {assertTargetSet} from '../next-stage/history-review.mjs';

export const PROTOCOL_VERSION = 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004';
const CONDITIONS = ['surface','distance','going','weather','turn','class_name'];
const CURRENT = ['sex_age','weight_carried','jockey','draw','trainer','sire','damsire','body_weight','body_weight_diff','equipment'];
const HISTORY = ['race_date','track','race_no','race_name','surface','distance','going','finish','margin','time_raw','early_pos','final_turn_pos','final3f','weight_carried','body_weight','jockey'];
const NAR = new Set(['門別','盛岡','水沢','浦和','船橋','大井','川崎','金沢','笠松','名古屋','園田','姫路','高知','佐賀']);
const JRA = new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const positive = x => Number.isInteger(x) && x > 0;
const present = x => x !== null && x !== undefined && String(x).trim() !== '';
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
const time = x => typeof x === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x));
const scalar = x => x === null || typeof x === 'string' && x.length <= 2048 || typeof x === 'number' && Number.isFinite(x) || typeof x === 'boolean';
const str = x => typeof x === 'string' && x.trim() && x.length <= 2048 ? x : null;
const num = x => typeof x === 'number' && Number.isFinite(x) ? x : null;

// LOCAL venues are in Japan. Combine the explicitly recorded race date and
// clock time; this is format conversion, not a guessed start or freshness proof.
function postTime(race) {
  if (time(race.scheduled_start)) return race.scheduled_start;
  if (date(race.race_date) && typeof race.scheduled_start === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(race.scheduled_start)) return `${race.race_date}T${race.scheduled_start}:00+09:00`;
  return null;
}

function validateRace(race) {
  if (!object(race) || !['高知','佐賀'].includes(race.track) || !positive(race.race_no) || race.race_no > (race.track === '高知' ? 11 : 12) || !date(race.race_date) || !time(postTime(race)) || new Date(Date.parse(postTime(race))+9*3600000).toISOString().slice(0,10) !== race.race_date || !object(race.conditions) || !Array.isArray(race.runners) || !race.runners.length || race.runners.length > 20) throw Error('RAW_RACE_STRUCTURE_INVALID');
  const seen = new Set();
  for (const r of race.runners) {
    if (!object(r) || !positive(r.horse_no) || r.horse_no > 20 || seen.has(r.horse_no) || !str(r.horse_name) || !['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status) || !Array.isArray(r.recent_card_slots) || r.recent_card_slots.length > 500 || r.recent_card_slots.some(h => !object(h))) throw Error('RAW_RUNNER_STRUCTURE_INVALID');
    seen.add(r.horse_no);
  }
  if (!race.runners.some(r => r.status === 'ACTIVE')) throw Error('RAW_ACTIVE_FIELD_EMPTY');
}

function historyCandidate(run) {
  const track = str(run.track);
  const normalized = track?.normalize('NFKC');
  const pastTrack = normalized?.startsWith('J') && JRA.has(normalized.slice(1)) ? normalized.slice(1) : track;
  const fields = {
    race_date:str(run.race_date),track:pastTrack,race_no:positive(run.race_no) ? run.race_no : null,
    race_name:str(run.race_name),surface:str(run.surface),distance:positive(run.distance_m) ? run.distance_m : null,
    going:str(run.going),finish:positive(run.finish) ? run.finish : null,
    margin:str(run.margin),time_raw:str(run.time),final3f:str(run.final3f),
    weight_carried:num(run.weight_kg),jockey:str(run.jockey),
    // Meaning-equivalent conversion from passing_order has not been established.
    early_pos:null,final_turn_pos:null,body_weight:null,
  };
  return {fields,verification_status:'UNVERIFIED',
    claimed_detail_url:str(run.official_url),
    missing_fields:HISTORY.filter(k => !present(fields[k])),
    withheld_fields:['early_pos','final_turn_pos'],
    notes:['OFFICIAL_IDENTITY_AND_HISTORY_NOT_VERIFIED','MARGIN_SEMANTICS_NOT_INDEPENDENTLY_VERIFIED']};
}

function selectCandidates(slots, targetDate) {
  const items=[],excluded=[],groups=new Map();
  slots.forEach((run,index) => {
    if (!present(run.race_date)) { excluded.push({slot_index:index,reason:'EMPTY_OR_UNDATED_SLOT'}); return; }
    if (!date(run.race_date) || run.race_date >= targetDate) { excluded.push({slot_index:index,reason:'NOT_PROVEN_PRIOR'}); return; }
    const candidate=historyCandidate(run),h=candidate.fields;
    if (!(NAR.has(h.track) || JRA.has(h.track))) { excluded.push({slot_index:index,reason:'HISTORY_TRACK_UNSUPPORTED'}); return; }
    const key=positive(h.race_no) ? JSON.stringify([h.race_date,h.track,h.race_no]) : null;
    if (key && groups.has(key)) {
      const previous=groups.get(key);
      if (JSON.stringify(previous.fields)!==JSON.stringify(h)) previous.verification_status='CONFLICT';
      excluded.push({slot_index:index,reason:previous.verification_status === 'CONFLICT' ? 'DUPLICATE_FACT_CONFLICT' : 'DUPLICATE_HISTORY'});
      return;
    }
    candidate.slot_index=index;
    if (key) groups.set(key,candidate);
    else candidate.notes.push('RACE_NUMBER_UNRESOLVED');
    items.push(candidate);
  });
  items.sort((a,b) => b.fields.race_date.localeCompare(a.fields.race_date) || (positive(a.fields.race_no) && positive(b.fields.race_no) ? b.fields.race_no-a.fields.race_no : a.slot_index-b.slot_index));
  for (const candidate of items.slice(5)) excluded.push({slot_index:candidate.slot_index,reason:'OUTSIDE_LATEST_MAX_FIVE'});
  return {latest_max_five:items.slice(0,5),excluded};
}

export function validateDraftStructure(context) {
  const errors=[];
  const top=['context_format','race','protocol','runners','missing_conditions','field_integrity_checked','stage','protocol_version'];
  if (!object(context) || Object.keys(context).length!==top.length || top.some(k => !Object.hasOwn(context,k))) return {ok:false,errors:['DRAFT_KEYS_INVALID']};
  if (context.context_format!=='COMPACT_V1' || context.protocol_version!==PROTOCOL_VERSION || context.stage!=='AWAITING_FULL_DEPTH_COMPARISON') errors.push('DRAFT_WRAPPER_INVALID');
  if (context.field_integrity_checked!==false || context.protocol?.enforced_server_side!==false || context.protocol?.protocol_key!=='LOCAL_MAIN' || context.protocol?.version!==PROTOCOL_VERSION) errors.push('UNVERIFIED_DRAFT_FLAGS_INVALID');
  if (!object(context.race) || !date(context.race.race_date) || !time(context.race.post_time) || context.race.circuit!=='LOCAL' || !positive(context.race.race_no) || !object(context.race.conditions) || CONDITIONS.some(k=>!scalar(context.race.conditions[k])) || !scalar(context.race.current_source_ref)) errors.push('DRAFT_RACE_INVALID');
  const strings=v=>Array.isArray(v) && v.every(s=>typeof s==='string' && s.length<=1024);
  if (!strings(context.missing_conditions) || !Array.isArray(context.runners) || !context.runners.length || context.runners.length>20) errors.push('DRAFT_COLLECTIONS_INVALID');
  const seen=new Set();
  for (const r of Array.isArray(context.runners) ? context.runners : []) {
    if (!object(r) || !positive(r.horse_no) || seen.has(r.horse_no) || !str(r.horse_name) || CURRENT.some(k=>!Object.hasOwn(r,k)||!scalar(r[k])) || !strings(r.missing_items) || !strings(r.history_source_refs) || JSON.stringify(r.running_style_reference)!=='["?"]' || !Array.isArray(r.recent_runs) || r.recent_runs.length!==0 || r.history_source_refs.length!==0) errors.push('DRAFT_RUNNER_INVALID');
    seen.add(r?.horse_no);
  }
  return {ok:errors.length===0,errors};
}

export function convertRace(race) {
  validateRace(race);
  const active=race.runners.filter(r=>r.status==='ACTIVE');
  const candidates=active.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
    claimed_nar_lineage_id:str(r.nar_lineage_id),claimed_profile_url:str(r.profile_url),
    ...selectCandidates(r.recent_card_slots,race.race_date)}));
  const conditions=Object.fromEntries(CONDITIONS.map(k=>[k,k==='distance' ? (positive(race.conditions.distance_m)?race.conditions.distance_m:null) : str(race.conditions[k])]));
  const draft_context={context_format:'COMPACT_V1',
    race:{race_date:race.race_date,track:race.track,race_no:race.race_no,circuit:'LOCAL',post_time:postTime(race),race_name:str(race.race_name),conditions,current_source_ref:str(race.official_url)},
    protocol:{protocol_key:'LOCAL_MAIN',version:PROTOCOL_VERSION,enforced_server_side:false},
    runners:active.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
      // The RAW package has no verified CURRENT attribute source. Even similarly
      // named historical or caller-added attributes are not trusted here.
      ...Object.fromEntries(CURRENT.map(k=>[k,null])),
      running_style_reference:['?'],history_source_refs:[],recent_runs:[],
      missing_items:[...CURRENT,'recent_runs:0/5','verified_history']})),
    missing_conditions:CONDITIONS.filter(k=>!present(conditions[k])),field_integrity_checked:false,
    stage:'AWAITING_FULL_DEPTH_COMPARISON',protocol_version:PROTOCOL_VERSION};
  const structure=validateDraftStructure(draft_context);
  if (!structure.ok) throw Error('DRAFT_STRUCTURE_INVALID:'+structure.errors.join(','));
  const quality=auditRace(race); // Existing independent five-completed-run quality gate.
  return {schema:'LAB_SHADOW_COMPACT_DRAFT_V1',race_key:`${race.track}${race.race_no}R`,
    production_dispatch_allowed:false,overall_status:'BLOCKED',draft_context,
    axes:{
      A:{status:'DRAFT_STRUCTURE_MATCH',production_contract_accepted:false,
        reasons:['FIELD_INTEGRITY_NOT_ESTABLISHED','PROTOCOL_NOT_SERVER_ENFORCED'],
        missing_input_information:[...CURRENT,'early_pos','final_turn_pos','verified_recent_runs'],
        note:'Names and scalar/array shapes match; this is not a server-validated context or the same production input.'},
      B:{status:'UNVERIFIED',reasons:['OFFICIAL_HTML_ORIGINAL_UNAVAILABLE','HORSE_IDENTITY_UNVERIFIED','HISTORY_UNVERIFIED','LATEST_FIELD_UNVERIFIED','AS_OF_AVAILABILITY_UNVERIFIED']},
      C:{status:quality.status==='READY'?'MET':'NOT_MET',reasons:quality.blockers,
        history_fact_complete_runners:quality.history_ready_runners,active_runners:quality.active_runner_count,
        note:'Legacy SHADOW field-completeness criteria only; neither official verification nor production eligibility.'}},
    unverified_history_candidates:candidates,
    excluded_current_runners:race.runners.filter(r=>r.status!=='ACTIVE').map(r=>({horse_no:r.horse_no,status:r.status,verification_status:'UNVERIFIED'})),
    limitations:['VERIFIED_HISTORY_ADMISSION_NOT_IMPLEMENTED','PASSING_ORDER_POSITION_MAPPING_NOT_IMPLEMENTED','CURRENT_ATTRIBUTE_VERIFICATION_NOT_IMPLEMENTED','LATEST_MAX_FIVE_CANDIDATES_DO_NOT_PROVE_COMPLETE_LIFETIME_HISTORY']};
}

export function convertDay(raw) {
  assertTargetSet(raw);
  const races=raw.races.map(convertRace);
  return {schema:'LAB_SHADOW_COMPACT_DRAFT_DAY_V1',target_date:'2026-10-10',races,
    summary:{races:races.length,active_runners:races.reduce((n,r)=>n+r.draft_context.runners.length,0),
      structure_matches:races.filter(r=>r.axes.A.status==='DRAFT_STRUCTURE_MATCH').length,
      production_accepted:0,official_verified:0,quality_met:races.filter(r=>r.axes.C.status==='MET').length,
      quality_not_met:races.filter(r=>r.axes.C.status==='NOT_MET').length,ready:0,blocked:races.length,
      admitted_verified_history_rows:0,
      unverified_history_candidates:races.reduce((n,r)=>n+r.unverified_history_candidates.reduce((m,h)=>m+h.latest_max_five.length,0),0)}};
}
