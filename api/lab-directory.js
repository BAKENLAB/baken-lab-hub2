import { isAuthenticated } from '../auth-utils.js';
export const config={runtime:'edge'};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8'};
const reply=(obj,status)=>new Response(JSON.stringify(obj),{status,headers});
export default async function handler(request){
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 const s=process.env.LAB_HUB_SESSION_SECRET,p=process.env.LAB_HUB_ACCESS_PASSWORD;
 if(!s||!p||!await isAuthenticated(request.headers.get('cookie'),s+':'+p))return reply({ok:false,error:'unauthorized'},401);
 if(new URL(request.url).search)return reply({ok:false,error:'invalid_request'},400);
 const gate=process.env.LAB_HUB_UPSTREAM_SECRET;
 if(!gate||!/^[0-9a-f]{96}$/.test(gate))return reply({ok:false,error:'unavailable'},503);
 try{
  const r=await fetch('https://qjlvsndiqjfsfjinilig.supabase.co/functions/v1/lab-directory-preview',{method:'GET',headers:{Accept:'application/json','X-Lab-Hub-Gate':gate},redirect:'error',cache:'no-store'});
  const t=await r.text();
  if(!r.ok||!r.headers.get('content-type')?.includes('application/json')||t.length>3500000)return reply({ok:false,error:'directory_unavailable'},503);
  return new Response(t,{status:200,headers});
 }catch{return reply({ok:false,error:'directory_unavailable'},503);}
}
