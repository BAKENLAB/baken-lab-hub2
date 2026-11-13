/** Strict draft-only inputs for optional pre-FROZEN paired audit.
 * Never reads odds or results, never calls a save or network. It only builds
 * a candidate from a VERIFIED official save payload after core validation.
 */
import {buildJraClaimedDraftPreview} from './jra-relative-draft-adapter.mjs';
import {buildRelativeAbilityRankProposal} from './relative-ability-rank-proposal.mjs';
import {buildLocalV17IndependentShadow} from './local-v17-full-field-independent-shadow.mjs';
const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const clean=s=>typeof s==='string'?s.normalize('NFKC').replace(/\s+/g,'').trim():'';
export function extractOfficialSaveDraft(payload,circuit){
 if(!['JRA','LOCAL'].includes(circuit)||!Array.isArray(payload?.runners))return null;
 const all=payload.runners;
 const legacy=circuit==='JRA'&&all.every(r=>r&&r.status===undefined);
 const active=all.filter(r=>r?.status==='ACTIVE'||legacy);
 if(active.length<6||active.length>20)return null;
 if(all.some(r=>r?.status===undefined&&!legacy))return null;
 const ids=new Set(),ranks=new Set();
 for(const r of active){
  if(!int(r?.horse_no,1,24)||!clean(r?.horse_name)||!int(r?.rank,1,active.length)||
    ids.has(r.horse_no)||ranks.has(r.rank))return null;
  ids.add(r.horse_no);ranks.add(r.rank);
 }
 if(ranks.size!==active.length)return null;
 return active.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.rank}))
   .sort((a,b)=>a.rank-b.rank);
}
const valid=result=>result&&['REORDERED','UNCHANGED'].includes(result.status)
 && result.production_rank_effect===false
 && result.target_result_used===false && result.market_used===false
 && result.candidate_order?.length>=6;
const enoughTime=(post,now)=>Number.isFinite(Date.parse(post))&&Number.isFinite(Date.parse(now))&&
 Date.parse(post)-Date.parse(now)>4*60_000;
export function buildOptionalSaveJraShadow({context,payload,now}={}){
 const baseline=extractOfficialSaveDraft(payload,'JRA');
 if(!baseline||!enoughTime(context?.race?.post_time,now))return null;
 const preview=buildJraClaimedDraftPreview({claimedContext:context,baseline,observedAt:now});
 if(!valid(preview)||preview.draft_runners_verified!==true)return null;
 return {baseline,preview};
}
/**
 * Distinguish observed official corner positions in a server-validated
 * pre-CLAIM snapshot from missing or untrusted evidence. This helper only
 * chooses the RESEARCH input; it never touches production ranks, saves or
 * raw FROZEN payloads. Unknown/invalid packet => normal verified evidence.
 */
export function selectVerifiedLocalResearchComparison(context){
 const fallback=context?.relative_condition_evidence??null;
 const shadow=context?.official_corner_shadow;
 const extra=shadow?.research_relative_condition_evidence;
 if(shadow?.use_for_rank!==false||shadow?.use_for_save_gate!==false||
    shadow?.status!=='DESCRIPTIVE_SHADOW_ONLY'||
    !int(shadow?.applied_prior_runs,1,100)||
    !extra||extra.status!=='READY'||
    extra.corner_evidence_scope!=='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY'||
    extra.corner_enriched_prior_runs!==shadow.applied_prior_runs||
    extra.target_date!==context?.race?.race_date||
    extra.runner_count!==context?.runners?.length||
    extra.market_used!==false||extra.target_result_used!==false||
    extra.rank_effect!==false||extra.score_effect!==false||
    extra.data_scope!=='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY')
  return fallback;
 return extra;
}
/**
 * Counterfactual integrity: prove all scorer-relevant historical facts are
 * identical between the normal and corner-enriched source EXCEPT the two
 * passing-order fields. No class/finish/condition/identity changes qualify.
 */
function verifyCornerOnlySupportChange(normal,enhanced){
 const left=normal?.runner_evidence,right=enhanced?.runner_evidence;
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)
  return {status:'NON_CORNER_INPUT_MISMATCH',changed_runs:0};
 const byNo=new Map(left.map(x=>[x?.horse_no,x]));
 if(byNo.size!==left.length)return {status:'NON_CORNER_INPUT_MISMATCH',changed_runs:0};
 const signature=run=>{
  const {early_pos,final_turn_pos,...rest}=run;
  return JSON.stringify(rest);
 };
 const validCorner=(before,after)=>before===after||
   (before==null&&int(after,1,24));
 let changed=0;
 for(const row of right){
  const prior=byNo.get(row?.horse_no);
  if(!prior||prior.horse_name!==row.horse_name||
     !Array.isArray(prior.supporting_runs)||!Array.isArray(row.supporting_runs)||
     prior.supporting_runs.length!==row.supporting_runs.length)
   return {status:'NON_CORNER_INPUT_MISMATCH',changed_runs:0};
  for(let i=0;i<row.supporting_runs.length;i++){
   const a=prior.supporting_runs[i],b=row.supporting_runs[i];
   if(!a||!b||signature(a)!==signature(b)||
      !validCorner(a.early_pos,b.early_pos)||
      !validCorner(a.final_turn_pos,b.final_turn_pos))
    return {status:'NON_CORNER_INPUT_MISMATCH',changed_runs:0};
   if(a.early_pos!==b.early_pos||a.final_turn_pos!==b.final_turn_pos)changed++;
  }
 }
 return {status:'MATCHED_SUPPORTING_RUNS',changed_runs:changed};
}
/**
 * Independent LOCAL1.7 candidate is scored from the same verified CLAIM
 * history, but WITHOUT the original rank or score. Those are inspected only
 * AFTER the pure full-field scorer has already returned its own order.
 *
 * Compact pre-FROZEN paired audit: no odds/results, no official save or
 * promotion, and no silent conversion of insufficient evidence into ranking.
 */
