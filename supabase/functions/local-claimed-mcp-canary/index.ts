import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@^2.0.0";
import {pipeline} from "npm:@supabase/middleware@1";
import {withOAuthProtectedResource,withSupabase} from "npm:@supabase/server@1";
import {z} from "npm:zod@^4.3.6";
// This canary has no database client, RPC, table queries or production context call.
const WORKERS=new Map([["LOCAL_QUEUE_RESCUE","RESCUE"],["LOCAL_QUEUE_KANTO","関東"],["LOCAL_QUEUE_WEST","西日本"],["LOCAL_QUEUE_CHUBU","中部"],["LOCAL_QUEUE_HOKKAIDO_TOHOKU","北海道東北"]]);
const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
async function bounded<T>(fn:()=>Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve().then(fn),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(Error("AUTHENTICATION_UNAVAILABLE")),14000);})]);}finally{clearTimeout(timer);}}
Deno.serve(pipeline([withOAuthProtectedResource(),withSupabase({auth:"user",errors:{detailed:false}})],async(req,{supabase})=>{
 // Gate discovery and invocation with the dedicated allowlist; authenticate once per request.
 try {
  const allowed=Deno.env.get("LOCAL_MCP_ALLOWED_USER_ID")??"";
  if(!uuid(allowed))return new Response(JSON.stringify({error:"AUTHORIZATION_NOT_CONFIGURED"}),{status:503,headers:{"content-type":"application/json"}});
  const {data:{user},error}=await bounded(()=>supabase.auth.getUser());
  if(error||!user||user.id!==allowed)return new Response(JSON.stringify({error:"FORBIDDEN"}),{status:403,headers:{"content-type":"application/json"}});
 } catch {return new Response(JSON.stringify({error:"AUTHENTICATION_UNAVAILABLE"}),{status:503,headers:{"content-type":"application/json"}});}
 const handler=createMcpHandler(()=>{const s=new McpServer({name:"BAKEN LOCAL MCP Canary (no DB operations)",version:"0.1.0"});
s.registerTool("lab_queue_claim_next",{description:"Enqueue, resume or claim one LOCAL job for an approved worker in one transaction. Tokens stay server-side.",inputSchema:z.object({worker_id:z.enum([...WORKERS.keys()])}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async()=>({content:[{type:"text",text:JSON.stringify({ok:true,canary:true,code:"CANARY_READ_ONLY",claimed:false,resumed:false})}]}));
s.registerTool("lab_claimed_context",{description:"Get verified context for an already CLAIMED LOCAL job owned by an approved LOCAL queue worker. Read-only.",inputSchema:z.object({job_id:z.string().uuid()}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}},async()=>({content:[{type:"text",text:JSON.stringify({ok:true,canary:true,code:"CANARY_READ_ONLY"})}]}));
s.registerTool("lab_save_claimed_prediction",{description:"Save a completed BAKEN LAB LOCAL prediction only for the currently live claim. Uses the production guarded save RPC; no direct table writes.",inputSchema:z.object({job_id:z.string().uuid(),protocol_version:z.string().min(1).max(100),payload:z.object({runners:z.array(z.unknown()).min(1),top5:z.array(z.unknown()).min(1),eye:z.unknown().nullable(),bets:z.array(z.unknown()),summary:z.unknown(),bet_strategy:z.string(),audit:z.record(z.string(),z.unknown())}).strict()}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async()=>({content:[{type:"text",text:JSON.stringify({ok:true,canary:true,code:"CANARY_READ_ONLY"})}]}));
 return s});return handler.fetch(req)}));
