// BAKEN LAB | RESEARCH ONLY, standalone real HTML to isolated shadow context.
// Reuses exact deployed nar-schedule-probe/diagnoseRows horse identity parser.
// GETs ONLY the two preselected official NAR past-date racecards below; no
// Supabase access, mutation, credentials, paid APIs, or any model rating changes.
import {load} from 'cheerio';
import {diagnosticTarget,diagnoseRows} from './nar-prod-horse-cell-diagnostics-reference.mjs';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';
const tasks=[
 {race:{race_date:'2026-10-21',track:'浦和',race_no:1,circuit:'LOCAL'},
  expectedRunners:12,review:{horse_no:10,horse_name:'サッシーユー',frozen_rank:11,winner_top5:false}},
 {race:{race_date:'2026-10-21',track:'門別',race_no:10,circuit:'LOCAL'},
  expectedRunners:12,review:{horse_no:9,horse_name:'メローニ',frozen_rank:5,winner_top5:true}}
];
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
for(const task of tasks){
 const {race}=task;
 const {url}=diagnosticTarget(new URLSearchParams({race_date:race.race_date,track:race.track,race_no:String(race.race_no)}));
 const abort=new AbortController(),kill=setTimeout(()=>abort.abort(),10000);
 let resp;try{resp=await fetch(url,{signal:abort.signal,redirect:'error',headers:{'accept':'text/html','user-agent':'Mozilla/5.0 BAKEN-LAB-RESEARCH/1.0'}})}finally{clearTimeout(kill)}
 if(!resp.ok)throw Error('OFFICIAL_RACECARD_HTTP_'+resp.status+' '+race.track);
 const body=resp.body;if(!body)throw Error('OFFICIAL_RACECARD_EMPTY_BODY');
 let total=0;const bufs=[];
 for await(const b of body){total+=b.length;if(total>2097152)throw Error('NAR_CARD_TOO_LARGE');bufs.push(b)}
 const html=Buffer.concat(bufs).toString('utf8');
 const $=load(html),plain=clean($('body').text());
 const [year,month,day]=race.race_date.split('-').map(Number);
 const compressed=plain.replace(/\s/g,'');
 if(!compressed.includes(year+'年'+month+'月'+day+'日')||
    !compressed.includes(race.track+'第'+race.race_no+'競走'))
    throw Error('NAR_RACE_HEADING_NOT_VERIFIED '+race.track);
 const rows=[];let row_index=0;
 $('table tr').each((_i,row)=>{
  const cells=[];
  $(row).children('th,td').each((_i,cell)=>{
   const elements=[cell,...$(cell).find('*').toArray()]
    .filter(el=>$(el).closest('tr')[0]===row)
    .map(el=>({tag:el.tagName,attributes:el.attribs??{},text:el.tagName==='a'?$(el).text():null}));
   cells.push({text:$(cell).text(),attributes:cell.attribs??{},elements});
  });
  rows.push({row_index:row_index++,cells});
 });
 const diagnosed=diagnoseRows(rows);
 if(diagnosed.length!==task.expectedRunners)
    throw Error('NAR_EXPECTED_FIELD_COUNT_MISMATCH '+race.track+
      ' expected='+task.expectedRunners+' actual='+diagnosed.length);
 const blocks=diagnosed.map(x=>({row_index:x.row_index,horse_no:x.horse_no}));
 const field=[];
 for(const item of diagnosed){
  const refs=[...new Set((item.horse_cell_links||[]).map(link=>{
    if(typeof link.href!=='string')return null;
    try{const resolved=new URL(link.href,url);return resolved.href}
    catch{return null}
   }).filter(ref=>typeof ref==='string' &&
       /^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{5,30}$/.test(ref)))];
  const runner={status:'ACTIVE',row_index:item.row_index,horse_no:item.horse_no,
    horse_name:item.horse_name,identity_refs:refs,
    current_source_ref:url,running_style_reference:['?'],recent_runs:[]};
  const columns=captureOwnedDebaPriorColumns({rows,diagnosedRunners:blocks,
      horseNo:runner.horse_no,debaSourceRef:url});
  const past=extractOwnedDebaPastCorners({race,cardSourceRef:url,
    cardHeader:plain.slice(0,2000),runner,columns});
  const style=buildDebaRunningStyleShadow({context:{race,runners:[runner]},
    priorEvidence:past}).runners[0];
  field.push({no:item.horse_no,name:item.horse_name,official_identity_count:refs.length,
    valid_prior_runs:past.length,style:style.shadow_style,evidence_status:style.evidence_status,
    first_prior:past[0]?.race_date??null,
    first_passage:past[0]?.passing_order??null});
 }
 field.sort((a,b)=>a.no-b.no);
 const selected=field.find(x=>x.no===task.review.horse_no);
 if(!selected||selected.name!==task.review.horse_name)
    throw Error('SELECTED_HORSE_IDENTITY_MISMATCH '+race.track);
 const stats={track:race.track,race_no:race.race_no,race_date:race.race_date,
   html_http:resp.status,html_bytes:total,table_rows:rows.length,runners:field.length,
   valid_horse_id:field.filter(x=>x.official_identity_count===1).length,
   runners_with_style:field.filter(x=>!x.style.includes('?')).length,
   runners_2plus_prior:field.filter(x=>x.valid_prior_runs>=2).length,
   prior_run_count:field.reduce((a,x)=>a+x.valid_prior_runs,0)};
 // Diagnostic only: capture owner-bound source rows of unparsed Monbetsu starts
 // so fixtures can be repaired without name-only joining or unknown guesses.
 if(race.track==='門別'){
  for(const n of [3,9,12]){
    const current=diagnosed.find(x=>x.horse_no===n);
    const next=Math.min(...diagnosed.filter(x=>x.row_index>current.row_index)
      .map(x=>x.row_index),Infinity);
    const rowsOwned=rows.filter(x=>x.row_index>=current.row_index&&x.row_index<next)
      .map(x=>({idx:x.row_index,cell_count:x.cells.length,
        texts:x.cells.map(c=>clean(c.text).slice(0,190))}));
    console.log('RESEARCH_UNPARSED_MONBETSU_DOM',JSON.stringify({
      no:n,name:current.horse_name,rows:rowsOwned}));
  }
 }
 console.log('RESEARCH_OFFICIAL_FIELD',JSON.stringify(stats));
 console.log('RESEARCH_OFFICIAL_RUNNERS',JSON.stringify(field));
 console.log('RESEARCH_FROZEN_CROSSCHECK_LABEL',JSON.stringify({
   ...task.review,shadow: selected,
   verdict:'EVIDENCE_ONLY_NOT_MODEL_RERANK'}));
 if(stats.valid_horse_id!==stats.runners)
    throw Error('FIELD_IDENTITY_INCOMPLETE_'+race.track);
 if(stats.runners_2plus_prior<2)
    throw Error('FIELD_PASSAGE_RESEARCH_INCOMPLETE_'+race.track);
}
