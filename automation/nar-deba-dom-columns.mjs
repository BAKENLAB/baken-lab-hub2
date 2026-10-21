// Research-only: owner-bound DOM extraction of past run columns from a single
// already-fetched NAR DebaTable. Pure function; no network, DB or scoring.
// Requires exact row/cell-column alignment. Unknown HTML layout yields no data.
const neat = s => String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const DATE_RX=/^(?:[1-9]|1\d|20)\s+\d{2}\.\d{2}\.\d{2}\s+(?:良|稍重|重|不良)\s+\d{1,2}頭(?:\s|$)/;
const PASS_RX=/(?:^|\s)\d{1,2}:\d{2}\.\d\s+(?:[1-9]|1\d|20)(?:-(?:[1-9]|1\d|20)){1,4}\s+\d{2}\.\d(?:\s|$)/;
export function captureOwnedDebaPriorColumns({rows,diagnosedRunners,horseNo,debaSourceRef}){
 if(!Array.isArray(rows)||rows.length>2000 || !Array.isArray(diagnosedRunners)||
    diagnosedRunners.length<1||diagnosedRunners.length>20 ||
    !Number.isInteger(horseNo)||!debaSourceRef) return [];
 const indices=diagnosedRunners.map(r=>r.row_index);
 if(indices.some(i=>!Number.isInteger(i)||i<0)||new Set(indices).size!==indices.length) return [];
 const found=diagnosedRunners.filter(r=>r.horse_no===horseNo);
 if(found.length!==1)return [];
 const owner=found[0],next=Math.min(...indices.filter(i=>i>owner.row_index),Infinity);
 const owned=rows.filter(r=>r&&Number.isInteger(r.row_index)&&
     r.row_index>=owner.row_index && r.row_index<next && Array.isArray(r.cells));
 // Date and passing-order must appear in rows owned by the same horse.
 const dates=owned.map(r=>({row:r,cells:r.cells.map(c=>neat(c?.text))})).filter(r=>r.cells.filter(x=>DATE_RX.test(x)).length>0);
 const forms=owned.map(r=>({row:r,cells:r.cells.map(c=>neat(c?.text))})).filter(r=>r.cells.filter(x=>PASS_RX.test(x)).length>0);
 if(dates.length!==1 || forms.length!==1) return [];
 const date=dates[0],form=forms[0];
 if(form.row.row_index<=date.row.row_index) return []; // Must be later in same horse group.
 const dateAt=date.cells.flatMap((v,i)=>DATE_RX.test(v)?[i]:[]);
 const formAt=form.cells.flatMap((v,i)=>PASS_RX.test(v)?[i]:[]);
 if(dateAt.length<1 || dateAt.length>5 || dateAt.length!==formAt.length)return [];
 // Two observed, explicitly documented layouts only:
 //  A. Paired same-column rows; sparse starts use exactly the same index.
 //  B. NAR official DebaTable: some runner rows contain one or two leading
 //     frame/horse-no cells; the 10- or 11-cell headline row ends in five
 //     dated starts, while the 7-cell dam/owner row ends in five passages.
 //     These exact five-slot suffixes align positionally.
 // Ambiguous, shifted or newly changed layouts remain unavailable ("?").
 const sameColumn=date.cells.length===form.cells.length &&
    dateAt.every((idx,k)=>idx===formAt[k]);
 const officialFive=(date.cells.length===11 || date.cells.length===10) &&
    form.cells.length===7 &&
    dateAt.length===5 &&
    dateAt.every((idx,k)=>idx===date.cells.length-5+k) &&
    formAt.every((idx,k)=>idx===2+k);
 if(!sameColumn&&!officialFive)return [];
 const result=[];
 for(let slot=0;slot<dateAt.length;slot++){
   const i=dateAt[slot],j=formAt[slot];
   if(!DATE_RX.test(date.cells[i]) || !PASS_RX.test(form.cells[j]))return [];
   result.push({slot:slot+1,headline:date.cells[i],form:form.cells[j],
      owner_horse_no:owner.horse_no,owner_row_index:owner.row_index,deba_source_ref:debaSourceRef});
 }
 return result;
}
