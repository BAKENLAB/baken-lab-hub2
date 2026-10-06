-- Execute only after stopping NEW queue/save entries and resolving live claims.
-- Original LOCAL RPCs and all FROZEN rows remain intact.
BEGIN;
DROP FUNCTION public.lab_queue_claim_next_v1(text);
DROP FUNCTION public.lab_queue_save_prediction_v1(uuid,uuid,text,jsonb,jsonb);
-- Retain receipt evidence. No receipt/prediction/job/run DELETE.
REVOKE ALL ON public.lab_local_queue_save_receipts FROM service_role;
COMMIT;
