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
const runningStyle = v => Array.isArray(v) && v.length>=1 && v.length<=4
  && v.every(x=>['逃','先','差','追','?'].includes(x))
  && new Set(v).size===v.length && (!v.includes('?') || v.length===1);
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
  const a=payload.audit||{},partial=a.partial_coverage===true;
  const unranked=runners.filter(r=>r?.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY');
  if(partial){
    if(unranked.length!==1||!Array.isArray(a.unrated_runner_nos)
      ||!sameSet(a.unrated_runner_nos,unranked.map(r=>r.horse_no))
      ||!obj(a.ability_coverage)||a.ability_coverage.rated_count!==runners.length-1
      ||a.ability_coverage.total_count!==runners.length
      ||!text(a.ability_coverage.warning)
      ||!a.ability_coverage.warning.includes('未評価')
      ||a.market_used_for_ranking!==false||a.market_used_for_eye!==false
      ||payload.eye!==null||!text(a.eye_abstention_reason)
      ||!a.eye_abstention_reason.includes('履歴'))bad('PARTIAL_COVERAGE');
    for(const r of unranked){
      const audit=Array.isArray(a.runner_evidence_audit)?a.runner_evidence_audit.find(x=>x.horse_no===r.horse_no):null;
      if(r.rank!==null||r.grade!==null||!text(r.reason)
        ||!Array.isArray(r.missing_items)||!r.missing_items.includes('verified_history')
        ||!audit||audit.recent_runs_checked!==0
        ||!Array.isArray(audit.missing_items)||!audit.missing_items.includes('verified_history'))bad('PARTIAL_UNRATED_EVIDENCE');
    }
  } else if(unranked.length || a.partial_coverage===false && Array.isArray(a.unrated_runner_nos)&&a.unrated_runner_nos.length) bad('PARTIAL_UNDECLARED');
  const rated=runners.filter(r=>r?.evaluation_status!=='UNRATED_NO_VERIFIED_HISTORY');
  if(runners.some(r=>!integer(r.horse_no)||!text(r.horse_name)||!runningStyle(r.running_style_reference))
    ||new Set(payload.runners.map(r=>r?.horse_no)).size!==payload.runners.length
    ||rated.some(r=>!integer(r.rank)||!text(r.reason)||!['S','A','B','C','D','E','F'].includes(r.grade))
    ||new Set(rated.map(r=>r.rank)).size!==rated.length
    ||rated.length<5||rated.some(r=>r.rank>rated.length)||new Set(rated.map(r=>r.rank)).size!==rated.length
    ||(!partial&&runners.some(r=>!integer(r.rank))))bad('RUNNERS');
  const top=payload.top5.map(r=>r?.horse_no);
  if(!sameSet(top,runners.filter(r=>integer(r.rank)&&r.rank<=5).map(r=>r.horse_no)))bad('TOP5_IDENTITY');
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
    if(c.eye_case && !Object.values(c.review_checks).some(x=>x.status==='CHECKED'))bad('UNSUPPORTED_CASE');
  }
}
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
      // Pairwise winners can be non-EYE horses. EYE selection below still
      // requires exactly one independently supported dominant candidate.
      if(!c.horse_nos.includes(c.preferred_horse_no))bad('PAIR_PREFERENCE');
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
  if(payload?.audit?.partial_coverage===true && selected!==null)bad('PARTIAL_EYE_MUST_ABSTAIN');
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

