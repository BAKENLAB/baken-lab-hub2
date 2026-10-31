// LAB VALUE research preview: read-only. No prediction save, job claim, cron, or bet generation.
// Only authenticated LAB HUB server-side proxy can call this via the existing shared gate digest.
const DIGEST="f2f0ebcd563b80c6928d8a11d1401a11eacfeb1128db7a6b3f8317bf70a50a92";
const noCache={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Type":"application/json; charset=utf-8"};
const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:noCache});
const number=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const unique=a=>[...new Set(a)];
function jstDate(d){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function toPost(race){
  const m=String(race.post_time||"").match(/(\d{1,2})時(\d{1,2})分/);
  if(!m)return NaN;
  return Date.parse(race.race_date+"T"+m[1].padStart(2,"0")+":"+m[2].padStart(2,"0")+":00+09:00");
}
function blind(race,r){
 const nr=(r.past_runs||[]).filter(h=>typeof h.race_date==="string"&&h.race_date<race.race_date&&h.surface===race.surface&&!/障害/.test(String(h.race_class||"")))
 .sort((a,b)=>b.race_date.localeCompare(a.race_date))
 .filter(h=>number(h.distance)!==null&&Math.abs(Number(h.distance)-race.distance)<=300);
 const top3=h=>[1,2,3].includes(number(h.finish));
 const narrow=h=>number(h.finish)>=4&&number(h.margin_to_winner)!==null&&number(h.margin_to_winner)<=0.4;
 const supportive=nr.filter(h=>top3(h)||narrow(h));
 const goodDates=unique(supportive.map(h=>h.race_date));
 const wins=nr.filter(h=>number(h.finish)===1);
 const podium=nr.filter(top3),close=nr.filter(narrow);
 const evidence=[];
 if(wins.length)evidence.push("NEAR_DISTANCE_WIN");
 if(podium.length>=2)evidence.push("REPEATED_NEAR_TOP3");
 if(close.length>=2)evidence.push("REPEATED_NARROW_LOSSES");
 if(wins.some(h=>number(h.margin_to_winner)>=0.3))evidence.push("DECISIVE_NEAR_WIN");
 if(podium.some(h=>number(h.early_pos)!==null&&number(h.early_pos)<=3))evidence.push("PROVEN_EARLY_POSITION");
 if(podium.length&&close.length)evidence.push("TOP3_AND_CLOSE_LOSS");
 const unknown=[];
 if(!nr.some(h=>number(h.distance)===race.distance))unknown.push("EXACT_DISTANCE_UNPROVEN");
 if(!nr.some(h=>h.track===race.track))unknown.push("TRACK_AT_NEAR_DISTANCE_UNPROVEN");
 if(/オープン|重賞|G[123ⅠⅡⅢ]/.test(String(race.class_name||""))&&
    !(r.past_runs||[]).some(h=>h.race_date<race.race_date&&/G[123ⅠⅡⅢ]|重賞|OP|オープン/.test(String(h.race_class||""))))
    unknown.push("OPEN_CLASS_UNPROVEN");
 const recentBad=nr.slice(0,3).filter(h=>number(h.finish)>=8&&number(h.margin_to_winner)>=1.5).length;
 const contrad=recentBad>=2?["REPEATED_HEAVY_DEFEATS"]:[];
 const eligible=number(r.rank)>5&&evidence.length>=2&&goodDates.length>=2&&unknown.length>0&&!contrad.length;
 return {eligible,evidence,unknown,contradictions:contrad,good_dates:goodDates.slice(0,5)};
}
async function trusted(req){
 const token=req.headers.get("x-lab-hub-gate")||"";
 if(!/^[0-9a-f]{96}$/.test(token))return false;
 const b=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
 const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<DIGEST.length;i++)diff|=h.charCodeAt(i)^DIGEST.charCodeAt(i);
 return diff===0;
}
async function readTable(base,key,table,params){
 const url=new URL("/rest/v1/"+table,base);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const r=await fetch(url.toString(),{method:"GET",headers:{"apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"},cache:"no-store"});
 if(!r.ok)throw new Error("SOURCE_"+table+"_"+r.status);
 const txt=await r.text();if(txt.length>5500000)throw new Error("SOURCE_TOO_LARGE");
 const data=JSON.parse(txt);if(!Array.isArray(data))throw new Error("SOURCE_BAD_SHAPE");
 return data;
}
Deno.serve(async req=>{
 try{
  if(req.method!=="GET")return respond({ok:false,error:"method_not_allowed"},405);
  if(!(await trusted(req)))return respond({ok:false,error:"unauthorized"},401);
  const url=new URL(req.url);
  const date=url.searchParams.get("date")||jstDate(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return respond({ok:false,error:"invalid_date"},400);
  const today=jstDate(new Date()),tomorrow=jstDate(new Date(Date.now()+86400000));
  if(date!==today&&date!==tomorrow)return respond({ok:false,error:"only_today_or_tomorrow_supported"},400);
  const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!key)return respond({ok:false,error:"server_config"},503);
  const [races,preds]=await Promise.all([
    readTable(base,key,"jra_live_races",{select:"id,race_date,track,race_no,race_name,post_time,field_size,race_type,class_name,surface,distance",race_date:"eq."+date,order:"track.asc,race_no.asc",limit:"60"}),
    readTable(base,key,"official_predictions",{select:"race_date,track,race_no,status,frozen_at,payload",race_date:"eq."+date,circuit:"eq.JRA",status:"eq.FROZEN",limit:"60"})
  ]);
  const predictionByKey=new Map(preds.map(p=>[p.track+"|"+p.race_no,p]));
  const ids=races.map(r=>r.id).filter(x=>/^[0-9a-f-]{36}$/.test(String(x)));
  const live=ids.length?await readTable(base,key,"jra_live_runners",{
    select:"live_race_id,horse_no,horse_name,past_runs,source_checked_at,win_odds",
    live_race_id:"in.("+ids.join(",")+")",limit:"1000"}):[];
  const liveByRace=new Map();
  for(const h of live){if(!liveByRace.has(h.live_race_id))liveByRace.set(h.live_race_id,new Map());
    liveByRace.get(h.live_race_id).set(number(h.horse_no),h);}
  const now=Date.now();
  let nextClaim=null;
  const reports=races.map(r=>{
    const post=toPost(r);
    const claim=post-70*60000;
    if(Number.isFinite(claim)&&post>now&&!/障害|新馬/.test(String(r.race_type||"")+" "+String(r.class_name||""))&&
      (nextClaim===null||claim<nextClaim))nextClaim=claim;
    const header={track:r.track,race_no:r.race_no,race_name:r.race_name,
      post_time:Number.isFinite(post)?new Date(post).toISOString():null,
      claim_window_opens:Number.isFinite(claim)?new Date(claim).toISOString():null};
    if(!Number.isFinite(post))return {...header,status:"INVALID_POST_TIME",candidates:[]};
    if(post<=now)return {...header,status:"POST_TIME_PASSED",candidates:[]};
    if(/障害|新馬/.test(String(r.race_type||"")+" "+String(r.class_name||"")))
      return {...header,status:"EXCLUDED_RACE_TYPE",candidates:[]};
    const p=predictionByKey.get(r.track+"|"+r.race_no);
    if(!p||Date.parse(p.frozen_at)>now||Date.parse(p.frozen_at)>=post)
      return {...header,status:"WAIT_FROZEN",candidates:[]};
    const runners=p.payload?.runners;
    const lmap=liveByRace.get(r.id);
    if(!Array.isArray(runners)||runners.length!==Number(r.field_size)||!lmap||lmap.size!==Number(r.field_size))
      return {...header,status:"INCOMPLETE_FIELD",candidates:[]};
    const nos=new Set(runners.map(x=>number(x.horse_no)));
    const ranks=new Set(runners.map(x=>number(x.rank)));
    if(nos.size!==runners.length||ranks.size!==runners.length||runners.some(x=>!lmap.has(number(x.horse_no))||
      number(x.rank)===null||number(x.score)===null))
      return {...header,status:"RUNNER_MISMATCH",candidates:[]};
    if([...lmap.values()].some(x=>!x.source_checked_at||Date.parse(x.source_checked_at)>now||
      Date.parse(x.source_checked_at)>=post||!Array.isArray(x.past_runs)))
      return {...header,status:"UNVERIFIED_PRE_RACE_SOURCE",candidates:[]};
    const candidates=[];
    for(const rr of runners){
      const h=lmap.get(number(rr.horse_no));
      if(number(rr.rank)<=5)continue;
      const audit=blind(r,{...h,rank:rr.rank});
      if(!audit.eligible)continue;
      const odds=number(h.win_odds);
      candidates.push({horse_no:number(rr.horse_no),horse_name:rr.horse_name||h.horse_name,
        rank:number(rr.rank),score:number(rr.score),evidence:audit.evidence,
        supporting_race_dates:audit.good_dates,unknown:audit.unknown,
        contradictions:audit.contradictions,win_odds:odds,
        price_band:odds===null?"WAIT_ODDS":odds>=20?"HIGH_ODDS_REVIEW":odds>=10?"MID_ODDS_REVIEW":"LOW_ODDS_REVIEW",
        source_checked_at:h.source_checked_at,original_prediction_unchanged:true,
        bet_recommendation:null});
    }
    return {...header,status:candidates.length?"RESEARCH_CANDIDATES":"NO_CANDIDATE",
      frozen_at:p.frozen_at,candidates:candidates.sort((a,b)=>(b.win_odds||0)-(a.win_odds||0))};
  });
  const summary={total:races.length,frozen:preds.length,eligible:reports.filter(x=>x.status==="RESEARCH_CANDIDATES"||x.status==="NO_CANDIDATE").length,
   pending:reports.filter(x=>x.status==="WAIT_FROZEN").length,reviewHorses:reports.reduce((n,x)=>n+x.candidates.length,0),
   highOdds:reports.reduce((n,x)=>n+x.candidates.filter(y=>y.price_band==="HIGH_ODDS_REVIEW").length,0)};
  return respond({ok:true,research_only:true,background_processing:false,auto_saving:false,bets:[],
   version:"LAB_VALUE_PREVIEW_V1",date,checked_at:new Date(now).toISOString(),
   next_claim_window_opens:nextClaim===null?null:new Date(nextClaim).toISOString(),
   disclaimer:"Pre-race read-only snapshot. Not automatic all-day processing or a betting signal.",
   summary,races:reports});
 }catch(e){console.error("VALUE_PREVIEW_FAIL",String(e?.message||"error").slice(0,130));
    return respond({ok:false,error:"research_preview_unavailable"},502);}
});
