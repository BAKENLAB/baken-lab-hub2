// Explicitly scoped capture-only repair for the two verified card discrepancies.
// No prediction writes; reject any changed prior identity, weight, or official jockey.
export function sameCapturedIdentity(current,old){
 const canonical=s=>String(s??"").normalize("NFKC").replace(/\s+/g," ").trim();
 const oldName=canonical(old.jockey).replace(/\s\d{3}\s[A-Z]$/,"");
 const currentName=canonical(current.jockey);
 return Number.isInteger(Number(current.horse_no))&&Number(current.horse_no)===Number(old.horse_no)
 &&current.horse_name===old.horse_name&&!!current.horse_ref&&current.horse_ref===old.horse_ref
 &&current.draw!=null&&old.draw!=null&&Number(current.draw)===Number(old.draw)
 &&current.weight_carried!=null&&old.weight_carried!=null&&Number.isFinite(Number(current.weight_carried))&&Number(current.weight_carried)===Number(old.weight_carried)
 &&currentName!==""&&currentName===oldName;
}
export function checkRepairRows(rows,prior,cancelled,raceNo){
 if(![10,11].includes(raceNo)||!Array.isArray(rows)||!Array.isArray(prior))return false;
 const expected=raceNo===10?10:18;
 if(prior.length!==expected-(raceNo===10?1:0)||rows.length!==expected)return false;
 const numbers=rows.map(r=>r.horse_no).sort((a,b)=>a-b);
 if(!numbers.every((n,i)=>n===i+1)||!prior.every(old=>rows.some(r=>sameCapturedIdentity(r,old))))return false;
 const extras=rows.filter(r=>!prior.some(o=>Number(o.horse_no)===r.horse_no));
 return extras.length===(raceNo===10?1:0)&&extras.every(r=>cancelled.get(r.horse_name)===r.horse_no&&r.horse_ref&&Number.isInteger(r.draw));
}

export function describeRepairMismatch(rows,prior,cancelled,raceNo){
 const normalize=s=>String(s??"").normalize("NFKC").replace(/\s+/g," ").trim();
 const result=[];
 for(const old of prior){
  const r=rows.find(x=>Number(x.horse_no)===Number(old.horse_no));
  if(!r){result.push([old.horse_no,"missing"]);continue;}
  const problems=[];
  if(r.horse_name!==old.horse_name)problems.push("name");
  if(!r.horse_ref||r.horse_ref!==old.horse_ref)problems.push("ref");
  if(r.draw==null||old.draw==null||Number(r.draw)!==Number(old.draw))problems.push("draw");
  if(r.weight_carried==null||old.weight_carried==null||!Number.isFinite(Number(r.weight_carried))||Number(r.weight_carried)!==Number(old.weight_carried))problems.push("weight");
  if(!normalize(r.jockey)||normalize(r.jockey)!==normalize(old.jockey).replace(/\s\d{3}\s[A-Z]$/,""))problems.push("jockey");
  if(problems.length)result.push([old.horse_no,...problems]);
 }
 const extras=rows.filter(r=>!prior.some(o=>Number(o.horse_no)===r.horse_no));
 return {raceNo,counts:[prior.length,rows.length],numberCoverage:rows.map(r=>r.horse_no).sort((a,b)=>a-b).every((n,i)=>n===i+1),mismatch:result,extra:extras.map(r=>({no:r.horse_no,cancelVerified:cancelled.get(r.horse_name)===r.horse_no,refPresent:!!r.horse_ref,drawPresent:Number.isInteger(r.draw)}))};
}
