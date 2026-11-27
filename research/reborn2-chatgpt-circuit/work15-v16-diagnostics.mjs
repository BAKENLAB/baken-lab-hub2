import {readFileSync} from 'node:fs';
const load=n=>JSON.parse(readFileSync(new URL(n,import.meta.url)));
const pinned=load('./work15-v12-derived-pinned.json'),receipt=load('./work15-time-receipt-derived-pinned.json');
const key=(...a)=>JSON.stringify(a);
const tuple=p=>key(p.original_file,p.original_sha256,p.corrected_file,p.corrected_sha256,p.pointer,p.expected_old,p.replacement);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const date=id=>{const d=typeof id==='string'&&id.split(':')[1];if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))throw Error('RACE_DATE');const v=new Date(d+'T00:00:00Z');if(!Number.isFinite(+v)||v.toISOString().slice(0,10)!==d)throw Error('RACE_DATE');return d;};
export const workInput=()=>structuredClone(pinned);
export function candidateChronology(r){
 const a=date(r.later_race),b=date(r.reference_race);
 return r.later_race===r.reference_race?'SAME_EVENT':a>b?'AFTER_DATE_ONLY':a<b?'BEFORE_REFERENCE':'SAME_DATE_UNRESOLVED';
}
export function workDiagnostics(c){
 if(c.source_blob!=='486b516a653660df2632da17cb0c76e88a05bd44'||c.version!=='1.2'||c.permission!=='NOT_CLEARED'||c.formal_admissions!==0||c.publication_at!==null)throw Error('WORK_SCOPE');
 const expected=new Set(receipt.patches.map(tuple)), seen=new Set(),files=new Map();
 for(const p of c.patches){
 const k=key(p.original_file,p.pointer);
 if(seen.has(k)||!expected.has(tuple(p))||p.replacement!==null||!hash(p.original_sha256)||!hash(p.corrected_sha256)||p.original_sha256===p.corrected_sha256)throw Error('PATCH_TUPLE');
 seen.add(k);const a=files.get(p.original_file)??[];a.push(p.pointer);files.set(p.original_file,a);
 }
 if(seen.size!==expected.size||files.size!==12)throw Error('PATCH_COVERAGE');
 const edges=new Set(),roots=new Map(),counts={AFTER_DATE_ONLY:0,BEFORE_REFERENCE:0,SAME_EVENT:0,SAME_DATE_UNRESOLVED:0};
 for(const r of c.relations){
 const k=key(r.peer_id,r.later_race,r.reference_race,r.reference_subject_id),root=key(r.peer_id,r.later_race),order=candidateChronology(r);
 if(edges.has(k)||r.date_order!==order||r.verified_publication_at!==null||r.formal_usable!==false)throw Error('RELATION_SCOPE');
 edges.add(k);counts[order]++;
 const a=roots.get(root)??{root,peer_id:r.peer_id,candidate_event:r.later_race,relations:[],formal:false};a.relations.push({reference_race:r.reference_race,reference_subject_id:r.reference_subject_id,order,eligible_for_date_only_review:order==='AFTER_DATE_ONLY',publication_verified:false,usable_for_current_win_place:false});roots.set(root,a);
 }
 if(edges.size!==137||roots.size!==65)throw Error('RELATION_COVERAGE');
 return {patches:seen.size,originals:files.size,relations:edges.size,roots:roots.size,counts,root_rows:[...roots.values()],mixed_roots:[...roots.values()].filter(r=>r.relations.some(x=>x.order==='AFTER_DATE_ONLY')&&r.relations.some(x=>x.order==='BEFORE_REFERENCE')).length,formal_admissions:0,official_replay_eligible:0,source_bytes_verified:false};
}
// Candidate-only bridge for existing 37/EYE05; date-only is not prestart eligibility.
// Scope dedup by peer/event AND preserve reference-specific edge rather than promoting all links.
export function candidate37Eye05(report,subject,reference){
 return report.root_rows.flatMap(root=>{
 const rows=root.relations.filter(r=>r.reference_subject_id===subject&&r.reference_race===reference&&r.eligible_for_date_only_review);
 return rows.length?[{root:root.root,candidate_event:root.candidate_event,peer_id:root.peer_id,rank_item:'37',eye_item:'EYE-05',time_scope:'AFTER_DATE_ONLY',current_effect:null,formal:false}]:[];
 });
}
