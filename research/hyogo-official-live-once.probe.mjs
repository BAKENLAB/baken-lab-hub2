// Explicit one-time source probe. Not included in npm test:pace or scheduled CI.
import assert from 'node:assert/strict';
import {parseHyogoAbilityDetail} from '../automation/hyogo-official-ability-evidence.mjs';
const url='https://www.sonoda-himeji.jp/data/ability/detail/135';
const response=await fetch(url,{headers:{accept:'text/html', 'user-agent':'Mozilla/5.0'},
 redirect:'error',signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200,'official HTTP not available');
const html=await response.text();
const parsed=parseHyogoAbilityDetail(html,url);
const matches=parsed.entries.filter(x=>x.horse_name==='エディットフォース'&&x.section==='能力検査');
console.log(JSON.stringify({http:response.status,html_bytes:html.length,
 parsed_status:parsed.status,event_date:parsed.event_date,venue:parsed.venue,
 going:parsed.going,entries:parsed.entries.length,matches},null,2));
assert.equal(parsed.status,'PARSED');
assert.equal(parsed.event_date,'2026-10-27');
assert.equal(matches.length,1);
assert.equal(matches[0].time_seconds,78);
assert.equal(matches[0].trainer.replace(/\s/g,''),'柏原誠路');
