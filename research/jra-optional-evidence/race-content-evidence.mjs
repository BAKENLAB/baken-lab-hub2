const analyzePastRace = (function coreModule() {
  const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+"T00:00:00Z"));
  const asOfDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) ? v.slice(0,10):null;
  const pos = x => Number.isInteger(x)&&x>0;
  const seconds = raw => {
    if(typeof raw!=="string"||!/^\d+:\d\d\.\d$/.test(raw))return null;
    const p=raw.split(":");return Number(p[0])*60+Number(p[1]);
  };
  const corners = raw => typeof raw==="string" && /^\s*\d+(?:[\s\-]+\d+)*\s*$/.test(raw) ? raw.trim().split(/[\s\-]+/).map(Number) : [];
  const normalized = r => {
    if(!r||!pos(r.horse_no)||typeof r.horse_name!=="string")return null;
    return {
      horse_no:r.horse_no,horse_name:r.horse_name,
      horse_ref:typeof r.horse_ref==="string"&&r.horse_ref?r.horse_ref:null,
      finish:pos(r.finish)?r.finish:null,
      draw:pos(r.draw)?r.draw:null,
      final_turn_pos:pos(r.final_turn_pos)?r.final_turn_pos:null,
      final3f:Number.isFinite(Number(r.final3f))&&r.final3f!=null&&Number(r.final3f)>=0?Number(r.final3f):null,
      final3f_rank:pos(r.final3f_rank)?r.final3f_rank:null,
      corners:corners(r.corner_positions),time:seconds(r.time_raw)
    };
  };
  function analyzePastRace({race,run,field,opponentHistory=[],asOf}={}) {
    const day=race&&race.race_date,cutoff=asOfDay(asOf);
    const rejected=(status,message)=>({status,facts:[],opponent_followups:[],caveats:[message],ability_score:null,evaluation_comment:null});
    if(!isDay(day)||!cutoff||day>=cutoff) return rejected("NOT_HISTORIC_AS_OF","予想日時より前のレースと確認できない");
    if(!Array.isArray(field)||!Array.isArray(opponentHistory))return rejected("INVALID_INPUT","全頭データまたは対戦相手履歴が不正");
    const runner=normalized(run),all=field.map(normalized).filter(Boolean);
    if(!runner)return rejected("INVALID_INPUT","対象馬の特定失敗");
    const matched=all.filter(r=>r.horse_no===runner.horse_no);
    if(matched.length!==1||matched[0].horse_name!==runner.horse_name||new Set(all.map(r=>r.horse_no)).size!==all.length) return rejected("FIELD_MISMATCH","馬番の重複・不一致");
    const expected=pos(race.field_size)?race.field_size:null;
    const full=expected!==null&&all.length===expected&&all.length===field.length;
    const winners=all.filter(r=>r.finish===1&&r.time!==null);
    const margin=runner.time!==null&&winners.length===1?Math.round((runner.time-winners[0].time)*10)/10:null;
    const gain=pos(runner.final_turn_pos)&&pos(runner.finish)?runner.final_turn_pos-runner.finish:null;
    const label=typeof race.race_name==="string"&&race.race_name?race.race_name:"過去レース";
    const facts=[];
    if(runner.finish!==null)facts.push(label+" "+(expected||all.length)+"頭立て "+runner.finish+"着");
    if(runner.corners.length)facts.push("通過順 "+runner.corners.join("→")+"番手");
    else if(runner.final_turn_pos!==null)facts.push("最終コーナー "+runner.final_turn_pos+"番手");
    if(runner.final3f!==null) facts.push("上がり3F "+runner.final3f.toFixed(1)+"秒"+(runner.final3f_rank!==null?"（順位"+runner.final3f_rank+"位）":""));
    if(margin!==null&&margin>=0)facts.push("勝ち馬と"+margin.toFixed(1)+"秒差");
    if(runner.draw!==null)facts.push(runner.draw+"枠");
    const rivals=all.filter(r=>r.horse_no!==runner.horse_no&&r.horse_ref);
    const refs=new Set(rivals.map(r=>r.horse_ref));
    const followups=opponentHistory.filter(h=>h&&typeof h.horse_ref==="string"&&refs.has(h.horse_ref)
          &&isDay(h.race_date)&&h.race_date>day&&h.race_date<cutoff&&pos(h.finish))
      .map(h=>{
        const rival=rivals.find(r=>r.horse_ref===h.horse_ref);
        return {horse_name:rival.horse_name,horse_no:rival.horse_no,
        followup_date:h.race_date,race_name:typeof h.race_name==="string"?h.race_name:"",
        finish:h.finish,prior_race_finish:rival.finish,temporal_relation:"LATER_RACE_KNOWN_BY_FORECAST"};
      }).sort((a,b)=>a.followup_date.localeCompare(b.followup_date)||a.horse_no-b.horse_no);
    const caveats=["通過順だけで出遅れ・不利・外回しを断定しない",
      "相手の後続戦績を一律の能力加点に使わない"];
    if(!full)caveats.push("全頭件数不足または照合不一致。対戦情報は部分的");
    if(race.archive_complete!==true)caveats.push("過去アーカイブ全体の完全性は未確認");
    if(runner.final3f===null||runner.final_turn_pos===null)caveats.push("上がりまたは最終コーナー位置が欠損");
    return {status:"READY",
      context:{race_date:day,race_name:label,class_name:race.class_name??null,track:race.track??null,
        surface:race.surface??null,distance:race.distance??null,going:race.going??null,
        field_count:all.length,expected_field_count:expected,full_field:full},
      horse:{horse_no:runner.horse_no,horse_name:runner.horse_name,finish:runner.finish,draw:runner.draw,
        final_turn_pos:runner.final_turn_pos,corner_positions:runner.corners,final3f:runner.final3f,
        final3f_rank:runner.final3f_rank,margin_to_winner_seconds:margin,
        position_gain_final_turn_to_finish:gain},
      facts,opponent_followups:followups,caveats,ability_score:null,evaluation_comment:null};
  }
  return analyzePastRace;
})();
export { analyzePastRace };
