// Local actual browser smoke, no external service. Chromium already
// available on GitHub hosted Ubuntu. Optional locally if absent.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exerciseExistingGraph} from './native-graph-issuance.mjs';
import {startGraphPreview} from './graph-preview.mjs';

const chrome=['google-chrome','chromium','chromium-browser'].find(x=>spawnSync('which',[x],{stdio:'ignore'}).status===0);
assert.ok(chrome,'CHROMIUM_REQUIRED_FOR_GRAPH_REVIEW');
const dir=await mkdtemp(join(tmpdir(),'reborn2-browser-'));
let child,preview,ws,stderr='';
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
try{
 preview=await startGraphPreview(exerciseExistingGraph('08'));
 child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+join(dir,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',d=>{stderr=(stderr+d).slice(-4000);});
 let port;
 for(let n=0;n<300&&!port;n++){if(child.exitCode!==null||child.signalCode!==null)break;try{port=(await readFile(join(dir,'profile','DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await delay(100);}}
 assert.ok(port,'CHROME_START '+stderr);
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json(),tab=tabs.find(t=>t.type==='page');
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {ok,fail,t}=pending.get(m.id);clearTimeout(t);pending.delete(m.id);m.error?fail(Error(JSON.stringify(m.error))):ok(m.result);}});
 function call(method,params={}){return new Promise((ok,fail)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);fail(Error('CDP_TIMEOUT '+method));},15000);pending.set(id,{ok,fail,t});ws.send(JSON.stringify({id,method,params}));});}
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 async function ready(expr){for(let n=0;n<100;n++){if(await evaluate(expr))return;await delay(100);}throw Error('PAGE_NOT_READY');}
 await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.navigate',{url:preview.url});await ready("document.readyState==='complete' && document.querySelectorAll('article').length===2");
 const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,count:document.querySelectorAll('article').length,pre:document.querySelectorAll('pre').length})");
 assert.equal(layout.width,390);assert.ok(layout.scroll<=390);assert.equal(layout.count,2);assert.equal(layout.pre,0);assert.equal(preview.detailReads(),0);
 if(process.env.PILOT_ARTIFACT_DIR){await mkdir(process.env.PILOT_ARTIFACT_DIR,{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.PILOT_ARTIFACT_DIR,'graph-mobile-390.png'),Buffer.from(shot.data,'base64'));}
 await evaluate("document.querySelector('article a').click(); true");await ready("location.pathname.endsWith('/horse') && document.querySelectorAll('li a').length===115");
 await evaluate("Array.from(document.querySelectorAll('li a')).find(a=>a.textContent.startsWith('RANK05 ')).click(); true");
 await ready("location.pathname.endsWith('/item') && document.body.textContent.includes('原本参照あり')");
 const detail=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,source:document.body.textContent.includes('原本の位置とハッシュ'),held:document.body.textContent.includes('保留')})");
 assert.equal(detail.width,390);assert.ok(detail.scroll<=390);assert.equal(detail.source,true);assert.equal(detail.held,true);assert.equal(preview.detailReads(),1);
 if(process.env.PILOT_ARTIFACT_DIR){const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.PILOT_ARTIFACT_DIR,'graph-held-390.png'),Buffer.from(shot.data,'base64'));}
 console.log('CODEX08_GRAPH_BROWSER PASS '+JSON.stringify({layout,detail,detailReads:preview.detailReads()}));
}finally{ws?.close();if(child&&child.exitCode===null&&child.signalCode===null){const exited=new Promise(ok=>child.once('exit',ok));child.kill('SIGTERM');await Promise.race([exited,delay(3000)]);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await Promise.race([exited,delay(3000)]);}}if(preview)await new Promise(ok=>preview.server.close(ok));await rm(dir,{recursive:true,force:true,maxRetries:12,retryDelay:250});}
