// Work18: per-subject and per-prior-event availability, never scoring or source admission.
const valid=v=>v!==null&&v!==undefined&&v!==''&&(!Array.isArray(v)||v.length>0);
const keys=f=>Object.keys(f??{}).filter(k=>valid(f[k]?.value));
const uniq=a=>[...new Set(a)].sort();
const eventKey=e=>'NAR-'+({'佐賀':'32','船橋':'19','園田':'27','高知':'31','大井':'20','川崎':'21','浦和':'18','名古屋':'24','笠松':'23','金沢':'22','門別':'36','盛岡':'10','水沢':'11','姫路':'28'}[e.track]??'?')+'-'+e.raceDate.replaceAll('-','')+'-'+String(e.raceNo).padStart(2,'0');
export function buildScopedInventory({inventory,scope,subjects,history=[],archive=[],local=null,context=null,fieldPass=false}){
 if(inventory.length!==115||new Set(inventory.map(x=>x.id)).size!==115)throw Error('INVENTORY_115');
 if(new Set(subjects.map(s=>s.no)).size!==subjects.length)throw Error('DUPLICATE_SUBJECT');
 const details=[];
 for(const s of subjects){
  const base=new Set();
  if(fieldPass&&s.horseId)base.add('field_identity');
  if(context){if(valid(context.race_date))base.add('current_date');if(valid(context.distance))base.add('current_distance');if(valid(context.class_name))base.add('current_class');if(valid(context.surface)&&valid(context.distance)&&valid(context.going))base.add('current_condition');}
  if(valid(s.weight))base.add('current_weight');
  if(valid(s.bodyWeight))base.add('current_weight_body');
  if(valid(s.equipment))base.add('current_equipment');
  if(valid(s.jockeyName))base.add('current_jockey');
  const runs=new Map();
  const entry=e=>{if(!runs.has(e))runs.set(e,new Set(base));return runs.get(e);};
  const matchedArchive=[];
  if(s.horseId)for(const h of history.filter(x=>x.currentNo===s.no&&x.horseId===s.horseId)){
   const k=entry(h.event);for(const x of keys(h.facts))k.add(x);
   const a=archive.find(x=>x.event===h.event);
   const m=a?.rows.filter(x=>x.horseId===h.horseId&&x.pastNo===h.pastNo)??[];
   if(m.length===1){for(const x of keys(m[0].facts))k.add(x);for(const x of keys(a.context))k.add(x);matchedArchive.push({event:h.event,rows:a.rows.length,recordedComplete:a.recordedFullFinishField});if(a.recordedFullFinishField)k.add('full_prior_result');}
  }
  if(s.horseId&&local)for(const h of local.accepted.filter(x=>x.currentNo===s.no&&x.horseId===s.horseId)){
   const k=entry(h.event);if(valid(h.positions))k.add('positions');if(valid(h.labels))k.add('labels');
   if(local.peers.some(p=>p.currentNo===s.no&&eventKey(p.priorRace)===h.event))k.add('peers');
   if(local.laps.some(p=>eventKey(p.event)===h.event))k.add('lap');
  }
  const all=new Set([...base,...[...runs.values()].flatMap(x=>[...x])]);
  const evaluate=k=>({any:inventory.filter(i=>i.inputs.some(x=>k.has(x))).map(i=>i.id),allListed:inventory.filter(i=>i.inputs.every(x=>k.has(x))).map(i=>i.id)});
  const total=evaluate(all);
  details.push({no:s.no,identityPresent:!!s.horseId,rosterBound:fieldPass&&!!s.horseId,historyEvents:runs.size,matchedArchive,keys:uniq([...all]),candidateItems:total.any,allListedAcrossRuns:total.allListed,events:[...runs.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([event,k])=>({event,keys:uniq([...k]),...evaluate(k)}))});
 }
 const rows=inventory.map(i=>({id:i.id,name:i.name,requiredInputs:i.inputs,work16Status:i.work16Status,subjectsWithAny:details.filter(d=>d.candidateItems.includes(i.id)).map(d=>d.no),subjectsWithAllListedSamePriorEvent:details.filter(d=>d.events.some(e=>e.allListed.includes(i.id))).map(d=>d.no),subjectsWithAllListedAcrossRuns:details.filter(d=>d.allListedAcrossRuns.includes(i.id)).map(d=>d.no),missingBySubject:details.map(d=>({no:d.no,keys:i.inputs.filter(k=>!d.keys.includes(k))})),status:'NOT_CERTIFIED',missingInterpretation:i.work16Status==='DIRECT_NOT_PUBLISHED'?'DIRECT_MEASUREMENT_NOT_PUBLISHED; ordinary evidence is candidate only':'NOT_OBSERVED_IN_THIS_EXECUTION; not proof of unavailability'}));
 return {scope,subjectCount:subjects.length,rosterBound:fieldPass,details,rows,formalAdmission:false,publicationAllowed:false};
}
export function snapshotSubjects(local){
 const byNo=new Map();for(const h of local.accepted){const set=byNo.get(h.currentNo)??new Set();set.add(h.horseId);byNo.set(h.currentNo,set);}
 return [...byNo.entries()].sort(([a],[b])=>a-b).map(([no,ids])=>({no,horseId:ids.size===1?[...ids][0]:null}));
}
