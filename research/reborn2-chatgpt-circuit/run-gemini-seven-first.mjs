import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {runGeminiFixture} from './gemini-seven-fixture-v5.mjs';
const raw=readFileSync(new URL('./gemini-seven-input-pinned.json',import.meta.url));
const out=runGeminiFixture(raw);
assert.equal(out.counts.audit_rows,805);
assert.equal(out.counts.checks_executed,805);
assert.equal(out.counts.formal_consumption,0);
assert.equal(out.normal_v5_entry.status,'BLOCKED');
assert.equal(out.runners.length,7);
assert.ok(out.runners.every(h=>h.items.length===115&&h.rank_candidate===null));
console.log('GEMINI_META '+JSON.stringify(Object.fromEntries(Object.entries(out).filter(([k])=>k!=='runners'))));
for(const h of out.runners){const {items,...rest}=h;console.log('GEMINI_HORSE '+JSON.stringify(rest));for(const i of items)console.log('GEMINI_ITEM '+JSON.stringify({horse_id:h.horse_id,...i}));}
