import {buildOptionalSaveJraShadow,extractOfficialSaveDraft} from "./optional-atomic-shadow-save.mjs";
import {buildRelativeAbilityRankProposal} from "./relative-ability-rank-proposal.mjs";
import {buildJraClaimedDraftPreview} from "./jra-relative-draft-adapter.mjs";
import {buildEvalTransferForJraClaim} from "./eval-course-transfer-live.mjs";
import {PRIVATE_EVAL_PRIORITIES} from "./eval-course-private-data.mjs";
import {buildJraVerifiedEvidenceRankBridge,verifyJraBridgeAlreadyApplied} from "./jra-verified-evidence-rank-bridge.mjs";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@^2.0.0";
import {pipeline} from "npm:@supabase/middleware@1";
import {withOAuthProtectedResource,withSupabase} from "npm:@supabase/server@1";
import {createClient} from "npm:@supabase/supabase-js@2";
import {z} from "npm:zod@^4.3.6";
import {load} from "npm:cheerio@1.0.0";

const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const err=(e:unknown)=>e instanceof Error?e.message:"UNAVAILABLE";
Deno.serve(pipeline([withOAuthProtectedResource(),withSupabase({auth:"user",errors:{detailed:false}})],async(req,{supabase})=>{
 const handler=createMcpHandler(()=>{const s=new McpServer({name:"BAKEN JRA Claimed Context",version:"0.1.0"});
 const admin=()=>{const u=Deno.env.get("SUPABASE_URL")??"",k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";if(!u||!k)throw Error("SERVER_CONFIGURATION_ERROR");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})};
 const auth=async()=>{const a=Deno.env.get("LOCAL_MCP_ALLOWED_USER_ID")??"";if(!uuid(a))throw Error("AUTHORIZATION_NOT_CONFIGURED");const {data:{user},error}=await supabase.auth.getUser();if(error||!user||user.id!==a)throw Error("FORBIDDEN")};

 // Only official CLAIM context is accepted; source limit & rights remain fixed.
 const loadEvalForClaim=async(data:any,c:any)=>{
   const rc=data?.race?.field_payload?.race??{};
   const turn=['東京','新潟','中京'].includes(data?.race?.track)?'左':'右';
   const key=String(data?.race?.track??'')+'|'+String(rc?.surface??'')+
     '|'+String(rc?.distance??'')+'|'+turn;
   let cohorts=[];
   if(PRIVATE_EVAL_PRIORITIES?.scope==='NORMAL_ALL_1942'&&
      data?.stage==='AWAITING_JRA_FULL_DEPTH_COMPARISON'){
     const {data:rows,error}=await c.from('lab_course_jra_transfer_v1')
       .select('source_course_key,target_course_key,runners,top3_lift,reliability,condition_precision,training_to')
       .eq('target_course_key',key).limit(200);
     if(!error&&Array.isArray(rows))cohorts=rows;
   }
   return buildEvalTransferForJraClaim({
     context:data,snapshot:PRIVATE_EVAL_PRIORITIES,
     ownedTransferStats:cohorts,observedAt:new Date().toISOString()
   });
 };
 s.registerTool("jra_claimed_context",{description:"Get verified JRA CLAIM context with live_ability_rank_input for the real pre-race JRA0.4 full-field decision. Review all ranks (not just 5/6) and use official historical proof to update official 100-point ranks and TOP5 when justified BEFORE save. Never use odds, target result, or rewrite FROZEN. Read-only.",inputSchema:z.object({job_id:z.string().uuid()}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({job_id})=>{try{await auth();const c=admin();const {data,error}=await c.rpc("jra_claimed_context",{p_job_id:job_id});if(error||!data)throw Error("CONTEXT_UNAVAILABLE");
 // Post-CLAIM, before save: generate an explicit alternative ranking, never
 // change the official baseline or bypass the existing save gate.
 try {
   const conditions=data?.race?.field_payload?.race??{};
   const baseline=Array.isArray(data.candidates)?
     data.candidates.map((r:any)=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.base_rank})):[];
   const suggested=buildRelativeAbilityRankProposal({
     race:{race_date:data.race.race_date,post_time:data.race.post_time,
       observation_at:new Date().toISOString(),circuit:"JRA",
       class_name:conditions.class_name,surface:conditions.surface,
       distance:conditions.distance},
     baseline,comparison:data.relative_condition_evidence
   });
   data.relative_rank_shadow={
     ...suggested,
     application:"RANK_PROPOSAL_ONLY_NOT_FROZEN",
     production_protocol_unmodified:true,
     baseline_kind:"BASE_CORE_CANDIDATE_NOT_OFFICIAL_FINAL_RANK"
   };
   // Real 2026-11-14 JRA0.4 pre-freeze ranking INPUT: not just a shadow.
   // Official save, job/lease and immutable FROZEN remain untouched.
   const candidate=suggested.candidate_order;
   const ids=new Set(baseline.map((x:any)=>x.horse_no));
   const validWholeField=["REORDERED","UNCHANGED"].includes(suggested.status)&&
     suggested.market_used===false&&suggested.target_result_used===false&&
     suggested.frozen_modified===false&&Array.isArray(candidate)&&
     candidate.length===baseline.length&&baseline.length>=6&&
     ids.size===baseline.length&&
     candidate.every((no:any)=>Number.isInteger(no)&&ids.has(no))&&
     new Set(candidate).size===ids.size;
   data.live_ability_rank_input=validWholeField?{
     status:"READY_FOR_OFFICIAL_RANK_DECISION",
     effective_mode:"JRA_0_4_WITH_LIVE_FULL_FIELD_EVIDENCE_20261114",
     actionable_in_real_prediction:true,
     candidate_full_order:[...candidate],
     candidate_top5:candidate.slice(0,5),
     rank_changes:suggested.rank_deltas??[],
     rank_evidence_by_horse:suggested.proof_by_horse??[],
     original_base_core_order:baseline.slice().sort((a:any,b:any)=>a.rank-b.rank).map((x:any)=>x.horse_no),
     baseline_kind:"BASE_CORE_NOT_FINAL_100_POINT_RANK",
     action:"USE_BEFORE_NEW_OFFICIAL_0_4_FROZEN",
     instruction:"COMPARE_ALL_ACTIVE_HORSES_NOT_ONLY_RANK5_6;USE_VERIFIED_PRE_RACE_CORNERS_LAPS_MARGINS_CLASS_AND_OPPONENTS_WHERE_AVAILABLE;CHANGE_FINAL_100_POINT_RANK_TOP5_WHEN_VERIFIED_PROOF_SUPPORTS_IT;NO_ODDS_OR_TARGET_RESULTS",
     class_opponent_pace_causality:"REQUIRES_INDEPENDENT_VERIFIED_REVIEW",
     save_authorized:false,frozen_modified:false,
     market_used:false,target_result_used:false
   }:{
     status:"FALLBACK_TO_JRA_0_4",reason:suggested.status??"UNVERIFIED",
     actionable_in_real_prediction:false,save_authorized:false,
     frozen_modified:false,market_used:false,target_result_used:false
   };
 } catch {
   data.relative_rank_shadow={status:"OPTIONAL_RANK_ENGINE_FAILED",
     production_rank_effect:false,market_used:false,target_result_used:false};
   data.live_ability_rank_input={status:"FALLBACK_TO_JRA_0_4",
     reason:"OPTIONAL_LIVE_RANK_INPUT_UNAVAILABLE",
     actionable_in_real_prediction:false,save_authorized:false};
 }
 // ALL 1,942 NORMAL Eval JRA course links (PRIVATE grade/rank only)
 // plus independently trained JRA cohorts. Full 4-run contents are cross-
 // linked one-to-one to official pace/corners/final3f/margins before ranking.
 // This feeds the real current full-field rank decision,
 // not the postrace shadow and NEVER the official FROZEN directly.
 try{
   const evalInput=await loadEvalForClaim(data,c);
   data.eval_course_transfer_input=evalInput;
   if(data.live_ability_rank_input &&
      typeof data.live_ability_rank_input==='object'){
     data.live_ability_rank_input.eval_course_transfer={
       status:evalInput.status,
       mode:'OFFICIAL_JRA_0_4_FULL_FIELD_COURSE_FIT_REVIEW',
       full_ranked_eval_normal_relations:evalInput.eval_normal_rows??0,
       historical_pace_detail_matches:evalInput.official_one_to_one_archive_pace_matches??0,
       course_fit_budget_max:evalInput.score_budget_max_per_horse??0,
       independent_running_content_may_change_full_rank:true,
       runner_course_budget:evalInput.status==='READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW'?
         evalInput.runners.map((h:any)=>({
           horse_no:h.horse_no,
           review_100pt_budget:h.optional_course_fit_budget_points,
           evidence_refs:h.confirmed_supporting_run_refs,
           already_counted_historical_run:true
         })):[],
       rule:'Review ALL 1,942 course correlation ranks and each horse actual verified historic race (corners, laps, closing, winning margin, relative class, opponents). One Eval-only course fit point budget max after OWN reliable n>=120 confirmation, but verified independent running quality may justify broader 100-point rank change; never double count the same run. No forced TOP5 or EYE, no odds or postrace result.'
     };
   }
 }catch{
   data.eval_course_transfer_input={status:'EVAL_TRANSFER_UNAVAILABLE',
     reason:'OPTIONAL_COURSE_ADAPTER_FAILED',score_effect:0,
     market_used:false,target_result_used:false};
 }
 return {content:[{type:"text",text:JSON.stringify(data)}],structuredContent:{context:data}}}catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}});

 // Second-pass preview after the model/human has ranked ALL runners once.
 // This corrects the baseline mismatch of the pre-evaluation BASE_CORE probe.
 // Pure read-only result. No CLAIM creation, mutation or saving permitted.
 s.registerTool("jra_relative_rank_preview",{
   description:"Read-only JRA full-field comparison of the user's draft rank against pre-race verified official evidence. Requires an existing live authorized CLAIM. Returns a SHADOW alternative, never updates FROZEN or official model.",
   inputSchema:z.object({
     job_id:z.string().uuid(),
     baseline:z.array(z.object({
       horse_no:z.number().int().min(1).max(24),
       horse_name:z.string().min(1).max(160),
       rank:z.number().int().min(1).max(24)
     }).strict()).min(6).max(24)
   }).strict(),
   annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({job_id,baseline})=>{
   try{
     await auth();
     const c=admin();
     const {data,error}=await c.rpc("jra_claimed_context",{p_job_id:job_id});
     if(error||!data)throw Error("CONTEXT_UNAVAILABLE");
     const result=buildJraClaimedDraftPreview({
       claimedContext:data,baseline,observedAt:new Date().toISOString()
     });
     const output={...result,
       baseline_kind:"EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT",
       production_protocol_unmodified:true,
       official_saved:false,save_authorized:false,
       application:"PRE_FROZEN_ALTERNATIVE_RANK_PROPOSAL_ONLY"};
     return {content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output};
   }catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });

 // Opt-in immutable PRE-FROZEN capture. Does NOT create a CLAIM or FROZEN.
 // The server rebuilds the shadow from official CLAIM context, not from a
 // client-supplied "winning" proposed rank. PostgreSQL repeats all guards.
 s.registerTool("jra_seal_relative_rank_pair",{
   description:"Seal the current JRA full-field draft and recalculated alternative in a separate immutable pre-race comparison table. Only for an already live authorized CLAIM, never saves a prediction or changes FROZEN.",
   inputSchema:z.object({
     job_id:z.string().uuid(),
     baseline:z.array(z.object({
       horse_no:z.number().int().min(1).max(24),
       horse_name:z.string().min(1).max(160),
       rank:z.number().int().min(1).max(24)
     }).strict()).min(6).max(24)
   }).strict(),
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({job_id,baseline})=>{
   try {
     await auth();
     const c=admin();
     const {data,error}=await c.rpc("jra_claimed_context",{p_job_id:job_id});
     if(error||!data)throw Error("CONTEXT_UNAVAILABLE");
     const preview=buildJraClaimedDraftPreview({
       claimedContext:data,baseline,observedAt:new Date().toISOString()
     });
     if(!["REORDERED","UNCHANGED"].includes(preview.status)||
       preview.draft_runners_verified!==true||
       preview.production_rank_effect!==false||
       preview.market_used!==false||preview.target_result_used!==false)
       throw Error("RANK_PREVIEW_UNVERIFIED");
     const {data:receipt,error:se}=await c.rpc("lab_capture_rank_shadow_preflight_v1",{
       p_circuit:"JRA",p_job_id:job_id,p_baseline:baseline,p_preview:preview
     });
     if(se||!receipt||!["SEALED_PRE_RACE","ALREADY_SEALED_SAME"].includes(receipt.status))
       throw Error("RANK_CAPTURE_REFUSED");
     return {content:[{type:"text",text:JSON.stringify(receipt)}],structuredContent:receipt};
   } catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });

 // PRE-SAVE real 100-point evidence rank finalizer, read-only and reversible.
 // HUB may use this before the official save to review score/rank/EYE changes.
 s.registerTool("jra_evidence_rank_preview",{
   description:"JRA LIVE pre-FROZEN full-field rank finalizer: use official as-of previous races, Eval normal 1,942 pair course-fit and verified corner/pace/last3f to ACTUALLY RECOMPUTE 100-point scores, rank, TOP5 and explain every delta. Pure read-only; never CLAIMs or saves. If TOP5 changes, EYE must be re-audited before regular official FROZEN save.",
   inputSchema:z.object({
     job_id:z.string().uuid(),
     payload:z.object({runners:z.array(z.unknown()).min(1),
       top5:z.array(z.unknown()).min(1),eye:z.unknown().nullable(),
       bets:z.array(z.unknown()),summary:z.unknown(),bet_strategy:z.string(),
       audit:z.record(z.string(),z.unknown())}).strict()
   }).strict(),
   annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({job_id,payload})=>{
   try {
     await auth();
     const c=admin();
     const {data:context,error}=await c.rpc("jra_claimed_context",{p_job_id:job_id});
     if(error||!context)throw Error("OFFICIAL_CLAIM_CONTEXT_UNAVAILABLE");
     const evalInput=await loadEvalForClaim(context,c);
     const result=buildJraVerifiedEvidenceRankBridge({
       context,evalInput,payload,observedAt:new Date().toISOString()
     });
     const output={...result,job_id,eval_status:evalInput.status,
       official_saved:false,save_authorized:false,
       use_proposal_only_after_eye_reaudited:true};
     return {content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output};
   }catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });
 // The real save entrypoint now applies verified score/rank changes itself
 // BEFORE the old guarded RPC. If changing TOP5, stop for independent
 // outside-TOP5 EYE re-audit (do not silently drop or promote the EYE).
 s.registerTool("jra_save_claimed_prediction",{
   description:"Save the current live JRA prediction through the unchanged guarded RPC. BEFORE FROZEN, all-field Eval+official pace evidence is reconciled with 100-point scores and TOP5; the verified deterministic score/rank delta and prior-run refs are added to FROZEN audit. When TOP5 membership changes, call jra_evidence_rank_preview, re-audit EYE and resubmit its proposal with audit.eye_reaudited_after_rank_change=true. No odds/results, no existing FROZEN edits.",
   inputSchema:z.object({job_id:z.string().uuid(),
     protocol_version:z.string().min(1).max(100),
     payload:z.object({runners:z.array(z.unknown()).min(1),
       top5:z.array(z.unknown()).min(1),eye:z.unknown().nullable(),
       bets:z.array(z.unknown()),summary:z.unknown(),bet_strategy:z.string(),
       audit:z.record(z.string(),z.unknown())}).strict()}),
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}
 },async({job_id,protocol_version,payload})=>{
   try{
     await auth();
     const c=admin(),observedAt=new Date().toISOString();
     let savedPayload:any=payload,rankBridgeStatus="NOT_READY",
       rankScoreChanges=0,beforeTop5:any=null,afterTop5:any=null,
       evalStatus="OPTIONAL_UNAVAILABLE";
     // Validity (official READY, active CLAIM, lease, race cutoff) is
     // still enforced by BOTH JRA claimed_context & original save RPC.
     // The optional Eval source must never directly write or change DB.
     try{
       const {data:context,error:ce}=await c.rpc("jra_claimed_context",
         {p_job_id:job_id}).abortSignal(AbortSignal.timeout(12000));
       if(!ce&&context){
         const evalInput=await loadEvalForClaim(context,c);
         evalStatus=evalInput?.status??"OPTIONAL_UNAVAILABLE";
         if(evalStatus==='READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW'){
           if(payload.audit?.evidence_rank_bridge?.version==='JRA_EVAL_1942_PACE_SCORE_V1'){
             const verified=verifyJraBridgeAlreadyApplied({
               context,evalInput,payload,observedAt:new Date().toISOString()
             });
             if(verified.status!=='VERIFIED')
               throw Error("JRA_EVIDENCE_ALREADY_APPLIED_INVALID_"+verified.reason);
             rankBridgeStatus="VERIFIED_ALREADY_APPLIED";
             rankScoreChanges=payload.audit.evidence_rank_bridge.per_runner.filter(
               (r:any)=>r.applied_delta>0).length;
             beforeTop5=payload.audit.evidence_rank_bridge.old_order.slice(0,5);
             afterTop5=payload.audit.evidence_rank_bridge.new_order.slice(0,5);
           }else{
             const preview=buildJraVerifiedEvidenceRankBridge({
               context,evalInput,payload,observedAt:new Date().toISOString()
             });
             if(preview.status==='REJECTED')
               throw Error("JRA_EVIDENCE_DRAFT_INVALID_"+preview.reason);
             if(preview.status==='EYE_REAUDIT_REQUIRED')
               throw Error("JRA_EVIDENCE_EYE_REAUDIT_REQUIRED_CALL_jra_evidence_rank_preview:FROM_"+
                 preview.before_top5.join("_")+"_TO_"+preview.after_top5.join("_"));
             if(preview.status==='READY_FOR_OFFICIAL_SAVE'){
               savedPayload=preview.proposed_payload;
               rankBridgeStatus="APPLIED_TO_SAVE_PAYLOAD";
               rankScoreChanges=preview.runner_score_changes;
               beforeTop5=preview.before_top5;afterTop5=preview.after_top5;
             }else rankBridgeStatus="OPTIONAL_PREVIEW_"+preview.status;
           }
         }
       }
     }catch(e){
       // A verified new-input safety refusal is never converted into a
       // fallback save. Missing optional data alone follows old JRA0.4.
       if(String(err(e)).startsWith('JRA_EVIDENCE_'))throw e;
       rankBridgeStatus="OPTIONAL_SOURCE_UNAVAILABLE";
     }
     let shadow=null;
     try{
       if(extractOfficialSaveDraft(savedPayload,"JRA")){
         const {data:context,error:ce}=await c.rpc("jra_claimed_context",
           {p_job_id:job_id}).abortSignal(AbortSignal.timeout(2200));
         if(!ce&&context)shadow=buildOptionalSaveJraShadow({
           context,payload:savedPayload,now:new Date().toISOString()
         });
       }
     }catch{/* Keep core save available; optional paired proof is best effort. */}
     const {data,error}=await c.rpc("jra_save_claimed_prediction_with_shadow_v1",{
       p_job_id:job_id,p_protocol_version:protocol_version,p_payload:savedPayload,
       p_baseline:shadow?.baseline??null,p_preview:shadow?.preview??null
     });
     if(error||!uuid(data?.prediction_id)||data?.ok!==true)throw Error("SAVE_REJECTED");
     // Read back the ACTUAL immutable FROZEN row. An RPC receipt by itself
     // does not prove the 100-point and TOP5 delta reached the production DB.
     // On readback failure report UNCONFIRMED without retrying any write.
     let dbVerification="UNCONFIRMED";
     try{
       const {data:stored,error:ve}=await c.from("official_predictions")
         .select("id,status,payload").eq("id",data.prediction_id)
         .eq("circuit","JRA").maybeSingle();
       if(!ve&&stored){
         const saved=stored.payload??{};
         const original=new Map(savedPayload.runners.map((r:any)=>[r.horse_no,r]));
         const fullRunners=Array.isArray(saved.runners)&&
           saved.runners.length===original.size&&
           saved.runners.every((r:any)=>{
             const prior:any=original.get(r.horse_no);
             return prior&&prior.horse_name===r.horse_name&&
               prior.score===r.score&&prior.rank===r.rank;
           });
         const top5=Array.isArray(saved.top5)&&saved.top5.length===5&&
           saved.top5.every((r:any,i:number)=>
             r.horse_no===savedPayload.top5[i]?.horse_no&&
             r.rank===savedPayload.top5[i]?.rank);
         const stamp=savedPayload.audit?.evidence_rank_bridge;
         const trace=stamp?
           saved.audit?.evidence_rank_bridge?.version===stamp.version&&
           JSON.stringify(saved.audit.evidence_rank_bridge.new_order)===
             JSON.stringify(stamp.new_order)&&
           saved.audit.evidence_rank_bridge.per_runner?.length===
             stamp.per_runner?.length:
           saved.audit?.evidence_rank_bridge===undefined;
         dbVerification=stored.status==="FROZEN"&&fullRunners&&top5&&trace&&
           Array.isArray(saved.bets)&&saved.bets.length===0?
           "VERIFIED_FROZEN_SCORES_TOP5_AUDIT_EMPTY_BETS":"MISMATCH";
       }
     }catch{/* Keep the successful immutable save receipt; never rewrite. */}
     const result={ok:true,prediction_id:data.prediction_id,
       shadow_status:data.shadow_status??"UNKNOWN",
       rank_evidence_bridge:rankBridgeStatus,eval_source_status:evalStatus,
       score_changed_runner_count:rankScoreChanges,
       top5_before:beforeTop5,top5_saved:afterTop5,
       db_frozen_evidence_verification:dbVerification,
       frozen_payload_had_evidence_provenance:
         savedPayload?.audit?.evidence_rank_bridge?.status==='APPLIED_TO_NEW_PREDICTION'};
     return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result};
   }catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });

 s.registerTool("jra_queue_claim_next",{
   description:"Manually claim or resume the next eligible JRA flat-race job: scheduled in Japan today, field BASIC_READY/READY, unsaved, 3-70 minutes before post. Uses the guarded jra_manual_claim_next_v1 RPC; does not predict, call paid APIs, enable Cron, or change FROZEN rows.",
   inputSchema:z.object({}).strict(),
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async()=>{
   try{
     await auth();
     const c=admin();
     const {data,error}=await c.rpc("jra_manual_claim_next_v1");
     if(error||!data||typeof data!=="object")throw Error("JRA_CLAIM_UNAVAILABLE");
     const result={
       claimed:data.claimed===true,
       resumed:data.resumed===true,
       job_id:typeof data.job_id==="string"?data.job_id:null,
       track:typeof data.track==="string"?data.track:null,
       race_no:Number.isInteger(data.race_no)?data.race_no:null,
       lease_until:typeof data.lease_until==="string"?data.lease_until:null,
       queued:Number.isInteger(data.queued)?data.queued:0,
       reason:typeof data.reason==="string"?data.reason:null,
       race_date:typeof data.race_date==="string"?data.race_date:null
     };
     return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result};
   }catch(e){
     return {isError:true,content:[{type:"text",text:err(e)}]};
   }
 });

 s.registerTool("jra_queue_status",{
   description:"Read-only JRA manual queue/readiness status: schedule capture, verified official race readiness, claims and FROZEN. Defaults to next available JRA date in Japan.",
   inputSchema:z.object({race_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict(),
   annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({race_date})=>{
   try{
     await auth();
     const c=admin();
     const {data,error}=await c.rpc("jra_manual_readiness_v1",{p_race_date:race_date??null});
     if(error||!data)throw Error("JRA_QUEUE_STATUS_UNAVAILABLE");
     return {content:[{type:"text",text:JSON.stringify(data)}],structuredContent:{status:data}};
   }catch(e){
     return {isError:true,content:[{type:"text",text:err(e)}]};
   }
 });

 s.registerTool("jra_official_publish_card",{
   description:"Manually inspect one JRA OFFICIAL entry card. Dry run is default. Publish BASIC_READY only after finalized horse numbers, official identity/entry-status checks, captured live runner agreement, and guarded transactional save. Never modifies predictions or Cron.",
   inputSchema:z.object({
     race_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
     track:z.enum(["東京","京都","新潟","中山","阪神","中京","小倉","福島","札幌","函館"]),
     race_no:z.number().int().min(1).max(12),
     dry_run:z.boolean().default(true)
   }).strict(),
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({race_date,track,race_no,dry_run})=>{
   try {
     await auth();
     const c=admin();
     const {data:queue,error:qerr}=await c.from("jra_live_queue")
       .select("cname,status").eq("race_date",race_date).eq("track",track).eq("race_no",race_no).maybeSingle();
     if(qerr||!queue?.cname) throw Error("JRA_OFFICIAL_QUEUE_MISSING");
     const cname=String(queue.cname);
     const response=await fetch("https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(cname),{
       headers:{"User-Agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
         "Accept-Language":"ja-JP,ja;q=0.9","Cache-Control":"no-cache"},redirect:"follow"
     });
     if(!response.ok)throw Error("JRA_OFFICIAL_HTTP_"+response.status);
     const bytes=new Uint8Array(await response.arrayBuffer());
     const html=new TextDecoder("shift_jis").decode(bytes);
     const $=load(html);
     const clean=(value:unknown)=>String(value??"").normalize("NFKC").replace(/\s+/g," ").trim();
     const dateText=clean($(".race_header .date_line .cell.date").first().text());
     const dateParts=dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
     const cardDate=dateParts
       ? [dateParts[1],dateParts[2].padStart(2,"0"),dateParts[3].padStart(2,"0")].join("-")
       : null;
     const mainRaceNumber=$(".race_title .race_number img").first().attr("src")??"";
     if(cardDate!==race_date||!mainRaceNumber.endsWith("/race_num_"+race_no+".png")){
       throw Error("JRA_CARD_DATE_OR_RACE_NO_MISMATCH");
     }
     const table=$("#syutsuba table.basic.narrow-xy").first();
     const tableRows=table.find("tbody tr").toArray();
     if(!table.length||!tableRows.length)throw Error("JRA_OFFICIAL_FIELD_NOT_PRESENT");
     const title=clean(table.find(".race_title .race_name").first().text());
     const course=clean(table.find(".race_title .cell.course").first().text());
     const time=clean(table.find(".race_header .cell.time strong").first().text());
     const timeMatch=time.match(/(\d{1,2})時(\d{2})分/);
     const distanceMatch=course.replace(/,/g,"").match(/(\d{3,4})メートル/);
     const surface=course.includes("障害")?"障害":course.includes("ダート")?"ダート":course.includes("芝")?"芝":null;
     if(!timeMatch||!distanceMatch||!surface||!title||surface==="障害"){
       throw Error("JRA_CARD_HEADER_INCOMPLETE_OR_OBSTACLE");
     }
     const hh=Number(timeMatch[1]),mm=Number(timeMatch[2]);
     if(hh<8||hh>19||mm>59)throw Error("JRA_INVALID_POST_TIME");
     const postTime=race_date+"T"+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":00+09:00";
     const runners: Array<Record<string,unknown>>=[];
     let waiting=0;
     for(const row of tableRows){
       const rowObj=$(row);
       const horseNoStr=clean(rowObj.find("td.num").first().text());
       const horseName=clean(rowObj.find("td.horse .name_line .name a[href*='accessU']").first().text());
       if(!horseNoStr && horseName){waiting++;continue;}
       if(!/^\d{1,2}$/.test(horseNoStr)||!horseName){throw Error("JRA_CARD_PARTIAL_NUMBER_OR_NAME");}
       const horseNo=Number(horseNoStr);
       const drawStr=clean(rowObj.find("td.waku").first().text());
       if(!/^[1-8]$/.test(drawStr))throw Error("JRA_DRAW_MISSING_"+horseNo);
       const statusCells=clean(rowObj.find("td.num,td.horse .name_line,td.jockey").text());
       const flags=[/取消/.test(statusCells),/除外/.test(statusCells)];
       if(flags[0]&&flags[1])throw Error("JRA_AMBIGUOUS_STATUS_"+horseNo);
       const status=flags[0]?"CANCELLED":flags[1]?"EXCLUDED":"ACTIVE";
       const rowClass=clean(rowObj.attr("class"));
       if(/cancel|scratched|except|withdraw/i.test(rowClass) && status==="ACTIVE"){
         throw Error("JRA_UNRECOGNIZED_STATUS_CLASS_"+horseNo);
       }
       const jockey=clean(rowObj.find("td.jockey p.jockey").first().text());
       const weightText=clean(rowObj.find("td.jockey p.weight").first().text());
       const weightMatch=weightText.match(/(\d{2}(?:\.\d)?)\s*kg/i);
       const weight=weightMatch?Number(weightMatch[1]):null;
       if(status==="ACTIVE"&&(!jockey||weight===null||weight<45||weight>70)){
         throw Error("JRA_ACTIVE_ENTRY_DETAIL_INCOMPLETE_"+horseNo);
       }
       runners.push({horse_no:horseNo,horse_name:horseName,draw:Number(drawStr),
         status,jockey:jockey||null,weight_carried:weight});
     }
     if(waiting>0){
       const result={ok:true,published:false,reason:"WAIT_OFFICIAL_HORSE_NUMBERS",
         race_date,track,race_no,rows:tableRows.length,numbered:runners.length,unnumbered:waiting};
       return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result};
     }
     if(runners.length!==tableRows.length||runners.length<5||new Set(runners.map(x=>x.horse_no)).size!==runners.length){
       throw Error("JRA_FIELD_COUNT_OR_UNIQUE_NUMBERS_INVALID");
     }
     const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
     const hash=Array.from(digest,x=>x.toString(16).padStart(2,"0")).join("");
     const proof={
       race_date,track,race_no,cname,race_name:title,post_time:postTime,
       checked_at:new Date().toISOString(),html_sha256:hash,html_bytes:bytes.length,
       verification_basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",all_rows_reviewed:true,
       race:{surface,distance:Number(distanceMatch[1])},runners
     };
     if(dry_run){
       const preview={ok:true,published:false,reason:"DRY_RUN_VERIFIED_HTML_ONLY",
         race_date,track,race_no,runner_count:runners.length,
         statuses:{active:runners.filter(x=>x.status==="ACTIVE").length,
           cancelled:runners.filter(x=>x.status==="CANCELLED").length,
           excluded:runners.filter(x=>x.status==="EXCLUDED").length},
         live_capture_status:queue.status,
         note:"DB live-runner agreement and atomic publisher guards checked only on real publish"};
       return {content:[{type:"text",text:JSON.stringify(preview)}],structuredContent:preview};
     }
     const {data,error}=await c.rpc("jra_publish_verified_card_v1",{p_proof:proof});
     if(error||!data?.ok)throw Error("JRA_VERIFIED_PUBLISH_REJECTED: "+(error?.message??"UNKNOWN"));
     return {content:[{type:"text",text:JSON.stringify(data)}],structuredContent:data};
   } catch(e){
     return {isError:true,content:[{type:"text",text:err(e)}]};
   }
 });
 return s});return handler.fetch(req)}));