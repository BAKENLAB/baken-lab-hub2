-- Disposable database only. Synthetic evidence; no official data or predictions.
set role service_role;
do $$
declare d date:=(clock_timestamp() at time zone 'Asia/Tokyo')::date-1;
 ref text; k text; rec jsonb; v jsonb; rejected boolean:=false;
begin
 ref:='pw01sde10032026020105'||replace(d::text,'-','')||'/AA';
 k:='JUMP_RESULT_V2|'||d::text||'|福島|5|'||ref;
 rec:=jsonb_build_object('key',k,'digest',repeat('a',64),'result',jsonb_build_object('source_ref',ref,'race_date',d,'track','福島','race_no',5,'jump',false,'official_proof',jsonb_build_object('parser_version','JUMP_RESULT_V2','html_sha256',repeat('b',64),'fetched_at',clock_timestamp()-interval '1 minute')));
 if public.jra_jump_history_cache_read_v1(k) is not null then raise exception 'cache unexpectedly populated';end if;
 if not public.jra_jump_history_cache_append_v1(rec) or not public.jra_jump_history_cache_append_v1(rec) then raise exception 'cache append failed';end if;
 if (select count(*) from private.jra_jump_verified_history_v1 where cache_key=k)<>1 or public.jra_jump_history_cache_read_v1(k) is distinct from rec then raise exception 'cache idempotence failed';end if;
 v:=jsonb_set(jsonb_set(rec,'{digest}',to_jsonb(repeat('c',64))),'{result,official_proof,fetched_at}',to_jsonb(clock_timestamp()-interval '1 second'));
 if not public.jra_jump_history_cache_append_v1(v) then raise exception 'cache version append failed';end if;
 if (select count(*) from private.jra_jump_verified_history_v1 where cache_key=k)<>2 or public.jra_jump_history_cache_read_v1(k) is distinct from v then raise exception 'cache latest/version preservation failed';end if;
 begin perform public.jra_jump_history_cache_append_v1(jsonb_set(rec,'{result,race_date}',to_jsonb(d+1)));exception when others then if sqlerrm not like '%JUMP_CACHE_SCOPE%' then raise;end if;rejected:=true;end;
 if not rejected then raise exception 'same day accepted';end if;
 if has_table_privilege('service_role','private.jra_jump_verified_history_v1','UPDATE') or has_table_privilege('service_role','private.jra_jump_verified_history_v1','DELETE') or has_function_privilege('anon','public.jra_jump_history_cache_read_v1(text)','EXECUTE') or has_function_privilege('authenticated','public.jra_jump_history_cache_append_v1(jsonb)','EXECUTE') then raise exception 'cache ACL failed';end if;
 raise notice 'PASS cache append/read/idempotence/version retention/today rejection/ACL';
end $$;
reset role;
