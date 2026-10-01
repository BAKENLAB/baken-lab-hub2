import {readFile} from 'node:fs/promises';
import {validatePayload, assertPredictionMatch, protocolPolicy, isTestPrediction} from '../prediction-contract.mjs';
// Inputs: a read-only official_predictions row export and an API JSON response.
const [savedPath,apiPath]=process.argv.slice(2);
if (!savedPath || !apiPath) throw new Error('Usage: node scripts/verify-prediction.mjs saved-row.json api-response.json');
const saved=JSON.parse(await readFile(savedPath,'utf8'));
const api=JSON.parse(await readFile(apiPath,'utf8'));
if (api.ok !== true) throw new Error('SYSTEM ERROR: API failed');
const candidates=[api.prediction,...(api.predictions||[]),...(api.races||[]).map(r=>r.prediction),...(api.results||[]).map(r=>r.prediction)].filter(Boolean);
const matches=candidates.filter(p=>p.id===saved.id);
if (!matches.length) throw new Error('DATA ERROR: saved prediction missing from API');
if(isTestPrediction(saved))throw new Error('DATA ERROR: test prediction excluded');
const policy=protocolPolicy(saved.protocol_version);
validatePayload(saved.payload,policy.legacy,saved.protocol_version);
for (const p of matches) {validatePayload(p.payload,policy.legacy,saved.protocol_version);assertPredictionMatch(saved.payload,p.payload);}
console.log('PASS: saved RANK/TOP5/EYE/reason match API ('+saved.id+')');
