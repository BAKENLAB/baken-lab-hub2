// Work18 per-horse/event input indexing; no grades and no authority.
import {hashText,canonical,makeSupply} from './stored-acquisition.mjs';
const ok=(v,m)=>{if(!v)throw Error(m)};
const codes={'佐賀':'32','船橋':'19','園田':'27','高知':'31','大井':'20','川崎':'21','浦和':'18','名古屋':'24','笠松':'23','金沢':'22','門別':'36','盛岡':'10','水沢':'11','姫路':'28'};
const event=z=>'NAR-'+codes[z.track]+'-'+z.date.replaceAll('-','')+'-'+String(z.raceNo).padStart(2,'0');
export function bindLocalReportedCard(p,expectedDigest,snapshot){
 ok(hashText(JSON.stringify(p))===expectedDigest,'LOCAL_CARD_DIGEST');
 ok(p.schema==='REBORN2_NORMAL_REAL_FACT_DIAGNOSTIC_1'&&p.target.targetOutcomeIncluded===false&&['marketUsed','oddsIncluded','popularityIncluded','claimStarted','predictionSaved','frozenModified'].every(k=>p.guards[k]===false),'LOCAL_CARD_FLAGS');
 const cut=p.capture.renderedDomObservedAt,post=p.target.scheduledPost;
 ok(Number.isFinite(Date.parse(cut))&&Date.parse(cut)<Date.parse(post),'LOCAL_CARD_TIME');
 const roster=p.roster.map(h=>({no:h.no,horseId:h.horseId,status:h.status,tier:'REPORTED_DOM_CARD_NOT_ORIGINAL'}));
 ok(roster.length>0&&new Set(roster.map(h=>h.horseId)).size===roster.length&&new Set(roster.map(h=>h.no)).size===roster.length&&roster.every(h=>/^\d{11}$/.test(h.horseId)&&['ACTIVE','CANCELLED','EXCLUDED'].includes(h.status)),'LOCAL_CARD_ROSTER');
 const history=[],conflicts=[],cancelled=[];
 for(const [i,h] of p.latestFiveDisplayed.entries()){
  const q=roster.find(x=>x.horseId===h.horseId);ok(q,'LOCAL_HISTORY_ROSTER');
  for(const [j,z] of h.runs.entries()){
   ok(codes[z.track]&&/^\d{4}-\d{2}-\d{2}$/.test(z.date)&&z.date<p.target.raceDate&&Number.isInteger(z.pastHorseNo),'LOCAL_HISTORY_EVENT');
   const e=event(z),root={sourceRef:p.source.raceCardUrl,pointer:'/latestFiveDisplayed/'+i+'/runs/'+j,packetDigest:expectedDigest,event:e,horseId:q.horseId,observedAt:cut};
   if(z.status==='CANCELLED'){cancelled.push({event:e,horseId:q.horseId,pastNo:z.pastHorseNo,root});continue;}
   const map={date:'date',track:'track',distance:'distanceM',going:'going',finish:'finish',clock:'time',final600:'final3f',reportedGap:'reportedGapSec',ordinalUnlabeled:'corners'};
   const facts=Object.fromEntries(Object.entries(map).filter(([k,v])=>z[v]!=null&&z[v]!=='').map(([k,v])=>[k,{value:z[v],root,sourceField:v,tier:'REPORTED_DOM_NOT_ORIGINAL'}]));
   const matches=snapshot.accepted.filter(c=>c.horseId===q.horseId&&c.event===e&&c.pastNo===z.pastHorseNo&&c.currentNo===q.no);
   if(matches.length===1){const c=matches[0];if(JSON.stringify(c.positions)===JSON.stringify(z.corners)){facts.positions={value:c.positions,root:c.root,tier:'STORED_ID_BOUND_MATCH'};facts.labels={value:c.labels,root:c.root,tier:'STORED_ID_BOUND_MATCH'};}else conflicts.push({event:e,horseId:q.horseId,pastNo:z.pastHorseNo,root,stored:c.root,reason:'ORDINAL_CONFLICT'});}
   history.push({event:e,horseId:q.horseId,currentNo:q.no,pastNo:z.pastHorseNo,facts});
  }
 }
 return {roster,history,cancelled,conflicts,target:{raceDate:p.target.raceDate,track:p.target.track,raceNo:p.target.raceNo,post,cutoff:cut}};
}
// Field presence is indexed within ONE subject and ONE prior event, not merged across samples.
export function itemSupplyIndex(inventory,supply){
 ok(supply.schema==='REBORN2_STAGE1_STORED_FACT_SUPPLY_1'&&supply.formalAdmission===false,'SUPPLY_SCOPE');
 ok(inventory.rows.length===115&&new Set(inventory.rows.map(x=>x.id)).size===115,'ITEM_IDS');
 const rows=[];
 for(const h of supply.history){
  const f=new Map(Object.entries(h.facts??{}));
  if(h.positions&&h.labels){f.set('positions',{value:h.positions,root:h.root});f.set('labels',{value:h.labels,root:h.root});}
  const event=(supply.archive??[]).find(e=>e.event===h.event),own=event?.rows.find(x=>x.horseId===h.horseId&&x.pastNo===h.pastNo);
  for(const [k,v] of Object.entries(own?.facts??{}))if(!f.has(k))f.set(k,v);
  for(const [k,v] of Object.entries(event?.context??{}))if(!f.has(k))f.set(k,v);
  // Full result remains withheld unless actually complete; partial rows have separate key.
  if(event?.rows.length)f.set('partial_prior_result',{root:{event:h.event,rows:event.rows.map(x=>x.root)},tier:'PARTIAL'});
  if(event?.recordedFullFinishField)f.set('full_prior_result',{root:{event:h.event,rows:event.rows.map(x=>x.root)},tier:'RECORDED_FULL_FINISH_NOT_STARTER_CERTIFIED'});
  const peers=supply.local?.peers?.filter(x=>x.currentNo===h.currentNo&&('NAR-'+codes[x.priorRace.track]+'-'+x.priorRace.raceDate.replaceAll('-','')+'-'+String(x.priorRace.raceNo).padStart(2,'0'))===h.event)??[];
  if(peers.length)f.set('peers',{root:peers.map(x=>x.root),tier:'STORED_PEER_NOT_FULL_RESULT'});
  const laps=supply.local?.laps?.filter(x=>('NAR-'+codes[x.event.track]+'-'+x.event.raceDate.replaceAll('-','')+'-'+String(x.event.raceNo).padStart(2,'0'))===h.event)??[];
  if(laps.length)f.set('lap',{root:laps.map(x=>x.root),tier:'RACE_LEVEL'});
  for(const item of inventory.rows){
   const evidence=item.inputs.filter(k=>f.has(k)).map(k=>({key:k,root:f.get(k).root,tier:f.get(k).tier??null}));
   rows.push({horseId:h.horseId,currentNo:h.currentNo,event:h.event,pastNo:h.pastNo,item:item.id,available:evidence,missing:item.inputs.filter(k=>!f.has(k)),limitation:item.limitation,judgment:'NOT_CERTIFIED'});
  }
 }
 return {schema:'REBORN2_STAGE1_PER_RUN_ITEM_SUPPLY_1',supplyDigest:supply.digest,rows,formal:false};
}
export function relationCandidates(supply){
 const direct=[],adjacent=[],opponentContext=[];
 for(const e of supply.archive??[]){
  const own=supply.history.filter(h=>h.event===e.event).map(h=>({h,row:e.rows.find(x=>x.horseId===h.horseId&&x.pastNo===h.pastNo)})).filter(x=>x.row);
  for(const [i,a] of own.entries()){
   for(const b of own.slice(i+1))if(a.h.horseId!==b.h.horseId&&a.row.facts.finish&&b.row.facts.finish)direct.push({event:e.event,a:a.row.root,b:b.row.root,finishA:a.row.facts.finish.value,finishB:b.row.facts.finish.value,tier:'EXACT_ROW_PAIR_NOT_GRADE'});
   const rank=Number(a.row.facts.finish?.value);if(Number.isInteger(rank)&&rank>0){
    const next=e.rows.filter(x=>Number(x.facts.finish?.value)===rank+1);
    if(next.length===1&&a.row.facts.clock&&next[0].facts.clock)adjacent.push({event:e.event,own:a.row.root,other:next[0].root,ownClock:a.row.facts.clock.value,otherClock:next[0].facts.clock.value,tier:'OBSERVED_NEXT_RANK_CLOCK_PAIR_NOT_OFFICIAL_MARGIN'});
   }
   opponentContext.push({event:e.event,subject:a.row.root,opponents:e.rows.filter(x=>x.horseId!==a.h.horseId).map(x=>x.root),classRoot:e.context.classLiteral?.root??null,full:e.recordedFullFinishField,tier:'PARTIAL_CONTEXT_NOT_STRENGTH'});
  }
 }
 return {direct,adjacent,opponentContext,formal:false};
}
