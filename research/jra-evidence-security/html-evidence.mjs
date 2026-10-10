// Offline SHADOW candidate; no network, database, credentials, or status inference.
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const MAX_BYTES=2*1024*1024;
function identity(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='www.jra.go.jp'||u.port||u.username||u.password||u.hash||u.pathname!=='/JRADB/accessD.html'||[...u.searchParams.keys()].some(k=>k!=='CNAME')||u.searchParams.getAll('CNAME').length!==1)throw Error('SOURCE_INVALID');const cname=u.searchParams.get('CNAME');const m=cname.match(/^pw01dde01(\d{2})\d{8}(\d{2})(\d{8})\/[A-Za-z0-9]{2}$/);if(!m)throw Error('CNAME_INVALID');return {cname,track_code:m[1],race_no:Number(m[2]),race_date:m[3].slice(0,4)+'-'+m[3].slice(4,6)+'-'+m[3].slice(6)};}
export function captureHtml({bytes,source_url,fetched_at,race,now=Date.now()}){
 const id=identity(source_url);if(!race||Object.keys(id).some(k=>race[k]!==id[k]))throw Error('RACE_MISMATCH');
 const t=Date.parse(fetched_at);if(!Number.isFinite(t)||!/(Z|[+-]\d\d:\d\d)$/.test(fetched_at)||t>now)throw Error('TIME_INVALID');
 const raw=Buffer.from(bytes);if(!raw.length||raw.length>MAX_BYTES)throw Error('SIZE_INVALID');
 const html=new TextDecoder('shift_jis',{fatal:true}).decode(raw);if(!/<html[\s>]/i.test(html))throw Error('HTML_INVALID');
 if(/(?:sb_secret_|service_role["']?\s*[:=]|Bearer\s+[A-Za-z0-9._-]+|jra_cron_token|JRA_CRON_TOKEN_SHA256)/i.test(html))throw Error('SECRET_PATTERN');
 const gzip=gzipSync(raw);if(gzip.length>MAX_BYTES)throw Error('COMPRESSED_SIZE_INVALID');
 return {format_version:'JRA_PRIVATE_HTML_V1',race:{...id},source_url,fetched_at,expires_at:new Date(t+30*86400000).toISOString(),wire_sha256:sha(raw),decoded_utf8_sha256:sha(Buffer.from(html)),gzip_sha256:sha(gzip),raw_bytes:raw.length,compressed_bytes:gzip.length,encoding:'shift_jis',compression:'gzip',body_gzip:gzip,status_verified:false};
}
export function replayHtml(record){if(record.encoding!=='shift_jis'||record.compression!=='gzip'||record.raw_bytes>MAX_BYTES||record.compressed_bytes>MAX_BYTES)throw Error('FORMAT_INVALID');if(record.body_gzip.length!==record.compressed_bytes||sha(record.body_gzip)!==record.gzip_sha256)throw Error('GZIP_HASH_MISMATCH');const raw=gunzipSync(record.body_gzip,{maxOutputLength:MAX_BYTES});if(raw.length!==record.raw_bytes||sha(raw)!==record.wire_sha256)throw Error('WIRE_HASH_MISMATCH');const html=new TextDecoder('shift_jis',{fatal:true}).decode(raw);if(sha(Buffer.from(html))!==record.decoded_utf8_sha256)throw Error('DECODED_HASH_MISMATCH');return {bytes:raw,html,status_verified:false};}
export async function storeCandidate(db,record,{timeout_ms=1500}={}){
 let timer;const controller=new AbortController();
 try{const {body_gzip,...meta}=record;let query=db.rpc('jra_store_html_evidence_v1',{p_meta:meta,p_gzip:'\\x'+Buffer.from(body_gzip).toString('hex')});if(typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);
 const deadline=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({error:true})},timeout_ms)});
 const result=await Promise.race([query,deadline]);return result.error?{saved:false,reason:'EVIDENCE_DB_FAILED'}:{saved:true,capture_id:result.data};}catch{return {saved:false,reason:'EVIDENCE_DB_FAILED'}}finally{clearTimeout(timer)}
}
