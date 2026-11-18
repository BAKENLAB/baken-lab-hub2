// Independent read-only preview. No calls to prediction / claim / save endpoints.
// Same high-entropy shared-gate SHA-256 verifier as existing HUB preview; no raw token stored.
const DIGEST="f2f0ebcd563b80c6928d8a11d1401a11eacfeb1128db7a6b3f8317bf70a50a92";
const HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Type":"application/json; charset=utf-8"};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:HEADERS});
function collapse(rows){
 const by=new Map(), conflicts=new Set();
 for(const r of rows){
  const id=String(r.horse_ref||'').trim(), name=String(r.horse_name||'').trim(), trainer=String(r.trainer||'').trim(), date=r.jra_live_races?.race_date, track=r.jra_live_races?.track;
  if(!id||!name||!trainer||!date||!track)continue;
  const old=by.get(id), stamp=String(r.source_checked_at||'');
  if(old&&old.date===date&&old.trainer!==trainer){conflicts.add(id+'|'+date);}
  if(!old||date>old.date||(date===old.date&&stamp>old.stamp)){
    by.set(id,{id,name,trainer,age:String(r.sex_age||''),date,track,stamp});
  }
 }
 return [...by.values()].filter(r=>!conflicts.has(r.id+'|'+r.date)).map(({stamp,...r})=>r).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ja'));
}
async function trusted(req){
 const token=req.headers.get("x-lab-hub-gate")||"";
 if(!/^[0-9a-f]{96}$/.test(token)) return false;
 const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
 const h=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
 let diff=0; for(let i=0;i<DIGEST.length;i++)diff|=h.charCodeAt(i)^DIGEST.charCodeAt(i);
 return diff===0;
}
const dateFmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"});
let cached=null, inflight=null;
async function getDirectory(){
 const now=Date.now(), today=dateFmt.format(new Date(now)), since=dateFmt.format(new Date(now-89*86400000));
 if(cached&&cached.today===today&&now-cached.at<10*60*1000)return cached.data;
 if(inflight)return inflight;
 inflight=(async()=>{
  const base=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!key)throw new Error("server_config");
  const all=[];const size=1000,cap=20000;let total=null;
  for(let offset=0;offset<cap;offset+=size){
   const u=new URL("/rest/v1/jra_live_runners",base);
   u.searchParams.set("select","id,horse_ref,horse_name,trainer,sex_age,source_checked_at,jra_live_races!inner(race_date,track)");
   u.searchParams.append("jra_live_races.race_date","gte."+since);
   u.searchParams.append("jra_live_races.race_date","lte."+today);
   u.searchParams.set("order","id.asc");u.searchParams.set("limit",String(size));u.searchParams.set("offset",String(offset));
   const headers={apikey:key,Authorization:"Bearer "+key,Accept:"application/json",...(offset===0?{Prefer:"count=exact"}:{})};
   const res=await fetch(u.toString(),{method:"GET",headers,redirect:"error",signal:AbortSignal.timeout(12000)});
   if(!res.ok)throw new Error("source_unavailable");
   const txt=await res.text();if(txt.length>2000000)throw new Error("page_too_large");
   const rows=JSON.parse(txt);if(!Array.isArray(rows))throw new Error("source_shape");
   if(offset===0){const n=res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];if(n==null)throw new Error("count_missing");total=Number(n);if(total>cap)throw new Error("preview_limit");}
   all.push(...rows);if(all.length===total)break;
   if(rows.length!==size||all.length>total)throw new Error("source_changed");
  }
  if(all.length!==total||new Set(all.map(r=>r.id)).size!==all.length)throw new Error("incomplete_source");
  const horses=collapse(all), dates=horses.map(r=>r.date).sort();
  const data={ok:true,scope:"JRA",source:"HUB出馬表",checked_at:new Date().toISOString(),window_from:since,window_to:today,observed_from:dates[0]||null,observed_to:dates.at(-1)||null,horse_count:horses.length,trainer_count:new Set(horses.map(r=>r.trainer)).size,horses};
  cached={today,at:Date.now(),data};return data;
 })();
 try{return await inflight;}finally{inflight=null;}
}
Deno.serve(async req=>{
 if(req.method!=="GET")return reply({ok:false,error:"method_not_allowed"},405);
 if(!(await trusted(req)))return reply({ok:false,error:"unauthorized"},401);
 if(new URL(req.url).search)return reply({ok:false,error:"invalid_request"},400);
 try{return reply(await getDirectory());}catch(e){console.error("LAB_DIRECTORY_READ_FAILED",String(e?.message||"unknown").slice(0,100));return reply({ok:false,error:"directory_unavailable"},503);}
});
