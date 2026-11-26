export const clean = value => String(value ?? '').normalize('NFKC').trim();
export const instant = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
  ? Date.parse(value) : NaN;

export function officialHorseId(ref, page) {
  try {
    const url=new URL(ref);
    const id=url.searchParams.get('k_lineageLoginCode');
    if (url.origin==='https://www.keiba.go.jp' && !url.username && !url.password &&
        url.pathname==='/KeibaWeb/DataRoom/'+page && /^\d{1,30}$/.test(id) &&
        url.searchParams.getAll('k_lineageLoginCode').length===1) return id;
  } catch { /* Invalid witness. */ }
  return null;
}

// Parenthesized groups have no unique internal order. Retain their rank interval only.
export function cornerPositions(orders, roster, horseNo) {
  const result=[];
  const known=new Set(roster);
  const labels=new Set();
  for (const {label,raw_order} of orders) {
    const text=clean(raw_order).replace(/\s/g,'');
    if (labels.has(label) || !/^(?:\*?\d{1,2}|\(\*?\d{1,2}(?:,\*?\d{1,2})*\))(?:[,\-=](?:\*?\d{1,2}|\(\*?\d{1,2}(?:,\*?\d{1,2})*\)))*$/.test(text))
      return null;
    labels.add(label);
    const groups=[...text.matchAll(/\([^()]+\)|\*?\d{1,2}/g)].map(m=>[...m[0].matchAll(/\d+/g)].map(n=>Number(n[0])));
    const all=groups.flat();
    if (new Set(all).size!==all.length || all.some(n=>!known.has(n))) return null;
    let start=1;
    for (const group of groups) {
      if (group.includes(horseNo)) result.push({label,from:start,to:start+group.length-1});
      start+=group.length;
    }
  }
  return result;
}

export function admitIncident(rows, witness, trackCode, asOf) {
  const matches=rows.filter(r=>r.date===witness.date && r.track===witness.track &&
    r.raceNo===witness.raceNo && r.priorNo===witness.priorNo);
  if (matches.length!==1) return null;
  const row=matches[0];
  const expected='https://ppr.keiba.go.jp/index.php/show/show/'+
    witness.date.replaceAll('-','')+'/'+trackCode+'/'+witness.raceNo+'/report.html';
  if (row.reportRef!==expected || row.horseId!==witness.horseId ||
      !(instant(row.publishedAt)<=instant(row.checkedAt) && instant(row.checkedAt)<=asOf) ||
      !clean(row.quote) || !['REPORTED_LATE_START','REPORTED_INTERFERENCE'].includes(row.kind)) return null;
  return {kind:row.kind,report_ref:row.reportRef,quote:row.quote,
    published_at:row.publishedAt,checked_at:row.checkedAt};
}
