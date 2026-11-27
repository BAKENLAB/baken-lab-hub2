import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {jointField,loadV30} from '../reborn2-chatgpt-circuit/work29-v30-terminal.mjs';
import {pipeline31,verifier31} from './work31-pinned/stage31-multifield-pipeline-v0.1.1.mjs';
import {guardedBridge31} from './work31-pinned/stage31-guarded-v30-bridge-v0.1.1.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>readFileSync(new URL('./work31-pinned/'+name,import.meta.url));
const bundlesName='stage31-multifield-bundles-v0.1.1.json';
const fixedFiles={
 'stage31-final-handoff-v0.1.1.json':'143e73029873b70446eb552817b89548b246d7e703fbb0bf4f7a06aea29e0ff6',
 [bundlesName]:'f9df1d7d76b2c50d94aa3e0587032ebf2867ee52d138a9a8e328e5cfa30c85b6',
 'stage31-multifield-pipeline-v0.1.1.mjs':'2a90a34871340ff6be8c29f36d6f2911a743827bb98de1198358f77ac9dcefff',
 'stage31-guarded-v30-bridge-v0.1.1.mjs':'96f66776de5cb74c24936a83246f2428a0a14b5365748df15ffc96c5de5f610a'
};
const unique=xs=>[...new Set(xs)].sort();

export function replayPinnedWork31(n,{withdraw=null}={}){
  for(const [file,digest] of Object.entries(fixedFiles)){
    if(sha(read(file))!==digest)throw Error('WORK31_SOURCE_PIN');
  }
  const b=JSON.parse(read(bundlesName));
  const names=loadV30().canonical;
  if(b.canonical.length!==115||b.canonical.some((x,i)=>x.item!==names[i]?.item||x.name!==names[i]?.name))
    throw Error('WORK31_CANONICAL');
  const fixture=b.cases.find(c=>c.n===n);
  if(!fixture)throw Error('UNPINNED_CASE');
  const envelope=pipeline31(fixture.input,fixture.registry,b.canonical,sha,verifier31);
  if(envelope.state!=='TEST_PACKET'||envelope.digest!==sha(JSON.stringify(envelope.packet))||
    envelope.resultTimestamp?.digest!==envelope.digest||envelope.packet.formal_admissions!==0)
    throw Error('WORK31_REPLAY_REJECTED');
  const outputHashes={
    3:'6239357e4557b8fa49c973bb12ec62ecb8dd5bb9d576c3493cbdc003445e4391',
    5:'00e048a9670ba3ab5df0c8a02c0f2b9430cb7bcc41e5cf1edfff346144495ce5',
    12:'2bb082754b3544facb786064a7b4441800dc8b002611401b572605bac4e7b8c2'
  };
  if(sha(JSON.stringify(envelope)+'\n')!==outputHashes[n])
    throw Error('WORK31_TRANSPORT_PIN');
  const p=envelope.packet;
  const all=new Map(p.evidence.map(e=>[e.evidenceId,e]));
  if(all.size!==p.evidence.length||new Set(p.evidence.map(e=>e.root)).size!==all.size)
    throw Error('WORK31_DUPLICATE_PROVENANCE');
  const closure=(id,ancestors=new Set())=>{
    const e=all.get(id);
    if(!e||ancestors.has(id)|| e.issuer!==p.issuer)throw Error('WORK31_DEPENDENCY');
    if(id===withdraw||e.root===withdraw)return null;
    const deps=e.dependencies.map(k=>closure(k,new Set([...ancestors,id])));
    if(deps.includes(null))return null;
    return unique([e.root,...deps.flat()]);
  };
  for(const id of all.keys())closure(id);
  const shared=guardedBridge31(p,jointField,withdraw);
  const runners=p.runners.map(h=>{
    const active=h.status==='ACTIVE'&&Boolean(closure(h.cardRef));
    const observed=active?p.evidence.filter(e=>e.subject===h.nativeId&&e.event!==p.targetId&&
      ['finish','finish_clock','individual_final600','winner_clock_difference'].includes(e.field)&&closure(e.evidenceId))
      .map(e=>({event:e.event,field:e.field,value:e.value,roots:closure(e.evidenceId)})):[];
    const rival=active?shared.fields.map(f=>({event:f.event,envelope:f.field.envelopes.find(x=>x.slot===h.nativeId),
      relations:f.pairs.filter(x=>[x.a,x.b].includes(h.nativeId)&&x.order!=='UNKNOWN').map(x=>({
        peer:x.a===h.nativeId?x.b:x.a, order:x.a===h.nativeId?x.order:x.order==='AHEAD'?'BEHIND':'AHEAD',
        roots:unique(x.refs.flatMap(id=>closure(id)??[]))
      }))})):[];
    for(const prior of rival){
      const ahead=prior.relations.some(p=>p.order==='AHEAD');
      const behind=prior.relations.some(p=>p.order==='BEHIND');
      prior.historical_comparison=ahead&&behind?'MIXED':ahead?'AHEAD_OF_OBSERVED_RIVALS':
        behind?'BEHIND_OBSERVED_RIVALS':'UNRESOLVED';
    }
    const pace=active?p.histories.filter(history=>history.participants.includes(h.nativeId)&&history.lap&&closure(history.lap))
      .map(history=>({event:history.event,scope:'RACE_LEADER_ONLY',roots:closure(history.lap)})):[];
    const state=h.status==='CANCELLED'?'NOT_APPLICABLE':active?'CURRENT_TRANSFER_UNPROVEN':'HELD_STATUS_OR_IDENTITY';
    return {slot:h.nativeId,status:h.status,axes:{
      A:{observed,observed_wins:observed.filter(e=>e.field==='finish'&&e.value===1).map(e=>e.event),
        scope:'HISTORICAL_RUN_MATERIAL'}, B:{state,condition_response:null},
      C:{rival,scope:'HISTORICAL_ORDER_ONLY'}, D:{pace,current_tolerance:null},
      E:{opposing_history:rival.filter(x=>x.relations.some(r=>r.order==='BEHIND')),current_counter:null}},
      audit:h.items.map(i=>({id:i.item,name:i.name,state:!active?state: i.refs.some(closureRef=>closure(closureRef))?
        'OBSERVATION_REFERENCED':'MISSING_OR_WITHDRAWN',grade_effect:false})),
      grade:null,state};
  });
  return {source_digest:envelope.digest,evidence_count:all.size,item_rows:runners.length*115,
    issuer:p.issuer,runners,formal:false};
}
