from pathlib import Path
import json,hashlib,difflib
root=Path(__file__).parent
source=(root/'baseline-index.ts.txt').read_text()
s=source
changes=[
 ('import {reconcileG1ScoringTrace}', 'import {readOfficialQueueCname} from "./jra-official-queue-read.mjs";\nimport {captureCardObservation} from "./jra-card-observation.mjs";\nimport {reconcileG1ScoringTrace}'),
 ('dry_run:z.boolean().default(true)\n   }).strict()', 'dry_run:z.boolean().default(true),\n     include_evidence:z.boolean().default(false)\n   }).strict()'),
 ('},async({race_date,track,race_no,dry_run})=>{\n   try {\n     await auth();', '},async({race_date,track,race_no,dry_run,include_evidence})=>{\n   try {\n     await auth();\n     if(include_evidence&&!dry_run)throw Error("JRA_RESEARCH_EXPORT_REQUIRES_DRY_RUN");\n     const researchExportEnabled=include_evidence&&Deno.env.get("JRA_RESEARCH_CARD_EXPORT_ENABLED")==="1";'),
 ('.select("cname,status").eq("race_date",race_date)', '.select("race_date,track,race_no,cname,status").eq("race_date",race_date)'),
 ('if(qerr||!queue?.cname) throw Error("JRA_OFFICIAL_QUEUE_MISSING");\n     const cname=String(queue.cname);', 'const cname=readOfficialQueueCname({queue,error:qerr,target:{race_date,track,race_no}});'),
 ('const bytes=new Uint8Array(await response.arrayBuffer());\n     const html=', 'const bytes=new Uint8Array(await response.arrayBuffer());\n     const researchFetchedAt=researchExportEnabled?new Date().toISOString():null;\n     const html='),
 ('const runners: Array<Record<string,unknown>>=[];\n     let waiting=0;', 'const runners: Array<Record<string,unknown>>=[];\n     const researchIdentities: Array<Record<string,unknown>>=[];\n     let waiting=0;'),
 ('runners.push({horse_no:horseNo,horse_name:horseName,draw,', 'if(researchExportEnabled){\n         const href=rowObj.find("td.horse .name_line .name a[href*=\'accessU\']").first().attr("href")??null;\n         let horseId=null;\n       try {horseId=new URL(href??"","https://www.jra.go.jp").searchParams.get("CNAME")?.match(/^pw01dud\\d{2}(\\d{10})\\/[A-Fa-f0-9]+$/)?.[1]??null;}catch{}\n       researchIdentities.push({horse_no:horseNo,horse_name:horseName,horse_ref:href,horse_id:horseId});\n     }\n     runners.push({horse_no:horseNo,horse_name:horseName,draw,'),
 ('return {content:[{type:"text",text:JSON.stringify(preview)}],structuredContent:preview};', 'if(include_evidence){\n         const observation=await captureCardObservation({requested:true,enabled:researchExportEnabled,bytes,proof,source_url:"https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(cname),response_url:response.url,fetched_at:researchFetchedAt,identities:researchIdentities});\n         const researchPreview={...preview,research_card_export:observation};\n         return {content:[{type:"text",text:JSON.stringify(researchPreview)}],structuredContent:researchPreview};\n       }\n       return {content:[{type:"text",text:JSON.stringify(preview)}],structuredContent:preview};')
]
for old,new in changes:
 if s.count(old)!=1:raise SystemExit('CANDIDATE_ANCHOR_DRIFT: '+old[:60])
 s=s.replace(old,new)
(root/'candidate-index.ts.txt').write_text(s)
(root/'candidate.patch').write_text(''.join(difflib.unified_diff(source.splitlines(True),s.splitlines(True),fromfile='jra-claimed-mcp/index.ts',tofile='jra-claimed-mcp/index.ts')))
(root/'candidate-replacements.json').write_text(json.dumps(changes,indent=2)+'\n')
(root/'candidate-manifest.json').write_text(json.dumps({'source_version':39,'source_bundle_sha256':'2601ff8de87dd7a061716c7274546efc0d984ce93d2d37abf2d10768dca2e7ad','source_snapshot_sha256':hashlib.sha256(source.encode()).hexdigest(),'candidate_sha256':hashlib.sha256(s.encode()).hexdigest(),'source_text_normalization':'trimEnd + LF','default_export_enabled':False,'deploy_file_mapping':{'jra-official-queue-read.mjs':'automation/jra-score-ledger/official-queue-read.mjs','jra-card-observation.mjs':'automation/jra-score-ledger/card-observation.mjs'},'deployed':False,'official_scoring_provider_completed':False},indent=2)+'\n')
print('Candidate prepared; production unchanged')
