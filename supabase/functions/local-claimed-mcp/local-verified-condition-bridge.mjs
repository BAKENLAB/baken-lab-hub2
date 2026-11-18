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
 * Strict, venue-aware official CLASS literal reader.
 * 名古屋/笠松: A・B・C are grades; suffix numbers are individual 組 numbers.
 * Thus 名古屋 C23組 = C級23組, NEVER generic C2/3組 or C2.
 * Other NAR districts: B1/B2, C1/C2/C3 etc. are graded class tiers.
 * When the district is missing, compact C23 is ambiguous (fail closed).
 * Mixed divisions such as A4・B3組/C14・C17組 are never one class.
 *
 * Caller supplies the official CURRENT race district for the target and
 * the prior runner's ACTUAL verified historical district for each run.
 * No inferred cross-district equivalence.
 * Evidence: NAR class guide, Nagoya official race-program C級 group rules.
 */
export function resolveLocalOfficialClassLiteral(name,track=null){
 const s=normalized(name),venue=normalized(track);
 if(!s)return {status:'CLASS_MISSING',class_label:null};
 if(venue==='名古屋'||venue==='笠松'){
   // Age-only events cannot be treated as adult A/B/C grade.
   if(/(?:^|[^0-9])3歳[ABC][0-9]/u.test(s))
     return {status:'AGE_RESTRICTED_CLASS',class_label:null};
   const all=[];
   const re=/(?:^|[^A-Z0-9])([ABC])([1-9][0-9]?)(?=$|[^A-Z0-9])/gu;
   for(const m of s.matchAll(re)) all.push(m[1]+String(Number(m[2])));
   const unique=[...new Set(all)];
   if(unique.length!==1)return {status:unique.length?'AMBIGUOUS_CLASS':'CLASS_NOT_EXPLICIT',class_label:null};
   return {status:'OFFICIAL_TOKAI_GROUP_LITERAL',class_label:unique[0]};
 }
 // Compact two-digit class+group tokens need a confirmed Tokai district.
 // A C29組 from Nagoya must not be read as C2 without its source venue.
 if(!venue&&/(?:^|[^A-Z0-9])[ABC][123][0-9]組/u.test(s))
   return {status:'VENUE_REQUIRED_FOR_COMPACT_CLASS',class_label:null};
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
