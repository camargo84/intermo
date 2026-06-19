
-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, keep authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_month_contract_count() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_month_contract_count() TO authenticated, service_role;

-- Add explicit deny policies for server-only tables (rate_limits, webhook_events)
-- so the RLS-enabled-no-policy linter passes. service_role bypasses RLS.
CREATE POLICY "No client access to rate_limits"
  ON public.rate_limits FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No client access to webhook_events"
  ON public.webhook_events FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Block client writes to subscriptions (reads are already governed by existing SELECT policy)
CREATE POLICY "No client writes to subscriptions (insert)"
  ON public.subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "No client writes to subscriptions (update)"
  ON public.subscriptions FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No client writes to subscriptions (delete)"
  ON public.subscriptions FOR DELETE
  TO anon, authenticated
  USING (false);
