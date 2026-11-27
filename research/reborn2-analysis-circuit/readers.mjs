import {readFileSync} from 'node:fs';

export function historyQuery({circuit,date,track,raceNo}) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0,10)!==date || !/^[\p{Script=Han}]{2,4}$/u.test(track) ||
      !Number.isInteger(raceNo) || raceNo<1 || raceNo>12) throw Error('INVALID_TARGET');
  const sources={
    JRA:['jra-extended-materials.sql',"DATE '2026-11-23' AND r.track='東京' AND r.race_no=12",'r.'],
    LOCAL:['local-detailed-packet-candidates.sql',"DATE '2026-11-22' AND track='佐賀' AND race_no=8",'']
  };
  const spec=Object.hasOwn(sources,circuit) ? sources[circuit] : null;
  if (!spec) throw Error('INVALID_CIRCUIT');
  const [file,original,alias]=spec;
  const sql=readFileSync(new URL('../reborn2-evidence-01-12/'+file,import.meta.url),'utf8');
  if (sql.split(original).length!==2) throw Error('READER_TEMPLATE_CHANGED');
  return sql.replace(original,"DATE '"+date+"' AND "+alias+"track='"+track+"' AND "+alias+"race_no="+raceNo);
}
