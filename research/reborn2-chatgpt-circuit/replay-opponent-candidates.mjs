import {readFileSync} from 'node:fs';
function replayOpponentCandidates(saga,nar){
 const key=r=>JSON.stringify([r.date,r.track,r.raceNo]);
 const rows=saga.results.diagnostic.filter(x=>x.linked===true&&x.prior.raceDate<x.followup.raceDate&&x.followup.raceDate<"2026-11-22");
 const profiles=nar.profiles.map(p=>({...p,rows:p.rows.filter(r=>r.date<nar.targetDate)}));
 const pair=[];
 for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){
   const [a,b]=[profiles[i],profiles[j]];
   for(const x of a.rows)for(const y of b.rows)if(key(x)===key(y)&&x.horseNo!==y.horseNo)pair.push({race_key:JSON.parse(key(x)),horse_ids:[a.horse_id,b.horse_id],finish:[x.finish,y.finish],later_peer_rows:b.rows.filter(z=>z.date>y.date).map(z=>({date:z.date,track:z.track,race_no:z.raceNo,finish:z.finish}))});
 }
 return {saga:{status:"STORED_PRESTART_CANDIDATE",target:saga.target,diagnostics:rows.length,subjects:new Set(rows.map(x=>x.subject_no)).size,prior_and_later_corroborated:rows.filter(x=>x.prior_result_matches===1&&x.followup_result_matches===1&&x.own_finish!==null).length,peer_later_wins:rows.filter(x=>x.peer_later_finish==="1").length,peer_later_nonwins:rows.filter(x=>Number(x.peer_later_finish)>1).length,distinct_peer_followups_reported:saga.results.distinct_peer_followups,formal_admissions:0},nar:{status:"RETROSPECTIVE_CANDIDATE",target_date:nar.targetDate,profiles:profiles.map(p=>({horse_id:p.horse_id,rows:p.rows.length})),shared_races:pair,formal_admissions:0},scoring_authorized:false};
}
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
console.log(JSON.stringify(replayOpponentCandidates(read('../reborn2-opponent-evidence/local-prestart-peer-replay.json'),read('../reborn2-analysis-circuit/nar-profile-observations-20261126.json')),null,2));
