import {readFileSync} from 'node:fs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
import {analyzeOpposition33to42Fixture} from './opposition-33-42.mjs';
import {analyzeConditions43to57Fixture} from './conditions-43-57.mjs';
import {analyzePace58to77Fixture} from './pace-58-77.mjs';
import {analyzeState78to92Fixture} from './state-78-92.mjs';
import {analyzeChanges93to100Fixture} from './changes-93-100.mjs';
import {inspectEye15} from './eye-01-15.mjs';
import {leaderWindows} from './route-observations-v13.mjs';
import {validateGenerated} from './synthetic-generator-v15.mjs';
const load=n=>JSON.parse(readFileSync(new URL(n,import.meta.url)));
const catalog=load('./catalog-115.json').items;
export const inputV2=()=>load('./gemini-four-v2-partial-pinned.json');
const key=(...a)=>JSON.stringify(a),uniq=a=>[...new Set(a)],stamp={fixture_only:true,official_evidence:false,formal_admission:false,identity_status:'FICTIONAL_ONLY'};
const local=(d,t)=>typeof t==='string'&&/^\d\d:\d\d$/.test(t)&&/^\d{4}-\d\d-\d\d$/.test(d)?d+'T'+t+':00':null;
const time=s=>typeof s==='string'?Date.parse(s+'Z'):NaN;
const same=(a,b,ks)=>ks.every(k=>a?.[k]!=null&&a[k]===b?.[k]);
const condKeys=['venue','course_version','distance_m','surface','turn','going','grade'];
const allowed=(o,keys)=>{if(!o||Object.keys(o).some(k=>!keys.split(' ').includes(k)))throw Error('UNEXPECTED_SCHEMA_FIELD');};
function validateShape(c){
 allowed(c,'id target history synthetic_pace_reference scenarios stage_partition weight_report workout');
 allowed(c.target,'id date start published conditions field_complete candidate_ids entrants');
 for(const s of c.scenarios??[])allowed(s,'id kind assumed_early_contenders pace_assumption observed assumed_leader_one_of other_of_pair H1_position');
 const condition=o=>allowed(o,'venue course_version distance_m surface turn first_corner_m going grade layout rule_version eligibility');
 condition(c.target.conditions);
 for(const h of c.target.entrants??[])allowed(h,'id runner draw sex age kg status');
 for(const r of c.history){allowed(r,'id date start published conditions field_count full_result_rows lap_kind lap_segment_m lap_tenths rows quarantine incident');condition(r.conditions);for(const x of r.rows)allowed(x,'runner id kg clock_tenths margin_tenths final3f_tenths corners finish body_weight measured');}
}
function validRows(r){
 const n=r.field_count,a=r.rows,w=a.find(x=>x.finish===1);
 if(new Set(a.map(x=>x.id)).size!==a.length||new Set(a.map(x=>x.finish)).size!==a.length||a.some(x=>!Number.isInteger(x.finish)||x.finish<1||n!=null&&x.finish>n))return false;
 if(r.full_result_rows&&(a.length!==n||a.some(x=>!Number.isInteger(x.runner)||x.runner<1||x.runner>n)||new Set(a.map(x=>x.runner)).size!==n))return false;
 return !a.some(x=>Number.isInteger(x.clock_tenths)&&Number.isInteger(w?.clock_tenths)&&x.finish>1&&Number.isInteger(x.margin_tenths)&&x.clock_tenths-w.clock_tenths!==x.margin_tenths);
}
const eligible=(r,t)=>r.id!==t.id&&validRows(r)&&time(local(r.date,r.published))<time(local(t.date,t.published))&&(r.start==null?r.date<t.date:time(local(r.date,r.start))<time(local(r.date,r.published)));
function positions(r,x){if(!Array.isArray(x.corners)||!Number.isInteger(r.field_count))return [];return x.corners.flatMap((n,i)=>{if(!Number.isInteger(n)||n<1||n>r.field_count)return [];if(r.full_result_rows){const a=r.rows.map(y=>y.corners?.[i]);if(a.some(q=>!Number.isInteger(q)||q<1||q>r.field_count)||new Set(a).size!==r.field_count)return [];}return [{segment:i+1,rank_min:n,rank_max:n}];});}
const roots=(r,x)=>[key('RESULT',r.id,x.id),...(positions(r,x).length?[key('POSITIONS',r.id,x.id)]:[])];
const lap=(r)=>{const a=r.lap_tenths,b=r.lap_segment_m,w=r.rows.find(x=>x.finish===1);if(r.lap_kind!=='synthetic_race_leader'||!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.every(n=>Number.isInteger(n)&&n>0)||!b.every(n=>Number.isInteger(n)&&n>0)||b.reduce((x,y)=>x+y,0)!==r.conditions.distance_m||a.reduce((x,y)=>x+y,0)!==w?.clock_tenths)return null;let m=0;return a.map((n,i)=>{const s={start_m:m,end_m:m+b[i],elapsed_tenths:n};m+=b[i];return s;});};
export function compareWitnesses(a,x,b,y,peer){
 const p=a.rows.find(z=>z.id===peer),q=b.rows.find(z=>z.id===peer);
 if(!p||!q||![x.clock_tenths,y.clock_tenths,p.clock_tenths,q.clock_tenths].every(Number.isInteger))return null;
 const differences=condKeys.filter(k=>!same(a.conditions,b.conditions,[k]));
 if(a.field_count!==b.field_count)differences.push('field_count');
 if(x.kg==null||y.kg==null||p.kg==null||q.kg==null||x.kg-p.kg!==y.kg-q.kg)differences.push('relative_weight');
 return {own_gap:x.clock_tenths-p.clock_tenths,peer_gap:y.clock_tenths-q.clock_tenths,differences,recorded_comparable:differences.length===0,formal_comparable:false,roots:uniq([key('RESULT',a.id,x.id),key('RESULT',a.id,p.id),key('RESULT',b.id,y.id),key('RESULT',b.id,q.id)]),current_order:null};
}
export function replayV2(c,{reveal=true}={}){
 validateShape(c);const t=c.target;if(new Set(c.history.map(r=>r.id)).size!==c.history.length)throw Error('DUPLICATE_RACE');
 const history=c.history.filter(r=>eligible(r,t)),ids=t.field_complete?t.entrants.map(h=>h.id):t.candidate_ids;
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('CANDIDATES');
 if(t.field_complete&&(t.entrants.some(x=>x.status!=='ACTIVE'||!Number.isInteger(x.runner))||new Set(t.entrants.map(x=>x.runner)).size!==ids.length))throw Error('ROSTER');
 const used=history.filter(r=>reveal||!(c.id==='V03'&&r.id.endsWith('V33')||c.id==='V04'&&r.id.endsWith('V43')));
 // Typed observations are admitted at date-only scope, not used to fabricate a missing event start.
 const roster=ids.map((id,i)=>({horse_id:id,horse_no:t.entrants?.find(h=>h.id===id)?.runner??i+1}));
 const groups=[],trace=[];const put=(kind,h,r,fact,event_key)=>groups.push({...stamp,event_key,evidence_ids:[event_key],record:{...stamp,kind,horse_id:h,race_id:r,fact}});
 for(const r of used)for(const x of r.rows){
 put(ids.includes(x.id)?'RESULT':'PEER_RESULT',x.id,r.id,{start_status:'FINISHED',finish:x.finish,field_size:r.field_count??null,clock_tenths:x.clock_tenths??null,winner_gap_tenths:x.margin_tenths??null,final3f_tenths:x.final3f_tenths??null},key('RESULT',r.id,x.id));
 const p=positions(r,x);if(p.length)put('POSITIONS',x.id,r.id,{field_size:r.field_count,positions:p},key('POSITIONS',r.id,x.id));
 const inc=r.incident;if(reveal&&inc?.victim===x.id&&r.rows.some(y=>y.id===inc.actor)&&time(inc.published+':00')<time(local(t.date,t.published))&&r.start!=null&&time(local(r.date,r.start))<time(inc.published+':00'))put('INCIDENT',x.id,r.id,{incident_code:'FIXTURE_PATH_PRESSURE',role:'SUFFERED',text:inc.reported_fact},key('INCIDENT',r.id,inc.id));
 }
 for(const r of used){const splits=lap(r);if(splits)put('RACE_LAPS',null,r.id,{splits},key('LAPS',r.id));}
 const target={...stamp,circuit:'FIXTURE',race_id:t.id,cutoff:local(t.date,t.published)},intake={...stamp,accepted:groups};
 const typed=analyzeTyped01to32({target,roster,intake,traceRead:x=>trace.push(x)});
 const decisions=ids.map(id=>{
 const own=used.flatMap(r=>r.rows.filter(x=>x.id===id).map(x=>({r,x}))).sort((a,b)=>b.r.date.localeCompare(a.r.date));
 const latest=own[0],p=latest?positions(latest.r,latest.x):[],first=p.find(q=>q.segment===1)?.rank_min??null,n=latest?.r.field_count??null;
 const any=p.some(q=>q.rank_max<=3)?true:p.length===4?false:null,early=first==null?null:first<=3;
 const routes=own.filter(({r})=>same(r.conditions,t.conditions,condKeys)).map(({r,x})=>{const pp=positions(r,x),a=pp.find(z=>z.segment===1)?.rank_min??null,b=pp.find(z=>z.segment===4)?.rank_min??null;return {race:r.id,finish:x.finish,win_attained:x.finish===1,place_attained:x.finish<=3,margin_tenths:x.margin_tenths??null,early:a,last:b,field:r.field_count,roots:roots(r,x),time_scope:r.start?'START_PUBLICATION_LOCAL_ORDER':'DATE_ONLY',forward_fade:a!=null&&a<=3&&b!=null&&b>a&&x.finish>3};});
 const direct=[],indirect=[],follow=[];
 for(const {r,x} of own){
 for(const peer of ids.filter(y=>y!==id)){const y=r.rows.find(z=>z.id===peer);if(y)direct.push({peer,race:r.id,order:Math.sign(y.finish-x.finish),conditions_match:same(r.conditions,t.conditions,condKeys),roots:[key('RESULT',r.id,id),key('RESULT',r.id,peer)]});
 for(const cm of r.rows.filter(z=>!ids.includes(z.id)))for(const b of used.filter(z=>z.id!==r.id)){const y=b.rows.find(z=>z.id===peer);if(y){const w=compareWitnesses(r,x,b,y,cm.id);if(w)indirect.push({peer,common:cm.id,...w});}}
 }
 for(const y of r.rows.filter(z=>z.id!==id))for(const b of used.filter(z=>z.date>r.date)){const z=b.rows.find(q=>q.id===y.id);if(z)follow.push({prior_race_id:r.id,peer_id:y.id,own_finish:x.finish,peer_finish:z.finish,shared_followup_key:key('RESULT',b.id,y.id),later_race_id:b.id,roots:[key('RESULT',r.id,id),key('RESULT',r.id,y.id),key('RESULT',b.id,y.id)],time_scope:b.start?'LOCAL_START':'DATE_ONLY'});}
 }
 const incidents=groups.filter(g=>g.record.kind==='INCIDENT'&&g.record.horse_id===id);
 const support=routes.filter(r=>r.place_attained),fade=routes.filter(r=>r.forward_fade);
 return {id,latest_supplied:latest?.r.id??null,immediate_prior_verified:false,any_top3:any,early_top3:early,early_rank:first,early_normalized:first!=null&&n>1?(first-1)/(n-1):null,late_only:any===true&&early===false,routes,direct,indirect,follow,incidents:incidents.map(g=>g.event_key),historical_win_witnesses:routes.filter(r=>r.win_attained).map(r=>r.race),historical_place_witnesses:support.map(r=>r.race),specific_forward_fade:fade.map(r=>r.race),general_win_ability:null,current_strength:null};
 });
 const rankAudit={runners:roster.map(h=>{const d=decisions.find(x=>x.id===h.horse_id),a=typed.find(x=>x.horse_id===h.horse_id);return {...h,items:catalog.filter(x=>!x.id.startsWith('EYE-')).map(x=>{let facts=a.items[x.id]?.observations.map(o=>({value:o.value,evidence_ids:o.evidence_ids}))??[];if(x.id==='35'||x.id==='36'||x.id==='37')facts=(x.id==='35'?d.direct:x.id==='36'?d.indirect:d.follow).map(v=>({value:v,evidence_ids:v.roots}));return {item_id:x.id,finding:{facts,hypotheses:[],counterevidence:[],unknowns:[]},evidence_ids:uniq(facts.flatMap(q=>q.evidence_ids))};})};})};
 const eye=inspectEye15({target,roster,rankAudit,intake,catalog,traceRead:x=>trace.push(x)});
 for(const d of decisions){const e=eye.find(x=>x.horse_id===d.id).items.find(x=>x.eye_item_id==='EYE-05'),seen=new Map();for(const f of d.follow.filter(x=>e.original_event_keys.includes(x.shared_followup_key))){if(!seen.has(f.shared_followup_key))seen.set(f.shared_followup_key,{root:f.shared_followup_key,finish:f.peer_finish,prior_routes:[]});seen.get(f.shared_followup_key).prior_routes.push(f.prior_race_id);}
 d.conditional_route_review=d.routes.map(r=>{const peer=[...seen.values()].filter(x=>x.prior_routes.includes(r.race));const incident=d.incidents.filter(x=>x.includes(r.race));return {race:r.race,own_place_attained:r.place_attained,place_with_later_top3_peer:r.place_attained&&peer.some(x=>x.finish<=3),observed_margin_tenths:r.margin_tenths,loss_context:incident.length?'OBSERVED_INCIDENT_CAUSAL_SHARE_UNKNOWN':r.forward_fade?'OBSERVED_POSITION_LOSS':'NONE_RECORDED',root_keys:uniq([...r.roots,...peer.map(x=>x.root),...incident]),current_effect:null};});}
 const scenarios=t.field_complete?(c.scenarios??[]).map(s=>{
 if(s.kind!=='HYPOTHETICAL'||s.observed!==false)throw Error('SCENARIO_NOT_HYPOTHETICAL');
 const contenders=s.assumed_early_contenders??null,possibleLeaders=s.assumed_leader_one_of??null;
 if([...(contenders??[]),...(possibleLeaders??[])].some(x=>!ids.includes(x))||contenders&&new Set(contenders).size!==contenders.length)throw Error('SCENARIO_IDS');
 return {id:s.id,assumption_only:true,assumed_contenders:contenders,possible_leaders:possibleLeaders,observed_pace:null,judgments:decisions.map(d=>{
 const leadWin=d.routes.filter(r=>r.early===1&&r.win_attained),latePlace=d.routes.filter(r=>r.early>3&&r.last<=3&&r.place_attained);
 const other=contenders?.filter(x=>x!==d.id).length;
 return {id:d.id,lead_win_witnesses:leadWin.map(r=>r.race),late_place_witnesses:latePlace.map(r=>r.race),lead_route_precondition:leadWin.length?(contenders?.includes(d.id)&&other>0?'CONTEST_ASSUMED_EASY_LEAD_NOT_ESTABLISHED':contenders?.includes(d.id)&&other===0?'NO_OTHER_ASSUMED_CONTENDER':'POSITION_OR_LEAD_UNRESOLVED'):'NO_RECORDED_LEAD_WIN_WITNESS',late_route_context:latePlace.length?(s.pace_assumption==='fast'?'FAST_PACE_ASSUMPTION_RELEVANT_NO_REALIZED_BENEFIT':'PACE_EFFECT_UNRESOLVED'):'NO_RECORDED_LATE_PLACE_WITNESS',current_effect:null,roots:uniq([...leadWin,...latePlace].flatMap(r=>r.roots))};
 })};
 }):[];
 const field=t.field_complete?{size:ids.length,any_top3:decisions.filter(d=>d.any_top3===true).length,early_top3:decisions.filter(d=>d.early_top3===true).length,late_only:decisions.filter(d=>d.late_only).map(d=>d.id),scope:'LATEST_SUPPLIED_NOT_AUTHENTICATED_IMMEDIATE_START'}:null;
 return {id:c.id,decisions,field,scenarios,strict_time_races:used.filter(r=>r.start!=null).map(r=>r.id),date_only_races:used.filter(r=>r.start==null).map(r=>r.id),laps:used.filter(r=>lap(r)).map(r=>({race:r.id,...leaderWindows(lap(r)),time_scope:r.start?'LOCAL_START':'DATE_ONLY'})),formal:false};
}
// Full generated data only: use real common research kernels with explicitly synthetic identity and exact times.
export function runGenerated(c,{mechanisms=[],allowExternalPeers=false,versioned=false}={}){
 const checked=validateGenerated(c,{allowExternalPeers});if(!checked.valid)throw Error('INVALID_GENERATED:'+checked.errors.join(','));
 const t=c.target,cv=r=>({track:r.venue,course_id:r.venue,course_version:r.course_version,surface:r.surface,distance:r.distance_m,distance_m:r.distance_m,going:r.going,turn:r.turn,class_key:r.grade,layout:r.layout,rule_version:r.rule_version,eligibility:r.eligibility,conditions_observed:true});
 const target={...stamp,...cv(t.conditions),circuit:'FIXTURE',race_id:t.id,field_size:t.entrants.length,cutoff:local(t.date,t.published),started_at:local(t.date,t.start),early_segment_m:600,local_date:t.date};
 const evidence=[],groups=[],runs=[],races=[],history=[],current=[],gates=[],paceBenchmarks=[];
 const ev=(id,h,r,pub,extra={})=>{const e={...stamp,evidence_id:'fixture-v2:'+id,horse_id:h,race_id:r,published_at:pub,published_at_or_null:pub,...extra};evidence.push(e);return e;};
 const g=(e,kind,fact)=>groups.push({...stamp,event_key:e.evidence_id,evidence_ids:[e.evidence_id],record:{...e,kind,fact}});
 const roster=t.entrants.map(x=>{const e=ev('card:'+x.id,x.id,t.id,target.cutoff,{runner_no:x.runner}),h={...e,horse_no:x.runner,active:true};current.push({...h,...cv(t.conditions),weight_kg:x.kg,actual_gate:x.draw});gates.push({...h,gate:x.draw,fixture_gate_consistent:true});g(e,'CURRENT_CARD',{...cv(t.conditions),weight_kg:x.kg});return h;});
 for(const r of c.history){const pub=local(r.date,r.published),start=local(r.date,r.start),f=ev('race:'+r.id,null,r.id,pub);races.push({...f,...cv(r.conditions),circuit:'FIXTURE',started_at:start,field_size:r.field_count,results:r.rows.map(x=>({horse_id:x.id,finish:x.finish,status:'FINISHED'}))});
 const le=ev('laps:'+r.id,null,r.id,pub),splits=lap(r);g(le,'RACE_LAPS',{splits});paceBenchmarks.push({...f,...cv(r.conditions),circuit:'FIXTURE',started_at:start,early_segment_m:600,early_seconds:leaderWindows(splits).early600_tenths/10,race_level_only:true});
 for(const x of r.rows){const e=ev('result:'+r.id+':'+x.id,x.id,r.id,pub),p=ev('pos:'+r.id+':'+x.id,x.id,r.id,pub),pos=positions(r,x),fact={...cv(r.conditions),start_status:'FINISHED',finish:x.finish,field_size:r.field_count,clock_tenths:x.clock_tenths,winner_gap_tenths:x.margin_tenths,final3f_tenths:x.final3f_tenths,weight_kg:x.kg};g(e,'RESULT',fact);g(p,'POSITIONS',{field_size:r.field_count,positions:pos});
 runs.push({...e,...fact,circuit:'FIXTURE',started_at:start,local_date:r.date,status:'FINISHED',gap_winner:x.margin_tenths==null?null:x.margin_tenths/10,final3f:x.final3f_tenths/10,positions:pos,first_segment:1,expected_segments:4,fixture_segment_labels_consistent:true,fixture_segment_grid_complete:true,position_evidence_id:p.evidence_id});
 }}
 for(const h of roster){const ids=runs.filter(r=>r.horse_id===h.horse_id).sort((a,b)=>b.started_at.localeCompare(a.started_at)).map(r=>r.race_id),e=ev('history:'+h.horse_id,h.horse_id,t.id,target.cutoff);history.push({...e,fixture_chronology_consistent:true,ordered_race_ids:ids,immediate_prior_race_id:ids[0],target_race_id:t.id});g(e,'HISTORY',{fixture_chronology_consistent:true,ordered_actual_start_race_ids:ids});}
 const ce=ev('geometry',null,t.id,target.cutoff),course=[{...ce,...cv(t.conditions),fixture_geometry_observed:true,first_turn_m:t.conditions.first_corner_m,first_turn_precision:'reported'}],intake={...stamp,accepted:groups},trace=[];
 const typed=analyzeTyped01to32({target,roster,intake,traceRead:x=>trace.push(x)});
 if(versioned)for(const r of races)r.row_evidence_ids=evidence.filter(e=>e.race_id===r.race_id&&e.horse_id&&e.evidence_id.startsWith('fixture-v2:result:')).map(e=>e.evidence_id);
 const opp=analyzeOpposition33to42Fixture({target,roster,races,histories:history}),conditions=analyzeConditions43to57Fixture({target,roster,runs,historyWitnesses:history,draws:gates}),pace=analyzePace58to77Fixture({target,roster,evidence,runs,history,gates,course,paceBenchmarks}),state=analyzeState78to92Fixture({target,roster,evidence,runs,history,current});
 const merged=roster.map(h=>{const items=Object.fromEntries(Object.entries(typed.find(x=>x.horse_id===h.horse_id).items).map(([k,v])=>[k,{facts:v.observations.map(o=>({value:o.value,evidence_ids:o.evidence_ids})),hypotheses:[],counterevidence:[],unknowns:v.unknowns}]));for(const z of [opp,conditions,pace,state])Object.assign(items,z.runners.find(x=>x.horse_id===h.horse_id).items);return {...h,items};});
 const facts=x=>[...(x?.facts??[]),...(x?.hypotheses??[]),...(x?.counterevidence??[])];
 const upstream=merged.flatMap(h=>Object.entries(h.items).map(([item_id,x])=>({horse_id:h.horse_id,item_id,source_cutoff:target.cutoff,evidence_ids:uniq(facts(x).flatMap(o=>o.evidence_ids)),analysis_status:facts(x).length?'OUTPUT_CANDIDATE':'UNKNOWN'})));
 const change=analyzeChanges93to100Fixture({target,roster,evidence,runs,history,currentConditions:current,upstream,mechanisms,traceRead:x=>trace.push(x)});
 for(const h of merged)Object.assign(h.items,change.runners.find(x=>x.horse_id===h.horse_id).items);
 const rankAudit={runners:merged.map(h=>({...h,items:Object.entries(h.items).map(([item_id,finding])=>({item_id,finding,evidence_ids:uniq(facts(finding).flatMap(o=>o.evidence_ids))}))}))};
 const eye=inspectEye15({target,roster,rankAudit,intake,catalog,traceRead:x=>trace.push(x)});
 const ledger=merged.flatMap(h=>catalog.map(d=>({horse:h.horse_id,item:d.id,section_called:true,output_count:d.id.startsWith('EYE-')?eye.find(x=>x.horse_id===h.horse_id).items.find(x=>x.eye_item_id===d.id).observed_facts.length:facts(h.items[d.id]).length,instrumented_reads:trace.filter(x=>x.horse_no===h.horse_no&&x.item_id===d.id).length,individual_semantic_effect_proven:false,formal:false})));
 return {checked,ledger,merged,eye,...(versioned?{evidence_index:evidence.map(({evidence_id,horse_id,race_id,published_at})=>({evidence_id,horse_id,race_id,published_at})),trace:trace.map(({consumer,consumer_item_id,horse_no,item_id,reason})=>({consumer,consumer_item_id,horse_no,item_id,reason})),executed_kernels:['analyzeTyped01to32','analyzeOpposition33to42Fixture','analyzeConditions43to57Fixture','analyzePace58to77Fixture','analyzeState78to92Fixture','analyzeChanges93to100Fixture','inspectEye15']}:{}),formal:false};
}
