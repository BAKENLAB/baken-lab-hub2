
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
   const res=await fetch("https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(race.cname),{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36","Accept-Language":"ja-JP,ja;q=0.9","Referer":"https://www.jra.go.jp/","Cache-Control":"no-cache"}});
   if(!res.ok)return respond({ok:false,error:"JRA_HTTP_"+res.status},503);
   byteBuffer=await res.arrayBuffer();checkedAt=new Date().toISOString();
  }finally{clearTimeout(cancel)}
 }catch(e){return respond({ok:false,error:"FETCH_FAILED",detail:String(e).slice(0,150)},503)}
 if(byteBuffer.byteLength<1500||byteBuffer.byteLength>2000000)return respond({ok:false,error:"HTML_SIZE"},422);
 const html=new TextDecoder("shift_jis").decode(new Uint8Array(byteBuffer));
 try{
  const parsed=parseNumberedJraCard({html,load,expectedRace:race});
  const accepted=validateCurrentJraField({race,officialRows:parsed.rows,liveRows:runners.data,checkedAt,nowMs:Date.now()});
  return respond({ok:true,track,race_no,date:race_date,full_field:race.field_size,verified:accepted.length,
   counts:{active:accepted.filter(r=>r.status==="ACTIVE").length,cancelled:accepted.filter(r=>r.status==="CANCELLED").length,excluded:accepted.filter(r=>r.status==="EXCLUDED").length},
   first_name:accepted[0]?.horse_name,last_name:accepted.at(-1)?.horse_name,has_japanese_name:/[\u3040-\u30ff\u3400-\u9fff]/.test(accepted[0]?.horse_name??""),
   code:"READ_ONLY_VALIDATION",no_prediction_written:true});
 }catch(e){
  return respond({ok:false,error:"VALIDATION_FAILED",reason:String(e?.message??e).slice(0,240),
   parsed_source:"fresh_jra_shift_jis",date:race_date,track,race_no,no_prediction_written:true},422)
 }
});