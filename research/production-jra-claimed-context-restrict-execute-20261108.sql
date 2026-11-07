-- Harden the privileged JRA claimed-context RPC.
-- The only known sanctioned caller is jra-claimed-mcp using service_role.
-- Keep existing guard clauses, function code and FROZEN unchanged.
REVOKE EXECUTE ON FUNCTION public.jra_claimed_context(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jra_claimed_context(uuid)
  TO service_role;
