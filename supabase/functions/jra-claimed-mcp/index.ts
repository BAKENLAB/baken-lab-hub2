import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@^2.0.0";
import {pipeline} from "npm:@supabase/middleware@1";
import {withOAuthProtectedResource,withSupabase} from "npm:@supabase/server@1";
import {createClient} from "npm:@supabase/supabase-js@2";
import {z} from "npm:zod@^4.3.6";
const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const err=(e:unknown)=>e instanceof Error?e.message:"UNAVAILABLE";
Deno.serve(pipeline([withOAuthProtectedResource(),withSupabase({auth:"user",errors:{detailed:false}})],async(req,{supabase})=>{
 const handler=createMcpHandler(()=>{const s=new McpServer({name:"BAKEN JRA Claimed Context",version:"0.1.0"});
 const admin=()=>{const u=Deno.env.get("SUPABASE_URL")??"",k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";if(!u||!k)throw Error("SERVER_CONFIGURATION_ERROR");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})};
 const auth=async()=>{const a=Deno.env.get("LOCAL_MCP_ALLOWED_USER_ID")??"";if(!uuid(a))throw Error("AUTHORIZATION_NOT_CONFIGURED");const {data:{user},error}=await supabase.auth.getUser();if(error||!user||user.id!==a)throw Error("FORBIDDEN")};
 s.registerTool("jra_claimed_context",{description:"Get verified context for an already CLAIMED JRA job owned by JRA_QUEUE_RESCUE. Read-only.",inputSchema:z.object({job_id:z.string().uuid()}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({job_id})=>{try{await auth();const c=admin();const {data,error}=await c.rpc("jra_claimed_context",{p_job_id:job_id});if(error||!data)throw Error("CONTEXT_UNAVAILABLE");return {content:[{type:"text",text:JSON.stringify(data)}],structuredContent:{context:data}}}catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}});
 s.registerTool("jra_save_claimed_prediction",{description:"Save a completed BAKEN LAB JRA prediction only for the currently live JRA claim through the guarded JRA save RPC.",inputSchema:z.object({job_id:z.string().uuid(),protocol_version:z.string().min(1).max(100),payload:z.object({runners:z.array(z.unknown()).min(1),top5:z.array(z.unknown()).min(1),eye:z.unknown().nullable(),bets:z.array(z.unknown()),summary:z.unknown(),bet_strategy:z.string(),audit:z.record(z.string(),z.unknown())}).strict()}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async({job_id,protocol_version,payload})=>{try{await auth();const c=admin();const {data,error}=await c.rpc("jra_save_claimed_prediction",{p_job_id:job_id,p_protocol_version:protocol_version,p_payload:payload});if(error||!uuid(data))throw Error("SAVE_REJECTED");return {content:[{type:"text",text:JSON.stringify({ok:true,prediction_id:data})}],structuredContent:{ok:true,prediction_id:data}}}catch(e){return {isError:true,content:[{type:"text",text:err(e)}]}}});

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
 return s});return handler.fetch(req)}));