// Extracted unchanged canonical/hash and horse-ID rules from V9/V3. No runner/DB imports.
import {createHash} from 'node:crypto';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export function canonical(x){if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);if(Array.isArray(x))return'['+x.map(canonical).join(',')+']';if(x&&Object.getPrototypeOf(x)===Object.prototype)return'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';throw Error('NON_JSON_VALUE');}
export function horseId(ref){if(typeof ref!=='string')return null;try{const u=new URL(ref,'https://www.jra.go.jp');if(u.origin!=='https://www.jra.go.jp'||u.pathname!=='/JRADB/accessU.html')return null;return u.searchParams.get('CNAME')?.match(/^pw01dud\d{2}(\d{10})\/[A-Fa-f0-9]+$/)?.[1]??null;}catch{return null;}}
