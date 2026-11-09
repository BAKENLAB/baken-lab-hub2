/**
 * LOCAL 1.6 pre-race, official-context-only condition resolver.
 *
 * Missing historic surface is NOT equivalent to incorrect surface.
 * NAR official course guide confirms Morioka is the ONLY current NAR venue
 * with a turf course; all listed non-Morioka NAR venues are dirt-only.
 * This is a public course property, NOT fabricated per-run result evidence.
 *
 * No market inputs, bets, job claims, DB access, FROZEN writes or ranking.
 * Caller MUST have already checked historical race/horse identity and as-of.
 * Source: https://www.keiba.go.jp/guide/course/
 */
const NAR_DIRT_ONLY_TRACKS=new Set([
 '門別','水沢','浦和','船橋','大井','川崎','金沢','笠松',
 '名古屋','園田','姫路','高知','佐賀'
]);
const normalized=x=>typeof x==='string'?x.normalize('NFKC').replace(/\s+/g,'').toUpperCase():'';
export function resolveLocalHistoricalSurface(run){
 const v=normalized(run?.surface);
 if(v==='ダート'||v==='芝')
   return {surface:v,provenance:'OFFICIAL_HISTORY_EXPLICIT',source_ref:null};
 // Ambiguous or unrecognized literal must NEVER be overridden by a track rule.
 if(v)return {surface:null,provenance:'UNVERIFIED_SURFACE_LITERAL',source_ref:null};
 if(NAR_DIRT_ONLY_TRACKS.has(run?.track))
   return {surface:'ダート',
     provenance:'NAR_OFFICIAL_SINGLE_SURFACE_TRACK_CAPABILITY',
     source_ref:'https://www.keiba.go.jp/guide/course/'};
 // Morioka has BOTH turf and dirt. JRA tracks may also have both.
 return {surface:null,provenance:'MIXED_OR_UNKNOWN_TRACK_NEEDS_EXPLICIT_SURFACE',source_ref:null};
}
/**
 * An explicitly printed CLASS label, extracted from an official race title.
 * Accept C2 / C2七組 / C29組 (=C2 9組) / C2-18組.
 * A1・A2 is ambiguous, not a single comparable class.
 * 3歳C2 is NOT adult C2. Original race name stays unchanged.
 */
export function resolveLocalOfficialClassLiteral(name){
 const s=normalized(name);
 if(!s)return {status:'CLASS_MISSING',class_label:null};
 const matches=[];
 const re=/(?:^|[^A-Z0-9])(3歳)?([ABC])([123])(?=$|[^A-Z0-9]|[1-9]\d?組|[23]歳以上)/gu;
 for(const m of s.matchAll(re)){
   const label=(m[1]?'3歳':'')+m[2]+m[3];
   matches.push(label);
 }
 const unique=[...new Set(matches)];
 if(unique.length!==1)return {status:unique.length?'AMBIGUOUS_CLASS':'CLASS_NOT_EXPLICIT',class_label:null};
 return {status:'OFFICIAL_CLASS_LITERAL',class_label:unique[0]};
}
