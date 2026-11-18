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