/** Strict draft-only inputs for optional pre-FROZEN paired audit.
 * Never reads odds or results, never calls a save or network. It only builds
 * a candidate from a VERIFIED official save payload after core validation.
 */
import {buildJraClaimedDraftPreview} from './jra-relative-draft-adapter.mjs';
import {buildRelativeAbilityRankProposal} from './relative-ability-rank-proposal.mjs';
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
 return {baseline,preview:{...result,
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
