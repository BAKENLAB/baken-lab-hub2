import assert from 'node:assert/strict';
import {loadV30} from '../reborn2-chatgpt-circuit/work29-v30-terminal.mjs';
import {synthesize} from './synthesis.mjs';
const loaded=loadV30(),A='S26:A',H='S26:H1';
const horse=x=>x.runners.find(h=>h.slot===A);
const monitored=x=>horse(x).paths.find(p=>p.event===H&&p.kind==='CHECKPOINT_PERSISTS_TO_FINISH');
const base=synthesize({loaded,fixture:'CONTROL',placeThreshold:3});
assert.equal(monitored(base).state,'CONTRADICTED_BY_OBSERVED_FINISH');
assert.ok(horse(base).axes[4].facts.some(f=>f.predicate==='DECISIVE_FOR_ASSUMPTION'));
assert.equal(horse(base).grade_decision.grade,null);
const removed=loaded.cases.get('CONTROL').o.evidence.find(e=>e.event_id===H&&e.subject_id===A&&e.field==='finish').evidence_id;
const variant=synthesize({loaded,fixture:'CONTROL',placeThreshold:3,withdraw:removed});
assert.ok(!horse(variant).evidence_roots.includes(removed));
assert.ok(!horse(variant).axes[4].facts.some(f=>f.evidence_refs.includes(removed)));
assert.notDeepEqual(horse(variant).axes[4].facts,horse(base).axes[4].facts);
assert.ok(horse(base).audit.some(a=>a.id==='RANK100'&&a.conditional_path_effect));
assert.equal(horse(base).axes[3].current_support.length,0);
assert.ok(horse(base).eye_feedback.every(f=>!f.conditional_path_effect));
const totals={fixtures:0,runners:0,observed:0,history:0,paths:0,grades:0};
for(const fixture of loaded.cases.keys()){
 const result=synthesize({loaded,fixture});
 assert.equal(Object.keys(result.byItem).length,115);
 assert.equal(result.held,826);
 assert.equal(result.groups,118);
 assert.ok(result.runners.every(h=>h.axes.length===5&&h.grade_decision.grade===null));
 totals.fixtures++;
 totals.runners+=result.runners.length;
 for(const item of Object.values(result.byItem)){
   totals.observed+=item.observed;totals.history+=item.historical_effect;totals.paths+=item.path_effect;
   totals.grades+=item.grade_effect;
 }
}
console.log(JSON.stringify({test:'synthesis',totals,terminal_before:monitored(base).state,
 terminal_after:monitored(variant).state,formal:false}));
