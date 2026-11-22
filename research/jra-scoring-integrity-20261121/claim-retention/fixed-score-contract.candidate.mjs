// Research-only gate: compare a caller's declared score against a distinct,
// server-owned deterministic scoring packet. It does not define/approve weights,
// recover historical decisions, authenticate JRA original bytes, or deploy.
// No packet => reject. Do not synthesize packet values from FROZEN or outcomes.
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const integer=x=>typeof x==='number'&&Number.isSafeInteger(x);
const unique=a=>new Set(a).size===a.length;
const key=x=>JSON.stringify([x.kind,x.source_ref]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clean=x=>typeof x==='string'&&x.trim().length>0;
const fail=(reason,details={})=>({ok:false,reason,formal_scoring_allowed:false,official_original_verified:false,...details});

export function checkFixedScoreContract({payload,selected}={}){
  const contract=selected?.serverPinnedContract;
  if(!contract||!clean(contract.policy_id)||!sha(contract.policy_sha256)||
      contract.approved_by_operator!==true||contract.scorer_version!==contract.policy_id)
    return fail('TRUSTED_FIXED_SCORE_CONTRACT_MISSING');
  // serverEvaluated must come from a controlled, separate scorer running with
  // the exact CLAIM snapshot and policy. Never build it from submitted payload.
  const packet=selected?.serverEvaluated;
  if(!packet||packet.policy_id!==contract.policy_id||
     packet.policy_sha256!==contract.policy_sha256||
     !sha(packet.context_sha256)||packet.context_sha256!==selected.context_sha256||
     !Array.isArray(packet.runners)||!Array.isArray(payload?.runners)||
     !Array.isArray(payload?.audit?.runner_history_checked))
    return fail('SERVER_REPLAY_PACKET_MISSING_OR_UNBOUND');
  if(packet.runners.length!==payload.runners.length ||
     payload.audit.runner_history_checked.length!==packet.runners.length)
    return fail('FULL_FIELD_REPLAY_COVERAGE');
  const ids=packet.runners.map(x=>x.horse_no);
  if(!unique(ids)||!ids.every(x=>integer(x)&&x>=1&&x<=24))
    return fail('REPLAY_RUNNER_IDENTITIES_INVALID');
  const checks=[];
  for(const computed of packet.runners){
    const runner=payload.runners.filter(x=>x.horse_no===computed.horse_no);
    const review=payload.audit.runner_history_checked.filter(x=>x.horse_no===computed.horse_no);
    if(runner.length!==1||review.length!==1||!Array.isArray(computed.factors)||
       !Array.isArray(review[0].evidence_effects))
      return fail('REPLAY_RUNNER_OR_REVIEW_MISSING',{horse_no:computed.horse_no});
    if(!integer(computed.base_score)||computed.base_score<0||computed.base_score>100||
       !integer(review[0].base_score)||!integer(review[0].score_after)||
       !integer(runner[0].score))
      return fail('REPLAY_NUMERIC_INPUT_INVALID',{horse_no:computed.horse_no});
    // No fallback CLAIMED_CONTEXT_RUN surrogate may impersonate an archived original.
    // Every factor must carry its independently checked original-body hash and
    // match the exact official run and horse ID in the selected snapshot.
    const hashes=new Set();
    for(const factor of computed.factors){
      if(!clean(factor.kind)||!clean(factor.source_ref)||!integer(factor.points)||
        !sha(factor.original_sha256)||!clean(factor.run_id)||
        !clean(factor.horse_id)||!sha(factor.rule_sha256)||
        factor.rule_sha256!==contract.policy_sha256||
        factor.verified_by_source_reader!==true)
        return fail('FACTOR_ORIGINAL_AND_RULE_PROOF_MISSING',{horse_no:computed.horse_no});
      if(factor.source_ref.startsWith('CLAIMED_CONTEXT_RUN:'))
        return fail('SURROGATE_CLAIMED_CONTEXT_REF_NOT_IMMUTABLE',{horse_no:computed.horse_no});
      const grounded=selected.verifiedSourceFacts?.filter(x=>
        x.horse_no===computed.horse_no &&
        x.horse_id===factor.horse_id &&
        x.run_id===factor.run_id &&
        x.source_ref===factor.source_ref &&
        x.original_sha256===factor.original_sha256 &&
        x.verified_by_official_reader===true);
      if(grounded?.length!==1)
        return fail('FACTOR_NOT_BOUND_TO_SELECTED_OFFICIAL_RUN',{horse_no:computed.horse_no});
      const id=key(factor);
      if(hashes.has(id))return fail('DUPLICATE_REPLAY_FACTOR',{horse_no:computed.horse_no});
      hashes.add(id);
    }
    const declared=review[0].evidence_effects.map(x=>[x.kind,x.source_ref,x.points]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const proven=computed.factors.map(x=>[x.kind,x.source_ref,x.points]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if(!same(declared,proven)||review[0].base_score!==computed.base_score)
      return fail('SUBMITTED_FACT_POINTS_NOT_REPRODUCED',{horse_no:computed.horse_no});
    const expected=Math.max(0,Math.min(100,computed.base_score+
      computed.factors.reduce((n,x)=>n+x.points,0)));
    if(!integer(expected)||expected!==review[0].score_after)
      return fail('BASE_AND_FACT_POINTS_NOT_REPRODUCED',{horse_no:computed.horse_no});
    // This check covers the unbridged core only. A separately approved Eval
    // bridge must be verified by the existing independent ledger check.
    if(runner[0].score!==expected && selected.separateBridgeValidated!==true)
      return fail('FINAL_SCORE_NOT_REPRODUCED_OR_BRIDGE_UNVERIFIED',{horse_no:computed.horse_no});
    checks.push({horse_no:computed.horse_no,score_before_bridge:expected,score_after_submission:runner[0].score});
  }
  // A conforming packet only proves that two score records agree. It does
  // NOT by itself prove the original bytes, policy approval, CLAIM or scorer
  // are authentic; those independent trust checks remain gating blockers.
  return {ok:true,reason:'DECLARED_SCORE_MATCHES_SEPARATE_SERVER_PACKET_ONLY',
    formal_scoring_allowed:false,official_original_verified:false,
    source_to_score_fully_authenticated:false,checks};
}
