import {ContextError,NAR_TRACK_CODES} from './local-worker-data.mjs';
import {historyBeforeRace} from './history-boundary.mjs';
const clean=v=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const header=['年月日','競馬場','R','競走名','格組','距離','天候・馬場','頭数','枠','馬番','人気','着順','タイム','差','上3F','体重','騎手(所属)','重量','調教師','収得賞金','1着馬または(2着馬)'];
const central=new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
export function narHorseUrl(href, debaUrl) {
  let u;try{u=new URL(href,debaUrl);}catch{throw new ContextError('HORSE_LINK_INVALID');}
  if(u.origin!=='https://www.keiba.go.jp' || u.pathname!=='/KeibaWeb/DataRoom/HorseMarkInfo' ||
    u.hash || u.username || u.password || [...u.searchParams.keys()].some(k=>!['k_lineageLoginCode','k_activeCode'].includes(k)) ||
    u.searchParams.getAll('k_lineageLoginCode').length!==1 ||
    !/^[0-9]{1,30}$/.test(u.searchParams.get('k_lineageLoginCode')??'') ||
    (u.searchParams.has('k_activeCode') && (u.searchParams.getAll('k_activeCode').length!==1 ||
      !/^[0-9]{1,3}$/.test(u.searchParams.get('k_activeCode')))))
    throw new ContextError('HORSE_LINK_INVALID');
  return u.href;
}
export function attachDomHorseLinks(snapshot, diagnostic) {
  if(!diagnostic?.ok || diagnostic.diagnostic_only!==true || diagnostic.truncated ||
    ['race_date','track','race_no'].some(k=>diagnostic[k]!==snapshot[k]) ||
    diagnostic.url!==snapshot.source_ref || !Array.isArray(diagnostic.runners) ||
    diagnostic.runners.length!==snapshot.runners.length)throw new ContextError('DOM_LINKS_UNVERIFIED');
  const seen=new Set();
  return {...snapshot,runners:snapshot.runners.map(r=>{
    const d=diagnostic.runners.find(x=>x.horse_no===r.horse_no);
    if(!d || seen.has(d.horse_no) || clean(d.horse_name)!==clean(r.horse_name) ||
      !Number.isInteger(d.row_index) || d.row_index<0 || !Number.isInteger(d.horse_cell_index) ||
      d.horse_cell_index<0 || !Array.isArray(d.horse_cell_links))throw new ContextError('DOM_LINKS_UNVERIFIED');
    seen.add(d.horse_no);
    // The link array is owned by the horse cell. Text never selects a link.
    const refs=[];
    for(const link of d.horse_cell_links) {
      if(link.href==null)continue;
      try{refs.push(narHorseUrl(link.href,snapshot.source_ref));}catch{/* unrecognized link remains unusable */}
    }
    const unique=[...new Set(refs)];
    const identity_refs=unique.length===1?unique:[];
    return {...r,identity_refs,horse_link_evidence:identity_refs.length?{
      horse_no:d.horse_no,row_index:d.row_index,horse_cell_index:d.horse_cell_index,
      deba_source_ref:snapshot.source_ref,horse_ref:identity_refs[0]}:null};
  })};
}
export function parseNarHorseHistory(profile,current,race) {
  if(race.circuit!=='LOCAL' || !Object.hasOwn(NAR_TRACK_CODES,race.track))throw new ContextError('RACE_MISMATCH');
  const ref=current.horse_link_evidence?.horse_ref;
  if(!ref || current.horse_link_evidence.horse_no!==current.horse_no ||
    !current.identity_refs?.includes(ref) || !profile?.ok || profile.diagnostic_only!==true ||
    profile.url!==ref || profile.truncated || !Array.isArray(profile.rows) || profile.rows.length>500 ||
    !Number.isFinite(Date.parse(profile.fetched_at)))throw new ContextError('HORSE_HISTORY_UNVERIFIED');
  // Header sanity is an additional mismatch check; identity comes from DOM URL.
  const lead=clean(profile.body).split('年月日')[0];
  if(!lead.includes(clean(current.horse_name)+' ') || !/(?:牡|牝|セ|セン|騸)\d+\s+(?:現役|抹消)/.test(lead))
    throw new ContextError('HORSE_HISTORY_UNVERIFIED');
  const index=profile.rows.findIndex(r=>Array.isArray(r.cells) && r.cells.map(clean).join('|')===header.join('|'));
  if(index<0)throw new ContextError('HORSE_HISTORY_SCHEMA_UNKNOWN');
  const runs=[];
  for(const row of profile.rows.slice(index+1)) {
    if(!Array.isArray(row.cells))throw new ContextError('HORSE_HISTORY_SCHEMA_UNKNOWN');
    const c=row.cells.map(clean);
    if(!/^\d{4}\/\d{2}\/\d{2}$/.test(c[0]??''))continue;
    // Verified common layout: weather/going plus an extra cell expands header.
    // Its observed values include empty and "ナ"; it is never an evaluation input.
    // A changed column layout is never guessed.
    if(c.length!==23 || !/^\d+$/.test(c[2]) || !/^\d+$/.test(c[11]))
      throw new ContextError('HORSE_HISTORY_SCHEMA_UNKNOWN');
    const track=c[1].startsWith('J')?c[1].slice(1):c[1];
    if(!(c[1].startsWith('J')?central.has(track):Object.hasOwn(NAR_TRACK_CODES,track)))continue;
    const h={race_date:c[0].replaceAll('/','-'),track,race_no:Number(c[2]),
      horse_no:Number(c[11]),horse_name:current.horse_name,horse_ref:ref,
      source:'NAR_OFFICIAL_RESCUE',data_origin:'NAR_OFFICIAL_RESCUE',source_ref:ref,race_name:c[3]};
    if(!historyBeforeRace(h,race))continue; // Never copy banned columns before this gate.
    if(h.race_no<1 || h.race_no>12 || h.horse_no<1 || h.horse_no>20)continue;
    if(/^\d+$/.test(c[5]))h.distance=Number(c[5]);
    else if(/^芝\d+$/.test(c[5])){h.surface='芝';h.distance=Number(c[5].slice(1));}
    // Unlabelled surface is missing, not assumed from distance.
    h.going=c[7]||null;
    h.finish=/^\d+$/.test(c[13])?Number(c[13]):null;
    h.time_raw=c[14]||null;h.margin=c[15]||null;h.final3f=c[16]||null;
    h.body_weight=/^\d+$/.test(c[17])?Number(c[17]):null;
    h.jockey=c[18]||null;
    h.weight_carried=/^\d+(?:\.\d+)?$/.test(c[19])?Number(c[19]):null;
    h.trainer=c[20]||null;
    runs.push(h);
  }
  const unique=new Map();
  for(const h of runs){const key=JSON.stringify([h.race_date,h.track,h.race_no]);if(unique.has(key))throw new ContextError('DUPLICATE_HORSE_HISTORY');unique.set(key,h);}
  return [...unique.values()].sort((a,b)=>b.race_date.localeCompare(a.race_date)||b.race_no-a.race_no).slice(0,5);
}
