import crypto from 'node:crypto';
const H=n=>`SYN:H${n}`; const iso=n=>`2026-11-28T00:${String(n).padStart(2,'0')}:00Z`; const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const doc=(id,kind,observations,extra={})=>({evidence_id:id,kind,issuer:'SYNTHETIC',source_url:'https://www.jra.go.jp/synthetic-not-fetched',raw_sha256:hash(id),captured_at:iso(10),published_at:iso(5),version:'SYN-V1',parser_version:'SYN-PARSER-1',format:'SYNTHETIC_JSON',observations,...extra});
export const target={issuer:'SYNTHETIC',event_id:'SYN:T',scheduled_post:'2026-11-28T01:00:00Z'};
export const card=doc('E:CARD','TARGET_CARD',{rows:[1,2,3,4,5].map(no=>({native_horse_id:H(no),horse_no:no,gate:no,weight_g:55000,status:'ACTIVE'}))});
export const profile=n=>doc(`E:PROFILE:${n}`,'HORSE_PROFILE',{native_horse_id:H(n),sex:'TEST',birth_year:2022});
export function result(id,{late=false,peer='BASE',going='GOOD',distance=1400}={}){
 const early=[12600,11500,13500,12900,11600];
 const final=late?[37750,37200,39300,37900,38000]:[38400,37800,38100,38600,37900];
 const finish=late?[2,1,5,4,3]:[3,1,4,5,2];
 return doc(`E:${id}`,'HISTORICAL_RESULT',{event_id:id,distance_m:distance,going,class_label:peer,rows:[1,2,3,4,5].map((n,i)=>({native_horse_id:H(n),horse_no:n,status:'FINISHED',finish:finish[i],clock_ms:85000+i*300+(late?i*100:0),final600_ms:final[i],checkpoint_ms:[early[i],48000+i*50,73000+i*100],checkpoint_ranks:[i+1,Math.min(5,i+1),finish[i]]}))});
}
export const laps=(id,late=false)=>doc(`E:LAPS:${id}`,'RACE_LAPS',{event_id:id,boundaries_m:[0,200,800,1200,1400],values_ms:late?[11500,36000,25500,11700]:[11500,36000,24800,12500]},{measurement_scope:'RACE_LEADER'});
export const splits=(id,n)=>doc(`E:SPLITS:${id}:${n}`,'INDIVIDUAL_SPLITS',{event_id:id,native_horse_id:H(n),boundaries_m:[0,200,800,1200,1400],values_ms:[12000+n*100,35500,25000+n*80,12000+n*50]},{measurement_scope:'INDIVIDUAL'});
export const eyeCategories=['EYE01','EYE02','EYE03','EYE04','EYE05','EYE06','EYE07','EYE08','EYE09','EYE10','EYE11','EYE12','EYE13','EYE14','EYE15'];
export function eyeMatrix(){return eyeCategories.map((id,i)=>({id,support:[`EYE-S-${i}`],counter:i%3===0?[`EYE-C-${i}`]:[],duplicate_of:i===14?'EYE04':null,irrelevant:i===13?[`EYE-I-${i}`]:[],expected_grade:null}));}
export const controls={sameEarlyDifferentLate:{base:result('BASE'),contrast:result('LATE',{late:true}),laps:[laps('BASE'),laps('LATE',true)]},opponentComposition:{base:result('PEER-A',{peer:'CLASS-A'}),contrast:result('PEER-B',{peer:'CLASS-B'})},conditionChange:{improved:result('GOOD-1200',{distance:1200,going:'GOOD'}),worsened:result('HEAVY-1600',{distance:1600,going:'HEAVY'})},missing:{state:'MISSING',value:null,evidence_ids:[],missing_reason:'NOT_PUBLISHED'},conflict:{state:'CONFLICT',value:null,evidence_ids:['E:BASE','E:LATE'],conflict:[1,2]},eye:eyeMatrix()};
