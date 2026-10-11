SELECT to_regnamespace('jra_evidence_private') IS NULL AS schema_absent, to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') IS NULL AS rpc_absent;
