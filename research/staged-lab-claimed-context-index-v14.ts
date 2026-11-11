import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {createHandler} from "./handler.mjs";
import {createLocalCornerServiceRpcStore} from "../../../automation/local-corner-service-rpc-store.mjs";
import {makeLocalClaimedCornerLookup} from "../../../automation/local-corner-claimed-lookup.mjs";
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const url=Deno.env.get('SUPABASE_URL');
// Only authorised service_role RPCs read optional pre-CLAIM evidence.
// The service credential is never returned, logged or supplied to the client.
if(!url||!serviceKey)throw new Error('Missing server configuration');
const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const store=createLocalCornerServiceRpcStore({client,timeoutMs:180});
const preclaimLookup=makeLocalClaimedCornerLookup({store});
Deno.serve(createHandler({client,serviceKey,preclaimLookup}));
