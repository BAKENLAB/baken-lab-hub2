// BAKEN LAB VALUE — RESEARCH ONLY. No network, DB writes or bet generation.
const num = v => v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const ts = v => v ? Date.parse(v) : NaN;
const uniq = xs => [...new Set(xs)];
const place = r => [1,2,3].includes(num(r.finish));

function blindAudit(race, runner) {
  const history=(runner.past_runs||[]).filter(x =>
    typeof x.race_date==="string" && x.race_date<race.race_date &&
    x.surface===race.surface && !/障害/.test(String(x.race_class||"")))
    .sort((a,b)=>b.race_date.localeCompare(a.race_date));
  const near=history.filter(x=>num(x.distance)!==null && Math.abs(num(x.distance)-race.distance)<=300);
  const narrow=x=>num(x.finish)!==null && num(x.finish)>=4 &&
    num(x.margin_to_winner)!==null && num(x.margin_to_winner)<=0.4;
  const supportive=near.filter(x=>place(x)||narrow(x));
  const top3=near.filter(place);
  const wins=near.filter(x=>num(x.finish)===1);
  const close=near.filter(narrow);
  const decisive=wins.filter(x=>num(x.margin_to_winner)!==null && num(x.margin_to_winner)>=0.3);
  const front=top3.filter(x=>num(x.early_pos)!==null && num(x.early_pos)<=3);
  const evidence=[];
  if(wins.length)evidence.push("NEAR_DISTANCE_WIN");
  if(top3.length>=2)evidence.push("REPEATED_NEAR_DISTANCE_TOP3");
  if(close.length>=2)evidence.push("REPEATED_NARROW_DEFEATS");
  if(decisive.length)evidence.push("DECISIVE_NEAR_DISTANCE_WIN");
  if(front.length)evidence.push("PROVEN_EARLY_POSITION");
  if(top3.length && close.length)evidence.push("TOP3_AND_NARROW_DEFEAT");
  const unknown=[];
  if(!history.some(x=>num(x.distance)===race.distance))unknown.push("EXACT_DISTANCE_UNPROVEN");
  if(!near.some(x=>x.track===race.track))unknown.push("TRACK_AT_NEAR_DISTANCE_UNPROVEN");
  if(/オープン|重賞|G[123ⅠⅡⅢ]/.test(String(race.class_name||"")) &&
     !history.some(x=>/重賞|OP|オープン|G[123ⅠⅡⅢ]/.test(String(x.race_class||""))))
     unknown.push("OPEN_CLASS_UNPROVEN_APPROXIMATE");
  const contradictions=[];
  if(near.slice(0,3).filter(x=>num(x.finish)>=8 && num(x.margin_to_winner)>=1.5).length>=2)
    contradictions.push("REPEATED_RECENT_HEAVY_DEFEATS");
  const dates=uniq(supportive.map(x=>x.race_date));
  return {horse_no:runner.horse_no,horse_name:runner.horse_name,
    original_rank:runner.rank,original_score:runner.score,evidence,
    supporting_race_dates:dates,unknown,contradictions,
    excluded_bad_history:(runner.past_runs||[]).filter(x=>!x.race_date||x.race_date>=race.race_date).length,
    pre_market_review:num(runner.rank)>5 && evidence.length>=2 && dates.length>=2 &&
      unknown.length>=1 && contradictions.length===0};
}

/* Pure, read-only research function. Inputs: race {race_date,track,race_no,
 post_time:timezone ISO,surface,distance,class_name,race_type,field_size},
 frozen {status:"FROZEN",frozen_at:timezone ISO},
 runners [{horse_no,horse_name,rank,score,past_runs,history_captured_at:timezone ISO}],
 market? {captured_at:timezone ISO,runners:[{horse_no,win_odds}]},
 as_of:timezone ISO. Neither race results nor betting strategy inputs accepted. */
export function evaluateLabValue({race,frozen,runners,market=null,as_of}) {
  const now=ts(as_of), post=ts(race?.post_time), froze=ts(frozen?.frozen_at);
  const base={status:"BLOCKED",reason:null,pre_market_candidates:[],price_watch:[],
    no_price_review:[],original_prediction_unchanged:true,proposed_ranks:null,
    proposed_scores:null,bets:[],bet_strategy:"SUSPENDED_FOR_ABILITY_STABILITY"};
  if(!Number.isFinite(now)||!Number.isFinite(post)||!race?.race_date)
    return {...base,reason:"INVALID_RACE_OR_EVALUATION_CLOCK"};
  if(now>=post)return {...base,reason:"POST_TIME_PASSED"};
  if(frozen?.status!=="FROZEN"||!Number.isFinite(froze)||froze>=post||froze>now)
    return {...base,reason:"NO_VALID_PRE_RACE_FROZEN"};
  if(/新馬|障害/.test(String(race.race_type||race.class_name||"")))
    return {...base,reason:"EXCLUDED_RACE_TYPE"};
  if(!Array.isArray(runners)||!Number.isInteger(race.field_size)||
     runners.length!==race.field_size||runners.length<2)
    return {...base,reason:"INCOMPLETE_FIELD"};
  if(new Set(runners.map(x=>num(x.horse_no))).size!==runners.length||
     new Set(runners.map(x=>num(x.rank))).size!==runners.length||
     runners.some(x=>num(x.rank)===null||num(x.score)===null||
       !Array.isArray(x.past_runs)||!Number.isInteger(num(x.horse_no))))
    return {...base,reason:"INVALID_FROZEN_RUNNERS"};
  if(runners.some(x=>!Number.isFinite(ts(x.history_captured_at))||
     ts(x.history_captured_at)>now||ts(x.history_captured_at)>=post))
    return {...base,reason:"UNVERIFIED_HISTORY_CAPTURE_TIME"};
  const all=runners.map(x=>blindAudit(race,x));
  const pre=all.filter(x=>x.pre_market_review);
  if(!market||!Number.isFinite(ts(market.captured_at))||
     ts(market.captured_at)>now||ts(market.captured_at)>=post||
     !Array.isArray(market.runners))
    return {...base,status:"WAIT_MARKET",reason:"NO_VERIFIED_PRE_RACE_MARKET",
      pre_market_candidates:pre,all_audits:all};
  const odds=new Map(market.runners.map(x=>[num(x.horse_no),num(x.win_odds)]));
  const priced=pre.map(x=>{
    const v=odds.get(num(x.horse_no));
    const price_band=v===undefined||v===null||!Number.isFinite(v)||v<1 ?
      "NO_ODDS" : v>=20 ? "HIGH_ODDS_REVIEW" : v>=10 ?
      "MID_ODDS_REVIEW" : "LOW_ODDS_OR_SHORT_PRICE";
    return {...x,win_odds:v??null,price_band,
      estimated_win_probability:null,estimated_place_probability:null,
      expected_value:null,bet_recommendation:null};
  });
  return {...base,status:"READY_RESEARCH_ONLY",reason:null,
    pre_market_candidates:pre,price_watch:priced.filter(x=>x.price_band==="HIGH_ODDS_REVIEW"),
    no_price_review:priced.filter(x=>x.price_band!=="HIGH_ODDS_REVIEW"),
    all_audits:all,market_captured_at:market.captured_at};
}
