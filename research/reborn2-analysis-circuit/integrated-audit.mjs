const ids=Array.from({length:32},(_,i)=>String(i+1).padStart(2,'0'));
const fixed=(n,unit)=>Number.isFinite(n)?n+unit:null;
const dependencies={
 '01':['finish','elapsed_seconds','final3f'],'02':['finish'],'03':['gap_winner'],'04':['gap_next'],
 '05':['elapsed_seconds'],'06':['final3f'],'07':['race_laps','corners','final3f'],
 '08':['race_laps','corners','final3f','gap_winner'],'09':['incident'],'10':['corners'],
 '11':['elapsed_seconds'],'12':['finish'],'13':['elapsed_seconds'],'14':['elapsed_seconds'],
 '15':['finish','gap_winner'],'17':['corners'],'18':['corners'],'19':['race_laps'],
 '20':['corners','race_laps'],'21':['corners'],'22':['corners'],'23':['corners','race_laps','final3f'],
 '24':['corners','final3f','finish'],'25':['corners','final3f','gap_winner'],'26':['incident'],
 '27':['incident','corners'],'28':['finish','gap_winner'],'29':['finish','gap_winner'],
 '30':['finish','elapsed_seconds'],'31':['elapsed_seconds'],'32':['elapsed_seconds']
};
const present=x=>Number.isFinite(x)||Array.isArray(x)&&x.length>0||typeof x==='string'&&x.length>0;
const raceKey=r=>JSON.stringify([r.race_date,r.track,r.race_no]);
const materialKey=r=>JSON.stringify([r.race_date,r.track,r.race_no,r.prior_no,r.source_ref]);

function describe(run,judgment) {
  const facts=[
    fixed(run.finish,'着'),fixed(run.elapsed_seconds,'秒（走破）'),
    fixed(run.gap_winner,'秒（勝ち馬との差）'),fixed(run.final3f,'秒（個馬上がり3F）'),
    run.corners?.length?'通過 '+run.corners.join('→'):null
  ].filter(Boolean);
  if(!facts.length) return null;
  return {race:{date:run.race_date,track:run.track,no:run.race_no},
    source_ref:run.source_ref,source_checked_at:run.source_checked_at,
    identity_status:run.identity_status,support:judgment?.support??[],counter:judgment?.counter??[],
    status:judgment?.status??'UNDETERMINED',
    text:[run.race_date,run.track,run.race_no+'R',facts.join('、')].join(' ')};
}

export function buildIntegratedAudit({horse,materials}) {
  const unique=new Map();
  const conflicts=[];
  for(const run of materials){
    const key=raceKey(run);
    if(unique.has(key)) {
      unique.set(key,null);
      conflicts.push(key);
    } else unique.set(key,run);
  }
  const usable=[...unique.values()].filter(Boolean);
  const judgments=new Map(horse.historical_judgments.map(j=>[j.evidence_id,j]));
  const evidence=usable.map(run=>describe(run,judgments.get(materialKey(run)))).filter(Boolean);
  const items=Object.fromEntries(ids.map(id=>{
    const fields=dependencies[id];
    const sources=fields?usable.filter(r=>fields.every(k=>present(r[k]))):[];
    const findings=horse.items[id];
    const used=horse.ability_trace.consumed_items.includes(id);
    const read=horse.ability_trace.context_items_read.includes(id);
    const observed=id==='01'?Boolean(horse.item01?.consumed_items?.length):findings.length>0;
    return [id,{
      acquisition:sources.length?'STORED_SOURCE_MATERIAL':'NO_BOUND_SOURCE_MATERIAL',
      identity:sources.length?[...new Set(sources.map(r=>r.identity_status??'UNVERIFIED'))]:[],
      source_refs:[...new Set(sources.map(r=>r.source_ref))],
      analysis:observed?'OUTPUT_PRESENT':'NO_OUTPUT',
      analysis_evidence_ids:[...new Set(findings.flatMap(f=>f.evidence_id?[f.evidence_id]:f.value?.evidence_ids??[]))],
      effect:used?'HISTORICAL_01_INPUT':read?'HISTORICAL_CONTEXT_READ':id==='01'&&observed?'HISTORICAL_01_OUTPUT':'NO_RECORDED_USE'
    }];
  }));
  const states=new Set(evidence.map(e=>e.status));
  const supporting=states.has('HISTORICAL_SUPPORT')||states.has('MIXED');
  const opposing=states.has('HISTORICAL_COUNTEREVIDENCE')||states.has('MIXED');
  return {items,evidence,conflicting_prior_keys:[...new Set(conflicts)],
    assessment:supporting&&opposing?'MIXED':supporting?'HISTORICAL_SUPPORT':
      opposing?'HISTORICAL_COUNTEREVIDENCE':'UNDETERMINED',current_ability:null};
}
