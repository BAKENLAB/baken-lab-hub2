import {readFile,writeFile} from 'node:fs/promises';
import {admitHorse} from './admit-history.mjs';
import {convertRace} from '../adapter/compact-v1-adapter.mjs';
const root=new URL('./',import.meta.url);
const data=JSON.parse(await readFile(new URL('extracted-evidence.json',root),'utf8'));
const log=JSON.parse(await readFile(new URL('fetch-log.json',root),'utf8'));
const cardBytes=await readFile(new URL(data.card.path,root));
const results=[];
for(const entry of data.runners){
 const fetch=log.find(x=>x.horse_no===entry.raw.horse_no);
 const profileBytes=fetch.path?await readFile(new URL(fetch.path,root)):null;
 results.push(admitHorse(entry,data.race,{cardBytes,cardHash:data.card.sha256,cardCapturedAt:data.card.download_completed_at,profileBytes,fetch}));
}
const raw=JSON.parse(await readFile(new URL('../2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',root),'utf8'));
const target=raw.races.find(r=>r.track==='高知'&&r.race_no===3);
const draft=convertRace(target);
const publicFields=['race_date','track','race_no','race_name','surface','distance','going','finish','margin','time_raw','early_pos','final_turn_pos','final3f','weight_carried','body_weight','jockey'];
for(const r of draft.draft_context.runners){
 const adopted=results.find(x=>x.horse_no===r.horse_no);
 if(adopted.current)for(const k of ['sex_age','weight_carried','jockey','draw','trainer','body_weight','equipment'])r[k]=adopted.current[k]??null;
 r.recent_runs=adopted.recent_runs.map(h=>Object.fromEntries(publicFields.map(k=>[k,h[k]??null])));
 r.history_source_refs=[...new Set(adopted.recent_runs.map(h=>h.source_ref))];
 r.missing_items=r.missing_items.filter(k=>k!=='verified_history' && !k.startsWith('recent_runs:') && (r[k]===null || r[k]===undefined));
 if(!r.recent_runs.length)r.missing_items.push('verified_history');
 if(r.recent_runs.length<5)r.missing_items.push('recent_runs:'+r.recent_runs.length+'/5');
}
// The saved RAW excluded horse 6 based on a past cancellation. The current
// official card includes its horse cell. Never assert complete field integrity.
draft.axes.B={status:'PARTIALLY_VERIFIED',verified_history_count:results.reduce((n,r)=>n+r.recent_runs.length,0),reasons:['RAW_CURRENT_FIELD_MISMATCH_HORSE_6','CURRENT_BODY_WEIGHT_AND_EQUIPMENT_UNAVAILABLE','NO_LATEST_FIELD_CHECK_AT_PREDICTION_TIME','RACE_CONDITIONS_NOT_REVERIFIED']};
await writeFile(new URL('pilot-results.json',root),JSON.stringify({race:data.race,production_dispatch_allowed:false,ready_changed:false,field_integrity_checked:false,results,draft_context:draft.draft_context,axes:draft.axes,overall_status:'BLOCKED'},null,2)+'\n',{flag:'wx'});
console.log(results.map(r=>({horse:r.horse_no,identity:r.identity_status,reason:r.reason,matched:r.history_candidates.filter(c=>c.status==='OFFICIAL_MATCHED').length,admitted:r.recent_runs.length})));
