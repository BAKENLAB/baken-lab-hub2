// Research-only ONE-GET diagnostics against NAR DebaTable.
// No keys, cookies, database access, persistence, betting, or production calls.
import {load} from 'cheerio';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';
const url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F10%2F21&k_raceNo=11';
const race={circuit:'LOCAL',track:'笠松',race_date:'2026-10-21',race_no:11};
const expectedNames=['ジョリーメモリー','トーホウジェンマ','コスモフィネス','ツインレイ','コスモフィネス','マーゴットメネス','カジカライズ','リアルカイザー','カレンアイバーソン','アースリーブラ'];
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const ctrl=new AbortController();const kill=setTimeout(()=>ctrl.abort(),15000);
let response;
try{response=await fetch(url,{signal:ctrl.signal,redirect:'error',headers:{'accept':'text/html','user-agent':'Mozilla/5.0 BAKEN-LAB-RESEARCH/1.0'}})}finally{clearTimeout(kill)}
if(!response.ok)throw Error('LIVE_HTML_FETCH_HTTP_'+response.status);
const limit=2100000;
if(Number(response.headers.get('content-length'))>limit)throw Error('LIVE_HTML_TOO_LARGE');
let size=0;const chunks=[];
for await(const chunk of response.body){
 size+=chunk.length;
 if(size>limit)throw Error('LIVE_HTML_TOO_LARGE');
 chunks.push(chunk);
}
const html=Buffer.concat(chunks).toString('utf8');
const $=load(html);
const text=norm($('body').text());
if(!text.includes('2026年10月21日')||!text.includes('YJSトライアルラウンド笠松第2戦')||!text.includes('コスモフィネス'))throw Error('RACE_PAGE_CONTENT_UNVERIFIED');
const rows=[];let row_index=0;
$('table tr').each((_,el)=>{
 rows.push({row_index:row_index++,cells:$(el).children('th,td').toArray().map(c=>({text:$(c).text(),
   links:$(c).find('a[href]').map((_,a)=>({text:norm($(a).text()),href:$(a).attr('href')})).get()}))});
});
const matches=[];
for(const row of rows){
 const horseNames=expectedNames.filter(name=>row.cells.some(c=>norm(c.text)===name||
     c.links.some(a=>norm(a.text)===name)));
 if(horseNames.length)matches.push({row_index:row.row_index,names:horseNames,
   cell_count:row.cells.length,
   labels:row.cells.slice(0,6).map(c=>norm(c.text).slice(0,50)),
   links:row.cells.flatMap(c=>c.links).filter(l=>l.href?.includes('k_lineageLoginCode')).slice(0,3).map(l=>l.href?.slice(0,130))});
}
const wrows=matches.filter(x=>x.names.includes('コスモフィネス'));
const full=matches.filter(x=>x.names.length===1);
console.log('LIVE_GET_OK',JSON.stringify({status:response.status,bytes:size,table_rows:rows.length,
  matched_runner_rows:full.length,wisteria_matches:wrows.length,title:norm($('title').text()).slice(0,110)}));
console.log('RUNNER_ROW_DIAGNOSTIC',JSON.stringify(matches.slice(0,13)));
const sample=wrows[0];
if(!sample)throw Error('CURRENT_RUNNER_ROW_NOT_FOUND');
const ownerIndex=sample.row_index;
const next=full.filter(x=>x.row_index>ownerIndex).sort((a,b)=>a.row_index-b.row_index)[0]?.row_index??Infinity;
const cardRows=rows.filter(x=>x.row_index>=ownerIndex&&x.row_index<next);
const dateRx=/\d{2}\.\d{2}\.\d{2}.{0,15}\d{1,2}頭/;
const cornerRx=/\d{1,2}:\d{2}\.\d.{0,5}\d(?:-\d){2,4}.{0,5}\d{2}\.\d/;
const info=cardRows.map(r=>({index:r.row_index,columns:r.cells.length,
  short:r.cells.map(c=>norm(c.text).slice(0,110)),
  date_count:r.cells.filter(c=>dateRx.test(norm(c.text))).length,
  passage_count:r.cells.filter(c=>cornerRx.test(norm(c.text))).length}))
 .filter(r=>r.date_count||r.passage_count);
console.log('PREVIOUS_RACE_ROW_DIAGNOSTIC',JSON.stringify(info.slice(0,14)));
const detected=full.map(x=>({horse_no:expectedNames.indexOf(x.names[0])+1,row_index:x.row_index,horse_name:x.names[0]}));
// The name->number below is only for identifying unique DOM blocks, NOT real horse identity.
const discovered=rows.find(r=>r.row_index===ownerIndex);
const runnerLink=discovered?.cells.flatMap(c=>c.links).find(l=>l.href?.includes('k_lineageLoginCode'));
console.log('MATCHED_HORSE_LINK',String(runnerLink?.href??'none').slice(0,200));
const candidate={
 race,cardSourceRef:url,cardHeader:text.slice(0,1300),
 runner:{status:'ACTIVE',horse_no:5,horse_name:'コスモフィネス',row_index:ownerIndex,identity_refs:runnerLink?[new URL(runnerLink.href,url).href]:[]},
 columns:[]
};
const blocks=full.map(x=>({horse_no:expectedNames.indexOf(x.names[0])+1,row_index:x.row_index}));
candidate.columns=captureOwnedDebaPriorColumns({rows,diagnosedRunners:blocks,horseNo:5,debaSourceRef:url});
const passages=extractOwnedDebaPastCorners(candidate);
console.log('RESEARCH_PARSER_RESULT',JSON.stringify({columns:candidate.columns.length,
 passages:passages.map(p=>({date:p.race_date,corner:p.passing_order,source:p.source}))}));
if(passages.length){
 const out=buildDebaRunningStyleShadow({context:{race,runners:[{...candidate.runner,
   current_source_ref:url,recent_runs:[],running_style_reference:['?']}]},priorEvidence:passages});
 console.log('RESEARCH_SHADOW_RESULT',JSON.stringify(out.runners[0]));
}
if(!passages.length)throw Error('RESEARCH_PARSER_NOT_YET_MATCHING_REAL_DOM');
