import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {horseId,raceCname} from './query.mjs';
export const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export const key=r=>[r.race_date,r.track,r.race_no,r.horse_no].join('/');
export function readPacket(path){const packet=JSON.parse(readFileSync(path));if(packet.format!=='BAKEN_V3_ENRICHMENT_GZIP_BASE64_V1')throw Error('PACKET_FORMAT');const raw=gunzipSync(Buffer.from(packet.data,'base64'));if(sha(raw)!==packet.sha256)throw Error('PACKET_HASH');const data=JSON.parse(raw);if(data.observed_at!==packet.observed_at||data.rows.length!==packet.rows)throw Error('PACKET_META');return {...data,sha256:packet.sha256};}
const time=x=>typeof x==='string'?Date.parse(x):NaN;
const sameNumber=(a,b)=>a==null&&b==null||a!=null&&b!=null&&Number.isFinite(Number(a))&&Number(a)===Number(b);
export function matchPrior(r,p,e,index){
 const base={baseline:p,index,match_status:'UNKNOWN',reason:'ARCHIVE_NOT_FOUND',flat:false,relative3f_verified:false,archive:null,strict_frozen_input_proven:false};
 if(!e)return {...base,reason:'ENRICHMENT_ROW_MISSING'};
 if(e.candidates.length!==1)return {...base,reason:e.candidates.length?'AMBIGUOUS_ARCHIVE':'ARCHIVE_NOT_FOUND'};
 const a=e.candidates[0],fail=[];
 if(a.race_date>=r.race_date)fail.push('FUTURE_OR_TARGET_RACE');
 if(a.race_date!==p.race_date||a.track!==p.track||a.surface!==p.surface||a.distance!==p.distance)fail.push('RACE_IDENTITY');
 if(a.source_ref!==raceCname(p.source_ref)&&a.source_ref?.split('CNAME=')[1]!==raceCname(p.source_ref))fail.push('OFFICIAL_RACE_REF');
 if(horseId(a.horse_ref)!==horseId(r.horse_ref)||!horseId(r.horse_ref))fail.push('HORSE_ID');
 if(a.horse_name!==r.horse_name||a.horse_no!==e.expected_prior_no||!e.baseline_live_version_matched)fail.push('NAME_OR_PRIOR_NO_OR_LIVE_VERSION');
 if(!sameNumber(a.finish,p.finish)||!sameNumber(a.final3f,p.final3f)||!sameNumber(a.field_size,p.field_size))fail.push('FINISH_OR_LAST3F_OR_FIELD_SIZE');
 if(![a.source_checked_at,a.created_at,a.updated_at].every(t=>time(t)<time(r.post_time)))fail.push('ARCHIVE_CUTOFF');
 const archivedCorners=typeof a.corners==='string'?a.corners.match(/\d+/g)?.map(Number):Array.isArray(a.corners)?a.corners:null;
 if(archivedCorners?.length&&JSON.stringify(archivedCorners)!==JSON.stringify(p.corner_positions))fail.push('CORNER_POSITION_CONFLICT');
 const positions_verified=!!archivedCorners?.length&&archivedCorners[0]===p.early_pos&&archivedCorners.at(-1)===p.final_turn_pos;
 const evaluation_eligible=Number.isInteger(p.finish)&&p.finish>=1&&p.finish<=p.field_size;
 const types=[a.race_type,...(a.horse_runs_race_types??[])].filter(Boolean);const flat=types.length>0&&types.every(t=>t==='平地'||t==='FLAT');
 if(types.some(t=>t!==types[0]))fail.push('RACE_TYPE_CONFLICT');
 if(fail.length)return {...base,match_status:'CONFLICT',reason:fail.join('|')};
 return {...base,archive:a,match_status:'MATCHED',reason:'EXACT_OFFICIAL_RACE_AND_HORSE_ID_WITH_NAME_NO_FINISH_LAST3F',flat,positions_verified,evaluation_eligible:flat&&evaluation_eligible,relative3f_verified:flat&&a.full_field===true&&a.field_rows===a.field_size&&a.field_final3f_count===a.field_size&&a.final3f!=null&&a.final3f_rank===a.calculated_final3f_rank,
 timestamp_consistent_before_post:true,timestamp_consistent_before_frozen:[a.source_checked_at,a.created_at,a.updated_at].every(t=>time(t)<=time(r.frozen_at)),race_type_status:flat?'CONFIRMED_FLAT':types.length?'NON_FLAT':'UNKNOWN'};
}
export function enrichHorse(r,records){
 const es=records.filter(e=>[e.target_date,e.target_track,e.target_no,e.target_horse_no].join('/')===key(r));
 const priors=r.past_runs.map((p,i)=>{const matches=es.filter(e=>e.prior_index===i);if(matches.length>1)throw Error('DUPLICATE_ENRICHMENT_ROW');return matchPrior(r,p,matches[0],i);});
 const e=es[0];const live=e?.baseline_live_version_matched===true&&time(r.source_checked_at)<time(r.post_time)&&time(r.history_updated_at)<time(r.post_time)?e.live_attributes:null;
 const card=e?.card_attributes&&time(e.field_fetched_at)<time(r.post_time)?e.card_attributes:null;
 const attrs={};for(const k of ['draw','sex_age','weight_carried','body_weight','body_weight_diff','equipment','jockey','trainer','going','weather','layout'])attrs[k]=live?.[k]??card?.[k]??null;
 return {priors,attrs,attributes_source:e?{field_fetched_at:e.field_fetched_at,source_checked_at:r.source_checked_at,live_version_matched:e.baseline_live_version_matched}:null,provenance:'READ_ONLY_TIMESTAMP_RECONSTRUCTION_NOT_IMMUTABLE_FROZEN_INPUT'};
}
