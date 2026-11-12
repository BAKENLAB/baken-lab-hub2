import {buildOptionalSaveLocalShadow,extractOfficialSaveDraft,selectVerifiedLocalResearchComparison} from "./optional-atomic-shadow-save.mjs";
import {buildRelativeAbilityRankProposal} from "./relative-ability-rank-proposal.mjs";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@^2.0.0";
import {pipeline} from "npm:@supabase/middleware@1";
import {withOAuthProtectedResource,withSupabase} from "npm:@supabase/server@1";
import {createClient} from "npm:@supabase/supabase-js@2";
import {z} from "npm:zod@^4.3.6";
import {queueNext,queueSave,publicError,bounded} from "./queue-operation.mjs";
import {assertLocalSaveDuringTransition} from "./local-eye.mjs";
const WORKERS=new Map([["LOCAL_QUEUE_RESCUE","RESCUE"],["LOCAL_QUEUE_KANTO","関東"],["LOCAL_QUEUE_WEST","西日本"],["LOCAL_QUEUE_CHUBU","中部"],["LOCAL_QUEUE_HOKKAIDO_TOHOKU","北海道東北"]]);
const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const err=(e:unknown)=>publicError(e);
const normalizePairEvidence=(payload:any)=>{
 const a=payload?.audit;
 const candidates=Array.isArray(a?.eye_candidate_audit)?a.eye_candidate_audit:[];
 const pairs=Array.isArray(a?.eye_pairwise_comparison)?a.eye_pairwise_comparison:[];
 const byNo=new Map(candidates.filter((c:any)=>Number.isInteger(c?.horse_no)).map((c:any)=>[c.horse_no,c]));
 for(const p of pairs){
  if(!Array.isArray(p?.horse_nos)||p.horse_nos.length!==2)continue;
  const refs=[...new Set(p.horse_nos.flatMap((n:any)=>{
    const c:any=byNo.get(n);
    return Array.isArray(c?.evidence_refs)?c.evidence_refs:[];
  }).filter((x:any)=>typeof x==="string"&&x.trim().length>0))];
  if(refs.length>0&&refs.length<=64)p.evidence_refs=refs;
 }
 return payload;
};
Deno.serve(pipeline([withOAuthProtectedResource(),withSupabase({auth:"user",errors:{detailed:false}})],async(req,{supabase})=>{
 const handler=createMcpHandler(()=>{const s=new McpServer({name:"BAKEN LOCAL Claimed Context",version:"0.3.0"});
 const admin=()=>{const u=Deno.env.get("SUPABASE_URL")??"",k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";if(!u||!k)throw Error("SERVER_CONFIGURATION_ERROR");return {u,k,c:createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}};
 const auth=async()=>{const a=Deno.env.get("LOCAL_MCP_ALLOWED_USER_ID")??"";if(!uuid(a))throw Error("AUTHORIZATION_NOT_CONFIGURED");const {data:{user},error}=await bounded(()=>supabase.auth.getUser());if(error||!user||user.id!==a)throw Error("FORBIDDEN");return user};
 const claim=async(c:any,id:string)=>{const {data:j,error:e}=await c.from("lab_prediction_jobs").select("id,circuit,job_status,worker_run_id,claim_token,claimed_by,lease_until,attempts,max_attempts").eq("id",id).eq("circuit","LOCAL").eq("job_status","CLAIMED").limit(2);if(e||!j||j.length!==1)throw Error("CLAIM_UNAVAILABLE");const x=j[0];if(!uuid(x.worker_run_id)||!uuid(x.claim_token)||(!Number.isFinite(Date.parse(x.lease_until))||Date.parse(x.lease_until)<=Date.now())||x.attempts>x.max_attempts||!WORKERS.has(x.claimed_by))throw Error("CLAIM_UNAVAILABLE");const {data:r,error:re}=await c.from("lab_worker_runs").select("id,worker_id,status,region").eq("id",x.worker_run_id).eq("status","RUNNING").limit(2);if(re||!r||r.length!==1||x.claimed_by!==r[0].worker_id||WORKERS.get(r[0].worker_id)!==r[0].region)throw Error("CLAIM_UNAVAILABLE");return {j:x,r:r[0]}};

 const TERMINAL_EYE_CODES=new Set(["LOCAL_EYE_SELECTION_MISMATCH","LOCAL_EYE_OLD_PAIRS_FORBIDDEN","LOCAL_EYE_MARKET_EVIDENCE"]);
 const KNOWN_FAILED_JOBS=[
  {id:"0d99a3a5-ace4-4c51-b0e3-5337df1300e6",worker:"LOCAL_QUEUE_KANTO",race_date:"2026-11-02",track:"船橋",race_no:9,error:"LOCAL_EYE_SELECTION_MISMATCH"},
  {id:"83cf4e54-ccb0-4995-bcc6-2728518be7e1",worker:"LOCAL_QUEUE_HOKKAIDO_TOHOKU",race_date:"2026-11-08",track:"盛岡",race_no:4,error:"LOCAL_EYE_MARKET_EVIDENCE"}
 ];
 const closeFailedClaim=async(c:any,job_id:string,code:string)=>{
   if(!TERMINAL_EYE_CODES.has(code))throw Error("QUEUE_STATE_UNAVAILABLE");
   const live=await claim(c,job_id);
   const {data:jobs,error:je}=await c.from("lab_prediction_jobs").select("race_date,track,race_no,circuit").eq("id",job_id).eq("circuit","LOCAL").limit(2);
   if(je||!jobs||jobs.length!==1)throw Error("QUEUE_STATE_UNAVAILABLE");
   const j=jobs[0];
   const {data:races,error:re}=await c.from("official_races").select("post_time,field_status,prediction_status").eq("race_date",j.race_date).eq("track",j.track).eq("race_no",j.race_no).eq("circuit","LOCAL").limit(2);
   if(re||!races||races.length!==1||races[0].field_status!=="READY"||!["PENDING","RETRY"].includes(races[0].prediction_status)||!(Date.parse(races[0].post_time)>Date.now()+180000))throw Error("QUEUE_STATE_UNAVAILABLE");
   const {data:existing,error:pe}=await c.from("official_predictions").select("*").eq("race_date",j.race_date).eq("track",j.track).eq("race_no",j.race_no).eq("circuit","LOCAL").limit(1);
   if(pe||existing?.length)throw Error("QUEUE_STATE_UNAVAILABLE");
   const {data:finished,error:fe}=await bounded(()=>c.rpc("lab_finish_prediction_job",{
     p_run_id:live.r.id,p_job_id:live.j.id,p_claim_token:live.j.claim_token,
     p_outcome:"DEAD",p_error:code,p_retry_seconds:60
   }));
   if(fe||finished?.job_status!=="DEAD")throw Error("QUEUE_STATE_UNAVAILABLE");
   const {error:we}=await bounded(()=>c.rpc("lab_finish_worker_run",{p_run_id:live.r.id,p_status:"FAILED",p_error:code}));
   if(we)throw Error("QUEUE_STATE_UNAVAILABLE");
   return true;
 };
 s.registerTool("lab_queue_claim_next",{description:"Enqueue, resume or claim one LOCAL job for an approved worker in one transaction. Tokens stay server-side.",inputSchema:z.object({worker_id:z.enum([...WORKERS.keys()])}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async(input)=>{try{await auth();const {c}=admin();let result=await queueNext(input,{client:c});const rejected=KNOWN_FAILED_JOBS.find(x=>result.claimed && result.job_id===x.id && input.worker_id===x.worker);
 if(rejected){
  const {data:job,error:je}=await c.from("lab_prediction_jobs").select("race_date,track,race_no,circuit").eq("id",result.job_id).eq("circuit","LOCAL").limit(1).single();
  if(je||!job||job.circuit!=="LOCAL"||job.race_date!==rejected.race_date||job.track!==rejected.track||job.race_no!==rejected.race_no)throw Error("QUEUE_STATE_UNAVAILABLE");
  await closeFailedClaim(c,result.job_id,rejected.error);
  result=await queueNext(input,{client:c});
 }return {content:[{type:"text",text:JSON.stringify(result)}]}}catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}});

 // Manual, single-race, append-only official evidence acquisition.
 // NEVER claims a job, saves a prediction, schedules a task or modifies FROZEN.
 // Authenticated server invokes the existing service-role-only preclaim gate.
 s.registerTool("lab_preclaim_official_corners",{
  description:"Explicit one-race LOCAL pre-CLAIM official historical corner acquisition. Requires a user-requested exact JST date, track and race number. It only appends verified past-running-order evidence; does not CLAIM, rank, bet or save a prediction. Never retries automatically.",
  inputSchema:z.object({
   race_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   track:z.enum(["盛岡","水沢","浦和","船橋","大井","川崎","金沢",
    "笠松","名古屋","園田","姫路","高知","佐賀","門別"]),
   race_no:z.number().int().min(1).max(14)
  }).strict(),
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({race_date,track,race_no})=>{
  try{
   await auth(); // LOCAL_MCP_ALLOWED_USER_ID is independently checked.
   const {u,k,c}=admin();
   const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
   if(race_date!==today)throw Error("PRECLAIM_DATE_NOT_TODAY");
   const {data:rows,error:dbError}=await c.from("official_races")
    .select("circuit,race_name,post_time,field_status,prediction_status")
    .eq("race_date",race_date).eq("track",track).eq("race_no",race_no)
    .eq("circuit","LOCAL").limit(2);
   if(dbError||!Array.isArray(rows)||rows.length!==1)
    throw Error("OFFICIAL_RACE_UNAVAILABLE");
   const r=rows[0];
   // A READY card can be a debut. Do not fetch historical corners if no
   // prior official result can exist for this first-start-only race.
   if(/新馬|初出走|メイクデビュー/u.test(String(r.race_name??"")))
    throw Error("PRECLAIM_DEBUT_NO_PAST_RUNNING_ORDER");
   if(r.field_status!=="READY"||
      !["PENDING","RETRY"].includes(r.prediction_status)||
      !Number.isFinite(Date.parse(r.post_time))||
      Date.parse(r.post_time)<=Date.now()+10*60000)
    throw Error("PRECLAIM_NOT_ELIGIBLE");
   const endpoint=u+"/functions/v1/lab-local-corner-preclaim";
   const response=await fetch(endpoint,{
    method:"POST",redirect:"error",cache:"no-store",
    headers:{"content-type":"application/json",authorization:"Bearer "+k,apikey:k},
    body:JSON.stringify({intent:"AUTHORIZED_PRECLAIM_RESEARCH",
      race_date,track,race_no}),
    signal:AbortSignal.timeout(85000)
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.ok!==true||result?.claim_started!==false||
      result?.prediction_saved!==false)
    throw Error("PRECLAIM_SOURCE_UNAVAILABLE");
   const output={
    race_date,track,race_no,status:String(result.status||"UNKNOWN"),
    stored:result.stored===true,linked_prior_runs:Number(result.linked_prior_runs)||0,
    read_count:Number(result.read_count)||0,
    verified_profile_horses:Number(result.verified_profile_horses)||0,
    // Aggregate-only source diagnostics; never return profiles, horse links,
    // service credentials, raw official HTML, or race outcome data.
    verified_prior_witnesses:
      Number.isInteger(result.verified_prior_witnesses)&&
      result.verified_prior_witnesses>=0&&result.verified_prior_witnesses<=200?
      result.verified_prior_witnesses:0,
    unavailable_or_empty_profiles:
      Number.isInteger(result.unavailable_or_empty_profiles)&&
      result.unavailable_or_empty_profiles>=0&&result.unavailable_or_empty_profiles<=20?
      result.unavailable_or_empty_profiles:0,
    missing_official_horse_links:
      Number.isInteger(result.missing_official_horse_links)&&
      result.missing_official_horse_links>=0&&result.missing_official_horse_links<=20?
      result.missing_official_horse_links:0,
    claim_started:false,prediction_saved:false,
    frozen_modified:false,market_used:false
   };
   return {content:[{type:"text",text:JSON.stringify(output)}],
     structuredContent:output};
  }catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });
 s.registerTool("lab_claimed_context",{description:"Get verified context for an already CLAIMED LOCAL job owned by an approved LOCAL queue worker. Read-only.",inputSchema:z.object({job_id:z.string().uuid()}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}},async({job_id})=>{try{await auth();const {u,k,c}=admin(),a=await claim(c,job_id);const res=await fetch(u+"/functions/v1/lab-claimed-context",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+k,apikey:k},body:JSON.stringify({run_id:a.r.id,job_id:a.j.id,claim_token:a.j.claim_token}),signal:AbortSignal.timeout(30000)});const o=await res.json().catch(()=>null);if(!res.ok||o?.ok!==true||!o?.context)throw Error(o?.error||"CONTEXT_UNAVAILABLE");const b=await claim(c,job_id);if(b.r.id!==a.r.id||b.j.claim_token!==a.j.claim_token)throw Error("CLAIM_CHANGED");return {content:[{type:"text",text:JSON.stringify(o.context)}]}}catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}});

 s.registerTool("lab_relative_rank_preview",{
  description:"Read-only pre-FROZEN relative ability rank preview for a valid LOCAL CLAIM. Uses existing officially verified context; never saves, never rewrites existing rankings, and excludes market/results.",
  inputSchema:z.object({
   job_id:z.string().uuid(),
   baseline:z.array(z.object({
     horse_no:z.number().int().min(1).max(24),
     horse_name:z.string().min(1).max(120),
     rank:z.number().int().min(1).max(20)
   }).strict()).min(6).max(20)
  }).strict(),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({job_id,baseline})=>{
  try{
   await auth();
   const {u,k,c}=admin(),a=await claim(c,job_id);
   const res=await fetch(u+"/functions/v1/lab-claimed-context",{
     method:"POST",
     headers:{"content-type":"application/json",authorization:"Bearer "+k,apikey:k},
     body:JSON.stringify({run_id:a.r.id,job_id:a.j.id,claim_token:a.j.claim_token}),
     signal:AbortSignal.timeout(30000)
   });
   const o=await res.json().catch(()=>null);
   if(!res.ok||o?.ok!==true||!o?.context)throw Error(o?.error||"CONTEXT_UNAVAILABLE");
   const b=await claim(c,job_id);
   if(b.r.id!==a.r.id||b.j.claim_token!==a.j.claim_token)throw Error("CLAIM_CHANGED");
   const ctx=o.context;
   const proposal=buildRelativeAbilityRankProposal({
     race:{race_date:ctx.race.race_date,post_time:ctx.race.post_time,
       observation_at:new Date().toISOString(),circuit:"LOCAL",
       track:ctx.race.track,class_name:ctx.race.conditions?.class_name,
       race_name:ctx.race.race_name,
       surface:ctx.race.conditions?.surface,
       distance:ctx.race.conditions?.distance},
     baseline,comparison:selectVerifiedLocalResearchComparison(ctx)
   });
   const output={...proposal,claim_verified:true,save_authorized:false,
     application:"OPTIONAL_PRE_FROZEN_PREVIEW_ONLY",production_protocol_unmodified:true};
   return {content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output};
  }catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });

 // Opt-in, server-validated prospective comparison capture.
 // Does not claim or save the official race. Re-check the live lease after
 // the context fetch, then the DB RPC independently rechecks time and field.
 s.registerTool("lab_seal_relative_rank_pair",{
   description:"Seal a LOCAL official full-field draft and evidence-only alternative for later true out-of-sample result comparison. Requires a live authorized CLAIM; never updates FROZEN or scores.",
   inputSchema:z.object({
     job_id:z.string().uuid(),
     baseline:z.array(z.object({
       horse_no:z.number().int().min(1).max(24),
       horse_name:z.string().min(1).max(160),
       rank:z.number().int().min(1).max(20)
     }).strict()).min(6).max(20)
   }).strict(),
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async({job_id,baseline})=>{
   try {
     await auth();
     const {u,k,c}=admin(),first=await claim(c,job_id);
     const res=await fetch(u+"/functions/v1/lab-claimed-context",{
       method:"POST",headers:{"content-type":"application/json",
         authorization:"Bearer "+k,apikey:k},
       body:JSON.stringify({run_id:first.r.id,job_id:first.j.id,
         claim_token:first.j.claim_token}),
       signal:AbortSignal.timeout(30000)
     });
     const o=await res.json().catch(()=>null);
     if(!res.ok||o?.ok!==true||!o?.context)throw Error("CONTEXT_UNAVAILABLE");
     const second=await claim(c,job_id);
     if(second.r.id!==first.r.id||second.j.claim_token!==first.j.claim_token)
       throw Error("CLAIM_CHANGED");
     const ctx=o.context;
     const evaluated=buildRelativeAbilityRankProposal({
       race:{race_date:ctx.race?.race_date,post_time:ctx.race?.post_time,
         observation_at:new Date().toISOString(),circuit:"LOCAL",
         track:ctx.race?.track,race_name:ctx.race?.race_name,
         class_name:ctx.race?.conditions?.class_name,
         surface:ctx.race?.conditions?.surface,
         distance:ctx.race?.conditions?.distance},
       baseline,comparison:selectVerifiedLocalResearchComparison(ctx)
     });
     if(!["REORDERED","UNCHANGED"].includes(evaluated.status)||
        evaluated.production_rank_effect!==false||
        evaluated.market_used!==false||evaluated.target_result_used!==false)
       throw Error("RANK_PREVIEW_UNVERIFIED");
     const preview={...evaluated,baseline_kind:"EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT",
       draft_runners_verified:true,official_saved:false,save_authorized:false,
       application:"OPT_IN_PRE_FROZEN_PAIR_ONLY"};
     const {data:receipt,error:se}=await c.rpc("lab_capture_rank_shadow_preflight_v1",{
       p_circuit:"LOCAL",p_job_id:job_id,p_baseline:baseline,p_preview:preview
     });
     if(se||!receipt||!["SEALED_PRE_RACE","ALREADY_SEALED_SAME"].includes(receipt.status))
       throw Error("RANK_CAPTURE_REFUSED");
     return {content:[{type:"text",text:JSON.stringify(receipt)}],structuredContent:receipt};
   } catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}
 });
 s.registerTool("lab_save_claimed_prediction",{description:"Save a completed BAKEN LAB LOCAL prediction only for the currently live claim. Uses the production guarded save RPC; no direct table writes.",inputSchema:z.object({job_id:z.string().uuid(),protocol_version:z.string().min(1).max(100),payload:z.object({runners:z.array(z.unknown()).min(1),top5:z.array(z.unknown()).min(1),eye:z.unknown().nullable(),bets:z.array(z.unknown()),summary:z.unknown(),bet_strategy:z.string(),audit:z.record(z.string(),z.unknown())}).strict()}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({job_id,protocol_version,payload})=>{let c:any=null;try{const user=await auth();c=admin().c;await claim(c,job_id);const original_payload=structuredClone(payload);payload=normalizePairEvidence(payload);assertLocalSaveDuringTransition({circuit:"LOCAL",protocol_version,payload});let shadow=null;
 // No optional evidence fetch may prevent the official save; use a strict timeout.
 try{
  if(extractOfficialSaveDraft(payload,"LOCAL")){
   const a=await claim(c,job_id),{u,k}=admin();
   const response=await fetch(u+"/functions/v1/lab-claimed-context",{
     method:"POST",headers:{"content-type":"application/json",
       authorization:"Bearer "+k,apikey:k},
     body:JSON.stringify({run_id:a.r.id,job_id:a.j.id,claim_token:a.j.claim_token}),
     signal:AbortSignal.timeout(2300)
   });
   const o=await response.json().catch(()=>null);
   if(response.ok&&o?.ok===true&&o.context){
     const proposal=buildOptionalSaveLocalShadow({
       context:o.context,payload,now:new Date().toISOString()
     });
     if(proposal){
       const b=await claim(c,job_id);
       if(b.r.id===a.r.id&&b.j.claim_token===a.j.claim_token)shadow=proposal;
     }
   }
  }
 }catch{/* Shadow lookup is always optional. */}
 const {data,error}=await bounded(()=>c.rpc("lab_queue_save_prediction_with_shadow_v1",{
   p_job_id:job_id,p_user_id:user.id,p_protocol_version:protocol_version,
   p_payload:payload,p_original_payload:original_payload,
   p_baseline:shadow?.baseline??null,p_preview:shadow?.preview??null
 }).abortSignal(AbortSignal.timeout(14000)),14000);
 if(error)throw Error(error.message==="SAVE_RETRY_MISMATCH"?
   "SAVE_RETRY_MISMATCH":"SAVE_REJECTED");
 if(data?.ok!==true||!uuid(data.prediction_id)||
   typeof data.already_saved!=="boolean")throw Error("SAVE_RESULT_INVALID");
 const result={ok:true,prediction_id:data.prediction_id,
   already_saved:data.already_saved,shadow_status:data.shadow_status??"UNKNOWN"};
 return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result}}catch(e){const code=(e instanceof Error)?e.message:"";if(c && TERMINAL_EYE_CODES.has(code)){try{await closeFailedClaim(c,job_id,code);}catch{return {isError:true,content:[{type:"text",text:"QUEUE_STATE_UNAVAILABLE"}]};}}return {isError:true,content:[{type:"text",text:err(e)}]}}});
 return s});return handler.fetch(req)}));
