// Private local Work11 runner. No network acquisition, no DB, no deployment.
// Usage: node run-approved-local.mjs PROSPECTIVE|RETROSPECTIVE manifest.json approval.json index.json
// The authority pins must have been installed independently by Main.
// Do not upload originals, projections, manifests, or output to GitHub/CI.
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {assertNativeAuthorityConfigured,inspectApprovedLocalHeader,issueNativeGraph,issueRetrospectiveGraph} from './native-graph-issuance.mjs';
import {startGraphPreview} from './graph-preview.mjs';
import {runWork13Diagnostic,renderDiagnosticHtml} from './work13-private-diagnostic.mjs';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
const formats=new Set(['NAR_DEBA_HTML_PROJECTION_1','NAR_HISTORY_HTML_PROJECTION_1','JRA_CORNER_HTML_PROJECTION_1','NAR_RESULT_HTML_PROJECTION_1']);
const read=p=>{const st=statSync(p);assert.ok(st.isFile()&&st.size>0&&st.size<=16*1024*1024,'LOCAL_FILE_LIMIT');const b=readFileSync(p);assert.ok(b.length>0&&b.length<=16*1024*1024,'LOCAL_FILE_LIMIT');return b;};
const json=p=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(read(p)));
async function main(){
 const [mode,manifestPath,approvalPath,indexPath,...extra]=process.argv.slice(2);
 if(mode==='FACT_DIAGNOSTIC'){
  assert.ok(manifestPath&&!approvalPath&&!indexPath&&!extra.length,'FACT_DIAGNOSTIC_ARGUMENTS');
  // No native authority, no native graph, no raw acquisition. Exact fixed
  // ordinary factual handoff only, private loopback, no persistence.
  const out=runWork13Diagnostic(json(manifestPath)),html=renderDiagnosticHtml(out),token='/'+randomBytes(24).toString('hex');
  const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");if(req.method!=='GET'||req.url!==token||req.headers.host!=='127.0.0.1:'+server.address().port){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  console.log(JSON.stringify({scope:out.scope,url:'http://127.0.0.1:'+server.address().port+token,analysisDigest:out.analysisDigest,timing:out.analysisTiming,coverage:out.coverage,publicationAllowed:false}));
  process.once('SIGINT',()=>server.close(()=>process.exit(0)));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));return;
 }
 assert.ok(['PROSPECTIVE','RETROSPECTIVE'].includes(mode)&&manifestPath&&approvalPath&&indexPath&&!extra.length,'LOCAL_RUNNER_ARGUMENTS');
 assertNativeAuthorityConfigured(); // before even reading manifest/index
 const signedManifest=json(manifestPath),approval=json(approvalPath);
 const header=inspectApprovedLocalHeader({version:'11',signedManifest,approval},mode);
 const index=json(indexPath),docs=header.documents;
 assert.deepEqual(Object.keys(index).sort(),docs.map(d=>d.id).sort(),'LOCAL_SOURCE_INVENTORY');
 const root=dirname(resolve(indexPath)),raws=new Map(),originals=new Map();
 for(const d of docs){
  const e=index[d.id],projected=formats.has(d.format);
  assert.ok(e&&typeof e==='object'&&!Array.isArray(e));
  assert.deepEqual(Object.keys(e).sort(),projected?['originalPath','projectionPath']:['projectionPath']);
  assert.equal(typeof e.projectionPath,'string');
  raws.set(d.id,read(resolve(root,e.projectionPath)));
  if(projected){assert.equal(typeof e.originalPath,'string');originals.set(d.id,read(resolve(root,e.originalPath)));}
 }
 const request={version:'11',signedManifest,approval,raws,originals};
 const cap=mode==='RETROSPECTIVE'?issueRetrospectiveGraph(request):issueNativeGraph(request);
 raws.clear();originals.clear();
 // The preview computes NORMAL from the exact issued capability. Do not
 // accept caller-supplied candidate JSON or reissue a fixture as native.
 const preview=await startGraphPreview(cap,{normal:true});
 console.log(JSON.stringify({mode,scope:'PRIVATE_LOCAL_CANDIDATE_PREVIEW',url:preview.url,analysis:preview.analysisReceipt,publicationAllowed:false}));
 process.once('SIGINT',()=>preview.server.close(()=>process.exit(0)));
 process.once('SIGTERM',()=>preview.server.close(()=>process.exit(0)));
}
main().catch(e=>{console.error('LOCAL_NORMAL_STOPPED: '+(e.code==='ERR_ASSERTION'?String(e.message).split('\n')[0]:'LOCAL_EXECUTION_FAILED'));process.exitCode=1;});
