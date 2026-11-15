/**
 * Research-only archive smoke. Target is a synthetic cutoff, not an actual
 * race and never used for FROZEN. Public official source, no DB or secrets.
 */
import {matchJraExactCourseFragments,acquireJraIncidentPackets,extractJraResultIncidentHtml,extractJraReportIncidentHtml} from '../automation/jra-official-incident-acquisition.mjs';
import {attachJraPriorIncidentEvidence} from '../automation/jra-official-stewards-incident-link.mjs';
import {runJraIncidentBatch,planJraIncidentBatch} from '../automation/jra-incident-batch-research.mjs';
import cohort from './jra-incident-kyoto3-20261115-research-fixture.json' with {type:'json'};
const priorRace={raceDate:'2025-07-13',track:'福島',raceNo:1,raceKey:'20250713_福島_1R',sourceRef:'/JRADB/accessS.html?CNAME=pw01sde1003202502060120250713/BF'};
const reportRef='https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw2fsrp1003202502060120250713%2F4A';
const names=['リアアーテシアン','エレクトロン','コパノセビリア','リュウノエッセンス','ナンヨーラーク','リオンアンサー','フォトンゲイザー','イイクニパッション','ビップレオン'];
const refs=['2023103702/53','2023106608/A1','2023101306/7D','2023102830/DF','2023102598/44','2023100328/94','2023106479/22','2023100102/60','2023105996/EF'];
const expectedRoster=names.map((horseName,i)=>({horseNo:i+1,horseName,horseRef:'/JRADB/accessU.html?CNAME=pw01dud10'+refs[i]}));
const targetRace={raceDate:'2030-01-01',postTime:'2030-01-01T09:30:00+09:00'};
const html='<html><body><h1>2025年7月13日 福島 1R</h1><table><thead><tr><th>着順</th><th>枠</th><th>馬番</th><th>馬名</th></tr></thead><tbody>'+expectedRoster.map(h=>'<tr><td>1</td><td>1</td><td>'+h.horseNo+'</td><td><a href="'+h.horseRef+'">'+h.horseName+'</a></td></tr>').join('')+'</tbody></table><h3>競走中の出来事等</h3><ul><li>リアアーテシアン号は、競走中止。</li></ul></body></html>';
const reportHtml='<html><head><title>裁決レポート</title></head><body><h1>福島 1R 裁決レポート</h1><p>3コーナーで、1番リアアーテシアンの進路が狭くなる事象がありました。</p><p>(その他5番および9番の進路に影響あり)</p><p>なお、この件についての制裁はありません。</p></body></html>';
const check=(yes:boolean,msg:string)=>{if(!yes)throw Error(msg);};
Deno.test('fixture only: exact roster and structured result/report sections',()=>{
 const a=extractJraResultIncidentHtml(html,priorRace,expectedRoster);
 check(a.verified&&'runners' in a&&a.runners.length===9&&a.sectionRows.length===1,'FIXTURE_RESULT');
 const b=extractJraReportIncidentHtml(reportHtml,priorRace);
 check(b.verified&&'paragraphs' in b&&b.paragraphs.length===2,'FIXTURE_REPORT');
 const popup=reportHtml.replace('<h1>福島 1R 裁決レポート</h1>','<div class="race-title"><span>福島 1Ｒ 裁決レポート</span></div>');
 check(extractJraReportIncidentHtml(popup,priorRace).verified,'FIXTURE_POPUP_HEADER');
 check(!extractJraReportIncidentHtml(popup.replace('福島 1Ｒ','福島 11Ｒ'),priorRace).verified,'POPUP_WRONG_RACE');
 const br=popup.replace(/<p>/g,'').replace(/<\/p>/g,'<br>').replace('</div>','</div><br>');
 const brResult=extractJraReportIncidentHtml(br,priorRace);
 check(brResult.verified&&'paragraphs' in brResult&&brResult.paragraphs.length===2,'FIXTURE_BR_DELIMITED_REPORT');
 check(!extractJraReportIncidentHtml(br.replace('福島 1Ｒ','福島 11Ｒ'),priorRace).verified,'BR_WRONG_RACE');

 check(!extractJraResultIncidentHtml(html.replace('2025年7月13日','2025年7月14日'),priorRace,expectedRoster).verified,'DATE_MISMATCH');
 check(!extractJraResultIncidentHtml(html,priorRace,expectedRoster.slice(0,8)).verified,'INCOMPLETE_ROSTER');
});
Deno.test('LIVE read-only: official JRA archived result and stewards report',async()=>{
 if(Deno.env.get('JRA_INCIDENT_LIVE_PROBE')!=='1'){console.log('LIVE_PROBE_NOT_REQUESTED');return;}
 const receipts:{url:string,status:number,type:string|null}[]=[];
 const acquisitionArgs={targetRace,priorRace:{...priorRace,distance:1200,surface:'芝'},expectedRoster,reportRef,fetchImpl:async(input:RequestInfo|URL,opts?:RequestInit)=>{
  const r=await fetch(input,opts);receipts.push({url:String(input),status:r.status,type:r.headers.get('content-type')});
  if(String(input).includes('pw2fsrp')&&r.ok){
   // Research diagnostic, bounded public report only. Never inspect odds or
   // dump the result page; log structural hints and charset, not HTML.
   const blob=await r.clone().arrayBuffer();
   if(blob.byteLength<=2000000){
    const bytes=new Uint8Array(blob),ascii=new TextDecoder('windows-1252').decode(bytes.slice(0,8192));
    const declared=ascii.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??null;
    const enc=/utf-8/i.test(declared??'')?'utf-8':/euc-jp/i.test(declared??'')?'euc-jp':'shift_jis';
    const decoded=new TextDecoder(enc).decode(bytes);
    console.log(JSON.stringify({report_structure:{bytes:bytes.length,declared,encoding:enc,has_report_title:decoded.includes('裁決レポート'),has_venue:decoded.includes('福島'),p_tags:(decoded.match(/<p(?:\s|>)/gi)??[]).length,br_tags:(decoded.match(/<br(?:\s|\/?\s*>)/gi)??[]).length,title:decoded.match(/<title[^>]*>([^<]{0,100})<\/title>/i)?.[1]??null}}));
   }
  }
  return r;
 }};
 const result=await acquireJraIncidentPackets(acquisitionArgs);
 type Event={horse_no:number,horse_id:string|null,kind:string};
 type Packet={source_kind:string,status:string,roster_ids?:string[],events?:Event[],unresolved?:unknown[]};
 const packets:Packet[]='packets' in result&&Array.isArray(result.packets)?result.packets as Packet[]:[];
 console.log(JSON.stringify({mode:'ARCHIVE_RESEARCH_ONLY_SYNTHETIC_TARGET',receipts,status:'status' in result?result.status:null,failures:'failures' in result?result.failures:[],packets:packets.map(p=>({source_kind:p.source_kind,status:p.status,roster_ids:p.roster_ids?.length,events:p.events?.map(e=>({horse_no:e.horse_no,horse_id:e.horse_id,kind:e.kind})),unresolved_count:p.unresolved?.length})),rank_effect:'rank_effect' in result?result.rank_effect:null,prediction_saved:false}));
 const report=packets.find(p=>p.source_kind==='REPORT');
 check(result.verified&&!!report,'LIVE_REPORT_UNVERIFIED');
 const timing='lap_observation' in result?result.lap_observation:null;
 console.log(JSON.stringify({archive_timing_structure:'source_structure' in result?result.source_structure:null,lap_status:timing?.status??null}));
 check(!!timing&&timing.status==='OFFICIAL_RACE_LAPS_VERIFIED','LIVE_SAME_RESPONSE_LAPS');
 check(JSON.stringify(timing?.lap_seconds)===JSON.stringify([12.4,10.9,11.4,12.1,11.8,13.1]),'LIVE_EXACT_OFFICIAL_LAPS');
 check(timing?.first_600m_seconds===34.7&&timing.last_600m_seconds===37,'LIVE_LAP_SUMS');
 console.log(JSON.stringify({same_response_laps:timing,report_verified:!!report}));
 check(!!report?.events?.some(e=>e.horse_id==='2023103702'&&e.kind==='RESTRICTED_PATH'),'LIVE_PRIMARY_VICTIM_MISSING');
 const officialRunners=expectedRoster.map(h=>({status:'ACTIVE',horse_no:h.horseNo,horse_name:h.horseName,horse_ref:h.horseRef}));
 const liveRunners=officialRunners.map(h=>({...h,past_runs:[{race_date:priorRace.raceDate,source_ref:priorRace.sourceRef}]}));
 const args={targetRace,officialRunners,liveRunners,packets,clock:()=>Date.now()};
 const joined=attachJraPriorIncidentEvidence(args);
 check(joined.runners.length===9&&!!joined.runners[0]?.history[0]?.events?.some((e:Event)=>e.horse_id==='2023103702'),'ARCHIVED_ID_LINK_UNVERIFIED');
 check(joined.rank_effect==='NONE','UNSAFE_RANK_EFFECT');
 check('coverage' in joined&&joined.coverage?.active_runners===9,'LIVE_COVERAGE_ROSTER');
 check('coverage' in joined&&joined.coverage?.verified_source_runs===9&&joined.coverage?.report_source_runs===9,'LIVE_COVERAGE_SOURCES');
 check('coverage' in joined&&joined.coverage?.not_supplied_slots===36,'LIVE_COVERAGE_MUST_NOT_CLAIM_FIVE_RUNS');
 if('coverage' in joined)console.log(JSON.stringify({archive_coverage:joined.coverage,scope:'NINE_HORSES_ONE_VERIFIED_ARCHIVE_RACE_EACH'}));
});


