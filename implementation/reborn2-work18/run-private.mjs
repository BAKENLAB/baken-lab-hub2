// Private operator input only. No acquisition, save, publication or native admission.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {hashText,canonical,adaptJraHistory,bindJraArchive,adaptLocalSnapshot,makeSupply} from './stored-acquisition.mjs';
import {bindLocalReportedCard,bindLocalArchive,itemSupplyIndex,relationCandidates} from './item-supply.mjs';
const inventory=JSON.parse(readFileSync(new URL('../reborn2-work17/item-input-inventory.json',import.meta.url),'utf8'));
export function runPrivate(input){
 let supply,adapter,archive;
 if(input.circuit==='JRA'){
  const j=input.attached;adapter=adaptJraHistory(j);archive=bindJraArchive({...j,events:input.events},adapter);
  supply=makeSupply({target:{raceDate:j.targetDate,track:j.track,raceNo:j.raceNo,post:j.post,cutoff:j.cutoff},roster:j.roster,history:adapter.accepted,archive:archive.events});
 }else if(input.circuit==='LOCAL'){
  const snap=input.snapshot;
  assert.equal(createHash('sha256').update(canonical(snap.evidence)).digest('hex'),input.expectedSnapshot.digest);
  adapter=adaptLocalSnapshot(snap,input.expectedSnapshot);
  const h=bindLocalReportedCard(input.card,input.expectedCardDigest,adapter);
  archive=bindLocalArchive({events:input.events},h,adapter);
  supply=makeSupply({...h,archive:archive.events,local:{peers:adapter.peers,laps:adapter.laps}});
 }else throw Error('CIRCUIT');
 const {digest,...body}=supply;
 assert.equal(hashText(canonical(body)),digest);
 assert.equal(createHash('sha256').update(canonical(body)).digest('hex'),digest);
 const index=itemSupplyIndex(inventory,supply),relations=relationCandidates(supply);
 assert.equal(index.rows.length,supply.history.length*115);
 assert.equal(supply.formalAdmission,false);
 assert.equal(supply.publicationAllowed,false);
 assert.equal(supply.persistenceAllowed,false);
 return {supply,index,relations,adapter,archive};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const x=runPrivate(input),s=x.supply;
 process.stdout.write(JSON.stringify({schema:s.schema,digest:s.digest,scope:s.scope,roster:s.roster.length,history:s.history.length,archiveEvents:s.archive.length,archiveRows:s.archive.reduce((n,e)=>n+e.rawRowCount,0),boundRows:s.archive.reduce((n,e)=>n+e.rows.length,0),itemSlots:x.index.rows.length,itemsWithSomeEvidence:x.index.rows.filter(q=>q.available.length).length,allListedFields:x.index.rows.filter(q=>!q.missing.length).length,direct:x.relations.direct.length,adjacent:x.relations.adjacent.length,opponentContext:x.relations.opponentContext.length,formal:false})+'\n');
}
