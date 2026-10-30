// Research only: compute evidence-based alternate running-style features.
// Never mutates the input context, CHAPPY ranks, grades, EYE or FROZEN payload.
// Rejects records without exact official runner identity and race/date provenance.
const clean = x => String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const styles=Object.freeze(['逃','先','差','追']);
export function buildDebaRunningStyleShadow({context,priorEvidence}){
  if(!context || !context.race || !Array.isArray(context.runners) ||
    !Array.isArray(priorEvidence))throw Error('SHADOW_CONTEXT_INVALID');
  const day=context.race.race_date;
  if(typeof day!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(day))throw Error('SHADOW_RACE_DATE_INVALID');
  const output=[];
  for(const runner of context.runners){
    const actualStyle=runner.running_style_reference ?? ['?'];
    const raw=priorEvidence.filter(x=>x.current_horse_no===runner.horse_no);
    let valid=true;
    const identities=runner.identity_refs||[];
    if(raw.length>5 || !Array.isArray(identities) || identities.length!==1)valid=false;
    const seenDates=new Set(),seenSlots=new Set(),positions=[];
    for(const x of raw){
      if(x.source!=='NAR_OFFICIAL_DEBA_PAST_COLUMN' || x.source_ref!==runner.current_source_ref ||
        x.identity_source_ref!==identities[0] || clean(x.horse_name)!==clean(runner.horse_name) ||
        x.race_date>=day || !/^20\d{2}-\d{2}-\d{2}$/.test(x.race_date) ||
        !Number.isInteger(x.slot) || x.slot<1 || x.slot>5 ||
        !Number.isInteger(x.early_pos) || x.early_pos<1 || x.early_pos>20 ||
        !Number.isInteger(x.final_turn_pos)||x.final_turn_pos<1||x.final_turn_pos>20 ||
        seenDates.has(x.race_date)||seenSlots.has(x.slot)){valid=false;break}
      const match=Array.isArray(runner.recent_runs)?runner.recent_runs.find(r=>r.race_date===x.race_date):null;
      if(match && match.early_pos!=null && Number(match.early_pos)!==x.early_pos){valid=false;break}
      seenDates.add(x.race_date);seenSlots.add(x.slot);positions.push(x.early_pos);
    }
    let proposed=['?'];
    if(valid && positions.length>=2){
      const c={逃:0,先:0,差:0,追:0};
      for(const n of positions){if(n===1)c.逃++;else if(n<=4)c.先++;else if(n<=8)c.差++;else c.追++}
      const selected=styles.filter(s=>c[s]>=2);
      if(selected.length)proposed=selected;
    }
    output.push({horse_no:runner.horse_no,horse_name:runner.horse_name,
      original_style:actualStyle,shadow_style:proposed,
      verified_passage_count:valid?positions.length:0,
      evidence_status:!valid?'REJECTED_CONFLICT':positions.length<2?'INSUFFICIENT':'RESEARCH_ONLY',
      // Source references prove *where* evidence came from, not whether ranking will improve.
      sources:valid?[...new Set(raw.map(x=>x.source_ref))]:[]});
  }
  return {race:{...context.race},runners:output,
    ranking_changed:false,score_changed:false,production_ready:false};
}
