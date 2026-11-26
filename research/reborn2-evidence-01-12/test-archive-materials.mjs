import assert from 'node:assert/strict';
import { supplyArchiveMaterials } from './archive-materials.mjs';
const rows = Array.from({length:6},(_,i)=> ({
 current_no:1,prior_no:1,race_date:'2026-10-0'+(i+1),track:'fixture',race_no:1,
 source_ref:'fixture',source_checked_at:'2026-10-15T00:00:00Z',finish:1,final3f:30,
 elapsed_seconds:60,lap_winner_seconds:60,halon_times:'12 - 12 - 12 - 12 - 12',
 distance:1000,surface:'芝',going:'良',corner_positions:'1 1'
}));
const data={circuit:'JRA',targetDate:'2026-11-01',cutoff:'2026-11-01T00:00:00Z',roster:[1,2],rows};
const packet=supplyArchiveMaterials(data);
assert.equal(packet.runners[0].materials.length,6);
assert.equal(packet.runners[1].materials.length,0);
assert.equal(packet.runners[0].items['07'],'PROXY_CANDIDATE_ONLY');
assert.equal(packet.runners[0].items['09'],'MISSING');
assert.equal(packet.scoring_authorized,false);
for(const extra of [{...rows[0]},{...rows[0],race_date:data.targetDate},{...rows[0],source_checked_at:'2026-11-02T00:00:00Z'}])
 assert.throws(()=>supplyArchiveMaterials({...data,rows:[...rows,extra]}));
const bad=supplyArchiveMaterials({...data,rows:[{...rows[0],lap_winner_seconds:59}]});
assert.equal(bad.runners[0].materials[0].race_laps,null);
console.log('PASS archive material handoff');
