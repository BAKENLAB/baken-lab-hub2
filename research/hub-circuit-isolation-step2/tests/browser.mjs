import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('../',import.meta.url);let count=0;
const base='http://shadow-test.invalid';
let browser;
function fixture(circuit,date){const horse={horse_no:1,horse_name:'SYNTHETIC '+circuit,rank:1,grade:'A',comment:'SYNTHETIC reason'},prediction={id:circuit,race_date:date,track:circuit==='JRA'?'東京':'高知',race_no:1,race_name:'SYNTHETIC race',circuit,frozen_at:date+'T00:00:00Z',payload:{runners:[horse],top5:[horse],eye:null,bets:[]}};return {prediction,race:{...prediction,key:date+'|'+prediction.track+'|1|'+circuit,prediction_status:'FROZEN',market_status:'PENDING',prediction},result:{...prediction,result:{finishers:[{horse_no:1,horse_name:horse.horse_name,finish:1}]},prediction}}}
async function open(folder,name,fail=[],empty=false){const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('http://shadow-test.invalid/**',route=>{try{const path=new URL(route.request().url()).pathname;return route.fulfill({body:readFileSync(new URL('.'+path,root)),contentType:path.endsWith('.mjs')?'text/javascript':'text/html'})}catch{return route.fulfill({status:404,body:''})}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',async route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action'),date=u.searchParams.get('date'),part=u.searchParams.get('circuit');if(action!=='list'&&action!=='results'){await route.fulfill({json:{ok:true,updates:[]}});return}const requested=part?[part]:['JRA','LOCAL'];if(requested.some(c=>fail.includes(c))){await route.fulfill({status:503,json:{ok:false,error:'SYNTHETIC_FAILURE'}});return}const rows=empty?[]:requested.map(c=>fixture(c,date));await route.fulfill({json:{ok:true,date,...(action==='list'?{races:rows.map(x=>x.race),predictions:rows.map(x=>x.prediction)}:{results:rows.map(x=>x.result)})}})});
 await page.goto(base+'/'+folder+'/'+name);await page.waitForTimeout(120);await page.locator('#dateInput').dispatchEvent('change');await page.waitForTimeout(120);return {page,errors};}
try{browser=await chromium.launch({headless:true,executablePath:process.env.SHADOW_CHROMIUM_PATH||'/usr/bin/chromium'});
 for(const name of ['today.html','result.html']){
  for(const fail of [[],['LOCAL'],['JRA'],['JRA','LOCAL']]){
   const {page,errors}=await open('candidate',name,fail);await page.locator('[data-main-tab="result"]').click();await page.waitForTimeout(100);
   for(const action of ['today','result']){const id=action==='today'?'todayCircuitErrors':'resultCircuitErrors';const errorText=await page.locator('#'+id).innerText();assert.equal(errorText.includes('地方：取得失敗'),fail.includes('LOCAL'));assert.equal(errorText.includes('中央：取得失敗'),fail.includes('JRA'));if(fail.length<2){const area=action==='today'?'#raceArea':'#resultArea';assert((await page.locator(area).innerText()).includes('SYNTHETIC race'))}count++}
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
  }
  const good=await open('candidate',name),original=await open('baseline',name);
  // Rendering functions/CSS unchanged: compare normal visible list and detail markup.
  for(const [selector,click]of [['#raceArea',null],['#resultArea','[data-main-tab="result"]']]){if(click){await good.page.locator(click).click();await original.page.locator(click).click();await good.page.waitForTimeout(100);await original.page.waitForTimeout(100)}assert.equal(await good.page.locator(selector).innerHTML(),await original.page.locator(selector).innerHTML());count++}
  await good.page.close();await original.page.close();
  const blank=await open('candidate',name,[],true);await blank.page.locator('[data-main-tab="result"]').click();await blank.page.waitForTimeout(100);assert.equal(await blank.page.locator('#todayCircuitErrors').innerText(),'');assert.equal(await blank.page.locator('#resultCircuitErrors').innerText(),'');assert((await blank.page.locator('#resultArea').innerText()).includes('まだ登録されていません'));count++;await blank.page.close();
 }
 console.log('Browser assertions PASS: '+count+'; viewport390x844; no page errors or horizontal overflow; requests intercepted, no production access');
}finally{await browser?.close()}
