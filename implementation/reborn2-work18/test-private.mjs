// No invented races: run only with authorized actual private Work18 input files.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runPrivate} from './run-private.mjs';
import {adaptLocalSnapshot,canonical,hashText} from './stored-acquisition.mjs';
const [jPath,lPath,otherPath]=process.argv.slice(2);
assert.ok(jPath&&lPath&&otherPath,'PRIVATE_ACTUAL_INPUTS_REQUIRED');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const j=runPrivate(read(jPath)),linput=read(lPath),l=runPrivate(linput);
assert.equal(j.supply.roster.length,12);assert.equal(j.supply.history.length,48);
assert.equal(j.supply.archive.length,34);assert.equal(j.supply.archive.reduce((n,e)=>n+e.rawRowCount,0),386);
assert.equal(j.supply.archive.reduce((n,e)=>n+e.rows.length,0),336);assert.equal(j.index.rows.length,5520);
assert.equal(l.supply.roster.length,7);assert.equal(l.supply.history.length,34);assert.equal(l.supply.cancelled.length,1);
assert.equal(l.supply.conflicts.length,1);assert.equal(l.supply.archive.length,9);assert.equal(l.index.rows.length,3910);
const other=read(otherPath),o=adaptLocalSnapshot(other.snapshot,other.expectedSnapshot);
assert.equal(o.accepted.length,35);assert.equal(o.peers.length,16);
for(const input of [linput,other]){
 const actual=input.snapshot;
 assert.equal(hashText(canonical(actual.evidence)),createHash('sha256').update(canonical(actual.evidence)).digest('hex'));
 const bad=structuredClone(actual);bad.evidence.packet.evidence[0].earlyPos=999;
 assert.throws(()=>adaptLocalSnapshot(bad,input.expectedSnapshot),/LOCAL_SNAPSHOT_PIN/);
}
console.log('Actual fixed Work18 private-input assertions completed.');
