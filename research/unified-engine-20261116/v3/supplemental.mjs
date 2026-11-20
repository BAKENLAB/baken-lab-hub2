import {readFileSync} from 'node:fs';import {sha,key} from './enrich.mjs';import {horseId} from './query.mjs';
const KINDS=new Set(['incident','geometry','training','pedigree','full_career','payout_cohort','sustained_effort']);
// Optional saved official evidence, not a network collector or inferred source.
export function readSupplemental(path){if(!path)return [];const x=JSON.parse(readFileSync(path));if(x.format!=='BAKEN_V3_OFFICIAL_SUPPLEMENTAL_V1'||!Array.isArray(x.entries))throw Error('SUPPLEMENTAL_FORMAT');return x.entries;}
export function supplementalForHorse(r,entries){const out={};for(const x of entries.filter(x=>x.race_key===[r.race_date,r.track,r.race_no].join('/')&&x.horse_id===horseId(r.horse_ref))){
 if(!KINDS.has(x.kind)||out[x.kind])throw Error('SUPPLEMENTAL_KIND_OR_DUPLICATE');const s=x.source;if(!s||typeof s.content!=='string'||sha(s.content)!==s.sha256)throw Error('SUPPLEMENTAL_HASH');
 const u=new URL(s.ref);if(u.protocol!=='https:'||u.username||u.password||u.port||!['www.jra.go.jp','jra.go.jp','www.keiba.go.jp'].includes(u.hostname))throw Error('SUPPLEMENTAL_OFFICIAL_SOURCE');
 if(![s.known_at,s.observed_at].every(t=>Number.isFinite(Date.parse(t)))||Date.parse(s.known_at)>=Date.parse(r.post_time)||Date.parse(s.observed_at)<Date.parse(s.known_at))throw Error('SUPPLEMENTAL_CUTOFF');
 if(s.published_at!=null&&(!Number.isFinite(Date.parse(s.published_at))||Date.parse(s.published_at)>Date.parse(s.known_at)||Date.parse(s.published_at)>=Date.parse(r.post_time)))throw Error('SUPPLEMENTAL_PUBLISHED_CUTOFF');
 const value=JSON.parse(s.content);if(value.horse_id!==horseId(r.horse_ref)||value.race_key!==x.race_key||value.kind!==x.kind)throw Error('SUPPLEMENTAL_IDENTITY');
 if(/"(?:odds|popularity|market|target_finish|result)"\s*:/.test(s.content))throw Error('SUPPLEMENTAL_MARKET_OR_TARGET_RESULT');
 out[x.kind]={value,source:{ref:s.ref,sha256:s.sha256,known_at:s.known_at,observed_at:s.observed_at,published_at:s.published_at??null},strict_frozen_input_proven:false};
 }return out;}
export function rivalsForHorse(r,facts,rows){const out=[];for(const x of rows.filter(x=>x.race_key===[r.race_date,r.track,r.race_no].join('/')&&x.horse_no===r.horse_no)){
 const p=facts.priors.find(p=>p.index===x.prior_index&&p.match_status==='MATCHED'&&p.flat);if(!p)throw Error('RIVAL_UNMATCHED_PRIOR');
 const ids=x.opponents.map(o=>o.opponent_id);if(new Set(ids).size!==ids.length||ids.includes(horseId(r.horse_ref))||ids.some(x=>!/^\d{10}$/.test(x))||x.opponents.length!==p.archive.field_size-1)throw Error('RIVAL_FIELD_IDENTITY');
 for(const o of x.opponents){const f=o.followup;if(!f)continue;if(f.race_date<=p.baseline.race_date||f.race_date>=r.race_date||f.race_type!=='平地'||!/^pw01sde\d+\/[\da-f]+$/i.test(f.source_ref)||![f.source_checked_at,f.created_at,f.updated_at].every(t=>Date.parse(t)<Date.parse(r.post_time)))throw Error('RIVAL_CUTOFF_OR_SOURCE');
 out.push({...o,prior_race_id:p.archive.race_id,prior_index:p.index,strict_frozen_input_proven:false});}
 }return out;}
