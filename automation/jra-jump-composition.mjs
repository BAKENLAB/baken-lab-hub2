// Development composition root. Do not register in a deployed MCP until the
// independent calendar source and official reader are validated and activated.
import {createOfficialJumpReader} from './jra-jump-official-reader.mjs';
import {makeJraResultCollector} from './jra-jump-official-history.mjs';
import {makeJumpHistoryReader} from './jra-jump-history-reader.mjs';
import {makeSupabaseJumpPorts} from './jra-jump-supabase-ports.mjs';
import {registerJumpTools} from './jra-jump-mcp-registration.mjs';
export function mountJumpCandidate({server,z,client,authorize,load,readOfficialDraw,cancellationReader,expectedMeetingsReader,verifiedResultReader,fetcher=fetch}){
 if([authorize,load,readOfficialDraw,cancellationReader,expectedMeetingsReader,verifiedResultReader,fetcher].some(fn=>typeof fn!=='function'))throw Error('JUMP_REQUIRED_SERVER_SOURCE_UNAVAILABLE');
 // Reader is read-only and uses bounded fetch. VerifiedResultReader must
 // prove exact race identity, complete official result and historical date
 // for every archived/cached result, or reject. Never fill from market data.
 const officialReader=createOfficialJumpReader({load,readOfficialDraw,cancellationReader,fetcher});
 const historyReader=async raw=>{
   const collector=makeJraResultCollector({load,fetcher,expectedMeetingsReader});
   return makeJumpHistoryReader({calendarReader:collector.calendar,resultReader:async(ref,asOf)=>verifiedResultReader({ref,asOf,readOfficial:collector.result})})(raw);
 };
 const ports=makeSupabaseJumpPorts({client,authorize,officialReader,historyReader});
 registerJumpTools(server,z,ports);
}
