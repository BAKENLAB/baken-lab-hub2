import {digest,sourceOK,forbidMarketsOrTargetResults} from '../input.mjs';
import {MINETA} from './conditions.mjs';
const numeric=x=>typeof x==='number'&&Number.isFinite(x)?x:typeof x==='string'&&/^-?\d+(?:\.\d+)?$/.test(x)?Number(x):null;
export function validateCorners(raw,field){
 const p=Array.isArray(raw)?raw:typeof raw==='string'&&/^\d+(?: \d+){0,3}$/.test(raw)?raw.split(' ').map(Number):null;
 return p&&p.length>=1&&p.length<=4&&Number.isInteger(field)&&field>0&&p.every(n=>Number.isInteger(n)&&n>=1&&n<=field)?[...p]:null;
}
export function styleOf(corners){if(!corners?.length)return 'UNKNOWN';const m=Math.min(...corners);return m<=3?'FRONT':m<=5?'SEMI':m<=9?'MID':'REAR';}
export function frontShare(styles){const n=styles.length,f=styles.filter(x=>x==='FRONT').length,u=styles.filter(x=>x==='UNKNOWN').length;if(!n)return {status:'UNKNOWN',matched:null};return {status:(f+u)*10<3*n?'CONFIRMED_BELOW_30':f*10>=3*n?'CONFIRMED_NOT_BELOW_30':'UNKNOWN_STRADDLES_30',matched:(f+u)*10<3*n?true:f*10>=3*n?false:null,front:f,unknown:u,active:n,lower:f/n,upper:(f+u)/n,hypothesis_threshold:'<30%',example_only_thresholds:['<40%','>50%']};}
export function rejectOutcomeFields(input){forbidMarketsOrTargetResults(input);const visit=(x)=>{if(!x||typeof x!=='object')return;for(const [k,v] of Object.entries(x)){if(/^(target_actual_position|target_position|target_finish|current_actual_position|target_corners)$/i.test(k))throw Error('V2_TARGET_OUTCOME_FORBIDDEN');visit(v)}};visit(input);if(input.race&&['finish','corner_positions','early_pos','final_turn_pos'].some(k=>k in input.race))throw Error('V2_TARGET_OUTCOME_FORBIDDEN');}
const asofCutoff=input=>Math.min(Date.parse(input.captured_at),Date.parse(input.race.post_time)-1);
const availableSource=(s,input)=>sourceOK(s,asofCutoff(input));
export const atomicFact=(horse,run,field,value,verified)=>({id:'atom:'+digest([horse,run?.race_date,run?.track,run?.source_ref??run?.source?.ref,field,value]).slice(0,24),horse_id:horse,prior_key:run?[horse,run.race_date,run.track,run.source_ref??run.source?.ref].join('/'):'CURRENT_CONDITION',field,value,verified,source_ref:run?.source_ref??run?.source?.ref??null});
const fact=atomicFact;
const cornerFacts=(horse,run,cs,verified)=>run&&cs?cs.map((value,i)=>fact(horse,run,'corner['+i+']',value,verified)):[];
export function priorView(input,horse){
 const cutoff=asofCutoff(input);
 const all=input.history.filter(h=>h.horse_id===horse.horse_id&&h.race_date<input.race.race_date).slice().sort((a,b)=>b.race_date.localeCompare(a.race_date));
 const isRun=h=>Number.isInteger(numeric(h.finish))&&numeric(h.finish)>0||['RAN','DNF'].includes(h.run_status);
 const valid=all.filter(h=>h.race_type==='平地'&&isRun(h)&&availableSource(h.source,input));
 const last=valid[0]??null;
 // Unknown newer records cannot silently become a confirmed latest-flat style.
 const newerUnknown=all.some(h=>(!last||h.race_date>=last.race_date)&&h.race_type!=='平地'&&h.race_type!=='障害'&&h.run_status!=='CANCELLED'&&h.run_status!=='EXCLUDED');
 const observed=all.find(h=>h.race_type!=='障害'&&isRun(h))??null;
 const raw=last??observed,cs=raw?validateCorners(raw.corner_positions,numeric(raw.field_size)):null;
 const certified=!!last&&!newerUnknown&&!!cs&&Date.parse(last.source.known_at)<=cutoff;
 return {all,last,observed:raw,corners:cs,style:certified?styleOf(cs):'UNKNOWN',recorded_style:styleOf(cs),certified,latest_flat_verified:!!last&&!newerUnknown,reason:!last?'LATEST_FLAT_NOT_VERIFIED':newerUnknown?'NEWER_RACE_TYPE_UNKNOWN':!cs?'CORNERS_UNKNOWN_OR_INVALID':'VERIFIED'};
}
function roiTransition(pattern,input){
 const unknown=reason=>({status:'ROI_UNAVAILABLE',matched:null,reason,proxy:pattern?.proxy??null});
 if(!pattern)return unknown('NO_PLACE_PAYOUT_STUDY');
 if(pattern.metric!=='PLACE_ROI_PERCENT')return unknown('PLACE_RATE_IS_NOT_ROI');
 if(pattern.payouts_verified!==true||!availableSource(pattern.source,input)||!pattern.train_to||pattern.train_to>=input.race.race_date)return unknown('PAYOUT_OR_ASOF_NOT_VERIFIED');
 for(const cell of [pattern.prior,pattern.current])if(!cell||numeric(cell.roi_percent)===null||!Number.isInteger(cell.n)||cell.n<50||!Number.isInteger(cell.span_years)||cell.span_years<10)return unknown('INSUFFICIENT_N_OR_TEN_YEAR_SPAN');
 return {status:'AVAILABLE',matched:pattern.prior.roi_percent<=70&&pattern.current.roi_percent>=90,primary_definition:'prior <=70%, current >=90%',alternative_definition:'prior <60%, current >=90%',alternative_match:pattern.prior.roi_percent<60&&pattern.current.roi_percent>=90,n_prior:pattern.prior.n,n_current:pattern.current.n,train_to:pattern.train_to};
}
export function buildMinetaFacts(input){
 rejectOutcomeFields(input);const active=input.roster.filter(h=>h.status==='ACTIVE');if(!active.length||new Set(active.map(h=>h.horse_no)).size!==active.length)throw Error('V2_ACTIVE_FIELD');
 const view=new Map(active.map(h=>[h.horse_id,priorView(input,h)])),byNo=new Map(active.map(h=>[h.horse_no,h]));const share=frontShare(active.map(h=>view.get(h.horse_id).style)),out=new Map();
 for(const h of active){
  const v=view.get(h.horse_id),r=v.observed,cs=v.corners,rows={};const set=(id,status,matched,value,evidence=[],missing=[])=>{rows['mineta_'+id]={status,matched,value,evidence,missing,automatic_points:false}};
  const cornerAtoms=cornerFacts(h.horse_id,r,cs,v.certified);
  set('T01',v.certified?'AVAILABLE':'UNKNOWN',v.certified?v.style==='FRONT':null,{style:v.style,recorded_style:v.recorded_style,min_corner:cs?Math.min(...cs):null,corner_gain:cs?cs[0]-cs.at(-1):null,late_advance:cs?cs.at(-1)<cs[0]:null,rally_to_front:cs?cs[0]>3&&cs.at(-1)<=3:null,definition:'MIN_ALL_CORNERS_NOT_MULTI_RUN_EARLY_AVERAGE'},cornerAtoms,v.certified?[]:[v.reason]);
  set('T02',share.status,share.matched,share,active.map(a=>view.get(a.horse_id)).filter(a=>a.certified).flatMap(a=>cornerFacts(a.last.horse_id,a.last,validateCorners(a.last.corner_positions,numeric(a.last.field_size)),true)),share.unknown?['UNKNOWN_FIELD_STYLES']:[]);
  const left=byNo.get(h.horse_no-1),right=byNo.get(h.horse_no+1),ls=left?view.get(left.horse_id).style:null,rs=right?view.get(right.horse_id).style:null;
  const sandwich=v.style==='UNKNOWN'||ls==='UNKNOWN'||rs==='UNKNOWN'?null:v.style!=='FRONT'&&ls==='FRONT'&&rs==='FRONT';
  set('T03',!left||!right?'NO_TWO_ACTIVE_LITERAL_NEIGHBORS':sandwich===null?'UNKNOWN':'PATTERN_REVIEW_REQUIRED',!left||!right?false:sandwich,{left_no:h.horse_no-1,right_no:h.horse_no+1,left_style:ls,right_style:rs,current_style:v.style,skip_cancelled_neighbors:false},[],['START_AND_GEOMETRY_REPRODUCTION_NOT_ESTABLISHED']);
  const g=input.geometry,draw=h.draw,geometryOK=g&&availableSource(g.source,input)&&Number.isFinite(g.first_corner_m)&&g.first_corner_m>0&&['芝','ダート'].includes(g.start_surface)&&Number.isInteger(draw)&&draw>0;
  set('T04',geometryOK?'GEOMETRY_REVIEW_REQUIRED':'UNKNOWN_GEOMETRY_OR_DRAW',null,{adjacent_fronts:v.style==='FRONT'&&[ls,rs].includes('FRONT'),draw:draw??null,first_corner_m:geometryOK?g.first_corner_m:null,start_surface:geometryOK?g.start_surface:null,directional_bonus:'NONE'},[],geometryOK?['REPRODUCTION_AND_DIRECTION_REVIEW_REQUIRED']:['FIRST_CORNER_START_SURFACE_VERIFIED_DRAW']);
  const roi=roiTransition(input.pattern_transition?.[h.horse_id],input);set('T05',roi.status,roi.matched,roi,[],roi.status==='AVAILABLE'?[]:[roi.reason]);
  const previousDistance=r?numeric(r.distance):null,change=previousDistance!==null?input.race.distance-previousDistance:null;
  const distanceAtom=r&&change!==null?fact(h.horse_id,r,'distance',previousDistance,v.latest_flat_verified):null;
  for(const [id,matched] of [['T06',change===null?null:change<0],['T07',change===null?null:change>0]])set(id,change===null?'UNKNOWN':'CHANGE_OBSERVED_REVIEW_REQUIRED',matched,{change_m:change,same_surface:r?r.surface===input.race.surface:null,position_projection:'UNVALIDATED',stamina:'UNVALIDATED',late_fade:'UNVALIDATED'},distanceAtom?[distanceAtom]:[],['DIRECTION_MAGNITUDE_AND_REPRODUCTION_REVIEW_REQUIRED']);
  const full=input.complete_history?.[h.horse_id],binding=digest(v.all),fullOK=full?.complete===true&&availableSource(full.source,input)&&full.history_sha256===binding;
  const knownSame=v.all.some(p=>p.surface===input.race.surface&&availableSource(p.source,input)),debut=knownSame?false:fullOK?true:null;
  let alternations=0;for(let i=1;i<v.all.length;i++)if(v.all[i].surface!==v.all[i-1].surface)alternations++;
  set('T08',debut===null?'FULL_HISTORY_INCOMPLETE':'HISTORY_REVIEW_REQUIRED',null,{surface_changed:r?r.surface!==input.race.surface:null,first_target_surface:debut,full_history_verified:fullOK,observed_surface_alternations:alternations,visible_history_count:v.all.length,recorded_target_surface_seen:v.all.some(p=>p.surface===input.race.surface),automatic_surface_bonus:false},[],fullOK?['SCHEDULING_AND_DISTANCE_INTERACTION_REVIEW_REQUIRED']:['FULL_CAREER_HISTORY_UNAVAILABLE']);
  const supplements=(input.supplemental??[]).filter(s=>s.horse_id===h.horse_id&&availableSource(s.source,input));
  set('T09','DESCRIPTIVE_REVIEW_REQUIRED',null,{position_gain:cs?cs[0]-cs.at(-1):null,official_incident:supplements.some(s=>s.kind==='OFFICIAL_INCIDENT'&&s.official_incident_verified===true),official_rival_followup:supplements.some(s=>s.kind==='OFFICIAL_RIVAL_FOLLOWUP'&&s.identity_verified===true),relative_last3f:r?.final3f_rank??null,field_laps_present:Array.isArray(r?.halon_laps),burden_cause:'NOT_PROVEN',current_reproduction_route:'NOT_AUDITED'},cornerAtoms,['CONCRETE_BURDEN_AND_CURRENT_REPRODUCTION_ROUTE_REQUIRED']);
  set('T10','DISABLED_MARKET_SEPARATION',null,{rank_effect:false,eye_effect:false});
  for(const id of ['T11','T12','T13'])set(id,'PROPRIETARY_UNAVAILABLE',null,null,[],['NO_PUBLIC_REPRODUCIBLE_FORMULA']);
  set('T14','INTEGRATION_ONLY_NOT_A_BONUS',null,{depends_on:MINETA.filter(c=>c.id!=='mineta_T14').map(c=>c.id),repeat_fact_bonus:0});
  out.set(h.horse_id,rows);
 }
 return {facts:out,active_count:active.length,style_coverage:active.filter(h=>view.get(h.horse_id).certified).length,share};
}