function buildLocalV17FullFieldSidecar({context,comparison,baseline,now}){
 const race=context?.race;
 const proof=buildLocalV17IndependentShadow({
  race:{circuit:'LOCAL',race_date:race?.race_date,track:race?.track,
   race_no:race?.race_no,race_name:race?.race_name,
   class_name:race?.conditions?.class_name,
   surface:race?.conditions?.surface,distance:race?.conditions?.distance,
   observation_at:now,post_time:race?.post_time},
  comparison
 });
 const abstain=(reason)=>({
  status:'ABSTAINED',reason,model:'LOCAL_1_7_INDEPENDENT_SHADOW',
  eligible_for_official_accuracy_claim:false,
  production_rank_effect:false,production_score_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false
 });
 if(proof?.status!=='READY_FOR_PROSPECTIVE_PAIRED_TEST')
  return abstain(proof?.reason??'NO_FULL_FIELD_INDEPENDENT_PROOF');
 const byNo=new Map(baseline.map(h=>[h.horse_no,h]));
 if(proof.all_runners_checked!==baseline.length||
    proof.runners.length!==baseline.length||
    proof.top5.length!==5||byNo.size!==baseline.length||
    proof.runners.some(h=>!byNo.has(h.horse_no)||
      clean(byNo.get(h.horse_no).horse_name)!==clean(h.horse_name)||
      !int(h.rank,1,baseline.length)||!int(h.score,0,100))||
    new Set(proof.runners.map(h=>h.horse_no)).size!==baseline.length||
    new Set(proof.top5).size!==5||
    proof.runners.slice(0,5).some((h,i)=>h.horse_no!==proof.top5[i])||
    proof.production_rank_effect!==false||proof.frozen_modified!==false||
    proof.market_used!==false||proof.target_result_used!==false)
  return abstain('INDEPENDENT_FIELD_IDENTITY_OR_SAFETY_MISMATCH');
 const oldTop=baseline.slice(0,5).map(x=>x.horse_no),newTop=[...proof.top5];
 const oldSet=new Set(oldTop),newSet=new Set(newTop);
 return {
  status:'FULL_FIELD_PAIRED_RESEARCH_ONLY',
  model:proof.model,version:proof.version,rank_source:'INDEPENDENT_SCORE_NO_BASELINE_RANK_INPUT',
  all_runners_checked:proof.all_runners_checked,
  old_top5:oldTop,shadow_top5:newTop,
  changed_top5_membership:newTop.some(x=>!oldSet.has(x)),
  changed_full_field_order:baseline.some((x,i)=>proof.runners[i].horse_no!==x.horse_no),
  newly_selected:newTop.filter(x=>!oldSet.has(x)),
  lost_from_top5:oldTop.filter(x=>!newSet.has(x)),
  // Give users an inspectable reason why the new independent rank moved,
  // not just an opaque 100pt number or a blanket "過信禁物" warning.
  // No odds, payouts, target results, or raw scraped history are propagated.
  score_table:proof.runners.map(x=>{
   const audit=proof.ability_evidence_audit.find(a=>a.horse_no===x.horse_no);
   return {horse_no:x.horse_no,rank:x.rank,
    research_score_100:x.score,confidence:x.confidence,
    historical_runs_checked:audit?.evidence_runs_checked??null,
    historical_runs_used:audit?.evidence_runs_used??null,
    top5_positive_runs:audit?.runs?.filter(z=>z.contextual_bonus_applied).length??null,
    same_class_top5_runs:audit?.runs?.filter(z=>
      z.contextual_bonus_applied&&z.context_band==='SAME_OFFICIAL_CLASS').length??null,
    same_condition_deep_finishes:audit?.runs?.filter(z=>
      z.same_condition_poor_offset>0).length??null,
    strongest_evidence_refs:audit?.score_contributions?.slice(0,2).map(z=>z.ref)??[]
   };
  }),
  historic_corner_source:comparison?.corner_evidence_scope===
   'VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY'?
    'INDEPENDENT_VERIFIED_PRECLAIM_CORNER_SNAPSHOT':
    'NORMAL_CLAIM_HISTORY_NO_SEPARATE_CORNER_CERTIFICATION',
  tie_count:proof.tied_score_runner_count,
  eye_research_candidate:proof.eye_candidate?.horse_no??null,
  verified_history_inputs:'ALREADY_VERIFIED_LOCAL_CLAIMED_HISTORY_ONLY',
  eligible_for_official_accuracy_claim:false,
  production_rank_effect:false,production_score_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false
 };
}

