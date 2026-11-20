import {digest} from './input.mjs';
// ALL numbers/names/sources in this fixture are explicitly synthetic test data.
const hash='a'.repeat(64),known='2026-11-15T00:00:00Z';
export const source=(official=true)=>({verified:true,known_at:known,sha256:hash,ref:official?'https://www.jra.go.jp/JRADB/synthetic-test':'https://github.com/BAKENLAB/baken-lab-hub2/synthetic-test-policy'});
export function lock(record){const {source:s,...body}=record;return {...body,source:{...source(false),...s,sha256:digest(body)}};}
export function fixture(){
 const roster=Array.from({length:8},(_,i)=>({horse_id:'SYNTHETIC-'+(i+1),horse_no:i+1,horse_name:'架空研究試験馬'+(i+1),status:'ACTIVE',identity_source:source()}));
 const race={race_id:'2026-11-15/東京/8',race_date:'2026-11-15',track:'東京',race_no:8,post_time:'2026-11-15T06:00:00Z',surface:'芝',distance:1600,class_level:1};
 const history=roster.flatMap((h,i)=>['2026-10-01','2026-10-15'].map((d,j)=>({horse_id:h.horse_id,horse_name:h.horse_name,race_date:d,track:'東京',race_no:j+1,race_type:'平地',surface:'芝',distance:1600,finish:2,field_size:16,margin_to_winner:0.2,early_pos:j?i<5?12:5+i-5:i<5?8:1+i-5,final_turn_pos:j?1:1,class_level:1,source:source()})));
 // First criterion references newer run; position evidence references older run,
 // ensuring different underlying races instead of two labels on one result.
 history.forEach(h=>{if(h.race_date==='2026-10-01'){h.early_pos=1+(Number(h.horse_id.split('-')[1])>5?Number(h.horse_id.split('-')[1])-6:7);h.final_turn_pos=h.early_pos;}else{h.early_pos=Number(h.horse_id.split('-')[1])<=5?12:Number(h.horse_id.split('-')[1])-1;h.final_turn_pos=1;}});
 const baseline=lock({runners:roster.map((h,i)=>({horse_id:h.horse_id,rank:i+1,score:95-i*5})),top5:roster.slice(0,5).map(h=>h.horse_id),eye:null});
 const rubric=lock({version:'SYNTHETIC_ONLY_NOT_APPROVED_WEIGHTS',criteria:[{id:'near_distance',max_points:50},{id:'position_gain',max_points:50}]});
 const input={mode:'SYNTHETIC_TEST',race,captured_at:'2026-11-15T01:00:00Z',input_frozen_at:'2026-11-15T02:00:00Z',roster,history,supplemental:[],baseline,rubric,reviews:[],eye_review:null};
 return input;
}
export function resultFixture(input){return lock({race_id:input.race.race_id,status:'OFFICIAL_FINAL',source:{...source(),known_at:'2026-11-15T06:30:00Z'},runners:input.roster.filter(h=>h.status==='ACTIVE').map(h=>({horse_id:h.horse_id,finish:h.horse_no===8?1:h.horse_no===6?2:h.horse_no===5?3:h.horse_no+3}))});}
