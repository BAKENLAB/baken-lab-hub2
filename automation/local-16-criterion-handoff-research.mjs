/** Research only, maps existing verified fact references to official criteria. Input presence is NOT evaluation completion. No rank/score authority, writes, or production connection. */
export function buildLocal16CriterionHandoff({context,protocolContent,facts,review,research=null}={}){
 const expected=["近5走を基本とした着順・着差","通過順・位置取り・上がり・不利","クラス実績と昇級/降級/クラス戻り","距離実績・距離延長短縮・距離戻り","競馬場実績・同条件実績","馬場適性","枠順・1角までの距離・脚質・同型馬","斤量・減量騎手","騎手/騎手替わり","休み明け・叩き何走目","馬体重・馬具（取得できる場合）","当日馬場傾向（取得できる場合）","今回条件で実際に走れる具体的な勝ち筋/好走筋"];
 const trExpected=["転入前の最高到達クラス","着順だけでなく着差・位置取り・走破内容","今回の地方クラスとの能力差","距離変更","小回り・先行力への適応可能性","斤量変化","初戦ゆえの不確実性"];
 const required=protocolContent?.runner_review?.required_checks,transfer=protocolContent?.transfer_audit?.checks;
 if(JSON.stringify(required)!==JSON.stringify(expected)||JSON.stringify(transfer)!==JSON.stringify(trExpected))throw Error("OFFICIAL_CRITERIA_CHANGED");
 const all=context?.runners;
 if(context?.protocol_version!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013"||context.context_format!=="COMPACT_V1"||context.field_integrity_checked!==true||context.race?.circuit!=="LOCAL"||!Array.isArray(all)||!all.length||new Set(all.map(x=>x.horse_no)).size!==all.length||facts?.status!=="VERIFIED_WHOLE_FIELD_FACTS"||facts.market_used!==false||facts.target_result_used!==false||review?.status!=="READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW"||review.score_or_rank_override!==false||facts.per_runner?.length!==all.length||review.per_runner_coverage?.length!==all.length)throw Error("UNVERIFIED_CONTEXT");
 const present=x=>x!==null&&x!==undefined&&x!==""&&x!=="?"&&(!Array.isArray(x)||x.length>0);
 const key=x=>JSON.stringify([x.race_date,x.track,x.race_no]);
 const by=new Map();let rejected=0;
 if(research!==null){
  if(research.schema!=="LOCAL_FULL_RESULT_RESEARCH_RUN_V1"||research.rank_authorized!==false||research.market_used!==false||research.production_connected!==false||!Array.isArray(research.links))throw Error("UNVERIFIED_RESEARCH_PACKET");
  for(const l of research.links){
   const p=l.priorRace,h=all.find(r=>r.horse_no===l.horse_no),hits=h?.recent_runs?.filter(r=>r.race_date===p?.raceDate&&r.track===p?.track&&r.race_no===p?.raceNo)??[];
   if(hits.length!==1||!p||p.raceDate>=context.race.race_date||l.rank_authorized!==false||l.source_timing!=="OBSERVED_BEFORE_CUTOFF"||(present(hits[0].finish)&&Number(hits[0].finish)!==l.finish)){rejected++;continue;}
   const k=h.horse_no+"|"+key(hits[0]);if(by.has(k))throw Error("DUPLICATE_RESEARCH_LINK");
   // No authenticated per-link receipt in current resolver. Keep research separate.
   by.set(k,{source_url:l.source_url,priorRace:p,finish:l.finish,winner_gap_seconds:l.winner_gap_seconds,final3f:l.final3f,corner_positions:l.corner_positions,status:"UNAUTHENTICATED_RESEARCH_ONLY"});
  }
 }
 const cond=context.race.conditions??{};
 const rows=all.map(h=>{
  const a=facts.per_runner.filter(x=>x.horse_no===h.horse_no&&x.horse_name===h.horse_name),b=review.per_runner_coverage.filter(x=>x.horse_no===h.horse_no&&x.horse_name===h.horse_name);
  if(a.length!==1||b.length!==1||!Array.isArray(h.recent_runs)||a[0].runs.length!==h.recent_runs.length||h.recent_runs.some(r=>typeof r.race_date!=="string"||r.race_date>=context.race.race_date))throw Error("ROSTER_HISTORY_MISMATCH");
  const runs=a[0].runs;if(runs.some((r,i)=>key(r)!==key(h.recent_runs[i])||r.evidence_ref!==`COMPACT_V1.runners[horse_no=${h.horse_no}].recent_runs[${i}]`))throw Error("RUN_REF_MISMATCH");
  const refs=fn=>runs.filter((r,i)=>fn(r,h.recent_runs[i])).map(r=>r.evidence_ref);
  const own=k=>present(h[k])?[`COMPACT_V1.runners[horse_no=${h.horse_no}].${k}`]:[];
  const cur=k=>present(cond[k])?[`COMPACT_V1.race.conditions.${k}`]:[];
  const hist=refs(r=>present(r.finish)||present(r.raw_margin)),corners=refs(r=>present(r.early_pos)||present(r.final_turn_pos)||present(r.final3f_seconds)),classes=[...cur("class_name"),...refs(r=>present(r.race_name))],dist=[...cur("distance"),...refs(r=>present(r.distance))],tracks=refs(r=>present(r.track)),going=[...cur("going"),...refs(r=>present(r.going))],weights=[...own("weight_carried"),...refs((r,x)=>present(x.weight_carried))],jockey=[...own("jockey"),...refs((r,x)=>present(x.jockey))],dates=refs(r=>present(r.race_date));
  const pairs=facts.head_to_head.filter(p=>p.horse_nos.includes(h.horse_no));
  const style=refs(r=>present(r.early_pos));
  const sources=[hist,corners,classes,dist,tracks,going,[...own("draw"),...style],weights,jockey,dates,[...own("body_weight"),...own("body_weight_diff"),...own("equipment")],[],[...hist,...corners,...pairs.flatMap(p=>p.refs)]];
  const caveats=["着差・5走未満の欠損","不利・区間ラップ・後続実績は未接続","地区間のクラス差を自動換算しない","距離適性は判断対象","同場≠同条件","現在と過去の比較が必要","1角距離・同型比較は別途必要。表示脚質は採点不使用","減量根拠は別確認","変更と実績を区別","仕上がりは推測しない","取得事実のみ","当日傾向未確認","独立評価必須"];
  const cell=(label,rs,caveat)=>({label,refs:[...new Set(rs)],status:rs.length?"INPUT_PRESENT_REVIEW_REQUIRED":"MISSING_OR_NOT_VERIFIED",caveat,evaluation_completed:false});
  return {horse_no:h.horse_no,horse_name:h.horse_name,criteria:required.map((x,i)=>cell(x,sources[i],caveats[i])),transfer_review:transfer.map((x,i)=>cell(x,[classes,[...hist,...corners],classes,dist,[...tracks,...style],weights,dates][i],"転入該当性と実際の比較は評価者が確認")),research_links:runs.flatMap(r=>{const x=by.get(h.horse_no+"|"+key(r));return x?[x]:[]}),lap_status:"NOT_CONNECTED",opponent_followup_status:"NOT_CONNECTED",assessment_required:true};
 });
 return {schema:"LOCAL_16_CRITERION_HANDOFF_RESEARCH_V1",rows,required_count:required.length,transfer_count:transfer.length,research_links_matched:by.size,research_links_rejected:rejected,score_authorized:false,score_computed:false,rank_authorized:false,market_used:false,target_result_used:false};
}
