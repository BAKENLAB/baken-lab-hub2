select rolname,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname;
