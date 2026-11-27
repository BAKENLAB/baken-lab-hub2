// Public profile observations retrieved retrospectively. No prestart admission.
export function analyzeRetrospectiveProfiles({targetDate,profiles}) {
  const histories=profiles.map(profile=>{
    const url=new URL(profile.source_ref);
    if(url.origin!=='https://www.keiba.go.jp'||url.pathname!=='/KeibaWeb/DataRoom/HorseMarkInfo'||
      url.searchParams.getAll('k_lineageLoginCode').length!==1||
      url.searchParams.get('k_lineageLoginCode')!==profile.horse_id)throw Error('PROFILE_ID_MISMATCH');
    const rows=profile.rows.filter(r=>r.date<targetDate);
    const ids=rows.map(r=>JSON.stringify([r.date,r.track,r.raceNo]));
    if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_PROFILE_RACE');
    for(const r of rows){
      if(!/^\d{4}-\d\d-\d\d$/.test(r.date)||!r.track||!Number.isInteger(r.raceNo)||
         !Number.isInteger(r.horseNo)||!Number.isInteger(r.finish)||r.finish<1||
         !/^\d+:[0-5]\d\.\d$/.test(r.clock)||!Number.isFinite(r.final3f)||r.final3f<=0)
        throw Error('UNSUPPORTED_PROFILE_ROW');
    }
    return {horse_id:profile.horse_id,rows,starts:rows.length,top3:rows.filter(r=>r.finish<=3).length,
      wins:rows.filter(r=>r.finish===1).length,source_ref:profile.source_ref};
  });
  if(new Set(histories.map(h=>h.horse_id)).size!==histories.length)throw Error('DUPLICATE_PROFILE_ID');
  const [own,rival]=histories;
  const direct=own&&rival?own.rows.flatMap(a=>rival.rows.filter(b=>
    a.date===b.date&&a.track===b.track&&a.raceNo===b.raceNo&&a.horseNo!==b.horseNo)
    .map(b=>({date:a.date,track:a.track,raceNo:a.raceNo,own_finish:a.finish,rival_finish:b.finish,
      subsequent_profile_rows:rival.rows.filter(r=>r.date>a.date).map(r=>({date:r.date,track:r.track,raceNo:r.raceNo,finish:r.finish}))}))):[];
  return {status:'RETROSPECTIVE_CANDIDATE_ONLY',targetDate,histories,direct,admitted:false};
}
