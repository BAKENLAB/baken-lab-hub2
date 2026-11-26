import {readFileSync} from 'node:fs';
function replayConditionCandidates(nar){
  return {status:"RETROSPECTIVE_CANDIDATE",target_date:nar.targetDate,profiles:nar.profiles.map(p=>{
    const rows=p.rows.filter(r=>r.date<nar.targetDate);
    const group=k=>{const m=new Map();for(const r of rows){const v=k(r);if(!m.has(v))m.set(v,[]);m.get(v).push(r);}return [...m].map(([value,rs])=>({value,n:rs.length,wins:rs.filter(r=>r.finish===1).length,nonwins:rs.filter(r=>r.finish!==1).length,races:rs.map(r=>[r.date,r.track,r.raceNo,r.finish])}));};
    return {horse_id:p.horse_id,rows:rows.length,venue_45:group(r=>r.track),calendar_57:group(r=>r.date.slice(0,7)),formal_admissions:0};}),other_items:"NO_BOUND_VERIFIED_INPUT",scoring_authorized:false};
}
const p=new URL('../reborn2-analysis-circuit/nar-profile-observations-20261126.json',import.meta.url);
console.log(JSON.stringify(replayConditionCandidates(JSON.parse(readFileSync(p,'utf8'))),null,2));
