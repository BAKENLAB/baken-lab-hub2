// Research-only: owner-bound DOM extraction of past run columns from a single
// already-fetched NAR DebaTable. Pure function; no network, DB or scoring.
// Requires exact row/cell-column alignment. Unknown HTML layout yields no data.
const neat = s => String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const DATE_RX=/^(?:[1-9]|1\d|20)\s+\d{2}\.\d{2}\.\d{2}\s+(?:良|稍重|重|不良)\s+\d{1,2}頭(?:\s|$)/;
const VOID_RUN_RX=/^(?:取止\s+\d{2}\.\d{2}\.\d{2}\s+(?:良|稍重|重|不良)\s+0頭|(?:取消|除外)\s+\d{2}\.\d{2}\.\d{2}\s+(?:良|稍重|重|不良)\s+(?:[1-9]|1\d|20)頭)(?:\s|$)/;
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
 const dates=owned.map(r=>({row:r,cells:r.cells.map(c=>neat(c?.text))}))
   .filter(r=>r.cells.some(v=>DATE_RX.test(v)));
 const forms=owned.map(r=>({row:r,cells:r.cells.map(c=>neat(c?.text))}))
   .filter(r=>r.cells.some(v=>PASS_RX.test(v)));
 if(dates.length!==1 || forms.length!==1) return [];
 const date=dates[0],form=forms[0];
 if(form.row.row_index<=date.row.row_index)return [];
 // Only two explicitly observed layouts: 1:1 same columns, or NAR's
 // 10/11-cell dated starts with the 7-cell form row. Canceled historical
 // slots remain present and must NOT shift the other four run pairings.
 let pairs=[];
 if(date.cells.length===form.cells.length){
   pairs=date.cells.flatMap((v,i)=>DATE_RX.test(v)||VOID_RUN_RX.test(v)?[[i,i]]:[]);
   // A passage without a recognized run header at that exact position is an
   // alignment conflict, not evidence to reuse from an adjacent cell.
   if(form.cells.some((v,i)=>PASS_RX.test(v)&&!pairs.some(p=>p[0]===i)))return [];
 }else if((date.cells.length===10||date.cells.length===11)&&form.cells.length===7){
   pairs=Array.from({length:5},(_,i)=>[date.cells.length-5+i,2+i]);
 }else return [];
 const result=[];
 for(let i=0;i<pairs.length;i++){
   const [di,fi]=pairs[i],h=date.cells[di],p=form.cells[fi];
   const valid=DATE_RX.test(h) && PASS_RX.test(p);
   if(valid){
     result.push({slot:i+1,headline:h,form:p,owner_horse_no:owner.horse_no,
       owner_row_index:owner.row_index,deba_source_ref:debaSourceRef});
     continue;
   }
   // Only a clearly identified 0-horse stopped meeting, or official canceled/excluded
   // start, paired with an
   // empty form cell can be safely skipped. Never invent its corner order.
   if(VOID_RUN_RX.test(h) && !p)continue;
   if(!h && !p)continue; // genuinely absent prior-run slots
   if(i < date.cells.length && !DATE_RX.test(h) && !VOID_RUN_RX.test(h)
      && !h && !p && date.cells.length===form.cells.length)continue;
   // Any shifted, truncated or ambiguous data rejects the horse.
   return [];
 }
 if(!result.length || result.length>5)return [];
 return result;
}
