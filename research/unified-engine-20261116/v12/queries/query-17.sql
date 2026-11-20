select race_key,cname,source_url,fetched_at,recorded_at,html_sha256,html_bytes,extractor_version,status_basis,official_status_verified from public.jra_html_evidence order by id desc limit 1;
