// LOCAL-only review candidate. No DB I/O, ranking, TOP5 generation or market scoring.
export const VERSION = 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004';
export const LEGACY_VERSION = 'CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930';
export const GUARD = 'LOCAL_EYE_COMPARISON_V1';
export const CHECKS = Object.freeze(['distance_change','track_change','going_change',
  'class_change','promotion_demotion','weight_change','jockey_change','draw',
  'running_style','pace_peers','margins','passing_order','final_section',
  'trouble','layoff_preparation','current_suitability','same_condition_history']);
const bad = code => {throw new Error('LOCAL_EYE_'+code);};
const obj = v => v && typeof v==='object' && !Array.isArray(v);
const text = v => typeof v==='string' && v.trim().length>0 && v.length<=4000;
const integer = v => Number.isInteger(v) && v>0;
const exactKeys = (o,keys) => obj(o) && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
const refs = v => Array.isArray(v) && v.length>0 && v.length<=64 && v.every(text)
  && new Set(v).size===v.length;
const sorted = v => [...v].sort((a,b)=>a-b);
const sameSet = (a,b) => Array.isArray(a) && a.every(integer) && new Set(a).size===a.length
  && JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const marketKey = /odds|popularity|market|人気|オッズ|単勝|市場/i;
const marketText = /odds|popularity|人気|オッズ|高配当|市場情報/i;
const rankOnly = /(?:6|６)位だから|TOP5(?:の)?次点|能力順位(?:だけ|のみ)|rank\s*={1,3}\s*6|(?:配列|候補)(?:の)?先頭/i;
function noMarket(value) {
  if(typeof value==='string' && marketText.test(value))bad('MARKET_EVIDENCE');
  if(!value || typeof value!=='object')return;
  for(const [k,v] of Object.entries(value)){if(marketKey.test(k))bad('MARKET_EVIDENCE');noMarket(v);}
}
function pool(payload) {
  if(!obj(payload)||!Array.isArray(payload.runners)||!Array.isArray(payload.top5)
    ||payload.runners.length<1||payload.runners.length>20)bad('SHAPE');
  const runners=payload.runners.filter(r=>r?.status!=='CANCELLED' && r?.status!=='EXCLUDED');
  if(runners.some(r=>!integer(r.horse_no)||!integer(r.rank)||!text(r.horse_name))
    ||new Set(payload.runners.map(r=>r?.horse_no)).size!==payload.runners.length
    ||new Set(runners.map(r=>r.rank)).size!==runners.length)bad('RUNNERS');
  const top=payload.top5.map(r=>r?.horse_no);
  if(!sameSet(top,runners.filter(r=>r.rank<=5).map(r=>r.horse_no)))bad('TOP5_IDENTITY');
  // Set membership only. Neither rank nor incoming array order chooses the winner.
  return runners.filter(r=>!top.includes(r.horse_no));
}
function checked(candidates,outside) {
  if(!Array.isArray(candidates)||!sameSet(candidates.map(c=>c?.horse_no),outside.map(r=>r.horse_no)))bad('CANDIDATE_SET');
  noMarket(candidates);
  for(const c of candidates) {
    if(!exactKeys(c,['horse_no','rank','upside_trigger','hidden_evidence','finish_path','risk',
      'eye_case','evidence_refs','review_checks']))bad('CANDIDATE_SCHEMA');
    const r=outside.find(r=>r.horse_no===c.horse_no);
    if(c.rank!==r.rank || typeof c.eye_case!=='boolean' || !Array.isArray(c.evidence_refs)
      ||(c.evidence_refs.length>0 && !refs(c.evidence_refs))
      ||(c.eye_case && !refs(c.evidence_refs)))bad('CANDIDATE_IDENTITY');
    for(const k of ['upside_trigger','hidden_evidence','finish_path','risk'])
      if(!text(c[k])||rankOnly.test(c[k]))bad('SPECIFIC_EVIDENCE');
    if(!exactKeys(c.review_checks,CHECKS))bad('CHECKS_INCOMPLETE');
    for(const check of Object.values(c.review_checks)){
      if(!exactKeys(check,['status','finding','evidence_refs'])||!text(check.finding)
        ||!Array.isArray(check.evidence_refs))bad('CHECK_SCHEMA');
      if(check.status==='CHECKED') {if(!refs(check.evidence_refs))bad('CHECK_EVIDENCE');}
      else if(check.status==='MISSING'){if(check.evidence_refs.length)bad('MISSING_INVENTED');}
      else bad('CHECK_STATUS');
    }
    // An eligible upside must have at least one independently documented fact.
    if(c.eye_case && !Object.values(c.review_checks).some(x=>x.status==='CHECKED'))bad('UNSUPPORTED_CASE');
  }
}
/** Comparisons are explicit analyst judgements, not numeric scores invented by this module.
 * Every unordered pair is required. Ties/unknowns never break by rank or array order.
 * The sole candidate with an evidenced win over every opponent is selected; otherwise null.
 */
