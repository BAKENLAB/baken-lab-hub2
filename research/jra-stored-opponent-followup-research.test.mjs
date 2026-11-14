import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {linkStoredJraResult as link,buildJraStoredOpponentIndex as build,reviewStoredJraPriorRace as review,attachStoredJraOpponentFollowups as attach} from '../automation/jra-stored-opponent-followup-research.mjs';
const sample=JSON.parse(fs.readFileSync(new URL('./jra-stored-opponent-followup-archive-sample-20261115.json',import.meta.url),'utf8'));
const scope={asOf:sample.as_of,targetRaceDate:'2026-11-15'};
const actual=()=>build({...scope,archiveRaces:sample.archive_races});
const base=()=>sample.archive_races.find(r=>r.race_date===sample.base.race_date&&r.track===sample.base.track&&r.race_no===sample.base.race_no);
test('actual stored JRA six-race archive links prior field and eight observed later starts by stable IDs',()=>{
 const x=actual(),r=review({index:x,priorRace:sample.base});
 assert.equal(x.coverage.linked_races,6);
 assert.ok(x.coverage.partial_result_races>=1);
 assert.equal(r.prior_observed_finishers,12);
 assert.equal(r.observed_later_runs,8);
 assert.equal(r.horses_with_observed_later_results,8);
 assert.equal(r.absence_is_not_no_later_run,true);
 assert.ok(r.runners.every(h=>h.later_observations.every(v=>v.horse_id===h.horse_id&&v.race_date>sample.base.race_date)));
 console.log(JSON.stringify({archive_scope:'STORED_OFFICIAL_CARD_RESULT_JOIN_NOT_REFETCH',...x.coverage,prior_horses:r.prior_observed_finishers,observed_later_runs:r.observed_later_runs,opponents_with_later_results:r.horses_with_observed_later_results,rank_effect:r.rank_effect}));
});
test('wrong name or number, duplicate id or card race identity mismatch reject whole archive row',()=>{
 const r=structuredClone(base());
 r.finishers[0].horse_name+='別馬';assert.equal(link({...scope,race:r}).status,'FINISHER_CARD_ID_MISMATCH');
 const d=structuredClone(base());d.card_runners[1].horse_ref=d.card_runners[0].horse_ref;
 assert.equal(link({...scope,race:d}).status,'AMBIGUOUS_ARCHIVE_HORSE_ID');
 const w={...base(),race_no:9};assert.equal(link({...scope,race:w}).status,'UNVERIFIED_ARCHIVE_IDENTITY_OR_ASOF');
});
test('later settlement beyond cutoff or target-day record is not as-of evidence',()=>{
 const r={...base(),settled_at:'2026-11-15T08:01:00+09:00'};
 assert.equal(link({...scope,race:r}).verified,false);
 assert.equal(link({...scope,targetRaceDate:base().race_date,race:base()}).verified,false);
 const later={...base(),card_checked_at:'2030-01-01T00:00:00Z'};
 assert.equal(link({...scope,race:later}).verified,false);
});
test('partial official results preserve missing denominator and do not fabricate a defeat',()=>{
 const r={...base(),finishers:base().finishers.slice(0,5)};
 const x=link({...scope,race:r});
 assert.equal(x.verified,true);assert.equal(x.status,'PARTIAL_STORED_RESULT');
 assert.equal(x.missing_active_result_count,7);assert.equal(x.observed_finishers.length,5);
 const z=build({...scope,archiveRaces:[r]});
 assert.equal(review({index:z,priorRace:sample.base}).prior_missing_active_results,7);
});
test('duplicate race snapshot is excluded rather than picking arbitrary copy',()=>{
 const a=base(),x=build({...scope,archiveRaces:[a,a]});
 assert.equal(x.coverage.linked_races,0);assert.equal(x.rejected.length,2);
});
test('synthetic field attachment uses stable IDs and prior exact race core; self excluded',()=>{
 const card=base(),idrow=card.card_runners[0];
 // Synthetic reference fixture only, not an acquisition URL; no network.
 const syntheticRef='/JRADB/accessS.html?CNAME=pw01sde10'+card.card_cname.match(/^pw01dde\d{2}(\d{20})\//)[1]+'/AA';
 const target=[{...idrow,horse_no:22}];
 const past={race_date:card.race_date,track:card.track,race_no:card.race_no,source_ref:syntheticRef};
 const x=attach({index:actual(),officialRunners:target,liveRunners:[{...target[0],past_runs:[past,past]}]});
 assert.equal(x.coverage.linked_prior_runs,1);assert.equal(x.runners[0].history[1].status,'DUPLICATE_PRIOR_RUN');
 assert.equal(x.runners[0].history[0].observed_opponents,11);
 assert.ok(x.runners[0].history[0].opponents.every(o=>o.horse_id!==x.runners[0].horse_id));
 assert.equal(x.runners[0].history[0].automatic_score_effect,0);
 assert.equal(x.rank_effect,'NONE');
 const wrong=attach({index:actual(),officialRunners:target,liveRunners:[{...target[0],past_runs:[{...past,source_ref:syntheticRef.replace('20261018','20261019')}]}]});
 assert.equal(wrong.coverage.linked_prior_runs,0);
});