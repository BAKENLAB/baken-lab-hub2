// Research-only readout of the actual operator protocol and a prospective
// scoring engine. It does not assign horse ranks, scores or bless a release.
// The currently ACTIVE JRA0.4 protocol allows manual rank deviations with
// OPTIONAL source evidence: it does NOT specify numerical factor weights.
const no=(reason,detail={})=>({
  can_certify_full_100pt:false,production_release_allowed:false,
  reason,...detail
});
export function inspectActualJraScoringProtocol(snapshot){
  const p=snapshot?.payload,c=p?.content,ranking=c?.ranking,
    comparison=ranking?.content_evaluation_contract;
  if(snapshot?.classification!=='READONLY_CURRENT_OPERATOR_PROTOCOL_DOCUMENT_NOT_NUMERIC_GENERATOR'||
    p?.protocol_key!=='JRA_MAIN'||p?.is_active!==true||
    p.version!=='JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023'||
    ranking?.candidate_function!=='public.jra_live_base_candidate_v1'||
    ranking?.validated_core!=='BASE_CORE_0.1')
    return no('ACTIVE_PROTOCOL_VERSION_OR_VALIDATED_BASE_MISMATCH');
  if(!comparison||comparison.base_core!=='BASE_CORE_0.1_UNCHANGED'||
    comparison.when_optional_unavailable!=='CONTINUE_BASE_CORE_NO_PENALTY'||
    !comparison.rank_effect?.includes('Manual whole-field ranking'))
    return no('PROTOCOL_MANUAL_OPTIONAL_RULE_CHANGED');
  // The policy explicitly supplies qualitative selection prose, and no
  // authoritative per-feature numeric weights, rule hashes, or scoring map.
  // This function deliberately cannot infer them from historical outcomes.
  const keys=[];
  const walk=(obj,prefix='')=>{
    if(!obj||typeof obj!=='object')return;
    for(const [k,v] of Object.entries(obj)){
      keys.push(prefix+k);
      if(v&&typeof v==='object')walk(v,prefix+k+'.');
    }
  };
  walk(c);
  const possibleNumericRules=keys.filter(k=>
    /(?:numeric_weights|factor_weights|coefficients|per_factor_points|score_formula|score_generator)/i.test(k));
  if(possibleNumericRules.length)
    return no('POTENTIAL_SCORER_RULES_REQUIRE_INDEPENDENT_VALIDATION',{
      possible_numeric_rule_fields:possibleNumericRules});
  return no('VALIDATED_BASE_PLUS_OPTIONAL_MANUAL_OVERLAY_NO_FIXED_FACTOR_WEIGHTS',{
    protocol_version:p.version,base_model:ranking.candidate_model_version,
    manual_rank_changes_permitted:true,content_sources_optional:true,
    approved_scoring_coefficients_found:false,
    full_field_source_authentication_proven:false
  });
}
export function classifySubmittedJraScoring({
 protocolSnapshot,submittedAudit,serverAuthority
}={}){
  const p=inspectActualJraScoringProtocol(protocolSnapshot);
  if(p.reason!=='VALIDATED_BASE_PLUS_OPTIONAL_MANUAL_OVERLAY_NO_FIXED_FACTOR_WEIGHTS')
    return {...p,mode:'PROTOCOL_INVALID'};
  const a=submittedAudit||{};
  const method=typeof a.score_method==='string'&&a.score_method.trim()?
    a.score_method.trim():null;
  const hasHistoricalDepth=Object.hasOwn(a,'full_depth_comparison');
  const s=serverAuthority||{};
  // All four conditions are server-bound and independent of submitted audit.
  const source=s.originalIssuerAuthenticated===true;
  const claim=s.sameImmutableClaimContext===true;
  const complete=s.fullRunnerAndFactorCoverage===true;
  const approved=s.operatorApprovedNumericScorer===true&&
    typeof s.operatorScorerPolicySha256==='string'&&
    /^[0-9a-f]{64}$/.test(s.operatorScorerPolicySha256);
  if(source&&claim&&complete&&approved)
    return {mode:'ELIGIBLE_FOR_SEPARATE_FULL_SCORE_REPLAY',
      can_certify_full_100pt:false,production_release_allowed:false,
      reason:'READY_FOR_INDEPENDENT_REPLAY_NOT_AUTHORIZED_BY_FLAGS_ALONE',
      requires_signed_packet_replay:true};
  // A submitted audit cannot assert its own scoring authority. Without the
  // separately generated signed replay, ALL manual/deep claims stay unproven.
  return {mode:'FULL_SCORE_UNPROVEN',can_certify_full_100pt:false,
    production_release_allowed:false,
    reason:method?'DECLARED_METHOD_IS_NOT_DETERMINISTIC_PROOF':'SCORE_METHOD_MISSING',
    method_declared:method!==null,
    legacy_depth_field_present:hasHistoricalDepth,
    deficiencies:{
      source_original_unverified:!source,claim_snapshot_unverified:!claim,
      full_field_proof_unverified:!complete,
      approved_scorer_missing:!approved
    },
    validated_baseline_available:true,
    operator_manual_overlay_not_numeric_verified:true};
}
