-- DEVELOPMENT ONLY: isolated history storage; never apply to production without approval.
begin;
create schema if not exists private;
create table private.jra_jump_verified_history_v1 (
 cache_key text not null,
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 fetched_at timestamptz not null,
 record jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(cache_key,digest)
);
alter table private.jra_jump_verified_history_v1 enable row level security;
revoke all on private.jra_jump_verified_history_v1 from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant select,insert on private.jra_jump_verified_history_v1 to service_role;
create policy jump_cache_read_service on private.jra_jump_verified_history_v1 for select to service_role using(true);
create policy jump_cache_insert_service on private.jra_jump_verified_history_v1 for insert to service_role with check(true);
create function public.jra_jump_history_cache_read_v1(p_key text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,private as $$
declare v jsonb;
begin
 if current_user<>'service_role' then raise exception 'JUMP_SERVICE_ROLE_REQUIRED'; end if;
 if p_key is null or length(p_key)>180 or p_key not like 'JUMP_RESULT_V2|%' then raise exception 'JUMP_CACHE_KEY'; end if;
 select record into v from private.jra_jump_verified_history_v1 where cache_key=p_key order by fetched_at desc,created_at desc,digest desc limit 1;
 return v;
end $$;
create function public.jra_jump_history_cache_append_v1(p_record jsonb)
returns boolean language plpgsql security invoker set search_path=pg_catalog,private as $$
declare r jsonb:=p_record->'result'; v_key text:=p_record->>'key'; v_digest text:=p_record->>'digest'; v_date date; v_fetched timestamptz;
begin
 if current_user<>'service_role' then raise exception 'JUMP_SERVICE_ROLE_REQUIRED'; end if;
 if jsonb_typeof(p_record) is distinct from 'object' or pg_column_size(p_record)>131072 or v_digest is null or v_digest !~ '^[0-9a-f]{64}$'
 or jsonb_typeof(r) is distinct from 'object' or r->'official_proof'->>'parser_version' is distinct from 'JUMP_RESULT_V2'
 or r->'official_proof'->>'html_sha256' is null or r->'official_proof'->>'html_sha256' !~ '^[0-9a-f]{64}$'
 or coalesce(r->>'source_ref','') !~ '^pw01sde(01|10)[0-9]+/[0-9A-Fa-f]{2}$' then raise exception 'JUMP_CACHE_PROOF'; end if;
 v_date:=(r->>'race_date')::date; v_fetched:=(r->'official_proof'->>'fetched_at')::timestamptz;
 if v_date is null or v_date>=(clock_timestamp() at time zone 'Asia/Tokyo')::date or v_fetched is null or v_fetched>clock_timestamp()
 or v_key is distinct from concat_ws('|','JUMP_RESULT_V2',r->>'race_date',r->>'track',r->>'race_no',r->>'source_ref') then raise exception 'JUMP_CACHE_SCOPE'; end if;
 insert into private.jra_jump_verified_history_v1(cache_key,digest,fetched_at,record) values(v_key,v_digest,v_fetched,p_record) on conflict(cache_key,digest) do nothing;
 return true;
end $$;
revoke all on function public.jra_jump_history_cache_read_v1(text) from public,anon,authenticated;
revoke all on function public.jra_jump_history_cache_append_v1(jsonb) from public,anon,authenticated;
grant execute on function public.jra_jump_history_cache_read_v1(text) to service_role;
grant execute on function public.jra_jump_history_cache_append_v1(jsonb) to service_role;
commit;
