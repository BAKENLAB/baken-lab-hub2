// Deterministic synthetic-only generator; no real-world identity, expectation, or outcome of target.
export function generateFixture(seed=20261127){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('SEED');
 let n=seed>>>0;const rnd=k=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%k;};
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const ids=['FIXTURE-A','FIXTURE-B','FIXTURE-C','FIXTURE-D'];
 const conditions={venue:'Synthetic Track',course_version:'S1',distance_m:1400,surface:'dirt',turn:'right',first_corner_m:285,going:'良',grade:'C2',layout:'R1400',rule_version:'S1',eligibility:'SYNTHETIC'};
 const entrants=ids.map((id,i)=>({id,runner:i+1,draw:i+1,kg:54+i%2*2,status:'ACTIVE'}));
 const race=(suffix,date,order,early)=>{const laps=Array.from({length:7},()=>115+rnd(20)),winner=laps.reduce((a,b)=>a+b,0),corners=[early,shuffle(ids),shuffle(ids),shuffle(ids)],nums=shuffle([1,2,3,4]);let gap=0;
 const rows=order.map((id,i)=>{if(i)gap+=1+rnd(5);return {id,runner:nums[i],kg:entrants.find(h=>h.id===id).kg,finish:i+1,clock_tenths:winner+gap,margin_tenths:i?gap:null,final3f_tenths:350+rnd(35),corners:corners.map(c=>c.indexOf(id)+1)}});
 return {id:'FK-GEN-'+suffix,date,start:'13:00',published:'13:20',conditions:{...conditions},field_count:4,full_result_rows:true,lap_kind:'synthetic_race_leader',lap_segment_m:Array(7).fill(200),lap_tenths:laps,rows};};
 return {id:'GEN-'+seed,target:{id:'FK-GEN-TARGET',date:'2026-11-20',start:'15:00',published:'14:30',conditions,field_complete:true,entrants},history:[race('1','2026-09-01',ids,ids),race('2','2026-10-01',[ids[1],ids[0],ids[2],ids[3]],[ids[1],ids[0],ids[3],ids[2]]),race('3','2026-11-01',[ids[2],ids[1],ids[3],ids[0]],ids)]};
}
const integer=(n)=>Number.isInteger(n)&&n>0;
const permutation=(xs,n)=>xs.length===n&&xs.every(x=>integer(x)&&x<=n)&&new Set(xs).size===n;
const instant=(d,t)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d??'')||!/^\d{2}:\d{2}$/.test(t??''))return NaN;const x=d+'T'+t+':00Z',v=Date.parse(x);return Number.isFinite(v)&&new Date(v).toISOString().slice(0,16)===x.slice(0,16)?v:NaN;};
export function validateGenerated(c){
 const errors=[],t=c.target,cut=instant(t.date,t.published),start=instant(t.date,t.start),n=t.entrants.length,ids=t.entrants.map(x=>x.id);
 if(!(cut<start)||!t.field_complete||!permutation(t.entrants.map(x=>x.runner),n)||!permutation(t.entrants.map(x=>x.draw),n)||new Set(ids).size!==n||t.entrants.some(x=>!/^FIXTURE-[A-Z]\d*$/.test(x.id)||!integer(x.kg)||x.status!=='ACTIVE'))errors.push('TARGET');
 if(new Set(c.history.map(x=>x.id)).size!==c.history.length)errors.push('DUPLICATE_RACE');
 for(const r of c.history){const bad=k=>errors.push(r.id+':'+k),m=r.field_count,rows=r.rows,w=rows.find(x=>x.finish===1);
 if(r.id===t.id||!(instant(r.date,r.start)<instant(r.date,r.published)&&instant(r.date,r.published)<cut))bad('TIME');
 if(!r.full_result_rows||rows.length!==m||!permutation(rows.map(x=>x.runner),m)||!permutation(rows.map(x=>x.finish),m)||new Set(rows.map(x=>x.id)).size!==m||rows.some(x=>!ids.includes(x.id)))bad('FIELD_ID');
 if(!w||rows.some(x=>!integer(x.kg)||!integer(x.clock_tenths)||!integer(x.final3f_tenths)||x.final3f_tenths>=x.clock_tenths||x.finish!==1&&x.clock_tenths-w.clock_tenths!==x.margin_tenths||x.finish===1&&x.margin_tenths!==null))bad('CLOCK_MARGIN_WEIGHT');
 if(rows.slice().sort((a,b)=>a.finish-b.finish).some((x,i,a)=>i&&x.clock_tenths<a[i-1].clock_tenths))bad('CLOCK_ORDER');
 if(rows.some(x=>!Array.isArray(x.corners)||x.corners.length!==4)||[0,1,2,3].some(k=>!permutation(rows.map(x=>x.corners?.[k]),m)))bad('CORNERS');
 if(!w||r.lap_kind!=='synthetic_race_leader'||r.lap_tenths.length!==r.lap_segment_m.length||!r.lap_tenths.every(integer)||!r.lap_segment_m.every(integer)||r.lap_segment_m.reduce((a,b)=>a+b,0)!==r.conditions.distance_m||r.lap_tenths.reduce((a,b)=>a+b,0)!==w.clock_tenths)bad('LAPS');
 }
 return {valid:errors.length===0,errors,seed_scope:'SYNTHETIC_ONLY',formal:false};
}
export function abnormalVariants(c){const variants={};for(const [k,mutate] of Object.entries({lap:x=>x.history[0].lap_tenths[0]++,distance:x=>x.history[0].lap_segment_m[0]++,margin:x=>x.history[0].rows[1].margin_tenths++,corner:x=>x.history[0].rows[1].corners[0]=x.history[0].rows[0].corners[0],identity:x=>x.history[0].rows[1].id=x.history[0].rows[0].id,runner:x=>x.history[0].rows[1].runner=x.history[0].rows[0].runner,field:x=>x.history[0].field_count++,weight:x=>x.history[0].rows[0].kg=0,time:x=>x.history[0].published='12:59',cutoff:x=>x.history[0].date='2026-11-21',duplicate:x=>x.history.push(structuredClone(x.history[0]))})){const v=structuredClone(c);mutate(v);variants[k]=v;}return variants;}
