/** Isolated official-field publication only. NO predictions or Cron changes.
 * CURRENT LIMIT: publish only races with EVERY runner verified ACTIVE.
 * Identity and source guard: JRA current official HTML, fresh Shift_JIS decode,
 * all horse rows match, current odds/jockey/weight, no cancellations.
 * Calls existing jra_publish_verified_card_v1 and checks BASIC_READY readback.
 * Intended for one-race manual authorized runs. Do NOT schedule this.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {load} from "npm:cheerio@1.0.0";
import {parseNumberedJraCard} from "./parse-numbered-card.mjs";
import {validateCurrentJraField} from "./validate-current-field.mjs";
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8"}});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
const same=(a,b)=>{if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0};
Deno.serve(async req=>{
 if(req.method!=="POST")return respond({ok:false,error:"METHOD"},405);
 const expected=Deno.env.get("JRA_CRON_TOKEN_SHA256")??"";
 const secret=req.headers.get("x-jra-cron-token")??"";
 if(!/^[a-f0-9]{64}$/.test(expected)||!/^[a-f0-9]{64}$/.test(secret)||!req.headers.get("authorization")?.startsWith("Bearer "))return respond({ok:false,error:"AUTH"},401);
 if(!same(await sha(secret),expected))return respond({ok:false,error:"AUTH"},401);
 let body;try{body=await req.json()}catch{return respond({ok:false,error:"BODY"},400)}
 if(!body||Object.keys(body).sort().join(",")!=="race_date,race_no,track")return respond({ok:false,error:"ARGS"},400);
 const {race_date,track,race_no}=body;
 const jstToday=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 if(race_date!==jstToday||!["新潟","京都","東京"].includes(track)||!Number.isInteger(race_no)||race_no<1||race_no>12)return respond({ok:false,error:"RACE"},400);
 const db=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const found=await db.from("jra_live_races").select("*").eq("race_date",race_date).eq("track",track).eq("race_no",race_no).maybeSingle();
 if(found.error||!found.data)return respond({ok:false,error:"RACE_NOT_FOUND"},404);
 const race=found.data;
 if(race.race_type==="障害"||!["芝","ダート"].includes(race.surface))return respond({ok:false,error:"NOT_FLAT"},422);
 const runners=await db.from("jra_live_runners").select("horse_no,horse_name,horse_ref,draw,jockey,weight_carried").eq("live_race_id",race.id).order("horse_no");
 if(runners.error||!runners.data)return respond({ok:false,error:"RUNNERS_NOT_FOUND"},500);
 let byteBuffer,checkedAt;
 try{
  const controller=new AbortController();const cancel=setTimeout(()=>controller.abort(),15000);
  try{
   const sourceUrl="https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(race.cname);
   const res=await fetch(sourceUrl,{signal:controller.signal,redirect:"error",headers:{"User-Agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36","Accept-Language":"ja-JP,ja;q=0.9","Referer":"https://www.jra.go.jp/","Cache-Control":"no-cache"}});
   if(res.url!==sourceUrl)return respond({ok:false,error:"JRA_UNEXPECTED_SOURCE_URL"},422);
   if(!res.ok)return respond({ok:false,error:"JRA_HTTP_"+res.status},503);
   byteBuffer=await res.arrayBuffer();checkedAt=new Date().toISOString();
  }finally{clearTimeout(cancel)}
 }catch(e){return respond({ok:false,error:"FETCH_FAILED",detail:String(e).slice(0,150)},503)}
 if(byteBuffer.byteLength<1500||byteBuffer.byteLength>2000000)return respond({ok:false,error:"HTML_SIZE"},422);
 const html=new TextDecoder("shift_jis").decode(new Uint8Array(byteBuffer));
 try{
  const parsed=parseNumberedJraCard({html,load,expectedRace:race});
  const accepted=validateCurrentJraField({race,officialRows:parsed.rows,liveRows:runners.data,checkedAt,nowMs:Date.now()});
  // Until a real current cancellation/exclusion fixture is independently
  // validated, any non-ACTIVE row is a hard stop: do not claim to verify it.
  if(accepted.some(r=>r.status!=="ACTIVE"))
   return respond({ok:false,error:"CANCELLED_OR_EXCLUDED_REQUIRES_MANUAL_VERIFICATION",track,race_no,verified:accepted.length},422);
  if(accepted.length!==race.field_size)return respond({ok:false,error:"INCOMPLETE_FIELD"},422);
  const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(byteBuffer));
  const html_sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  const proof={
   race_date,track,race_no,cname:race.cname,html_sha256,html_bytes:byteBuffer.byteLength,
   checked_at:checkedAt,post_time:parsed.post_time,race_name:parsed.race_name,
   race:{surface:parsed.surface,distance:parsed.distance},
   runners:accepted,verification_basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",
   all_rows_reviewed:true
  };
  // The ONLY mutating action is the EXISTING production guard, which rejects
  // stale evidence, mismatched fields, late races, active leases and FROZEN.
  const saved=await db.rpc("jra_publish_verified_card_v1",{p_proof:proof});
  if(saved.error)return respond({ok:false,error:"OFFICIAL_VERIFIED_GUARD_REJECTED",details:String(saved.error.message).slice(0,180),track,race_no},422);
  // Read after write. Do not report success solely from optimistic RPC output.
  const check=await db.from("official_races")
   .select("race_date,track,race_no,field_status,source,field_payload")
   .eq("race_date",race_date).eq("track",track).eq("race_no",race_no).eq("circuit","JRA").maybeSingle();
  if(check.error||check.data?.field_status!=="BASIC_READY"||
     check.data?.field_payload?.official_status_verification?.html_sha256!==html_sha256)
    return respond({ok:false,error:"POST_PUBLISH_READBACK_MISMATCH",track,race_no},500);
  return respond({ok:true,track,race_no,date:race_date,field_status:"BASIC_READY",
   verified:accepted.length,active:accepted.length,status_guard:"ALL_ACTIVE_ONLY",
   proof_sha256:html_sha256,official_status_verified:true,
   prediction_saved:false,job_done:false});
 }catch(e){
  return respond({ok:false,error:"VALIDATION_FAILED",reason:String(e?.message??e).slice(0,240),
   parsed_source:"fresh_jra_shift_jis",date:race_date,track,race_no,no_prediction_written:true},422)
 }
});