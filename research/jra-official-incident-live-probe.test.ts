/**
 * Research-only archive smoke. Target is a synthetic cutoff, not an actual
 * race and never used for FROZEN. Public official source, no DB or secrets.
 */
import {acquireJraIncidentPackets,extractJraResultIncidentHtml,extractJraReportIncidentHtml} from '../automation/jra-official-incident-acquisition.mjs';
import {attachJraPriorIncidentEvidence} from '../automation/jra-official-stewards-incident-link.mjs';
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
 check(!extractJraResultIncidentHtml(html.replace('2025年7月13日','2025年7月14日'),priorRace,expectedRoster).verified,'DATE_MISMATCH');
 check(!extractJraResultIncidentHtml(html,priorRace,expectedRoster.slice(0,8)).verified,'INCOMPLETE_ROSTER');
});
Deno.test('LIVE read-only: official JRA archived result and stewards report',async()=>{
 if(Deno.env.get('JRA_INCIDENT_LIVE_PROBE')!=='1'){console.log('LIVE_PROBE_NOT_REQUESTED');return;}
 const receipts:{url:string,status:number,type:string|null}[]=[];
 const acquisitionArgs={targetRace,priorRace,expectedRoster,reportRef,fetchImpl:async(input:RequestInfo|URL,opts?:RequestInit)=>{
  const r=await fetch(input,opts);receipts.push({url:String(input),status:r.status,type:r.headers.get('content-type')});return r;
 }};
 const result=await acquireJraIncidentPackets(acquisitionArgs);
 type Event={horse_no:number,horse_id:string|null,kind:string};
 type Packet={source_kind:string,status:string,roster_ids?:string[],events?:Event[],unresolved?:unknown[]};
 const packets:Packet[]='packets' in result&&Array.isArray(result.packets)?result.packets as Packet[]:[];
 console.log(JSON.stringify({mode:'ARCHIVE_RESEARCH_ONLY_SYNTHETIC_TARGET',receipts,status:'status' in result?result.status:null,failures:'failures' in result?result.failures:[],packets:packets.map(p=>({source_kind:p.source_kind,status:p.status,roster_ids:p.roster_ids?.length,events:p.events?.map(e=>({horse_no:e.horse_no,horse_id:e.horse_id,kind:e.kind})),unresolved_count:p.unresolved?.length})),rank_effect:'rank_effect' in result?result.rank_effect:null,prediction_saved:false}));
 const report=packets.find(p=>p.source_kind==='REPORT');
 check(result.verified&&!!report,'LIVE_REPORT_UNVERIFIED');
 check(!!report?.events?.some(e=>e.horse_id==='2023103702'&&e.kind==='RESTRICTED_PATH'),'LIVE_PRIMARY_VICTIM_MISSING');
 const officialRunners=expectedRoster.map(h=>({status:'ACTIVE',horse_no:h.horseNo,horse_name:h.horseName,horse_ref:h.horseRef}));
 const liveRunners=officialRunners.map(h=>({...h,past_runs:[{race_date:priorRace.raceDate,source_ref:priorRace.sourceRef}]}));
 const args={targetRace,officialRunners,liveRunners,packets,clock:()=>Date.now()};
 const joined=attachJraPriorIncidentEvidence(args);
 check(joined.runners.length===9&&!!joined.runners[0]?.history[0]?.events?.some((e:Event)=>e.horse_id==='2023103702'),'ARCHIVED_ID_LINK_UNVERIFIED');
 check(joined.rank_effect==='NONE','UNSAFE_RANK_EFFECT');
});
