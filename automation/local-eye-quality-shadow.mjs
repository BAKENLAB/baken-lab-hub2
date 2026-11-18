/** LAB EYE 1.1 QUALITY SHADOW — research only. Do not import into live worker or official save. All comparisons must be recorded before the race. */
export function selectLocalQualityEyeShadow({runners,candidates,comparisons}) {
  const fail=(msg)=>{throw new Error("SHADOW_EYE_"+msg)};
  const nonempty=(v)=>typeof v==="string"&&v.trim().length>0;
  const refs=(v)=>Array.isArray(v)&&v.length>0&&v.every(nonempty);
  const forbidden=/人気|オッズ|popularity|odds|market/i;
  if(!Array.isArray(runners)||!Array.isArray(candidates)||!Array.isArray(comparisons))fail("SHAPE");
  const active=runners.filter(r=>r.status!=="CANCELLED"&&r.status!=="EXCLUDED");
  const pool=active.filter(r=>Number.isInteger(r.rank)&&r.rank>5);
  const ids=pool.map(r=>r.horse_no);
  if(ids.length!==new Set(ids).size||candidates.length!==pool.length)fail("POOL");
  const cMap=new Map();
  for(const c of candidates){
    if(!ids.includes(c.horse_no)||cMap.has(c.horse_no))fail("CANDIDATES");
    if(!nonempty(c.upside_trigger)||!nonempty(c.finish_path)||!nonempty(c.risk)||!Array.isArray(c.positive_factors)||!Array.isArray(c.evidence_refs))fail("EVIDENCE_SHAPE");
    if(forbidden.test(c.upside_trigger+" "+c.finish_path+" "+c.risk))fail("MARKET");
    const categories=new Set(), events=new Set(),valid=[];
    for(const f of c.positive_factors) {
      if(!nonempty(f.category)||!nonempty(f.reason)||!nonempty(f.event_id)||!refs(f.evidence_refs)||typeof f.current_relevance!=="boolean")fail("FACTOR_SHAPE");
      if(forbidden.test(f.reason))fail("MARKET");
      if(categories.has(f.category)||events.has(f.event_id))fail("DUPLICATE_FACT");
      if(!f.evidence_refs.every(ref=>c.evidence_refs.includes(ref)))fail("UNVERIFIED_REF");
      categories.add(f.category);events.add(f.event_id);
      if(f.current_relevance)valid.push(f);
    }
    cMap.set(c.horse_no,{...c,eligible:valid.length>=2,current_factors:valid.length});
  }
  const seen=new Set(), wins=new Map(ids.map(id=>[id,0]));
  if(comparisons.length!==ids.length*(ids.length-1)/2)fail("PAIR_COVERAGE");
  for(const p of comparisons){
    if(!Array.isArray(p.horse_nos)||p.horse_nos.length!==2||p.horse_nos[0]===p.horse_nos[1]||!p.horse_nos.every(id=>cMap.has(id)))fail("PAIR_ID");
    const key=[...p.horse_nos].sort((a,b)=>a-b).join(":");
    if(seen.has(key))fail("PAIR_DUPLICATE");
    seen.add(key);
    if(p.criterion!=="CURRENT_UPSIDE_OVER_BASELINE"||!nonempty(p.reason)||forbidden.test(p.reason)||!refs(p.evidence_refs))fail("PAIR_EVIDENCE");
    if(p.preferred_horse_no!==null && !p.horse_nos.includes(p.preferred_horse_no))fail("PAIR_WINNER");
    if(p.preferred_horse_no!==null){
      for(const id of p.horse_nos)if(!p.evidence_refs.some(ref=>cMap.get(id).evidence_refs.includes(ref)))fail("PAIR_UNVERIFIED");
      wins.set(p.preferred_horse_no,wins.get(p.preferred_horse_no)+1);
    }
  }
  const qualified=[...cMap.values()].filter(c=>c.eligible);
  const undefeated=qualified.filter(c=>wins.get(c.horse_no)===ids.length-1);
  const selected=undefeated.length===1?undefeated[0]:null;
  return {selected_horse_no:selected?.horse_no??null,reason:selected?"UNIQUE_EVIDENCE_BASED_UPSIDE_WINNER":qualified.length===0?"NO_CURRENT_INDEPENDENT_FACTORS":"NO_UNIQUE_COMPARATIVE_WINNER",eligible_horse_nos:qualified.map(c=>c.horse_no),rank6_auto_selected:false};
}
