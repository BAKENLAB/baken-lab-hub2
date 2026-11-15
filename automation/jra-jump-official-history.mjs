// Candidate read-only JRA calendar and official result collector. No target-day result reads.
// Existing jra-backfill v27 navigation convention; no odds requests, no database writes.
const BASE='https://www.jra.go.jp/JRADB/accessS.html';
const TRACKS={'01':'札幌','02':'函館','03':'福島','04':'新潟','05':'東京','06':'中山','07':'中京','08':'京都','09':'阪神','10':'小倉'};
const need=(b,c)=>{if(!b)throw Error('JUMP_'+c)};
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const horseId=x=>String(x??'').match(/pw01dud\d{2}(\d{10})/)?.[1]??null;
export function resultIdentity(cname){
 const m=String(cname).match(/^pw01sde(?:01|10)(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})\/[0-9A-F]{2}$/i);
 if(!m||!TRACKS[m[1]]||Number(m[5])<1||Number(m[5])>12)return null;
 return {cname,track:TRACKS[m[1]],race_no:Number(m[5]),race_date:m[6].slice(0,4)+'-'+m[6].slice(4,6)+'-'+m[6].slice(6,8)};
}
const identity=r=>[r.race_date,r.track,r.race_no].join('|');
export function verifyCalendar(rows,expectedMeetings,from,to){
 need(Array.isArray(rows)&&Array.isArray(expectedMeetings)&&from<to,'CALENDAR_SCOPE');
 const meetings=new Map(expectedMeetings.filter(x=>x.date>=from&&x.date<to).map(x=>[x.date+'|'+x.track,x]));
 need(meetings.size===expectedMeetings.filter(x=>x.date>=from&&x.date<to).length,'CALENDAR_DUP_MEETING');
 const unique=new Map();
 for(const r of rows){if(r.race_date<from||r.race_date>=to)continue;const m=meetings.get(r.race_date+'|'+r.track);need(m,'UNEXPECTED_MEETING');const k=identity(r);const old=unique.get(k);need(!old||old.cname===r.cname,'RESULT_ID_CONFLICT');unique.set(k,r)}
 for(const [k,m] of meetings){
  need(Array.isArray(m.race_nos)&&m.race_nos.length>0&&new Set(m.race_nos).size===m.race_nos.length,'MEETING_EXPECTED_RACES');
  const observed=[...unique.values()].filter(r=>r.race_date+'|'+r.track===k).map(r=>r.race_no).sort((a,b)=>a-b);
  need(JSON.stringify(observed)===JSON.stringify([...m.race_nos].sort((a,b)=>a-b)),'CALENDAR_INCOMPLETE');
 }
 return [...unique.values()].sort((a,b)=>identity(a).localeCompare(identity(b)));
}
export function parseResultPage(load,html,ref){
 const expected=resultIdentity(ref);need(expected,'RESULT_REF');
 const $=load(html),head=clean($('.race_header .date').first().text()),dm=head.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
 const observed=dm?dm[1]+'-'+dm[2].padStart(2,'0')+'-'+dm[3].padStart(2,'0'):'';
 const raceNumber=$('.race_title .race_number img').first().attr('src')??'';
 need(observed===expected.race_date&&head.includes(expected.track)&&raceNumber.endsWith('/race_num_'+expected.race_no+'.png'),'RESULT_HEADER');
 const title=clean($('.race_name').first().text()),course=clean($('.race_title .cell.course').first().text()),cls=clean($('.race_title .cell.class').first().text());
 const distance=Number(course.replaceAll(',','').match(/(\d+)\s*メートル/)?.[1]);
 need(title&&course&&Number.isInteger(distance)&&distance>0,'RESULT_CONDITIONS');
 const jump=/障害|ジャンプ|J[・.･]?G[ⅠⅡⅢI123]/i.test(title+' '+cls+' '+course);
 if(!jump){need(/芝|ダート/.test(course),'RESULT_SURFACE');return {...expected,jump:false,source_ref:ref}}
 const class_name=/未勝利/.test(title+' '+cls)?'未勝利':/オープン|ジャンプ|大障害|J[・.･]?G/i.test(title+' '+cls)?'オープン':null;
 need(class_name,'RESULT_CLASS');
 const table=$('table.basic.narrow-xy.striped').first(),rows=table.find('tbody tr').toArray();
 need(table.length&&rows.length>=2,'RESULT_TABLE');
 const cell=(r,s)=>clean($(r).find(s).first().text()),parseTime=s=>{const m=s.match(/^(\d+)[:.](\d{2}\.\d)$/);return m?Number(m[1])*60+Number(m[2]):null};
 const all=rows.map(r=>{
  const horse_id=horseId($(r).find('.horse a[href*="accessU"]').first().attr('href')),horse_no=Number(cell(r,'.num')),jockey=cell(r,'.jockey').replace(/^[△▲☆★◇]/,'').trim();
  const place=cell(r,'.place'),finish=/^\d+$/.test(place)?Number(place):null;
  const result_status=finish!==null?'FINISHED':/中止/.test(place)?'DNF':/失格/.test(place)?'DISQUALIFIED':/取消|除外/.test(place)?'NOT_STARTED':null;
  need(horse_id&&Number.isInteger(horse_no)&&horse_no>0&&result_status&&(result_status==='NOT_STARTED'||jockey),'RESULT_ROW');
  const corners=cell(r,'.corner').match(/\d+/g)?.map(Number)??[],final_turn_pos=corners.length?corners.at(-1):null;
  const secs=parseTime(cell(r,'.time'));
  need(finish===null||secs!==null,'RESULT_TIME');
  return {horse_id,horse_no,jockey,finish,result_status,final_turn_pos,secs};
 });
 need(new Set(all.map(r=>r.horse_no)).size===all.length&&new Set(all.map(r=>r.horse_id)).size===all.length,'RESULT_DUPLICATE');
 const winners=all.filter(r=>r.finish===1);need(winners.length>=1,'RESULT_WINNER');
 const win=Math.min(...winners.map(r=>r.secs));
 const field_size=all.length;
 return {...expected,jump:true,class_name,distance,source_ref:ref,rows:all.filter(r=>r.result_status!=='NOT_STARTED').map(r=>{need(r.finish===null||r.secs>=win,'RESULT_NEGATIVE_GAP');return {...r,field_size,verified:true,race_type:'障害',race_date:expected.race_date,track:expected.track,class_name,distance,source_ref:ref,gap_seconds:r.secs===null?null:Math.round((r.secs-win)*10)/10}})};
}
export function makeJraResultCollector({load,fetcher=fetch,maxRequests=240,expectedMeetingsReader}){
 need(typeof load==='function'&&typeof expectedMeetingsReader==='function','CALENDAR_DEPENDENCIES');
 let requests=0;
 async function read(cname,post=true){
  need(++requests<=maxRequests,'REQUEST_BUDGET');
  need(/^pw01(?:skl|srl|sde)[0-9A-Za-z]+\/[0-9A-F]{2}$/i.test(cname),'SOURCE_REF');
  const res=await fetcher(post?BASE:BASE+'?CNAME='+encodeURIComponent(cname),{method:post?'POST':'GET',...(post?{body:'cname='+encodeURIComponent(cname)}:{}),headers:{'Content-Type':'application/x-www-form-urlencoded','Accept-Language':'ja','Cache-Control':'no-cache'},redirect:'error'});
  need(res.ok,'OFFICIAL_HTTP');const bytes=new Uint8Array(await res.arrayBuffer());need(bytes.length>400&&bytes.length<4000000,'OFFICIAL_PAGE_SIZE');
  return new TextDecoder('shift_jis').decode(bytes);
 }
 const unique=x=>[...new Set(x)];
 async function calendar(from,to){
  need(/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to)&&from<to,'CALENDAR_DATES');
  const expected=await expectedMeetingsReader(from,to);
  need(expected?.verified===true&&expected.from===from&&expected.to===to&&Array.isArray(expected.meetings)&&expected.source_ref,'CALENDAR_WITNESS');
  const root=await read('pw01skl00999999/B3'),months=[];
  const t=new Date(from.slice(0,7)+'-01T00:00:00Z');while(t.toISOString().slice(0,10)<to){months.push(t.toISOString().slice(0,7).replace('-',''));t.setUTCMonth(t.getUTCMonth()+1)}
  const refs=[];
  for(const ym of months){
   const m=new RegExp('objParam\\["'+ym.slice(2)+'"\\]\\s*=\\s*"([0-9A-Fa-f]{2})"').exec(root);need(m,'MONTH_CODE');
   const page=await read('pw01skl10'+ym+'/'+m[1].toUpperCase());
   const meetings=unique([...page.matchAll(/pw01srl[^"'<>\s]+\/[0-9A-Fa-f]{2}/g)].map(x=>x[0]));need(meetings.length>0,'MONTH_MEETINGS');
   for(const id of meetings){
    const h=await read(id);const links=unique([...h.matchAll(/pw01sde[^"'<>\s]+\/[0-9A-Fa-f]{2}/g)].map(x=>x[0]));
    need(links.length>0,'MEETING_LINKS');
    for(const link of links){const r=resultIdentity(link);need(r,'RESULT_LINK_PARSE');if(r.race_date>=from&&r.race_date<to)refs.push(r)}
   }
  }
  return {rows:verifyCalendar(refs,expected.meetings,from,to),source_ref:expected.source_ref,from,to};
 }
 return {calendar,async result(cname,asOf){const r=resultIdentity(cname);need(r&&r.race_date<asOf,'ASOF_RESULT');return parseResultPage(load,await read(cname,false),cname)},requests:()=>requests};
}
