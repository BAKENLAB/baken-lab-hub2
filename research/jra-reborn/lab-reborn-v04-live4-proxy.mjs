/**
 * BAKEN LAB REBORN v0.4 LIVE4 PROXY ONLY (2026-10-24).
 * Frozen as-of inputs + original immutable 2024 coefficients.
 * NOT the original v0.4 scorer: older history and 3f rank are missing.
 * No target results, popularity, odds, official predictions or training are inputs.
 * Unknown evidence enters a sensitivity range; baseline omits unverified positives.
 * This is for research-grade hypothesis only, not approved LAB performance statistics.
 */
export function scoreLockedLive4Proxy(packet, model) {
 const bad=(reason)=>({status:"REJECTED_PROXY",reason,runners:[],top5:[]});
 if(!packet||!model||model.id!=="LAB_REBORN_V04_ASOF_2024_FIT"||model.status!=="FROZEN_BEFORE_VALIDATION"||model.training!=="2024-01-01/2024-12-31"||!Array.isArray(model.coeffs)||model.coeffs.length!==152||!Array.isArray(model.cohort)||model.cohort.length!==8)return bad("BAD_LOCKED_MODEL");
 const p=packet.payload||packet;
 const stamp=packet.saved_at||p.saved_at,post=packet.source_post_time||p.source_post_time;
 if(!stamp||!post||!(Date.parse(stamp)<Date.parse(post)))return bad("NOT_PRESTART_SOURCE");
 if(!/^\d{4}-\d\d-\d\d$/.test(packet.race_date||p.race_date||""))return bad("BAD_TARGET_DATE");
 const race_date=packet.race_date||p.race_date,track=packet.track||p.track,race_no=packet.race_no||p.race_no;
 if(!track||!(+race_no>=1&&+race_no<=12)||!["芝","ダート"].includes(p.surface)||!Number.isFinite(+p.distance))return bad("BAD_RACE");
 const level=x=>{const s=String(x||"");if(/G[ⅠⅡⅢ123]|オープン|リステッド/i.test(s))return 5;if(/3勝|1600万/.test(s))return 4;if(/2勝|1000万/.test(s))return 3;if(/1勝|500万/.test(s))return 2;if(/未勝利|新馬/.test(s))return 1;return null};
 const segment= x=>x===1?"MAIDEN":x===2?"CLASS1":x===3||x===4?"CLASS2_3":x===5?"OPEN_GRADED":null;
 const cl=level(p.class_name),sg=segment(cl);
 if(!sg)return bad("UNCLASSIFIED_RACE");
 if(!Array.isArray(p.runners)||p.runners.length!==+p.field_size||p.runners.length<6)return bad("INCOMPLETE_FIELD");
 const c=new Map(model.cohort.map(x=>[[x.segment,x.surface].join("|"),+x.p]));
 const w=new Map(model.coeffs.map(x=>[[x.segment,x.surface,x.signal].join("|"),+x.coefficient]));
 const prior=c.get(sg+"|"+p.surface);
 if(!(prior>0&&prior<1))return bad("NO_COHORT");
 const names=new Set(),numbers=new Set();
 const runners=[];
 for(const h of p.runners) {
  const no=+h.horse_no;
  if(!Number.isInteger(no)||no<1||numbers.has(no)||typeof h.horse_name!=="string"||names.has(h.horse_name)||!Array.isArray(h.history))return bad("INVALID_RUNNER");
  numbers.add(no);names.add(h.horse_name);
  if(h.history.some(v=>!(typeof v.race_date==="string"&&v.race_date<race_date)))return bad("FUTURE_HISTORY");
  const history=h.history.filter(v=>Number.isInteger(+v.finish)&&+v.finish>=1).sort((a,b)=>b.race_date.localeCompare(a.race_date)).slice(0,4);
  const n4=history.length,p4=history.filter(x=>+x.finish<=3).length;
  const gap=x=>x.margin_to_winner===null||x.margin_to_winner===undefined?null:(Number.isFinite(+x.margin_to_winner)?+x.margin_to_winner:null);
  const gaps=history.map(gap).filter(x=>x!==null&&x>=0);
  const avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null;
  const closeDistance=x=>x.surface===p.surface&&x.distance!=null&&Number.isFinite(+x.distance)&&Math.abs(+x.distance - +p.distance)<=200;
  const knownSameClass=history.some(x=>level(x.race_class)===cl&&gap(x)!==null&&gap(x)<=1);
  const classUnknownPossible=!knownSameClass&&history.some(x=>level(x.race_class)===null&&gap(x)!==null&&gap(x)<=1);
  const possible3f=history.some(x=>closeDistance(x)&&+x.finish>=4&&+x.finish<=10&&gap(x)!==null&&gap(x)<=0.5);
  const sig=[
   "P"+Math.min(3,p4),"H"+Math.min(3,n4),
   "M"+(avg===null?"NONE":avg<=0.5?"A":avg<=1?"B":avg<=2?"C":"D")
  ];
  if(history.some(x=>closeDistance(x)&&+x.finish>=4&&+x.finish<=6&&gap(x)!==null&&gap(x)<=0.5))sig.push("CLOSE46");
  if(knownSameClass)sig.push("CLASS_CLOSE");
  if(history.some(x=>closeDistance(x)&&+x.finish<=3))sig.push("NEAR_PODIUM");
  if(history.filter(x=>closeDistance(x)&&+x.finish<=3).length>=2)sig.push("REPEAT");
  const rawBase=Math.log(prior/(1-prior))+sig.reduce((s,f)=>s+(w.get([sg,p.surface,f].join("|"))||0),0);
  const scenarios=[];
  for(const older of [false,true])for(const fast of (possible3f?[false,true]:[false]))for(const cls of (classUnknownPossible?[false,true]:[false])){
   const z=rawBase+(older?(w.get([sg,p.surface,"OLD_COURSE"].join("|"))||0):0)+(fast?(w.get([sg,p.surface,"FAST_CLOSE"].join("|"))||0):0)+(cls?(w.get([sg,p.surface,"CLASS_CLOSE"].join("|"))||0):0);
   scenarios.push(100/(1+Math.exp(-z)));
  }
  runners.push({horse_no:no,horse_name:h.horse_name,live_usable_n:n4,
    skipped_no_finish:h.history.length-history.length,
    missing_gap:gaps.length!==history.length,
    missing_class_possible:classUnknownPossible,missing_final3f_rank_possible:possible3f,missing_older_history:true,
    signals:sig,
    proxy_score:Math.round(scenarios[0]*100)/100,
    score_min:Math.round(Math.min(...scenarios)*10000)/10000,
    score_max:Math.round(Math.max(...scenarios)*10000)/10000});
 }
 runners.sort((a,b)=>b.proxy_score-a.proxy_score||a.horse_no-b.horse_no);
 runners.forEach((h,i)=>h.proxy_rank=i+1);
 runners.forEach(h=>{
 const above=(other,a,b)=>a>b+1e-8||(Math.abs(a-b)<=1e-8&&other.horse_no<h.horse_no);
 h.rank_min=1+runners.filter(v=>v!==h&&above(v,v.score_min,h.score_max)).length;
 h.rank_max=1+runners.filter(v=>v!==h&&above(v,v.score_max,h.score_min)).length;
 });
 return {status:"LIVE4_PROXY_ONLY_NO_FROZEN_V04_PREDICTION",model:"LAB_REBORN_V04_2024_FIXED_COEFFICIENT_LIVE4_PROXY",
 race_date,track,race_no,source_saved_at:stamp,source_post_time:post,
 required_history_signal_missing:["OLDER_5_TO_8","FINAL3F_RANK","UNKNOWN_PRIOR_CLASS"],
 any_unusable_history:runners.some(x=>x.skipped_no_finish>0||x.missing_gap),
 runners,top5:runners.slice(0,5),production_write:false,
 original_v04_complete:false,target_results_used:false,odds_used:false,
 rank_compared_to_results:false};
}
