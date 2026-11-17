// Reporting correction only. Never changes source eligibility, claims or score.
export function failureCodes(p){const reason=[p.raw_reason,p.type_reason].filter(Boolean).join(' '),codes=[];
 if(/(?:IDENTITY|HORSE_ID|HORSE_NAME|NAME|HORSE_REF)_(?:MISMATCH|CONFLICT|INVALID)|(?:MISMATCH|INVALID)_(?:HORSE|IDENTITY)/i.test(reason))codes.push('IDENTITY_MISMATCH');
 if(/TIMESTAMP|ASOF|AFTER_TARGET|POST_TARGET|SOURCE_AFTER|TIME_INCONSISTENT/i.test(reason))codes.push('TIMESTAMP_ISSUE');
 if(p.match_status==='CONFLICT'||/DISAGREE|SOURCE_CONFLICT/i.test(reason))codes.push('SOURCE_DISAGREEMENT');
 if(/FORMAT|PARSE|MALFORMED/i.test(reason))codes.push('SCHEMA_PARSE');
 if(!p.archive_run_id||p.match_status!=='MATCHED')codes.push('MISSING_VERIFIED_RACE');
 if(p.archive_run_id&&p.flat!==true)codes.push('FLAT_STATUS_UNKNOWN');
 if(!p.evaluation_eligible&&!codes.length)codes.push('OTHER');return [...new Set(codes)];
}
