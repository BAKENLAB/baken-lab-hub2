import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {analyzeV30,loadV30} from '../reborn2-chatgpt-circuit/work29-v30-terminal.mjs';
import {pipeline31,verifier31} from './work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {consume32,BUNDLE_SHA256,PRODUCER_SHA256} from './work32-pinned/stage32-verified-common-adapter-v0.1.2.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const fixed=(file,digest)=>{
  const bytes=readFileSync(new URL('./work32-pinned/'+file,import.meta.url));
  if(sha(bytes)!==digest)throw Error('WORK32_PIN_MISMATCH');
  return bytes.toString('utf8');
};
export function replayWork32(n,{withdraw=null,placeThreshold=null}={}){
  const text=fixed('stage32-bundles-v0.1.2.json',BUNDLE_SHA256);
  fixed('stage32-condition-pipeline-v0.1.2.mjs',PRODUCER_SHA256);
  fixed('stage32-verified-common-adapter-v0.1.2.mjs','098f94a2738d68d30030403788dc15f707dba4438719256f08b846403fba0e92');
  const bundle=JSON.parse(text);
  const catalog=loadV30().canonical;
  if(bundle.canonical.length!==115||bundle.canonical.some((x,i)=>x.item!==catalog[i]?.item||x.name!==catalog[i]?.name))throw Error('WORK32_CANONICAL');
  const fixture=bundle.cases.find(c=>c.n===n);
  if(!fixture)throw Error('WORK32_CASE_NOT_PINNED');
  const envelope=pipeline31(fixture.input,fixture.registry,bundle.canonical,sha,verifier31);
  const result=consume32(text,n,envelope,sha,pipeline31,verifier31,analyzeV30,withdraw,{placeThreshold});
  if(result.state!=='COMMON_ANALYZER_EXECUTED')throw Error(result.reason??result.state);
  return result;
}

// Keep historical observations and transfer judgments independently inspectable.
export function reviewWork32(n,options={}){
  const {pack,result}=replayWork32(n,options);
  const runners=result.runners.map(h=>{
    const active=h.status==='ACTIVE'&&h.identity_known;
    const state=h.status==='CANCELLED'?'NOT_APPLICABLE':active?'HELD_CURRENT_TRANSFER':'HELD_IDENTITY_OR_STATUS';
    const conditions=active?h.condition_paths.map(p=>({
      event:p.event,matched:Object.keys(p.dims).filter(k=>p.dims[k]===true),
      changed:p.mismatches,unknown:p.unknown,state:p.state,refs:p.refs
    })):[];
    const scenarios=active?h.scenarios_v30.filter(p=>!['CHECKPOINT_OBSERVED','FINISH_OBSERVED'].includes(p.kind))
      .map(p=>({...p,win:p.envelope?.win??null,place:p.envelope?.place??null})):[];
    const opposing=active?h.findings_v30.filter(f=>[
      'CHECKPOINT_PERSISTENCE_REFUTED','SHARED_PATH_REJECTED_BY_TERMINAL_COUNTEREVIDENCE'
    ].includes(f.state)):[];
    return {
      slot:h.slot,status:h.status,state,
      axes:{
        A:{history:active?h.historical:[],scope:'PAST_ONLY'},
        B:{conditions,current_support:null},
        C:{observations:active?h.terminal_v30.map(p=>({event:p.event,rival:p.rival,
          order:p.finish_order,refs:p.refs})):[],scope:'PAST_ONLY'},
        D:{scenarios,observed_pace:active?h.pace_paths:[],current_response:null},
        E:{opposing,severity:opposing.length?'HISTORICAL_PATH_REFUTED':'UNDETERMINED',current_severity:null}
      },
      eye_feedback:active?h.eye_feedback_v30:[],
      audit:h.items.map(i=>({id:i.item,state:active?(i.refs.length?'EVIDENCE_REFERENCED':'NO_EVIDENCE'):state,
        findings:active?i.v30_findings:[],grade_effect:false})),
      grade:null
    };
  });
  return {manifest_digest:pack.packet.manifestDigest,scope:pack.packet.scope,
    scenarios:result.shared_scenarios_v30,conflicts:pack.packet.conflicts,runners,formal:false};
}
