/**
 * JRA VERIFIED OFFICIAL CARD PUBLISHER -- STAGED ONLY.
 * DO NOT DEPLOY until actual JRA HTML fixtures have been verified end-to-end.
 * Requires verify_jwt:true AND a secret JRA_VERIFIER_TOKEN_SHA256 environment value.
 * Does NOT save predictions; only calls existing guarded BASIC_READY publisher.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {load} from "npm:cheerio@1.0.0";
import {parseNumberedJraCard} from "./parse-numbered-card.mjs";
import {validateCurrentJraField} from "./validate-current-field.mjs";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim();
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
const safeEq=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
const jstDate=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const timeoutMs=15000;
const TRACKS=new Set(["東京","京都","新潟","中山","阪神","中京","小倉","福島","札幌","函館"]);

Deno.serve(async req=>{
  if(req.method!=="POST")return reply({ok:false,error:"POST_ONLY"},405);
  const secretHash=Deno.env.get("JRA_VERIFIER_TOKEN_SHA256");
  const supplied=req.headers.get("x-jra-verifier-token")??"";
  if(!secretHash||!/^[a-f0-9]{64}$/.test(secretHash)||supplied.length<24)return reply({ok:false,error:"UNAUTHORIZED"},401);
  const tokenHash=await sha256(new TextEncoder().encode(supplied));
  if(!safeEq(tokenHash,secretHash))return reply({ok:false,error:"UNAUTHORIZED"},401);
  let input:any;try{input=await req.json()}catch{return reply({ok:false,error:"INVALID_JSON"},400)}
  if(!input||Object.keys(input).sort().join(",")!=="race_date,race_no,track")return reply({ok:false,error:"INVALID_PARAMS"},400);
  const date=String(input.race_date??""),track=clean(input.track),no=Number(input.race_no);
  if(date!==jstDate()||!TRACKS.has(track)||!Number.isInteger(no)||no<1||no>12)return reply({ok:false,error:"INVALID_RACE"},400);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return reply({ok:false,error:"SERVER_CONFIG_MISSING"},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const raceQuery=await db.from("jra_live_races").select("*")
    .eq("race_date",date).eq("track",track).eq("race_no",no).maybeSingle();
  if(raceQuery.error)return reply({ok:false,error:"RACE_READ_ERROR"},500);
  const race=raceQuery.data;
  if(!race||race.race_type==="障害"||!["芝","ダート"].includes(race.surface)||
     !Number.isInteger(race.field_size)||!race.cname)return reply({ok:false,error:"UNSUPPORTED_OR_MISSING_LIVE_RACE"},422);
  const runnersQuery=await db.from("jra_live_runners")
    .select("horse_no,horse_name,horse_ref,draw,jockey,weight_carried")
    .eq("live_race_id",race.id).order("horse_no",{ascending:true});
  if(runnersQuery.error||!runnersQuery.data)return reply({ok:false,error:"RUNNERS_READ_ERROR"},500);
  // Current SOURCE, fetched afresh; never derive proof time/hash from stored historical capture.
  const controller=new AbortController(),cancel=setTimeout(()=>controller.abort(),timeoutMs);
  let bytes:Uint8Array;
  try {
    const sourceUrl="https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(race.cname);
    const response=await fetch(sourceUrl,{signal:controller.signal,redirect:"follow",
      headers:{"user-agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        "accept":"text/html,application/xhtml+xml","accept-language":"ja-JP,ja;q=0.9","cache-control":"no-cache"}});
    if(!response.ok)throw Error("OFFICIAL_FETCH_HTTP_"+response.status);
    bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<1500||bytes.length>2000000)throw Error("OFFICIAL_HTML_SIZE_UNEXPECTED");
  } catch(error) {
    return reply({ok:false,error:"CURRENT_OFFICIAL_CARD_FETCH_FAILED",detail:String(error).slice(0,120)},503);
  } finally {clearTimeout(cancel)}
  const checkedAt=new Date().toISOString();
  try {
    const html=new TextDecoder("shift_jis").decode(bytes);
    const parsed=parseNumberedJraCard({html,load,expectedRace:race});
    const verifiedRows=validateCurrentJraField({
      race,officialRows:parsed.rows,liveRows:runnersQuery.data,checkedAt,nowMs:Date.now()});
    const proof={
      race_date:date,track,race_no:no,cname:race.cname,
      html_sha256:await sha256(bytes),html_bytes:bytes.length,checked_at:checkedAt,
      post_time:parsed.post_time,race_name:parsed.race_name,
      race:{surface:parsed.surface,distance:parsed.distance},
      runners:verifiedRows,verification_basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",
      all_rows_reviewed:true
    };
    // The existing production SQL function is the only publisher. It rejects
    // stale proof, mismatched runners, active claims, old races and frozen races.
    const saved=await db.rpc("jra_publish_verified_card_v1",{p_proof:proof});
    if(saved.error)return reply({ok:false,error:"VERIFIED_PUBLISH_GUARD_REJECTED",detail:String(saved.error.message).slice(0,160)},422);
    return reply({ok:true,publication:saved.data,
      proof_basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",
      source_checked_at:checkedAt,runner_count:verifiedRows.length});
  } catch(error) {
    return reply({ok:false,error:"CURRENT_OFFICIAL_CARD_NOT_VERIFIED",
      detail:String(error?.message??error).slice(0,180)},422);
  }
});
