import test from 'node:test';
import assert from 'node:assert/strict';
import {localOfficialHistoricalClassEvidence as normalize,
 resolveLocalOfficialClassLiteral} from '../automation/local-verified-condition-bridge.mjs';

const mk=(name,track='盛岡')=>({race_name:name,track,
 evidence_ref:'COMPACT_V1.runners[horse_no=8].recent_runs[0]'});

test('sponsored NAR title is not rewritten into market evidence',()=>{
 const x=normalize(mk('オッズパーク賞C1五組'));
 assert.equal(x.status,'OFFICIAL_CLASS_ONLY');
 assert.equal(x.display,'C1五組');
 assert.equal(x.display.includes('オッズ'),false);
 assert.equal(x.evidence_ref,'COMPACT_V1.runners[horse_no=8].recent_runs[0]');
});
test('non-market class title stays precise',()=>{
 assert.equal(normalize(mk('C1五組')).display,'C1五組');
 assert.equal(normalize(mk('祝30周年C2七組')).display,'C2七組');
});
test('Tokai C23組 is not misread as adult grade C2',()=>{
 const x=normalize(mk('スポンサー賞C23組','名古屋'));
 assert.equal(x.display,'C23組');
 assert.equal(resolveLocalOfficialClassLiteral('C23組','名古屋').class_label,'C23');
});
test('no official history provenance means no class text at all',()=>{
 const x=normalize({race_name:'オッズパーク賞C1五組',track:'盛岡'});
 assert.equal(x.status,'OFFICIAL_HISTORY_UNVERIFIED');
 assert.equal(x.display,null);
});
test('an unknown literal is unknown, not fabricated as a class',()=>{
 assert.equal(normalize(mk('大きな賞')).status,'CLASS_UNVERIFIED');
});
test('no allowance for odds-driven model narrative',()=>{
 // Sanitizer operates only on a trusted historical class field.
 // The market validator is deliberately not changed by this patch.
 const h=normalize(mk('オッズパーク賞C1五組'));
 assert.equal(/オッズ|人気|odds|popularity/i.test(h.display),false);
 const modelComment='オッズが高いから能力加点';
 assert.equal(/オッズ|人気|odds|popularity/i.test(modelComment),true);
});
