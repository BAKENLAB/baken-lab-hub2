import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {createHandler} from "./handler.mjs";
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const url=Deno.env.get('SUPABASE_URL');
// No RPC or write methods are used. Service credential is never returned/logged.
if(!url||!serviceKey)throw new Error('Missing server configuration');
const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({client,serviceKey}));