export function buildOptionalSaveLocalShadow({context,payload,now}={}){
 const baseline=extractOfficialSaveDraft(payload,'LOCAL');
 const race=context?.race;
 if(!baseline||!enoughTime(race?.post_time,now))return null;
 const selectedComparison=selectVerifiedLocalResearchComparison(context);
 const verifiedCorner=context?.official_corner_shadow;
 const sourceIsCorner=selectedComparison!==null&&selectedComparison!==undefined&&
  selectedComparison===verifiedCorner?.research_relative_condition_evidence&&
  verifiedCorner?.status==='DESCRIPTIVE_SHADOW_ONLY';
 const result=buildRelativeAbilityRankProposal({
  race:{race_date:race?.race_date,post_time:race?.post_time,
   observation_at:now,circuit:'LOCAL',track:race?.track,
   race_name:race?.race_name,class_name:race?.conditions?.class_name,
   surface:race?.conditions?.surface,distance:race?.conditions?.distance},
  baseline,comparison:selectedComparison
 });
 if(!valid(result)||!['REORDERED','UNCHANGED'].includes(result.status))return null;
 // Direct A/B counterfactual, holding the SAME official rank draft fixed.
 // A corner source is not proof the corners CHANGED any decision. Compare
 // normal history with the enriched verified pre-CLAIM corner lane.
 let cornerImpact={status:sourceIsCorner?'NORMAL_HISTORY_NOT_COMPARABLE':'NO_VERIFIED_PRECLAIM_CORNERS',
  normal_top5:null,enriched_top5:result.top5??null,changed_top5:null,
  changed_any_rank:null,new_top5_horse_numbers:[],lost_top5_horse_numbers:[]};
 if(sourceIsCorner){
  const plain=buildRelativeAbilityRankProposal({
   race:{race_date:race?.race_date,post_time:race?.post_time,
    observation_at:now,circuit:'LOCAL',track:race?.track,
    race_name:race?.race_name,class_name:race?.conditions?.class_name,
    surface:race?.conditions?.surface,distance:race?.conditions?.distance},
   baseline,comparison:context?.relative_condition_evidence
  });
  const integrity=verifyCornerOnlySupportChange(
   context?.relative_condition_evidence,selectedComparison);
  if(context?.relative_condition_evidence &&
     integrity.status==='NON_CORNER_INPUT_MISMATCH'){
   cornerImpact={...cornerImpact,status:'NON_CORNER_EVIDENCE_CHANGED'};
  }else if(valid(plain)&&['REORDERED','UNCHANGED'].includes(plain.status)){
   const oldTop=plain.top5??[],newTop=result.top5??[];
   const oldIds=new Set(oldTop),newIds=new Set(newTop);
   cornerImpact={status:integrity.changed_runs>0?
     'VERIFIED_SAME_DRAFT_AB_COMPARISON':'CORNER_SOURCE_NO_MATCHED_SUPPORTING_RUN_CHANGE',
    verified_changed_supporting_runs:integrity.changed_runs,
    normal_top5:[...oldTop],enriched_top5:[...newTop],
    changed_top5:oldTop.some((x,i)=>newTop[i]!==x),
    changed_any_rank:(plain.candidate_order??[]).some((x,i)=>result.candidate_order?.[i]!==x),
    new_top5_horse_numbers:newTop.filter(x=>!oldIds.has(x)),
    lost_top5_horse_numbers:oldTop.filter(x=>!newIds.has(x))};
  }
 }
 const independentV17=buildLocalV17FullFieldSidecar({
  context,comparison:selectedComparison,baseline,now
 });
 return {baseline,preview:{...result,
  independent_full_field_v17:independentV17,
  corner_rank_counterfactual:cornerImpact,
  // Do not claim official pre-CLAIM corner use when only ordinary history
  // was available. This records WHICH lane supplied the shadow evaluator.
  observed_corner_source:sourceIsCorner?
   'VERIFIED_PRECLAIM_CORNER_SHADOW':'NORMAL_VERIFIED_CLAIM_HISTORY_ONLY',
  verified_preclaim_corner_applied_runs:sourceIsCorner?
   verifiedCorner.applied_prior_runs:0,
  baseline_kind:'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT',
  draft_runners_verified:true,official_saved:false,save_authorized:false,
  application:'AUTO_OPTIONAL_SAME_TRANSACTION_CAPTURE'}};
}
