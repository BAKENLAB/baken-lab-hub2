// Development composition root. Do not register in a deployed MCP until the
// independent calendar source and official reader are validated and activated.
import {createOfficialJumpReader} from './jra-jump-official-reader.mjs';
import {makeJraResultCollector} from './jra-jump-official-history.mjs';
import {makeJumpHistoryReader} from './jra-jump-history-reader.mjs';
import {makeSupabaseJumpPorts} from './jra-jump-supabase-ports.mjs';
import {makeVerifiedResultReader} from './jra-jump-verified-cache.mjs';
import {makeSupabaseHistoryStore} from './jra-jump-cache-store.mjs';
import {registerJumpTools} from './jra-jump-mcp-registration.mjs';
export function mountJumpCandidate({server,z,client,authorize,load,readOfficialDraw,cancellationReader,expectedMeetingsReader,fetcher=fetch}){
 if([authorize,load,readOfficialDraw,cancellationReader,expectedMeetingsReader,fetcher].some(fn=>typeof fn!=='function'))throw Error('JUMP_REQUIRED_SERVER_SOURCE_UNAVAILABLE');
 // Read only bounded official fetch; the verified append-only cache is server-owned.
 const officialReader=createOfficialJumpReader({load,readOfficialDraw,cancellationReader,fetcher});
 const historyReader=async raw=>{
   const collector=makeJraResultCollector({load,fetcher,expectedMeetingsReader});
   const cache=makeVerifiedResultReader({store:makeSupabaseHistoryStore(client)});
   return makeJumpHistoryReader({calendarReader:collector.calendar,resultReader:(ref,asOf)=>cache.read({ref,asOf,readOfficial:collector.result})})(raw);
 };
 const ports=makeSupabaseJumpPorts({client,authorize,officialReader,historyReader});
 registerJumpTools(server,z,ports);
}