// V1.6: count independent positive factors. All 17 checks remain mandatory;
// a CHECKED item alone is NOT a positive factor.
export const FACTOR_VERSION='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
export const FACTOR_GUARD='LOCAL_EYE_FACTOR_COUNT_V1';
export function selectLocalFactorEye({circuit,payload}) {
 if(circuit!=='LOCAL')bad('LOCAL_ONLY');
 const outside=pool(payload),a=payload?.audit;
 if(!obj(a)||a.rank6_auto_selected!==false||a.market_used_for_eye!==false
   ||a.eye_selection_method!==FACTOR_GUARD
   ||a.eye_reaudit_guard!=='EYE_REAUDIT_GUARD_20260929')bad('AUDIT_FLAGS');
 if(!sameSet(a.eye_pool_checked,outside.map(r=>r.horse_no)))bad('POOL_SET');
 checked(a.eye_candidate_audit,outside);
 if(!Array.isArray(a.eye_pairwise_comparison)||a.eye_pairwise_comparison.length!==0)bad('OLD_PAIRS_FORBIDDEN');
 const fa=a.eye_positive_factor_audit;
 if(!Array.isArray(fa)||!sameSet(fa.map(x=>x?.horse_no),outside.map(r=>r.horse_no)))bad('FACTOR_POOL');
 noMarket(fa);noMarket(a.eye_tie_break);
 const eligible=[];
 for(const record of fa){
   if(!exactKeys(record,['horse_no','positive_factors'])||!Array.isArray(record.positive_factors)||record.positive_factors.length>17)bad('FACTOR_SCHEMA');
   const cand=a.eye_candidate_audit.find(x=>x.horse_no===record.horse_no);
   const seenCategories=new Set(),seenReasons=new Set();let recent=false;
   for(const f of record.positive_factors){
     if(!exactKeys(f,['category','reason','evidence_refs','current_relevance'])
       ||!CHECKS.includes(f.category)||!text(f.reason)||rankOnly.test(f.reason)
       ||!refs(f.evidence_refs)||typeof f.current_relevance!=='boolean')bad('FACTOR_SCHEMA');
     if(seenCategories.has(f.category)||seenReasons.has(f.reason.trim()))bad('FACTOR_DUPLICATE');
     seenCategories.add(f.category);seenReasons.add(f.reason.trim());
     const check=cand.review_checks[f.category];
     if(check.status!=='CHECKED'
       ||!f.evidence_refs.every(r=>cand.evidence_refs.includes(r)&&check.evidence_refs.includes(r)))bad('FACTOR_UNVERIFIED');
     if(f.current_relevance)recent=true;
   }
   if(record.positive_factors.length>=2)eligible.push({horse_no:record.horse_no,count:record.positive_factors.length});
 }
 const max=eligible.length?Math.max(...eligible.map(x=>x.count)):0;
 const leaders=eligible.filter(x=>x.count===max).map(x=>x.horse_no);
 const tie=a.eye_tie_break;
 let selected=null;
 if(a.partial_coverage===true){
   if(tie!==null)bad('PARTIAL_EYE_MUST_ABSTAIN');
 }else if(leaders.length===1){
   if(tie!==null)bad('TIE_BREAK_UNEXPECTED');
   selected=leaders[0];
 }else if(leaders.length>1){
   if(tie!==null){
     if(!exactKeys(tie,['selected_horse_no','strength_reason','recency_reason','risk_reason','evidence_refs'])
       ||!leaders.includes(tie.selected_horse_no)||!text(tie.strength_reason)
       ||!text(tie.recency_reason)||!text(tie.risk_reason)||!refs(tie.evidence_refs))bad('TIE_BREAK_SCHEMA');
     for(const k of ['strength_reason','recency_reason','risk_reason'])
       if(rankOnly.test(tie[k]))bad('TIE_BREAK_EVIDENCE');
     const winner=a.eye_candidate_audit.find(x=>x.horse_no===tie.selected_horse_no);
     if(!tie.evidence_refs.some(r=>winner.evidence_refs.includes(r)))bad('TIE_BREAK_EVIDENCE');
     selected=tie.selected_horse_no;
   }
 }else if(tie!==null)bad('TIE_BREAK_UNEXPECTED');
 if(!a.eye_candidate_audit.every(c=>c.eye_case===(c.horse_no===selected&&selected!==null)))bad('SELECTION_MISMATCH');
 if(selected===null){
   if(payload.eye!==null||a.eye_selected_rank!==null||!text(a.eye_abstention_reason)
     ||rankOnly.test(a.eye_abstention_reason)||marketText.test(a.eye_abstention_reason))bad('ABSTENTION');
 }else{
   const r=outside.find(x=>x.horse_no===selected);
   if(!obj(payload.eye)||payload.eye.horse_no!==selected||payload.eye.horse_name!==r.horse_name
      ||a.eye_selected_rank!==r.rank||!text(payload.eye.reason)||rankOnly.test(payload.eye.reason)
      ||Object.hasOwn(payload.eye,'rank')&&payload.eye.rank!==r.rank)bad('SELECTION_MISMATCH');
   noMarket(payload.eye);
 }
 return selected;
}

export function assertLocalSaveDuringTransition(input) {
  const {circuit,protocol_version,payload}=input;
  if(circuit!=='LOCAL')bad('LOCAL_ONLY');
  if(![LEGACY_VERSION,VERSION,FACTOR_VERSION].includes(protocol_version))bad('PROTOCOL');
  if(!exactKeys(payload,['runners','top5','eye','bets','summary','bet_strategy','audit']))bad('PAYLOAD_KEYS');
  if(!Array.isArray(payload.bets)||payload.bets.length!==0
    ||payload.bet_strategy!=='SUSPENDED_FOR_ABILITY_STABILITY')bad('BET_CONTRACT');
  if(protocol_version===VERSION)assertLocalEyeForSave(input);
  if(protocol_version===FACTOR_VERSION){if(payload?.audit?.protocol_version!==FACTOR_VERSION)bad('PROTOCOL');selectLocalFactorEye({circuit,payload});}
  return true;
}
