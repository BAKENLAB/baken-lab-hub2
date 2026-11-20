# Generate only a research text candidate; fail closed if source anchors drift.
from pathlib import Path
import hashlib,json,difflib
root=Path(__file__).parent
base=(root/'../v14/sources/index.ts.txt').read_text()
assert hashlib.sha256(base.encode()).hexdigest()=='18f2b9ea8520b244f28ccb6c54b5a8f740dc8f30d17c2c0d8ed0d50bde18377d'
s=base
anchors=[]
def insert(anchor,stage,value,before=True):
 global s
 anchor=('\n'+anchor) if anchor.startswith(' ') else anchor
 assert s.count(anchor)==1,(anchor,s.count(anchor))
 line=f'\n // V16 OBSERVE {stage}\n if(researchCapture.enabled) await researchCapture.observe("{stage}",()=>({value}));\n'
 s=s.replace(anchor,line+anchor if before else anchor+line)
 anchors.append({'stage':stage,'anchor':anchor,'value':value,'position':'before' if before else 'after'})
s='import {createResearchCapture} from "./capture.mjs"; // V16 RESEARCH ONLY\n'+s
anchor='const handler=createMcpHandler(()=>{'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'const researchCapture=createResearchCapture(); // V16 DEFAULT OFF: no sink/gate binding\n')
# The existing scope/read/bridge/EYE/save operations remain in exactly their order.
insert('const data=scopeVerifiedActiveField(raw);','initial_raw','raw')
insert('const data=scopeVerifiedActiveField(raw);','initial_scoped','data',False)
insert('   return buildEvalTransferForJraClaim({','eval_materials','{context:data,ownedTransferStats:cohorts,snapshot:PRIVATE_EVAL_PRIORITIES}')
insert(' return {content:[{type:"text",text:JSON.stringify(data)}],structuredContent:{context:data}}','initial_response','{text:JSON.stringify(data)}')
insert('     const context=scopeVerifiedActiveField(raw);assertScopedActivePayload(context,payload);','preview_raw','raw')
insert('     const context=scopeVerifiedActiveField(raw);assertScopedActivePayload(context,payload);','preview_scoped','context',False)
insert('     const result=buildJraVerifiedEvidenceRankBridge({','bridge_before','{context,evalInput,payload}')
insert('     // BEGIN EYE FILL PREVIEW','bridge_after','result')
insert('     const fill=result.status===','eye_before','result')
insert('     // END EYE FILL PREVIEW','eye_after','previewResult')
insert('     let eyeFillContext:any=null;','submitted_payload','payload')
insert('         const context=scopeVerifiedActiveField(raw);assertScopedActivePayload(context,payload);','save_raw','raw')
insert('         const context=scopeVerifiedActiveField(raw);assertScopedActivePayload(context,payload);','save_scoped','context',False)
insert("         if(evalStatus==='READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW'){",'bridge_before','{context,evalInput,payload}')
insert('     // BEGIN EYE FILL SAVE','bridge_after','{payload:savedPayload,status:rankBridgeStatus}')
insert('     if(eyeFillContext){','eye_before','{context:eyeFillContext,payload:savedPayload}')
insert('     // END EYE FILL SAVE','eye_after','savedPayload')
insert('         if(!ce&&context)shadow=buildOptionalSaveJraShadow({','shadow_raw','{context,error_present:!!ce}')
insert('     const {data,error}=await c.rpc("jra_save_claimed_prediction_with_shadow_v1",{','final_payload','savedPayload')
insert('     if(error||!uuid(data?.prediction_id)||data?.ok!==true)throw Error("SAVE_REJECTED");','receipt','data',False)
(root/'candidate-index.ts.txt').write_text(s)
(root/'candidate.patch').write_text(''.join(difflib.unified_diff(base.splitlines(True),s.splitlines(True),fromfile='v33/index.ts',tofile='v16-research/candidate-index.ts')))
(root/'hook-map.json').write_text(json.dumps(anchors,indent=2))
print('candidate hooks',len(anchors))
