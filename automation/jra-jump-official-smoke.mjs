// A bounded, read-only official JRA network probe. No credentials, DB, odds or target result.
import {load} from 'npm:cheerio@1.0.0';
import {readProgramDay} from './jra-jump-program-reader.mjs';
import {makeJraResultCollector} from './jra-jump-official-history.mjs';
const day='2026-11-14',asOf='2026-11-15';
const checked=await readProgramDay({load,date:day,asOf});
if(checked.meetings.length!==3||checked.meetings.reduce((s,m)=>s+m.race_nos.length,0)!==36||!checked.planned_only)throw Error('PROGRAM_EXPECTED_3_MEETINGS_36_RACES');
console.log('PASS official scheduled day: 3 meetings / 36 planned races');
const collector=makeJraResultCollector({load,expectedMeetingsReader:async()=>{throw Error('not a complete historical calendar witness')},maxRequests:2});
const r=await collector.result('pw01sde0105202605030820261114/9B',asOf);
if(!r.jump||r.track!=='東京'||r.race_no!==8||r.distance!==3110||r.class_name!=='オープン'||!r.rows.length)throw Error('JUMP_RESULT_EXPECTED_IDENTITY');
console.log('PASS official historical hurdle result: '+r.rows.length+' starters; identity and result decoder verified');
