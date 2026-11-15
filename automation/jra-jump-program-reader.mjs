// Read-only JRA scheduled daily program cross-check. A planned card is not a
// final result certificate: caller must ALSO reconcile official result index.
const tracks=['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'];
const clean=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const need=(v,c)=>{if(!v)throw Error('JUMP_'+c)};
export function parseProgramDay(load,html,date){
 const $=load(html),root=clean($('body').text());
 const dateLabel=date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>y+'年'+Number(m)+'月'+Number(d)+'日');
 need(root.includes(dateLabel)&&root.includes('競馬番組'),'PROGRAM_DATE');
 const meetings=[];
 $('table').each((_,t)=>{
  const tbl=$(t),head=clean(tbl.find('th').text());
  if(!head.includes('レース番号')||!head.includes('発走時刻'))return;
  const caption=[tbl.find('caption').first().text(),tbl.prev().text(),tbl.parent().prev().text(),tbl.parent().find('h2,h3,h4,h5').first().text(),tbl.find('thead').text()].map(clean);
  const names=[...new Set(caption.flatMap(s=>[...s.matchAll(/\d+回(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)\d+日/g)].map(m=>m[1])))];
  need(names.length===1&&tracks.includes(names[0]),'PROGRAM_TRACK');
  const race_nos=[];
  tbl.find('tr').each((_,row)=>{
   const cell=clean($(row).children('td,th').first().text());
   const m=cell.match(/^(\d{1,2})\s*レース$/);
   if(m)race_nos.push(Number(m[1]));
  });
  need(race_nos.length>0&&race_nos.every((n,i)=>n===i+1&&n<=12),'PROGRAM_ROWS');
  meetings.push({date,track:names[0],race_nos});
 });
 need(meetings.length>0&&new Set(meetings.map(m=>m.track)).size===meetings.length,'PROGRAM_MEETINGS');
 return meetings;
}
export async function readProgramDay({load,date,asOf,fetcher=fetch}){
 need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<asOf,'PROGRAM_ASOF');
 const [y,m,d]=date.split('-');
 const url='https://www.jra.go.jp/keiba/calendar'+y+'/'+y+'/'+m+'/'+m+d+'.html';
 const res=await fetcher(url,{redirect:'error',headers:{'Accept-Language':'ja','Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
 need(res.ok,'PROGRAM_HTTP');
 const bytes=new Uint8Array(await res.arrayBuffer());need(bytes.length>500&&bytes.length<4000000,'PROGRAM_BYTES');
 const utf=new TextDecoder().decode(bytes),sjis=new TextDecoder('shift_jis').decode(bytes);
 const html=utf.includes('競馬番組')?utf:sjis;
 return {date,source_ref:url,meetings:parseProgramDay(load,html,date),planned_only:true};
}
