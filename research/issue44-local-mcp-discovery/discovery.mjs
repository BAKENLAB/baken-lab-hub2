export const EXPECTED_TOOLS=Object.freeze(["lab_queue_claim_next","lab_preclaim_official_corners","lab_claimed_context","lab_relative_rank_preview","lab_seal_relative_rank_pair","lab_save_claimed_prediction"]);
const validName=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,128}$/.test(x);
function names(value){
 if(!Array.isArray(value)||value.some(x=>!validName(x))||new Set(value).size!==value.length)throw new Error('INVALID_TOOL_NAMES');
 return [...value].sort();
}
const missing=xs=>EXPECTED_TOOLS.filter(x=>!xs.includes(x));
export function assessDiscovery({sourceTools,conversationTools,authenticatedToolsList=null,authenticated=false}){
 const source=sourceTools===null?null:names(sourceTools);
 const client=names(conversationTools);
 const listed=authenticated===true&&authenticatedToolsList!==null?names(authenticatedToolsList):null;
 const sourceMissing=source===null?null:missing(source);
 const serverMissing=listed===null?null:missing(listed);
 const clientMissing=missing(client);
 const status=sourceMissing?.length?'SERVER_REGISTRATION_INCOMPLETE':
   listed===null?'AUTHENTICATED_LIST_UNVERIFIED':
   serverMissing.length?'SERVER_DISCOVERY_INCOMPLETE':
   clientMissing.length?'CLIENT_SURFACE_INCOMPLETE':'COMPLETE';
 return {status,sourceRegistrationComplete:source===null?null:sourceMissing.length===0,
   authenticatedListComplete:listed===null?null:serverMissing.length===0,
   conversationSurfaceComplete:clientMissing.length===0,
   missingFromSource:sourceMissing,missingFromAuthenticatedList:serverMissing,missingFromConversation:clientMissing,
   priorityMissing:['lab_preclaim_official_corners','lab_relative_rank_preview'].filter(x=>clientMissing.includes(x)),
   androidSpecificCauseConfirmed:false,appSnapshotCauseConfirmed:false};
}
export function bindingWarnings({hasAppBinding,hasRemoteBinding}){
 if(typeof hasAppBinding!=='boolean'||typeof hasRemoteBinding!=='boolean')throw new Error('INVALID_BINDING_OBSERVATION');
 return hasAppBinding&&hasRemoteBinding?['MIXED_BINDINGS_REQUIRE_SEPARATE_OBSERVATION']:
   hasRemoteBinding?['DIRECT_MCP_HOST_SUPPORT_UNVERIFIED']:hasAppBinding?['APP_TOOL_SNAPSHOT_UNVERIFIED']:['NO_BINDING'];
}
// Supply an already initialized, normally authorized SDK Client. This helper
// never initializes/authenticates a connection, reads tokens, or calls a tool.
export async function listToolsReadOnly(client,{maxPages=4,maxTools=64,timeoutMs=10000}={}){
 if(typeof client?.listTools!=='function'||!Number.isInteger(maxPages)||maxPages<1||maxPages>8||
   !Number.isInteger(maxTools)||maxTools<1||maxTools>256||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
   throw new Error('INVALID_DISCOVERY_LIMITS');
 const controller=new AbortController();let timer;
 const operation=async()=>{
  const found=[],seen=new Set();let cursor;
  for(let page=0;page<maxPages;page++){
   const r=await client.listTools(cursor===undefined?{}:{cursor},{signal:controller.signal,timeout:timeoutMs});
   if(!r||!Array.isArray(r.tools))throw new Error('INVALID_TOOLS_LIST');
   for(const t of r.tools){
    if(!validName(t?.name)||found.includes(t.name))throw new Error('INVALID_OR_DUPLICATE_TOOL');
    found.push(t.name);if(found.length>maxTools)throw new Error('TOOL_LIMIT');
   }
   if(r.nextCursor===undefined)return names(found);
   if(typeof r.nextCursor!=='string'||!r.nextCursor||r.nextCursor.length>1024||seen.has(r.nextCursor))throw new Error('INVALID_OR_REPEATED_CURSOR');
   seen.add(r.nextCursor);cursor=r.nextCursor;
  }
  throw new Error('PAGE_LIMIT');
 };
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('DISCOVERY_TIMEOUT'));},timeoutMs)});
 try{return await Promise.race([operation(),timeout]);}finally{clearTimeout(timer);controller.abort();}
}
