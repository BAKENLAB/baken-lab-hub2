// Research-only snapshot copied from deployed Supabase nar-schedule-probe / horse-cell-diagnostics.mjs.
// DO NOT MODIFY BY HAND; maintain byte-for-byte body with deployed diagnostic source.
// This is not a production integration and contains no runtime credentials.
// Diagnostic evidence only. Never resolves URLs or interprets identifier semantics.
const tracks = {門別:'36',帯広:'03',盛岡:'10',水沢:'11',浦和:'18',船橋:'19',大井:'20',川崎:'21',金沢:'22',笠松:'23',名古屋:'24',園田:'27',姫路:'28',高知:'31',佐賀:'32'};
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
export function diagnosticTarget(params) {
  const race_date=params.get('race_date'),track=params.get('track'),raw=params.get('race_no');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(race_date??'') || !Number.isFinite(Date.parse(race_date)) ||
     new Date(race_date).toISOString().slice(0,10)!==race_date || !tracks[track] ||
     !/^(?:[1-9]|1[0-2])$/.test(raw??'')) throw new Error('INVALID_RACE');
  const url=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
  url.searchParams.set('k_babaCode',tracks[track]);url.searchParams.set('k_raceDate',race_date.replaceAll('-','/'));
  url.searchParams.set('k_raceNo',raw);
  return {race_date,track,race_no:Number(raw),url:url.href};
}
export function diagnoseRows(rows) {
  if(rows.length>2000)throw new Error('DOM_TOO_LARGE');
  const runners=[],seen=new Set();
  for(const row of rows) {
    const cells=row.cells;
    const candidates=cells.map((c,i)=>/^.+[（(][^）)]+[）)]$/.test(clean(c.text)) &&
      !/^[\d(]/.test(clean(c.text)) && i>=1 ? i : -1).filter(i=>i>=0);
    const matches=candidates.map(i=>({i,numbers:cells.slice(0,i-1).map(c=>clean(c.text)).filter(s=>/^\d+$/.test(s))}))
      .filter(m=>m.numbers.length>=1 && m.numbers.length<=2 && Number(m.numbers.at(-1))>=1 && Number(m.numbers.at(-1))<=20);
    if(!matches.length)continue;
    if(matches.length!==1)throw new Error('AMBIGUOUS_RUNNER_ROW');
    const {i,numbers}=matches[0],horse_no=Number(numbers.at(-1)),cell=cells[i-1];
    if(seen.has(horse_no))throw new Error('DUPLICATE_HORSE_NO');
    seen.add(horse_no);
    const horse_name=clean(cell.text);
    if(!horse_name || horse_name.length>100 || cell.elements.length>100)throw new Error('INVALID_HORSE_CELL');
    const copyAttrs=attrs=>{
      if(Object.keys(attrs).length>100 || Object.entries(attrs).some(([k,v])=>k.length>200 || String(v).length>4096))
        throw new Error('ATTRIBUTES_TOO_LARGE');
      return Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k,String(v)]));
    };
    runners.push({horse_no,horse_name,row_index:row.row_index,horse_cell_index:i-1,
      horse_cell_attributes:copyAttrs(cell.attributes),
      horse_cell_links:cell.elements.filter(e=>e.tag==='a').map(e=>({
        text:clean(e.text),href:Object.hasOwn(e.attributes,'href')?String(e.attributes.href):null,
        attributes:copyAttrs(e.attributes)})),
      horse_cell_element_attributes:cell.elements.filter(e=>Object.keys(e.attributes).length)
        .map(e=>({tag:e.tag,attributes:copyAttrs(e.attributes)}))});
  }
  if(!runners.length || runners.length>20)throw new Error('NO_UNAMBIGUOUS_RUNNERS');
  return runners.sort((a,b)=>a.horse_no-b.horse_no);
}
