import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
import {assessJraJumpReadiness} from "./jra-jump-preflight.mjs";
import {inventoryJumpArchive} from "./jra-jump-archive-audit.mjs";

const respond=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x??"");
Deno.serve(async req=>{
 if(req.method!=="POST") return respond({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const bearer=req.headers.get("authorization")??"";
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))return respond({ok:false,error:"AUTH_REQUIRED"},401);
 const url=Deno.env.get("SUPABASE_URL")??"";
 const anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
 const adminKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 const allowed=Deno.env.get("LOCAL_MCP_ALLOWED_USER_ID")??"";
 if(!url||!anon||!adminKey||!uuid(allowed))return respond({ok:false,error:"AUTH_CONFIGURATION_UNAVAILABLE"},503);
 const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(bearer.slice(7));
 if(authError||!user||user.id!==allowed)return respond({ok:false,error:"FORBIDDEN"},403);
 let body;
 try{body=await req.json()}catch{return respond({ok:false,error:"BAD_BODY"},400)}
 if(!body||Array.isArray(body)||typeof body!=="object"||
    Object.keys(body).sort().join(",")!=="race_date,race_no,track")
   return respond({ok:false,error:"INVALID_ARGS"},400);
 const {race_date,track,race_no}=body;
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(race_date)||race_date!==today||
   !["札幌","函館","福島","新潟","東京","中山","中京","京都","阪神","小倉"].includes(track)||!Number.isInteger(race_no)||race_no<1||race_no>12)
   return respond({ok:false,error:"OUT_OF_SCOPE"},400);
 const db=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const [r,q,p,protos]=await Promise.all([
   db.from("jra_live_races").select("id,race_date,track,race_no,race_type,surface,distance,field_size")
    .match({race_date,track,race_no}).maybeSingle(),
   db.from("jra_live_queue").select("race_date,track,race_no,status")
    .match({race_date,track,race_no}).maybeSingle(),
   db.from("official_races").select("race_date,track,race_no,circuit,field_status,field_payload")
    .match({race_date,track,race_no,circuit:"JRA"}).maybeSingle(),
   db.from("lab_prediction_protocols").select("protocol_key,version,is_active").eq("protocol_key","JRA_JUMP")
 ]);
 if(r.error||q.error||p.error||protos.error)return respond({ok:false,error:"SOURCE_READ_UNAVAILABLE"},503);
 if(!r.data)return respond({ok:false,error:"LIVE_RACE_NOT_CAPTURED"},404);
 const h=await db.from("jra_live_runners").select("horse_no,horse_name,horse_ref,past_runs")
   .eq("live_race_id",r.data.id).order("horse_no");
 if(h.error)return respond({ok:false,error:"FIELD_READ_UNAVAILABLE"},503);
 const preflight=assessJraJumpReadiness({race:r.data,queue:q.data,
    liveRunners:h.data??[],official:p.data,protocols:protos.data??[]});
 // Read the already-captured 2018-2026 official archive; never fetch target
 // results or pretend the archive is the entire post-2026-09-13 calendar.
 const names=[...new Set((h.data??[]).map(x=>x.horse_name))];
 if(names.length<5||names.length>24)return respond({ok:false,error:"ARCHIVE_RUNNER_SCOPE_INVALID"},422);
 const past=await db.from("jra_lab_runs").select(
   "horse_name,horse_ref,finish,record_role,source_kind,source_ref,jra_lab_races!inner(race_date,track,race_no,surface,source_ref,full_field,archive_complete)")
  .in("horse_name",names).eq("record_role","full_runner")
  .eq("jra_lab_races.surface","障害").lt("jra_lab_races.race_date",race_date)
  .limit(1000);
 if(past.error||!Array.isArray(past.data)||past.data.length===1000)
   return respond({ok:false,error:"ARCHIVE_READ_INCOMPLETE"},503);
 const archive=inventoryJumpArchive({race:r.data,liveRunners:h.data??[],rows:past.data});
 return respond({ok:true,...preflight,observed:{...preflight.observed,archive}},200);
});
