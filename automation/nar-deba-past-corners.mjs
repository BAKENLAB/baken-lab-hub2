// BAKEN LAB | Research-only LOCAL pre-race card passing-order extraction.
// A card belongs to ONE currently active runner, with official DOM row ownership
// previously established by the validated horse-cell/lineage diagnostic.
// Strictly refuses uncertain structure. Does not query any past race results,
// write to DB, alter rankings, or join horses by name.
const COURSE_CODE = Object.freeze({'門別':'36','帯広':'03','盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32'});
const clean = x => String(x ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
const strictDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && Number.isFinite(Date.parse(d)) &&
  new Date(d).toISOString().slice(0,10)===d;
const PASSAGE = /(?:^|\s)(\d{1,2}:\d{2}\.\d)\s+((?:[1-9]|1\d|20)(?:-(?:[1-9]|1\d|20)){1,4})\s+(\d{2}\.\d)(?:\s|$)/;

export function extractOwnedDebaPastCorners({race,cardSourceRef,cardHeader,runner,columns}) {
  if(!race || !runner || !Array.isArray(columns) || columns.length>5 ||
    !strictDate(race.race_date) || race.circuit!=='LOCAL' || !COURSE_CODE[race.track] ||
    !Number.isInteger(race.race_no) || race.race_no<1 || race.race_no>12) return [];
  const expected='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode='+
    COURSE_CODE[race.track]+'&k_raceDate='+encodeURIComponent(race.race_date.replaceAll('-','/'))+
    '&k_raceNo='+race.race_no;
  if(cardSourceRef!==expected) return [];
  const header=clean(cardHeader).replace(/\s/g,'');
  const [yr,mo,dy]=race.race_date.split('-').map(Number);
  if(!header.includes(yr+'年'+mo+'月'+dy+'日') ||
     !header.includes(race.track+'第'+race.race_no+'競走')) return [];
  const ref=Array.isArray(runner.identity_refs) && runner.identity_refs.length===1?runner.identity_refs[0]:null;
  if(runner.status!=='ACTIVE' || !Number.isInteger(runner.horse_no) || runner.horse_no<1 ||
     runner.horse_no>20 || !Number.isInteger(runner.row_index) || runner.row_index<0 ||
     !clean(runner.horse_name) ||
     typeof ref!=='string' ||
     !/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{5,30}$/.test(ref)) return [];
  const result=[],slots=new Set(),dates=new Set();
  for(const col of columns) {
    if(!col || col.owner_horse_no!==runner.horse_no ||
      col.owner_row_index!==runner.row_index ||
      col.deba_source_ref!==expected ||
      !Number.isInteger(col.slot) || col.slot<1 || col.slot>5 ||
      slots.has(col.slot)) return [];
    slots.add(col.slot);
    const h=clean(col.headline), f=clean(col.form);
    // Date, position and horse number must come from the SAME horse-owned column.
    const info=h.match(/^(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s+(良|稍重|重|不良)\s+(\d{1,2})頭(?:\s|$)/);
    const tail=h.match(/(?:^|\s)(\d{1,2})番(?:\s|$)/);
    const passage=f.match(PASSAGE);
    if(!info || !tail || !passage) continue; // Unreadable is missing, never invented.
    const date='20'+info[2]+'-'+info[3]+'-'+info[4];
    const field=Number(info[6]),pastNo=Number(tail[1]);
    const corners=passage[2].split('-').map(Number);
    if(!strictDate(date) || date>=race.race_date || dates.has(date) ||
      field<2 || field>20 || pastNo<1 || pastNo>20 ||
      corners.some(n=>n>field)) continue;
    dates.add(date);
    result.push({race_date:date,source:'NAR_OFFICIAL_DEBA_PAST_COLUMN',
      source_ref:expected,identity_source_ref:ref,
      current_horse_no:runner.horse_no,past_horse_no:pastNo,
      horse_name:runner.horse_name,slot:col.slot,finish:Number(info[1]),
      early_pos:corners[0],final_turn_pos:corners[corners.length-1],
      passing_order:passage[2],field_size:field});
  }
  return result.sort((a,b)=>a.slot-b.slot);
}
