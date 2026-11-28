// 09: narrow incident witness intake. Search excerpts are route discovery only, not archived full official records.
// No event text => unknown, never normal. This module never authorizes scoring.
// Actual admission requires official full text, immutable acquisition witness, exact result/profile linkage and cutoff.
export function inspectStartIncident({circuit,raceDate,trackCode,raceNo,sourceRef,subject,officialPhrase,archiveHorse,sourceMode}){
 const miss=reason=>({status:'MISSING',reason,normal_start_verified:false,assessment_admitted:false});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raceDate??'')||!Number.isInteger(raceNo)||raceNo<1||raceNo>12||!subject||!archiveHorse||archiveHorse.name!==subject.name||!Number.isInteger(archiveHorse.no)||archiveHorse.no<1||archiveHorse.no>24)return miss('RACE_OR_SUBJECT_UNBOUND');
 let link=false;
 if(circuit==='JRA'){
  const m=/^https:\/\/www\.jra\.go\.jp\/JRADB\/accessS\.html\?CNAME=(pw01sde\d+)(?:%2F|\/)([0-9A-F]{2})$/.exec(sourceRef??'');
  link=!!m&&m[1].endsWith(String(raceNo).padStart(2,'0')+raceDate.replaceAll('-',''))&&archiveHorse.race_ref===m[1]+'/'+m[2];
 }else if(circuit==='LOCAL'){
  link=Number.isInteger(trackCode)&&sourceRef==='https://ppr.keiba.go.jp/index.php/show/show/'+raceDate.replaceAll('-','')+'/'+trackCode+'/'+String(raceNo).padStart(2,'0')+'/report.html'&&subject.no===archiveHorse.no;
 }
 if(!link)return miss('RACE_SOURCE_REF_MISMATCH');
 if(!['発進不良〔出遅れ〕','大きく出遅れました'].includes(officialPhrase))return miss('NO_MATCHED_START_EVENT');
 const missing=[];
 if(sourceMode!=='FULL_OFFICIAL_DOCUMENT')missing.push('FULL_OFFICIAL_DOCUMENT_NOT_RETRIEVED');
 // The intake does not independently verify or accept asserted identity, publication or raw-document proofs.
 missing.push('INDEPENDENT_RESULT_PROFILE_ID_LINK_NOT_VERIFIED','IMMUTABLE_SOURCE_PUBLICATION_AND_ASOF_NOT_VERIFIED');
 return {status:'OFFICIAL_SEARCH_EXCERPT_EVENT_CANDIDATE',event_type:'REPORTED_LATE_START',race_date:raceDate,race_no:raceNo,horse_no:archiveHorse.no,horse_name:subject.name,source_ref:sourceRef,missing,normal_start_verified:false,assessment_admitted:false};
}
