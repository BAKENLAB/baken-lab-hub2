import {CONDITIONS} from '../catalog.mjs';
import {MINETA} from '../v2/conditions.mjs';
import {styleOf,frontShare} from '../v2/features.mjs';
export const ROUTES=Object.freeze([...CONDITIONS.filter(c=>c.id!=='mineta'),...MINETA].map(c=>({id:c.id,source:c.source??'VERIFIED_SUPPLEMENTAL_ARTIFACT_REQUIRED',retrieval:c.id.startsWith('mineta_')?'V3 identity-anchored flat history + full target roster; licensed/market exclusions remain explicit':({eval_course:'Licensed NORMAL snapshot, count+asof+exact layout gate',incident:'Official incident source; explicit text, cutoff and hash required',rival_followup:'Direct archived prior opponents -> official followup before target; separate locked export required',training:'Official/authorized training artifact with identity/asof/hash',bloodline:'Official pedigree artifact with identity/asof/hash'}[c.id]??'Version-matched live/card attributes + unique official archive race CNAME and horse ID'),scoring_connected:['recent_form','relative_early','near_distance','same_track','last3f'].includes(c.id),status:'RESOLVER_REGISTERED_NOT_ALL_MATERIAL_ACQUIRED'})));
if(ROUTES.length!==38||new Set(ROUTES.map(x=>x.id)).size!==38)throw Error('ROUTE_COUNT');
const yes=x=>x!==null&&x!==undefined&&x!=='';
const good=p=>Number.isInteger(p.baseline.finish)&&p.baseline.finish>=1&&p.baseline.finish<=p.baseline.field_size&&(p.baseline.finish<=3||(typeof p.baseline.margin_to_winner==='number'&&p.baseline.margin_to_winner<=0.6));
export function auditHorse(r,facts,raceFacts,{evalFact=null,baseline=false}={}){
 const out=[],h=facts.priors.filter(p=>p.match_status==='MATCHED'&&p.flat&&p.evaluation_eligible),latest=facts.priors[0],a=facts.attrs;
 const record=(id,available,value,matched=null,reason='')=>out.push({id,acquisition:available?'AVAILABLE':'UNKNOWN',decision:available&&typeof matched==='boolean'?(matched?'MATCHED':'NOT_MATCHED'):'UNKNOWN',value:available?value:null,reason:reason||(available?'SOURCE_PRESENT_NOT_AUTOMATIC_SCORING_OR_FORMAL_AUDIT':'REQUIRED_VERIFIED_MATERIAL_MISSING')});
 const excluded=(id,reason)=>out.push({id,acquisition:'EXCLUDED',decision:'EXCLUDED',value:null,reason});
 const near=h.filter(p=>p.baseline.surface===r.conditions.surface&&Math.abs(p.baseline.distance-r.conditions.distance)<=200);
 record('recent_form',h.length>0,h.map(p=>({date:p.baseline.race_date,finish:p.baseline.finish,margin:p.baseline.margin_to_winner})),h.length? h.some(good):null);
 const cls=h.filter(p=>yes(p.archive.class_name)),targetClass=r.conditions.class_name??r.conditions.race_class;
 record('same_class',cls.length>0&&yes(targetClass),cls.map(p=>p.archive.class_name),null,'Class labels require explicit normalization/equivalence map; no class hierarchy inferred.');
 record('near_distance',h.length>0,near.map(p=>p.archive.run_id),h.length?near.some(good):null);
 record('same_track',h.length>0,h.filter(p=>p.baseline.track===r.track).map(p=>p.archive.run_id),h.length?h.some(p=>p.baseline.track===r.track&&p.baseline.surface===r.conditions.surface&&good(p)):null);
 record('relative_early',raceFacts.earlyComplete,{mean:raceFacts.early.get(r.horse_no),dense_rank:raceFacts.earlyRanks.get(r.horse_no)},raceFacts.earlyComplete?raceFacts.earlyRanks.get(r.horse_no)<=3:null,'All ACTIVE horses require >=2 confirmed flat early positions.');
 const held=h.filter(p=>p.positions_verified);record('front_hold',held.length>0,held.filter(p=>p.baseline.early_pos>=1&&p.baseline.early_pos<=3&&good(p)).map(p=>p.archive.run_id),held.length?held.some(p=>p.baseline.early_pos>=1&&p.baseline.early_pos<=3&&good(p)):null);
 record('long_turf',h.length>0,h.filter(p=>p.baseline.surface==='芝'&&p.baseline.distance>=r.conditions.distance&&good(p)).map(p=>p.archive.run_id),h.length?h.some(p=>p.baseline.surface==='芝'&&p.baseline.distance>=r.conditions.distance&&good(p)):null);
 const gain=h.filter(p=>p.positions_verified&&p.baseline.early_pos>=1&&p.baseline.final_turn_pos>=1);
 record('position_gain',gain.length>0,gain.map(p=>({run:p.archive.run_id,gain:p.baseline.early_pos-p.baseline.final_turn_pos})),gain.length?gain.some(p=>p.baseline.early_pos>p.baseline.final_turn_pos):null,'Descriptive only, no causal improvement assumed.');
 record('eval_course',evalFact?.status==='AVAILABLE',evalFact?.value,null,evalFact?.reason??'LICENSED_CACHE_NOT_SUPPLIED');
 record('incident',false,null,null,'No explicit official incident text with pre-target provenance.');
 record('rival_followup',facts.rivals?.length>0,facts.rivals??null,null,'Direct prior opponents and first archived flat followups before target; descriptive, not causal or complete future coverage.');
 const laps=h.filter(p=>p.archive.full_field&&p.archive.field_rows===p.archive.field_size&&p.archive.distance%200===0&&typeof p.archive.halon_times==='string'&&p.archive.halon_times.split(/\s*-\s*/).length===p.archive.distance/200&&p.archive.halon_times.split(/\s*-\s*/).every(x=>/^\d+(\.\d+)?$/.test(x)));
 record('race_pace',laps.length>0,laps.map(p=>({run:p.archive.run_id,laps:p.archive.halon_times})),null,'Official complete field/laps acquired; target causal pace interpretation remains unknown.');
 const last=h.filter(p=>p.relative3f_verified);record('last3f',last.length>0,last.map(p=>({run:p.archive.run_id,rank:p.archive.final3f_rank,field:p.archive.field_size})),last.length?last.some(p=>p.archive.final3f_rank<=3):null);
 record('stamina',false,null,null,'Same/longer distance result alone does not establish sustained long-spurt mechanism.');
 record('distance_change',latest?.match_status==='MATCHED'&&latest.evaluation_eligible,{change_m:latest?r.conditions.distance-latest.baseline.distance:null},null,'Distance delta observed; reproducibility needs full context.');
 record('going_weather',yes(a.going)&&yes(a.weather),{going:a.going,weather:a.weather});
 record('carried_weight',yes(a.weight_carried),a.weight_carried);
 record('body_weight',yes(a.body_weight)&&yes(a.body_weight_diff),{weight:a.body_weight,diff:a.body_weight_diff});
 record('equipment',yes(a.equipment),a.equipment,null,'Null equipment is unknown, not no equipment.');
 record('sex_age',yes(a.sex_age),a.sex_age);
 record('jockey_trainer',yes(a.jockey)&&yes(a.trainer),{jockey:a.jockey,trainer:a.trainer},null,'Names never imply preference or ability points.');
 record('draw_geometry',false,null,null,yes(a.draw)?'Official draw acquired; first-turn/start-surface effect source missing.':'Draw and verified course geometry missing.');
 record('training',false,null,null,'Verified training artifact absent.');record('bloodline',false,null,null,'Identity-anchored verified pedigree source absent.');
 const currentStyle=raceFacts.styles.get(r.horse_no)??'UNKNOWN';
 record('mineta_T01',currentStyle!=='UNKNOWN',{style:currentStyle,min_corner:currentStyle!=='UNKNOWN'?Math.min(...latest.baseline.corner_positions):null},currentStyle!=='UNKNOWN'?currentStyle==='FRONT':null,'V2 styleOf: minimum ALL verified latest-flat corners, not early-position mean.');
 record('mineta_T02',raceFacts.frontShare.unknown<raceFacts.frontShare.active,raceFacts.frontShare,raceFacts.frontShare.matched,'V2 frontShare bounds retained; unknown horses remain in denominator.');
 const left=raceFacts.styles.get(r.horse_no-1),right=raceFacts.styles.get(r.horse_no+1),noTwo=left===undefined||right===undefined,known=![currentStyle,left,right].includes('UNKNOWN');
 record('mineta_T03',noTwo||known,{literal_previous:left??null,literal_next:right??null,current_style:currentStyle},noTwo?false:known?currentStyle!=='FRONT'&&left==='FRONT'&&right==='FRONT':null,'Literal numbers, non-front subject; cancelled/missing neighbors never skipped.');
 record('mineta_T04',false,null,null,'Adjacent front runners are insufficient without verified draw/geometry.');
 record('mineta_T05',false,null,null,'Pre-target training-only payout cohort absent; ROI unavailable, no finish proxy presented as ROI.');
 record('mineta_T06',latest?.match_status==='MATCHED'&&latest.evaluation_eligible,{delta:latest?r.conditions.distance-latest.baseline.distance:null},latest?.match_status==='MATCHED'&&latest.evaluation_eligible?r.conditions.distance<latest.baseline.distance:null,'Shortening observed, not proof of positional reproduction.');
 record('mineta_T07',latest?.match_status==='MATCHED'&&latest.evaluation_eligible,{delta:latest?r.conditions.distance-latest.baseline.distance:null},latest?.match_status==='MATCHED'&&latest.evaluation_eligible?r.conditions.distance>latest.baseline.distance:null,'Extension observed, stamina and positional suitability audited separately.');
 record('mineta_T08',false,null,null,'Latest4 histories are not full career: first surface switch unknown.');
 const burden=h.filter(p=>good(p)&&yes(p.archive.weight_carried));record('mineta_T09',burden.length>0&&yes(a.weight_carried),burden.map(p=>({prior_weight:p.archive.weight_carried,current_weight:a.weight_carried,run:p.archive.run_id})),null,'Burden comparison available; strength/reproduction not automatically positive.');
 excluded('mineta_T10','Market/value theory disabled; popularity/odds prohibited.');excluded('mineta_T11','Proprietary AI unavailable.');excluded('mineta_T12','Proprietary index unavailable.');excluded('mineta_T13','Proprietary index unavailable.');excluded('mineta_T14','Integration orchestration, not an additional scoring factor.');
 for(const [kind,id] of Object.entries({incident:'incident',geometry:'draw_geometry',training:'training',pedigree:'bloodline',sustained_effort:'stamina'})){const material=facts.supplemental?.[kind];if(material){const row=out.find(x=>x.id===id);row.acquisition='AVAILABLE';row.value=material;row.decision='UNKNOWN';row.reason='VERIFIED_IDENTITY_ASOF_CONTENT; interpretation/scoring/formal review NOT auto-certified';}}
 const needsWholeWindow=new Set(['recent_form','same_class','near_distance','same_track','front_hold','long_turf','position_gain','last3f']);
 if(h.length<facts.priors.length)for(const row of out)if(needsWholeWindow.has(row.id)&&row.decision==='NOT_MATCHED'){row.decision='UNKNOWN';row.reason='NO_POSITIVE_IN_CONFIRMED_SUBSET; remaining stored priors unresolved';}
 if(out.length!==38)throw Error('AUDIT_COUNT');return out.map(x=>({...x,horse_no:r.horse_no,source_mode:baseline?'BASELINE_WITHOUT_ARCHIVE_MATCH':'IDENTITY_ANCHORED_RECONSTRUCTION',formal_audit_performed:false,history_scope:'STORED_LATEST_UP_TO_4_NOT_FULL_CAREER'}));
}
export function wholeRace(rows,facts){
 const early=new Map(),styles=new Map();
 for(const r of rows){const f=facts.get(r.horse_no),h=f.priors.filter(p=>p.match_status==='MATCHED'&&p.evaluation_eligible&&p.positions_verified&&p.baseline.early_pos>=1&&p.baseline.early_pos<=p.baseline.field_size&&p.baseline.field_size>0);
  if(h.length>=2)early.set(r.horse_no,h.reduce((s,p)=>s+p.baseline.early_pos/p.baseline.field_size,0)/h.length);
  const p=f.priors[0],corners=p?.baseline.corner_positions;
  styles.set(r.horse_no,p?.match_status==='MATCHED'&&p.evaluation_eligible&&p.positions_verified&&Array.isArray(corners)&&corners.length>0&&corners.every(v=>Number.isInteger(v)&&v>=1&&v<=p.baseline.field_size)?styleOf(corners):'UNKNOWN');
 }
 const sorted=[...new Set(early.values())].sort((a,b)=>a-b),earlyRanks=new Map([...early].map(([no,v])=>[no,sorted.indexOf(v)+1]));
 return {early,earlyRanks,styles,earlyComplete:early.size===rows.length,latestComplete:[...styles.values()].every(s=>s!=='UNKNOWN'),frontShare:frontShare([...styles.values()])};
}