Deno.test('literal report link from same verified result; never invent checksum',()=>{
 const link='<a href="'+reportRef+'">裁決レポート</a>';
 const ok=extractJraResultIncidentHtml(html.replace('</body>',link+'</body>'),priorRace,expectedRoster);
 check(ok.verified&&'discoveredReport' in ok&&ok.discoveredReport===reportRef,'REPORT_LINK_DISCOVERY');
 const wrong=extractJraResultIncidentHtml(html.replace('</body>',link.replace('20250713','20250714')+'</body>'),priorRace,expectedRoster);
 check(wrong.verified&&'discoveredReport' in wrong&&wrong.discoveredReport===null,'WRONG_RACE_REPORT_LINK');
 const foreign=extractJraResultIncidentHtml(html.replace('</body>',link.replace('https://www.jra.go.jp','https://example.invalid')+'</body>'),priorRace,expectedRoster);
 check(foreign.verified&&'discoveredReport' in foreign&&foreign.discoveredReport===null,'FOREIGN_REPORT_HOST');
 const popupLink='<a href="#" onclick="window.open(\''+reportRef+'\')">裁決レポート</a>';
 const popup=extractJraResultIncidentHtml(html.replace('</body>',popupLink+'</body>'),priorRace,expectedRoster);
 check(popup.verified&&'discoveredReport' in popup&&popup.discoveredReport===reportRef,'QUOTED_POPUP_REFERENCE');
});
Deno.test('LIVE bounded whole-field coverage: Kyoto3 2026-11-15, six independently verified prior rosters',async()=>{
 if(Deno.env.get('JRA_INCIDENT_LIVE_PROBE')!=='1')return;
 const reserveMs=180000;
 if(Date.now()+reserveMs>=Date.parse(cohort.targetRace.postTime)){
  console.log(JSON.stringify({cohort_scope:'KYOTO3_20261115',status:'NOT_RUN_AFTER_OR_NEAR_POST'}));return;
 }
 const diagnostics:unknown[]=[];
 const args={...cohort,reserveMs,maxRaces:6,acquire:async(input:Parameters<typeof acquireJraIncidentPackets>[0])=>{
  const x=await acquireJraIncidentPackets(input);
  diagnostics.push({attempt:diagnostics.length+1,status:'status' in x?x.status:null,structure:'source_structure' in x?x.source_structure:null});
  return x;
 }};
 const plan=planJraIncidentBatch(args);
 check('expected_runs' in plan&&plan.expected_runs===17,'COHORT_EXPECTED_RUNS');
 check('ready_prior_races' in plan&&plan.ready_prior_races===6,'COHORT_PRIOR_ROSTERS');
 const x=await runJraIncidentBatch(args);
 if(!('incident_review' in x))throw Error('COHORT_BATCH_NOT_RUN');
 const review=x.incident_review;
 console.log(JSON.stringify({cohort_structure:diagnostics}));
 console.log(JSON.stringify({cohort_scope:'KYOTO3_20261115_PREPOST_RESEARCH_ONLY',attempted_prior_races:x.attempted_prior_races,receipts:x.receipts,coverage:'coverage' in review?review.coverage:null,rank_effect:x.rank_effect,prediction_saved:x.prediction_saved}));
 check('coverage' in review&&review.coverage.active_runners===10&&review.coverage.supplied_runs===17,'COHORT_DENOMINATOR');
 check('coverage' in review&&review.coverage.verified_source_runs>0,'COHORT_NO_VERIFIED_INCIDENT_SOURCE');
 check(x.attempted_prior_races===6&&x.rank_effect==='NONE'&&x.prediction_saved===false,'COHORT_SCOPE');
});


Deno.test('exact archived course label independently matches and fails closed on conflicts',()=>{
 const exact='コース:1,200メートル(芝・右)';
 check(matchJraExactCourseFragments([exact,exact],1200,'芝').verified,'EXACT_ARCHIVE_LABEL');
 check(!matchJraExactCourseFragments([exact],1400,'芝').verified,'WRONG_DISTANCE');
 check(!matchJraExactCourseFragments([exact],1200,'ダート').verified,'WRONG_SURFACE');
 check(!matchJraExactCourseFragments([exact,'コース:1,400メートル(芝・右)'],1200,'芝').verified,'CONFLICTING_COURSE');
 check(!matchJraExactCourseFragments(['別レース '+exact],1200,'芝').verified,'NO_EMBEDDED_LABEL');
 check(!matchJraExactCourseFragments([],1200,'芝').verified,'MISSING_COURSE');
});
