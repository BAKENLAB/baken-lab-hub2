// Read-only G1 information-coverage adapter for officially claimed JRA races.

// NO scoring, rank, EYE, FROZEN, odds, wagering or DB writes.

function norm(v){return String(v??"").normalize("NFKC").trim();}

function asDate(s){const t=Date.parse(s??"");return Number.isFinite(t)?t:NaN;}

function number(v){const n=Number(v);return Number.isFinite(n)?n:null;}

function isG1Race(context){
 const r=context?.race??{},d=r.field_payload?.race??{};
 const name=norm(d.race_name??d.name??d.race_title??r.race_name??r.name);
 const grade=norm(d.grade??d.grade_name??d.class_name??r.grade);
 const known=["フェブラリーステークス","高松宮記念","大阪杯","桜花賞","皐月賞","天皇賞(春)","NHKマイルカップ","ヴィクトリアマイル","優駿牝馬","東京優駿","安田記念","宝塚記念","スプリンターズステークス","秋華賞","菊花賞","天皇賞(秋)","エリザベス女王杯","マイルチャンピオンシップ","ジャパンカップ","チャンピオンズカップ","阪神ジュベナイルフィリーズ","朝日杯フューチュリティステークス","ホープフルステークス","有馬記念"];
 return {name,grade,yes:/^(?:G1|GI|GⅠ|グレード1)$/i.test(grade)||known.includes(name)};
}

export function buildG1IntelligenceAudit(context,{observedAt,payload}={}){
 const base={version:"JRA_G1_INTELLIGENCE_AUDIT_V1",mode:"EVIDENCE_COVERAGE_ONLY",score_delta:0,
  rank_changed:false,top5_changed:false,eye_changed:false,save_authorized:false,
  frozen_modified:false,market_used:false,target_result_used:false};
 const id=isG1Race(context);
 if(!id.yes)return {...base,status:"SKIPPED_NON_G1",race_name:id.name};
 const rc=context?.race??{},raceDate=rc.race_date,post=asDate(rc.post_time),now=asDate(observedAt);
 if(context?.stage!=="AWAITING_JRA_FULL_DEPTH_COMPARISON"||!Number.isFinite(post)||!Number.isFinite(now)||
    now>=post||!(/^\d{4}-\d{2}-\d{2}$/.test(raceDate??"")))
  return {...base,status:"BLOCKED_NOT_VALID_PRE_RACE_CLAIM",race_name:id.name};
 const full=rc.field_payload?.runners,hist=context?.runner_history;
 if(!Array.isArray(full)||!Array.isArray(hist))
  return {...base,status:"BLOCKED_MISSING_OFFICIAL_FIELD_OR_HISTORY",race_name:id.name};
 const active=full.filter(r=>r?.status==="ACTIVE"),byNo=new Map();
 if(active.length<6||active.length>24||active.some(r=>!Number.isInteger(r.horse_no)||!norm(r.horse_name)||byNo.has(r.horse_no)||!byNo.set(r.horse_no,norm(r.horse_name))))
  return {...base,status:"BLOCKED_INVALID_OFFICIAL_ACTIVE_FIELD",race_name:id.name};
 const hByNo=new Map();
 for(const h of hist){
  if(!Number.isInteger(h?.horse_no)||hByNo.has(h.horse_no)||!byNo.has(h.horse_no)||
     norm(h.horse_name)!==byNo.get(h.horse_no))
   return {...base,status:"BLOCKED_HISTORY_IDENTITY_MISMATCH",race_name:id.name};
  hByNo.set(h.horse_no,h);
 }
 if(hByNo.size!==active.length)
  return {...base,status:"BLOCKED_INCOMPLETE_HISTORY",race_name:id.name};
 const ranked=Array.isArray(payload?.runners)?payload.runners:context?.candidates;
 const rankType=Array.isArray(payload?.runners)?"PRE_SAVE_DRAFT_SCORE_RANK":"BASE_CORE_NOT_FINAL_100PT";
 const ranks=new Map((Array.isArray(ranked)?ranked:[]).map(r=>[r.horse_no,Number(r.rank??r.base_rank)]));
 const content=new Map((Array.isArray(context?.runner_content_evidence)?context.runner_content_evidence:[]).map(r=>[r.horse_no,r]));
 const pace=new Map((Array.isArray(context?.field_pace_evidence?.runners)?context.field_pace_evidence.runners:[]).map(r=>[r.horse_no,r]));
 const rel=new Map((Array.isArray(context?.relative_condition_evidence?.runner_evidence)?context.relative_condition_evidence.runner_evidence:[]).map(r=>[r.horse_no,r]));
 const perRunner=[];
 for(const r of active){
  const h=hByNo.get(r.horse_no),runs=h.past_runs;
  if(!Array.isArray(runs))
   return {...base,status:"BLOCKED_MISSING_PAST_RUN_ARRAY",race_name:id.name,horse_no:r.horse_no};
  if(runs.some(p=>typeof p?.race_date!=="string"||p.race_date>=raceDate))
   return {...base,status:"BLOCKED_FUTURE_OR_UNDATED_RUN",race_name:id.name,horse_no:r.horse_no};
  const rank=ranks.get(r.horse_no),finishers=runs.filter(p=>{const f=number(p.prior_finish??p.finish);return f!==null&&f>0;});
  const closeLoss=finishers.filter(p=>{const f=number(p.prior_finish??p.finish);const m=number(p.winner_margin_seconds??p.margin_seconds);return f>=4&&f<=9&&m!==null&&m<=0.6&&m>=0;}).length;
  const withCorners=runs.filter(p=>norm(p.corner_positions??p.official_corner_positions)).length;
  const withLast3f=runs.filter(p=>number(p.final3f??p.official_final3f)!==null).length;
  const missing=["LOSS_CAUSE_EXPLICIT_PROOF","PRE_RACE_TRAINER_COMMENT","PRE_RACE_WORKOUT_CHANGE","EQUIPMENT_CHANGE"];
  perRunner.push({horse_no:r.horse_no,horse_name:byNo.get(r.horse_no),
   rank:Number.isInteger(rank)&&rank>0?rank:null,
   near_top5_boundary:Number.isInteger(rank)&&rank>=4&&rank<=10,
   past_run_count:runs.length,prior_top3_count:finishers.filter(p=>number(p.prior_finish??p.finish)<=3).length,
   prior_close_losses_to_review:closeLoss,
   prior_corner_runs:withCorners,prior_final3f_runs:withLast3f,
   has_separate_content_evidence:content.has(r.horse_no),
   has_pace_field_evidence:pace.has(r.horse_no),
   has_relative_opponent_evidence:rel.has(r.horse_no),
   external_pre_race_checks_required:missing
  });
 }
 return {...base,status:"READY_READ_ONLY_REVIEW",race_name:id.name,race_date:raceDate,
  field_count:active.length,full_field_verified:true,rank_basis:rankType,
  per_runner:perRunner,
  g1_review_priorities:["CAUSE_OF_PRIOR_LOSS_FROM_VERIFIED_EVIDENCE","VENUE_DISTANCE_TRACK_AND_OPPONENT_FIT","PRE_RACE_GEAR_WORKOUT_TRAINER_CHANGES_REQUIRE_EXTERNAL_PROOF","FRONT_RUNNER_COMPETITION_AND_PACE_SCENARIOS","RECHECK_RANKS_4_TO_10_WITHOUT_AUTO_PROMOTION","NO_DOUBLE_COUNTED_PAST_RUN_FACTORS"],
  caveat:"Missing external pre-race information means NOT_VERIFIED, never a claim that no change occurred. Retrospective research scores are not used."};
}

