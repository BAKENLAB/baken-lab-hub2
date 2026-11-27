// Local actual browser smoke, no external service. Chromium already
// available on GitHub hosted Ubuntu. Optional locally if absent.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeFixture} from './adapter.mjs';
import {saveCompact} from './compact-store.mjs';
import {startPreview} from './mobile-preview.mjs';
const chrome=['google-chrome','chromium','chromium-browser'].find(x=>spawnSync('which',[x],{stdio:'ignore'}).status===0);
if(!chrome){console.log('CODEX02_BROWSER_NOT_AVAILABLE');process.exit(0);}
const dir=await mkdtemp(join(tmpdir(),'reborn2-browser-'));
let child,preview,ws;
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
try{
 const archive=await saveCompact(join(dir,'archive'),await executeFixture('FK34_FULL'));
 preview=await startPreview(archive.root,archive.manifestDigest);
 child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+join(dir,'profile'),'about:blank'],{stdio:'ignore'});
 let port;
 for(let n=0;n<100&&!port;n++){try{port=(await readFile(join(dir,'profile','DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await delay(100);}}
 assert.ok(port,'CHROME_START');
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json(),tab=tabs.find(t=>t.type==='page');
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {ok,fail,t}=pending.get(m.id);clearTimeout(t);pending.delete(m.id);m.error?fail(Error(JSON.stringify(m.error))):ok(m.result);}});
 function call(method,params={}){return new Promise((ok,fail)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);fail(Error('CDP_TIMEOUT '+method));},15000);pending.set(id,{ok,fail,t});ws.send(JSON.stringify({id,method,params}));});}
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 async function ready(expr){for(let n=0;n<100;n++){if(await evaluate(expr))return;await delay(100);}throw Error('PAGE_NOT_READY');}
 await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.navigate',{url:preview.url});await ready("document.readyState==='complete' && document.querySelectorAll('article').length===5");
 const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,count:document.querySelectorAll('article').length,pre:document.querySelectorAll('pre').length})");
 assert.equal(layout.width,390);assert.ok(layout.scroll<=390);assert.equal(layout.count,5);assert.equal(layout.pre,0);assert.equal(preview.detailReads(),0);
 if(process.env.PILOT_ARTIFACT_DIR){await mkdir(process.env.PILOT_ARTIFACT_DIR,{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.PILOT_ARTIFACT_DIR,'mobile-390.png'),Buffer.from(shot.data,'base64'));}
 await evaluate("document.querySelector('article a').click(); true");await ready("location.pathname==='/detail' && document.querySelector('pre')!==null");
 const detail=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,chars:document.querySelector('pre').textContent.length})");
 assert.equal(detail.width,390);assert.ok(detail.scroll<=390);assert.ok(detail.chars<=12000);assert.equal(preview.detailReads(),1);
 await evaluate("document.querySelector('a[href=\"/\"]').click(); true");await ready("location.pathname==='/' && document.querySelectorAll('article').length===5");
 console.log('CODEX02_BROWSER_MOBILE PASS '+JSON.stringify({layout,detail,detailReads:preview.detailReads()}));
}finally{ws?.close();if(child){child.kill('SIGTERM');await Promise.race([new Promise(ok=>child.once('exit',ok)),delay(2000)]);}if(preview)await new Promise(ok=>preview.server.close(ok));await rm(dir,{recursive:true,force:true});}
