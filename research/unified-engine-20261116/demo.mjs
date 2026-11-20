import {writeFileSync} from 'node:fs';import {evaluateRace} from './engine.mjs';import {compareCohort} from './compare.mjs';import {audited} from './synthetic-scenario.mjs';import {resultFixture} from './fixtures.mjs';
const input=audited();const inference=evaluateRace(input); // finalized BEFORE results are admitted
const comparison=compareCohort([inference],[resultFixture(input)]);
const output=process.argv[2];if(!output)throw Error('Specify output JSON path');
const summary={label:'SYNTHETIC_ENGINE_ACCEPTANCE_ONLY_NOT_46R_STUDY',horse_count:inference.runners.length,audit_item_count:inference.audit.length,scoring_status:inference.status,eye:inference.eye,comparison};
writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(inference,null,2)+'\n');
console.log(JSON.stringify({output,horses:summary.horse_count,audit_items:summary.audit_item_count,metrics:comparison.metrics}));
