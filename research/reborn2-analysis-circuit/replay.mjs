import {readFileSync} from 'node:fs';
import {analyzeField} from './analyze.mjs';
import {buildJraProfile} from './jra-profile.mjs';

const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
const {circuit,date,track,raceNo,rows,meta}=data;
if (!meta.length || meta.some(m=>m.cutoff!==meta[0].cutoff)) throw Error('UNBOUND_CUTOFF');
const roster=circuit==='JRA'?meta.map(m=>m.horse_no):[...new Set(rows.map(r=>Number(r.current_no)))];
if(circuit==='LOCAL' && roster.length!==meta[0].active_runner_count) throw Error('UNPROVEN_LOCAL_ROSTER');
const profile=data.profileInput ? buildJraProfile(data.profileInput) : null;
if(data.profileInput && (data.profileInput.target.cutoff!==meta[0].cutoff ||
    data.profileInput.target.track!==track || data.profileInput.target.race_no!==raceNo))
  throw Error('PROFILE_TARGET_MISMATCH');
const output=analyzeField({input:{circuit,targetDate:date,cutoff:meta[0].cutoff,roster,rows},profile});
console.log(JSON.stringify({circuit,date,track,raceNo,cutoff:meta[0].cutoff,runners:roster.length,
  roster_kind:circuit==='JRA'?'STORED_CARD_ROWS':'SNAPSHOT_WITNESS_COUNT_MATCH',
  source_rows:rows.length,profile_rows:profile?.history_n??null,
  over_five:roster.filter(n=>rows.filter(r=>Number(r.current_no)===n).length>5).length,
  coverage:output.coverage}));
