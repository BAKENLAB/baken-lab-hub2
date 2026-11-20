select version,is_active,created_at,updated_at,content from public.lab_prediction_protocols where protocol_key='JRA_MAIN' order by is_active desc,created_at desc limit 3;
