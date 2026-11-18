/**
 * JRA official CLAIM -> actual draft full-field rank challenger.
 *
 * The first-pass BASE_CORE candidate ranking is not the saved JRA0.4 order.
 * Only an explicit second-pass full-field draft is eligible for comparison.
 * This adapter is pure: never claims, saves, reads results or changes FROZEN.
 */
import {buildRelativeAbilityRankProposal} from './relative-ability-rank-proposal.mjs';

export function buildJraClaimedDraftPreview({claimedContext,baseline,observedAt}={}) {
 const data=claimedContext;
 const raceData=data?.race?.field_payload?.race??{};
 const result=buildRelativeAbilityRankProposal({
   race:{race_date:data?.race?.race_date,post_time:data?.race?.post_time,
     observation_at:observedAt,circuit:'JRA',
     track:data?.race?.track,race_name:data?.race?.race_name,
     class_name:raceData.class_name,surface:raceData.surface,
     distance:raceData.distance},
   baseline,comparison:data?.relative_condition_evidence
 });
 const sourceBaseline=Array.isArray(data?.candidates)?data.candidates:[];
 const validSource=Array.isArray(baseline)&&sourceBaseline.length===baseline.length &&
   sourceBaseline.every(c=>Number.isInteger(c?.horse_no)&&Number.isInteger(c?.base_rank)
     &&baseline.some(h=>h?.horse_no===c.horse_no));
 const differences=validSource?sourceBaseline.filter(c=>
   baseline.find(h=>h.horse_no===c.horse_no)?.rank!==c.base_rank)
   .map(c=>({horse_no:c.horse_no,
     base_core_rank:c.base_rank,draft_rank:baseline.find(h=>h.horse_no===c.horse_no).rank}))
   :[];
 return {
   ...result,
   baseline_kind:'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT',
   base_core_reference_only:true,
   base_core_draft_delta_known:validSource,
   base_core_draft_differences:result.candidate_order?differences:[],
   draft_runners_verified:result.candidate_order!==null,
   official_saved:false,save_authorized:false,
   application:'RANK_PROPOSAL_PRE_FROZEN_NOT_AN_OFFICIAL_PREDICTION',
   production_protocol_unmodified:true
 };
}
