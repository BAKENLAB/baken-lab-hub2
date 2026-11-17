import {createHash} from 'node:crypto';
export const MICRO=1000000;
export const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en'))):v);
export const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const order=(a,b)=>a<b?-1:a>b?1:0;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function apportion(total,items){
 if(!integer(total)||items.some(x=>!integer(x.weight))||new Set(items.map(x=>x.id)).size!==items.length)throw Error('APPORTION_INPUT');
 const sum=items.reduce((s,x)=>s+BigInt(x.weight),0n),out=items.map(x=>({id:x.id,amount:0,remainder:0n}));if(!sum||!total)return out.map(({remainder,...x})=>x);
 let used=0;for(let i=0;i<items.length;i++){const v=BigInt(total)*BigInt(items[i].weight);out[i].amount=Number(v/sum);out[i].remainder=v%sum;used+=out[i].amount;}
 out.sort((a,b)=>a.remainder===b.remainder?order(a.id,b.id):a.remainder>b.remainder?-1:1);for(let i=0;i<total-used;i++)out[i].amount++;
 return out.sort((a,b)=>order(a.id,b.id)).map(({remainder,...x})=>x);
}
export function validateFact(f,cutoff){
 if(!f||!f.race_id||!f.horse_id||!f.measurement||!f.source||!f.observed_at||f.value===null||f.value===undefined||!Number.isFinite(Date.parse(f.observed_at))||!Number.isFinite(Date.parse(cutoff))||Date.parse(f.observed_at)>=Date.parse(cutoff)||!Number.isFinite(Date.parse(f.race_date))||f.race_date>=cutoff.slice(0,10))throw Error('FACT_IDENTITY_TIME_VALUE');
 if(/odds|popularity|market|target_finish|target_result/i.test(f.measurement))throw Error('FORBIDDEN_MEASUREMENT');
 if(f.verified!==true)throw Error('FACT_UNVERIFIED');const inspect=x=>{if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if(/odds|popularity|market|target_finish|target_result/i.test(k))throw Error('FORBIDDEN_MEASUREMENT');inspect(v);}};inspect(f.value);const identity={race_id:f.race_id,horse_id:f.horse_id,measurement:f.measurement};
 return {...f,id:digest(identity),identity};
}
export function allocate({claims,facts,axisCaps,cutoff,rootCap=25}){
 const fm=new Map(),byIdentity=new Map();for(const raw of facts){const f=validateFact(raw,cutoff),prior=byIdentity.get(f.id);if(prior&&canonical(prior)!==canonical(f))throw Error('FACT_CONFLICT');byIdentity.set(f.id,f);fm.set(f.id,f);}
 const cm=new Map();for(const raw of claims){const c={...raw,fact_ids:[...new Set(raw.fact_ids??[])].sort(order)};if(!c.id||!c.axis||!integer(c.cap_micro)||!integer(axisCaps[c.axis]*MICRO))throw Error('CLAIM_ID_CAP');if(c.request_micro!==null&&(!integer(c.request_micro)||c.request_micro>c.cap_micro))throw Error('CLAIM_REQUEST');if(c.request_micro>0&&(!c.fact_ids.length||c.fact_ids.some(id=>!fm.has(id))))throw Error('CLAIM_FACTS');const old=cm.get(c.id);if(old&&canonical(old)!==canonical(c))throw Error('CLAIM_CONFLICT');cm.set(c.id,c);}
 const cs=[...cm.values()].sort((a,b)=>order(a.id,b.id));for(const [axis,cap]of Object.entries(axisCaps))if(cs.filter(c=>c.axis===axis).reduce((s,c)=>s+c.cap_micro,0)!==Math.round(cap*MICRO))throw Error('AXIS_BUDGET');
 const slices=[];for(const c of cs)if(c.request_micro>0)for(const x of apportion(c.request_micro,c.fact_ids.map(id=>({id,weight:1}))))slices.push({id:c.id+'/'+x.id,claim_id:c.id,fact_id:x.id,root:fm.get(x.id).race_id,requested_micro:x.amount});
 const byFact=new Map();for(const s of slices)byFact.set(s.fact_id,[...(byFact.get(s.fact_id)??[]),s]);
 const factBudgets=[];for(const [id,ss]of [...byFact].sort(([a],[b])=>order(a,b))){const cap=Math.max(...ss.map(s=>s.requested_micro)),amounts=new Map(apportion(cap,ss.map(s=>({id:s.id,weight:s.requested_micro}))).map(x=>[x.id,x.amount]));for(const s of ss)s.after_fact_micro=amounts.get(s.id);factBudgets.push({fact_id:id,cap_micro:cap,requested_micro:ss.reduce((s,x)=>s+x.requested_micro,0)});}
 const byRoot=new Map();for(const s of slices)byRoot.set(s.root,[...(byRoot.get(s.root)??[]),s]);const roots=[];
 for(const [id,ss]of [...byRoot].sort(([a],[b])=>order(a,b))){const requested=ss.reduce((s,x)=>s+x.after_fact_micro,0),budget=Math.min(Math.round(rootCap*MICRO),requested),amounts=new Map(apportion(budget,ss.map(s=>({id:s.id,weight:s.after_fact_micro}))).map(x=>[x.id,x.amount]));for(const s of ss)s.credited_micro=amounts.get(s.id);roots.push({race_id:id,cap_micro:Math.round(rootCap*MICRO),requested_micro:requested,debited_micro:budget});}
 slices.sort((a,b)=>order(a.id,b.id));const components=cs.map(c=>({...c,credited_micro:slices.filter(s=>s.claim_id===c.id).reduce((n,s)=>n+s.credited_micro,0)})),ledger=Object.entries(axisCaps).sort(([a],[b])=>order(a,b)).map(([axis,cap])=>{const cc=components.filter(c=>c.axis===axis),lower_micro=cc.reduce((s,c)=>s+c.credited_micro,0),unknown_micro=cc.filter(c=>c.request_micro===null).reduce((s,c)=>s+c.cap_micro,0);return {id:axis,cap,lower_micro,upper_micro:lower_micro+unknown_micro,lower:lower_micro/MICRO,upper:(lower_micro+unknown_micro)/MICRO,components:cc};}),credited_micro=components.reduce((n,c)=>n+c.credited_micro,0),debited_micro=roots.reduce((n,r)=>n+r.debited_micro,0);
 if(credited_micro!==debited_micro)throw Error('CONSERVATION');for(const b of factBudgets)if(slices.filter(s=>s.fact_id===b.fact_id).reduce((n,s)=>n+s.credited_micro,0)>b.cap_micro)throw Error('FACT_BUDGET');
 return {lower:credited_micro/MICRO,upper:ledger.reduce((s,l)=>s+l.upper_micro,0)/MICRO,credited_micro,debited_micro,ledger,facts:[...fm.values()].sort((a,b)=>order(a.id,b.id)),fact_budgets:factBudgets,roots,slices,ability_score:null,allocation_method:'SIMULTANEOUS_PROPORTIONAL_V1',production_allowed:false};
}
