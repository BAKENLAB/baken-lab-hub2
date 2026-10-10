// Gateway verify_jwt MUST remain true. This is additional cron-only authorization.
export async function authorizeCron(req,body,expectedHash){
 if(req.method!=='POST')return {ok:false,status:405,error:'METHOD_NOT_ALLOWED'};
 if(!/^[a-f0-9]{64}$/.test(expectedHash||''))return {ok:false,status:503,error:'JRA_CRON_AUTH_NOT_CONFIGURED'};
 if(!/^Bearer [^\s]+$/.test(req.headers.get('authorization')||''))return {ok:false,status:401,error:'UNAUTHORIZED'};
 const token=req.headers.get('x-jra-cron-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return {ok:false,status:401,error:'UNAUTHORIZED'};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expectedHash.charCodeAt(i);
 if(different)return {ok:false,status:401,error:'UNAUTHORIZED'};
 if(!body||typeof body!=='object'||Array.isArray(body))return {ok:false,status:400,error:'INVALID_BODY'};
 if(!['discover','sync_batch'].includes(body.action))return {ok:false,status:403,error:'ACTION_NOT_ALLOWED'};
 if(Object.keys(body).some(k=>!['action','batch_size'].includes(k)))return {ok:false,status:400,error:'INVALID_BODY'};
 if(body.action==='discover'&&Object.hasOwn(body,'batch_size'))return {ok:false,status:400,error:'INVALID_BODY'};
 if(body.action==='sync_batch'&&Object.hasOwn(body,'batch_size')&&(!Number.isInteger(body.batch_size)||body.batch_size<1||body.batch_size>5))return {ok:false,status:400,error:'INVALID_BATCH_SIZE'};
 return {ok:true};
}
