// ISOLATED RESEARCH ONLY: proposed alternative explicit BASE_CORE_ONLY mode.
// It does NOT bypass or weaken the production full-depth save guard and DOES
// NOT save/CLAIM. The actual active JRA0.4 operator protocol says optional
// evidence may be unavailable without penalizing BASE_CORE. The current v42
// full-depth gate nevertheless requires scored nonzero historical factors.
// This module shows how a separately reviewed baseline-only path could
// distinguish genuine base rank from unproven strengthened 100-point scores.
import {calculateRecoveredBase30_38} from './recovered-base30-38-readonly.mjs';
const fail=(reason,detail={})=>({ok:false,reason,...detail,
  official_save_allowed:false,production_release_allowed:false,
  formal_100pt_complete:false,optional_content_scored:false});
const isText=x=>typeof x==='string'&&x.trim().length>0;
const exactDate=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
  !Number.isNaN(Date.parse(x+'T00:00:00Z'));
export function inspectResearchBaselineOnly({context,protocolVersion,nowIso}={}){
 if(protocolVersion!=='JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023')
   return fail('OPERATOR_PROTOCOL_NOT_PINNED');
 const race=context?.race,field=race?.field_payload?.runners,
  c=context?.candidates;
 if(!race||!exactDate(race.race_date)||!isText(race.track)||
   !Number.isInteger(race.race_no)||!Array.isArray(field)||
   !Array.isArray(c)||c.length<6||c.length>24||
   race.field_payload?.race?.race_type!=='平地')
   return fail('NO_ELIGIBLE_VERIFIED_FLAT_FIELD');
 const post=Date.parse(race.post_time),now=Date.parse(nowIso);
 if(!Number.isFinite(post)||!Number.isFinite(now)||now>=post-180000)
   return fail('OUTSIDE_PREPOST_SAFETY_WINDOW');
 const active=field.filter(x=>x.status==='ACTIVE');
 if(active.length!==c.length||active.length!==field.length)
   return fail('ACTIVE_FIELD_MISMATCH');
 const candidateByNo=new Map(),activeByNo=new Map();
 for(const a of active){
  if(!Number.isInteger(a.horse_no)||!isText(a.horse_name)||
    activeByNo.has(a.horse_no))return fail('DUPLICATE_ACTIVE_ENTRY');
  activeByNo.set(a.horse_no,a);
 }
 const preview=[];
 for(const v of c){
  if(!Number.isInteger(v.horse_no)||candidateByNo.has(v.horse_no)||
     !activeByNo.has(v.horse_no)||
     activeByNo.get(v.horse_no).horse_name!==v.horse_name)
    return fail('CANDIDATE_IDENTITY_MISMATCH');
  candidateByNo.set(v.horse_no,v);
  if(v.data_status!=='RANKED'||v.model_version!=='JRA_BASE_CORE_0.1_AB')
    return fail('UNSUPPORTED_BASE_CORE_SEGMENT',{horse_no:v.horse_no});
  if(!Number.isInteger(v.base_rank)||v.base_rank<1||v.base_rank>c.length)
    return fail('BASE_CORE_RANK_INVALID',{horse_no:v.horse_no});
  const rate=typeof v.base_rate==='number'?String(v.base_rate):v.base_rate;
  let provisional;
  try{provisional=calculateRecoveredBase30_38(rate);}
  catch{return fail('BASE_CORE_RATE_MISSING',{horse_no:v.horse_no});}
  preview.push({horse_no:v.horse_no,horse_name:v.horse_name,
    base_rank:v.base_rank,base_rate:rate,
    observed_baseline_display_score:provisional,
    full_100pt_score:null,rank_after_unsupported_manual_overlay:null,
    source_verification_level:'BASE_CORE_CANDIDATE_ONLY',
    source_full_depth_authenticated:false,
    evidence_effects:[],eye:null});
 }
 const order=preview.slice().sort((a,b)=>a.base_rank-b.base_rank);
 if(order.some((r,i)=>r.base_rank!==i+1))return fail('BASE_CORE_RANK_DUPLICATED');
 return {ok:true,reason:'RESEARCH_BASELINE_PREVIEW_NO_FULL_DEPTH_CERTIFICATION',
  classification:'BASE_CORE_ONLY_UNENRICHED',
  preview_runners:order,preview_top5:order.slice(0,5).map(r=>r.horse_no),
  candidate_count:order.length,eye:null,
  baseline_display_formula:'round(30+38*base_rate) [historically observed; not approved full 100pt]',
  official_original_issuer_verified:false,
  authorized_claim_bound:false,certified_asof_context:false,
  original_signer_authenticated:false,
  all_runner_numeric_factor_proofs:false,
  full_100pt_complete:false,optional_content_scored:false,
  official_save_allowed:false,production_release_allowed:false,
  cannot_be_passed_to_existing_full_depth_guard:true,
  separate_mode_requires_explicit_operator_approval:true
 };
}
