// Authenticated, read-only relay for LAB VALUE pre-race research.
import { isAuthenticated } from '../auth-utils.js';
export const config={runtime:'edge'};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export default async function handler(request){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET'}});
 const s=process.env.LAB_HUB_SESSION_SECRET,p=process.env.LAB_HUB_ACCESS_PASSWORD;
 if(!s||!p||!await isAuthenticated(request.headers.get('cookie'),s+':'+p))
  return new Response('Unauthorized',{status:401,headers});
 const url=new URL(request.url);
 const date=url.searchParams.get('date');
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return new Response('Invalid date',{status:400,headers});
 const secret=process.env.LAB_HUB_UPSTREAM_SECRET;
 if(!secret||!/^[0-9a-f]{96}$/.test(secret))return new Response('Proxy unavailable',{status:503,headers});
 const dest=new URL('https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/lab-value-preview');
 if(date)dest.searchParams.set('date',date);
 try{
  const resp=await fetch(dest.toString(),{method:'GET',
   headers:{'Accept':'application/json','X-Lab-Hub-Gate':secret},redirect:'error',cache:'no-store'});
  const txt=await resp.text();
  if(txt.length>1000000)return new Response('Response too large',{status:502,headers});
  const type=resp.headers.get('content-type')||'';
  if(!type.includes('application/json'))return new Response('Upstream error',{status:502,headers});
  return new Response(txt,{status:resp.status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 }catch(err){console.error('LAB_VALUE_PROXY_ERROR',String(err?.name||'Error'));
  return new Response(JSON.stringify({ok:false,error:'upstream_unavailable'}),{status:502,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
}