export function selectLocalEye({circuit,payload}) {
  if(circuit!=='LOCAL')bad('LOCAL_ONLY');
  const outside=pool(payload), a=payload.audit;
  if(!obj(a)||a.rank6_auto_selected!==false||a.eye_selection_method!==GUARD
    ||a.eye_reaudit_guard!=='EYE_REAUDIT_GUARD_20260929'
    ||a.market_used_for_eye!==false)bad('AUDIT_FLAGS');
  if(!sameSet(a.eye_pool_checked,outside.map(r=>r.horse_no)))bad('POOL_SET');
  checked(a.eye_candidate_audit,outside);
  const comparisons=a.eye_pairwise_comparison;
  if(!Array.isArray(comparisons)||comparisons.length!==outside.length*(outside.length-1)/2)bad('PAIR_COVERAGE');
  noMarket(comparisons);
  const seen=new Set(), wins=new Map(outside.map(r=>[r.horse_no,0]));
  for(const c of comparisons){
    if(!exactKeys(c,['horse_nos','preferred_horse_no','criterion','reason','evidence_refs'])
      ||!Array.isArray(c.horse_nos)||c.horse_nos.length!==2
      ||!c.horse_nos.every(n=>wins.has(n))||c.horse_nos[0]===c.horse_nos[1])bad('PAIR_IDENTITY');
    const key=sorted(c.horse_nos).join(':');if(seen.has(key))bad('PAIR_DUPLICATE');seen.add(key);
    if(c.criterion!=='CURRENT_UPSIDE_OVER_BASELINE' || !text(c.reason)||rankOnly.test(c.reason)
      ||!Array.isArray(c.evidence_refs)||(c.evidence_refs.length>0 && !refs(c.evidence_refs))
      ||(c.preferred_horse_no!==null && !refs(c.evidence_refs)))bad('PAIR_EVIDENCE');
    for(const n of c.horse_nos){const candidate=a.eye_candidate_audit.find(x=>x.horse_no===n);
      if((c.preferred_horse_no!==null || candidate.evidence_refs.length>0)
        &&!c.evidence_refs.some(ref=>candidate.evidence_refs.includes(ref)))bad('PAIR_UNLINKED');}
    if(c.preferred_horse_no!==null){
      if(!c.horse_nos.includes(c.preferred_horse_no)
        ||!a.eye_candidate_audit.find(x=>x.horse_no===c.preferred_horse_no).eye_case)bad('PAIR_PREFERENCE');
      wins.set(c.preferred_horse_no,wins.get(c.preferred_horse_no)+1);
    }
  }
  const best=outside.filter(r=>a.eye_candidate_audit.find(c=>c.horse_no===r.horse_no).eye_case
    &&wins.get(r.horse_no)===outside.length-1);
  return best.length===1 ? best[0].horse_no : null;
}
export function assertLocalEyeForSave({circuit,protocol_version,payload}) {
  if(protocol_version!==VERSION || payload?.audit?.protocol_version!==VERSION)bad('PROTOCOL');
  const selected=selectLocalEye({circuit,payload}), a=payload.audit;
  if(!Object.hasOwn(payload,'eye'))bad('EYE_MISSING');
  if(selected===null){
    if(payload.eye!==null||a.eye_selected_rank!==null||!text(a.eye_abstention_reason)
      ||rankOnly.test(a.eye_abstention_reason)||marketText.test(a.eye_abstention_reason))bad('ABSTENTION');
  }else{
    const r=payload.runners.find(r=>r.horse_no===selected);
    if(!obj(payload.eye)||payload.eye.horse_no!==selected||payload.eye.horse_name!==r.horse_name
      ||a.eye_selected_rank!==r.rank||!text(payload.eye.reason)||rankOnly.test(payload.eye.reason))bad('SELECTION_MISMATCH');
    if(Object.hasOwn(payload.eye,'rank')&&payload.eye.rank!==r.rank)bad('SELECTION_MISMATCH');
    noMarket(payload.eye);
  }
  return true;
}
// During preparation 1.4 retains its existing EYE contract; only 1.5 gets the new guard.
// The DB RPC remains authoritative about the single currently active LOCAL version.
export function assertLocalSaveDuringTransition(input) {
  const {circuit,protocol_version,payload}=input;
  if(circuit!=='LOCAL')bad('LOCAL_ONLY');
  if(![LEGACY_VERSION,VERSION].includes(protocol_version))bad('PROTOCOL');
  if(!exactKeys(payload,['runners','top5','eye','bets','summary','bet_strategy','audit']))bad('PAYLOAD_KEYS');
  if(!Array.isArray(payload.bets)||payload.bets.length!==0
    ||payload.bet_strategy!=='SUSPENDED_FOR_ABILITY_STABILITY')bad('BET_CONTRACT');
  if(protocol_version===VERSION)assertLocalEyeForSave(input);
  return true;
}
