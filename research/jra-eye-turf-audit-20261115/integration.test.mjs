import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeEyeAdditionalAudit} from '../../automation/jra-eye-additional-audit.mjs';
const root=new URL('./',import.meta.url);
const original=readFileSync(new URL('rollback/index.ts',root),'utf8');
const candidate=readFileSync(new URL('candidate-index.ts',root),'utf8');
test('removing optional import and two hooks restores production byte-for-byte',()=>{
 const stripped=candidate.replace('import { safeEyeAdditionalAudit } from "./jra-eye-additional-audit.mjs";\n','').replace(/^ *\/\/ BEGIN OPTIONAL EYE AUDIT\n[\s\S]*?^ *\/\/ END OPTIONAL EYE AUDIT\n/gm,'');
 assert.equal(stripped,original);
});
test('saving, authentication and registered tool schemas are unchanged',()=>{
 assert.equal(candidate.slice(candidate.indexOf('s.registerTool("jra_save_claimed_prediction"')),original.slice(original.indexOf('s.registerTool("jra_save_claimed_prediction"')));
 assert.equal((candidate.match(/s\.registerTool\(/g)||[]).length,(original.match(/s\.registerTool\(/g)||[]).length);
});
test('optional errors cannot throw into prediction execution',()=>{
 assert.equal(safeEyeAdditionalAudit(null,'bad').status,'OPTIONAL_REVIEW_UNAVAILABLE');
 assert.equal(safeEyeAdditionalAudit({race:{}},'bad').formal_save_authorized,false);
});
test('optional failure leaves caller input untouched',()=>{const x={stage:'unknown',existing_eye:{horse_no:7},rank:[3,1]};const b=JSON.stringify(x);safeEyeAdditionalAudit(x,'bad');assert.equal(JSON.stringify(x),b)});
test('integration has no extra database or model calls',()=>{
 const delta=candidate.replace(original,'');
 const hooks=[...candidate.matchAll(/BEGIN OPTIONAL EYE AUDIT\n([\s\S]*?)\/\/ END OPTIONAL EYE AUDIT/g)].map(x=>x[1]).join('');
 assert.equal(/\.rpc\(|fetch\(|\.from\(|openai/i.test(hooks),false);
 assert.equal((candidate.match(/\.rpc\(/g)||[]).length,(original.match(/\.rpc\(/g)||[]).length);
});
