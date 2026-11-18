/**
 * Official pre-score content -> original LOCAL1.6 criteria, used by claimed context.
 * DOES NOT score, rank, infer trouble, include post-start records or adopt a new rubric.
 * Every entry is explicitly "not yet judged": the scorer must explain favorable
 * AND unfavorable facts, assign independent 100pt scores, then TOP5 and 17-check EYE.
 */
export function buildLocal16LiveScoringCriteria({context,protocolContent,facts,review}={}){
 const skip=(reason)=>({status:"NOT_READY",reason,source:"OFFICIALLY_VERIFIED_PRE_RACE_ONLY",score_computed:false,score_effect:0,rank_effect:false,save_authorized:false});
 const required=protocolContent?.runner_review?.required_checks;
 const transfer=protocolContent?.transfer_audit?.checks;
 const expected=["近5走を基本とした着順・着差","通過順・位置取り・上がり・不利","クラス実績と昇級/降級/クラス戻り","距離実績・距離延長短縮・距離戻り","競馬場実績・同条件実績","馬場適性","枠順・1角までの距離・脚質・同型馬","斤量・減量騎手","騎手/騎手替わり","休み明け・叩き何走目","馬体重・馬具（取得できる場合）","当日馬場傾向（取得できる場合）","今回条件で実際に走れる具体的な勝ち筋/好走筋"];
 const trExpected=["転入前の最高到達クラス","着順だけでなく着差・位置取り・走破内容","今回の地方クラスとの能力差","距離変更","小回り・先行力への適応可能性","斤量変化","初戦ゆえの不確実性"];
 if(context?.context_format!=="COMPACT_V1"||context?.race?.circuit!=="LOCAL"||context?.field_integrity_checked!==true||
 context?.protocol_version!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013"||
 JSON.stringify(required)!==JSON.stringify(expected)||JSON.stringify(transfer)!==JSON.stringify(trExpected))
 return skip("OFFICIAL_PROTOCOL_UNAVAILABLE_OR_CHANGED");
 if(facts?.status!=="VERIFIED_WHOLE_FIELD_FACTS"||facts.market_used!==false||facts.target_result_used!==false||
 review?.status!=="READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW"||review.score_or_rank_override!==false)
 return skip("WHOLE_FIELD_OFFICIAL_FACTS_REQUIRED");
 const all=context?.runners;
 if(!Array.isArray(all)||!all.length||all.length>20||!Array.isArray(facts.per_runner)||!Array.isArray(review.per_runner_coverage)||
 facts.per_runner.length!==all.length||review.per_runner_coverage.length!==all.length||
 new Set(all.map(h=>h.horse_no)).size!==all.length)return skip("FIELD_INTEGRITY_REQUIRED");
 const positive=x=>Number.isInteger(x)&&x>=1&&x<=24;
 const present=x=>x!==null&&x!==undefined&&x!==""&&x!=="?"&&(!Array.isArray(x)||x.length>0);
 const sameKey=x=>JSON.stringify([x?.race_date,x?.track,x?.race_no]);
 const details=[];
 for(const h of all){
  const f=facts.per_runner.filter(x=>x?.horse_no===h.horse_no&&x?.horse_name===h.horse_name);
  const v=review.per_runner_coverage.filter(x=>x?.horse_no===h.horse_no&&x?.horse_name===h.horse_name);
  if(!positive(h.horse_no)||typeof h.horse_name!=="string"||!h.horse_name||f.length!==1||v.length!==1||
  !Array.isArray(h.recent_runs)||h.recent_runs.length>5||f[0].runs?.length!==h.recent_runs.length||
  f[0].runs.some((r,i)=>sameKey(r)!==sameKey(h.recent_runs[i])||
  r.evidence_ref!=="COMPACT_V1.runners[horse_no="+h.horse_no+"].recent_runs["+i+"]"||
  r.race_date>=context.race.race_date))
   return skip("HISTORY_IDENTITY_OR_ASOF_CONFLICT");
  const runs=f[0].runs,cond=context.race.conditions??{};
  const past=(fn)=>runs.filter((r,i)=>fn(r,h.recent_runs[i])).map(r=>r.evidence_ref);
  const own=(key)=>present(h[key])?["COMPACT_V1.runners[horse_no="+h.horse_no+"]."+key]:[];
  const current=(key)=>present(cond[key])?["COMPACT_V1.race.conditions."+key]:[];
  const hist=past(r=>present(r.finish)||present(r.raw_margin)||present(r.elapsed_seconds));
  const orders=past(r=>present(r.early_pos)||present(r.final_turn_pos)||present(r.final3f_seconds));
  const klass=[...current("class_name"),...past(r=>present(r.race_name))];
  const dist=[...current("distance"),...past(r=>present(r.distance))];
  const venue=past(r=>present(r.track));
  const going=[...current("going"),...past(r=>present(r.going)||present(r.surface))];
  const weight=[...own("weight_carried"),...past((r,raw)=>present(raw.weight_carried))];
  const jockey=[...own("jockey"),...past((r,raw)=>present(raw.jockey))];
  const date=past(r=>present(r.race_date));
  const pair=facts.head_to_head?.filter(p=>p.horse_nos?.includes(h.horse_no))??[];
  const head=pair.flatMap(p=>p.refs??[]);
  // Only authenticated NAR race-level official 200m splits corroborated by
  // a current horse's exact official prior-race witness, never horse splits.
  const lapRecords=context.official_lap_evidence?.status==="VERIFIED_PAST_RACE_LAPS"&&
   context.official_lap_evidence?.horse_specific_sectionals===false&&
   context.official_lap_evidence?.score_effect===0&&
   context.official_lap_evidence?.rank_effect===false?
   context.official_lap_evidence.prior_races:[];
  const lapRefs=Array.isArray(lapRecords)?lapRecords.flatMap((p,i)=>
   p?.linked_runners?.some(x=>x.horse_no===h.horse_no&&
     typeof x.run_ref==="string"&&
     h.recent_runs.some((_,j)=>x.run_ref===
      "COMPACT_V1.runners[horse_no="+h.horse_no+"].recent_runs["+j+"]"))?
     ["COMPACT_V1.official_lap_evidence.prior_races["+i+"]"]:[]):[];
  const forms=[hist,[...orders,...lapRefs],klass,dist,venue,going,[...own("draw"),...past(r=>present(r.early_pos))],weight,jockey,date,[...own("body_weight"),...own("body_weight_diff"),...own("equipment")],[],[...hist,...orders,...lapRefs,...head]];
  const transferForms=[klass,[...hist,...orders],klass,dist,[...venue,...orders],weight,date];
  const entry=(name,refs,limitations)=>({criterion:name,evidence_refs:[...new Set(refs)],data_state:refs.length?"VERIFIED_INPUT_AVAILABLE":"MISSING_INPUT",evaluation_state:"NOT_SCORED",limitations});
  const caveats=[
   "Historical results and recorded margins do not establish opponent quality alone",
   "Passage/final3f may be partial; verified race-level laps do NOT establish each horse's own split or interference",
   "Different regions and class labels must not be automatically equated",
   "Distance change is not an automatic bonus or penalty",
   "Venue and same-condition repeatability must be assessed separately",
   "Missing going or mixed-surface course cannot be inferred",
   "First-turn geometry and pace peers need separate grounded confirmation",
   "Weight advantage requires current and comparable previous weights",
   "A jockey change is not an automatic improvement",
   "Rest duration is known; physical readiness is not",
   "Missing body weight/equipment must remain unknown",
   "Same-day track trend requires independent timestamped evidence",
   "Compare favorable AND unfavorable verified observations before ranking"
  ];
  details.push({horse_no:h.horse_no,horse_name:h.horse_name,
   criteria:required.map((name,i)=>entry(name,forms[i],caveats[i])),
   transfer_review:transfer.map((name,i)=>entry(name,transferForms[i],"First confirm transfer applicability and compare actual verified class and conditions")),
   direct_opponent_pairs:pair.length,verified_history_runs:runs.length,
   full_laps:lapRefs.length?"VERIFIED_RACE_LEVEL_PARTIAL":"NOT_VERIFIED",
   opponent_followup:"NOT_VERIFIED",
   ranking_justification:"INDEPENDENT_HUMAN_OR_MODEL_ASSESSMENT_REQUIRED"});
 }
 return {status:"READY_FOR_INDEPENDENT_100_POINT_SCORING",schema:"LOCAL16_OFFICIAL_CRITERIA_INPUT_V1",
  source:"OFFICIALLY_VERIFIED_PRE_RACE_ONLY",protocol_version:context.protocol_version,
  score_computed:false,score_effect:0,rank_effect:false,save_authorized:false,
  current_and_past_checked:true,runner_count:details.length,original_checks:required.length,
  transfer_checks:transfer.length,rows:details,assessment_required:true,
  instruction:"Before TOP5 or EYE, compare the supplied official facts and actual missing/contradictory evidence for EVERY horse. Independently score 0-100 under existing LOCAL1.6, explain why evidence changes or does not change the score; do not use new fixed weights, inferred laps, opponent followup, popularity or odds."};
}