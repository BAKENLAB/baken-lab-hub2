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
 if(dates.length!==1 || forms.length!==1 || dates[0].cells.length!==forms[0].cells.length) return [];
 const date=dates[0],form=forms[0];
 if(form.row.row_index<=date.row.row_index) return []; // Must be later in same horse group.
 const result=[];
 for(let i=0;i<date.cells.length;i++){
   if(!DATE_RX.test(date.cells[i]))continue;
   if(!PASS_RX.test(form.cells[i]))return []; // never shift nearby columns.
   if(result.length===5)return [];
   result.push({slot:result.length+1,headline:date.cells[i],form:form.cells[i],
      owner_horse_no:owner.horse_no,owner_row_index:owner.row_index,deba_source_ref:debaSourceRef});
 }
 return result;
}
