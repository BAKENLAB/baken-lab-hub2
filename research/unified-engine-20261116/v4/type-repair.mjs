// Normative classification, NOT turf=>flat inference and NOT an archive UPDATE.
// JRA 2026 program separate conditions table, PDF page16 (zero-based15).
export const TYPE_RULE=Object.freeze({id:'JRA_2026_FLAT_ONLY_WIN_CLASSES',source:'https://www.jra.go.jp/keiba/program/2026/pdf/bangumi_betsu.pdf',pdf_page:16,flat_only_labels:['1勝クラス','2勝クラス','3勝クラス'],inspection_date:'2026-11-17',strict_historical_document_attestation:false});
export function deriveExclusiveFlat(p){
 if(p.match_status!=='MATCHED'||p.archive?.race_type!=null||!TYPE_RULE.flat_only_labels.includes(p.archive.class_name)||!/^2026-/.test(p.baseline.race_date))return p;
 const a=p.archive,b=p.baseline,valid=Number.isInteger(b.finish)&&b.finish>=1&&b.finish<=b.field_size;
 return {...p,flat:true,evaluation_eligible:valid,race_type_status:'DERIVED_FROM_VERIFIED_FLAT_EXCLUSIVE_CLASS_RECONSTRUCTION',flat_basis:TYPE_RULE,source_mode:'ORIGINAL_CROSS_SOURCE_MATCH_PLUS_EXCLUSIVE_CLASS_RULE',relative3f_verified:a.full_field===true&&a.field_rows===a.field_size&&a.field_final3f_count===a.field_size&&a.final3f!=null&&a.final3f_rank===a.calculated_final3f_rank,strict_frozen_input_proven:false};
}
