// Read only the current card's official time header, as the verified publisher does.
export function readRepairPostTime(value){
 const s=String(value??"").normalize("NFKC").trim(),m=s.match(/^(\d{1,2})時(\d{2})分$/);
 if(!m||Number(m[1])<8||Number(m[1])>19||Number(m[2])>59)throw Error("JRA_REPAIR_POST_TIME_HEADER_INVALID");
 return Number(m[1])+"時"+m[2]+"分";
}

// One verified current-card schedule correction, never a change to an official registry or FROZEN.
// Both prior and current time must still be at least five minutes ahead.
export function compareRepairPostTime({date,track,raceNo,previous,current,now}){
 const a=readRepairPostTime(previous),b=readRepairPostTime(current);
 const ts=x=>Date.parse(date+"T"+x.replace(/^(\d{1,2})時(\d{2})分$/,(_,hh,mm)=>hh.padStart(2,"0")+":"+mm)+":00+09:00");
 if(!Number.isFinite(now)||![ts(a),ts(b)].every(x=>Number.isFinite(x)&&x>now+300000))return false;
 return a===b||(date==="2026-11-15"&&track==="京都"&&raceNo===10&&a==="15時00分"&&b==="15時01分");
}
