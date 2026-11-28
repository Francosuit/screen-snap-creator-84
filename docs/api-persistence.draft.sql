-- DRAFT ONLY: NOT APPLIED, NOT REGISTERED AS A MIGRATION.
-- Requires explicit authorization and isolated database integration tests.
-- Credentials remain encrypted in managed server secret storage; only references
-- are stored here. No hotel data is seeded or modified by this draft.

-- Organization identity is hotels.org_owner, NOT a new organization system.
-- Verified caller comes exclusively from auth.uid(), never a request userId.
CREATE FUNCTION public.suite_api_can_access(_hotel uuid, _organization uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = _hotel AND h.org_owner = _organization AND NOT h.archived
      AND (h.org_owner = (select auth.uid()) OR EXISTS (
        SELECT 1 FROM public.hotel_members m
        WHERE m.hotel_id = h.id AND m.user_id = (select auth.uid())
          AND m.active AND m.role = 'director'
          AND 'integraciones' = ANY(m.modules)
      ))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.suite_api_can_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_api_can_access(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.suite_api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id),
  authorized_user_id uuid NOT NULL,
  provider_id text NOT NULL CHECK (length(provider_id) BETWEEN 1 AND 160),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  external_property_id text NOT NULL CHECK (length(external_property_id) BETWEEN 1 AND 160),
  credential_ref text NOT NULL CHECK (length(credential_ref) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'unconfigured'
    CHECK (status IN ('unconfigured', 'connected', 'disabled', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, hotel_id, id),
  UNIQUE (provider_id, environment, external_property_id)
);
GRANT SELECT ON public.suite_api_connections TO authenticated;
GRANT ALL ON public.suite_api_connections TO service_role;
ALTER TABLE public.suite_api_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_connections_read ON public.suite_api_connections FOR SELECT TO authenticated
  USING (authorized_user_id = (select auth.uid())
    AND public.suite_api_can_access(hotel_id, organization_id));
CREATE INDEX api_connections_user_hotel_idx ON public.suite_api_connections (authorized_user_id, hotel_id, updated_at DESC);
CREATE INDEX api_connections_hotel_idx ON public.suite_api_connections (hotel_id);

-- Protect the authoritative hotel/company relation even on service writes.
CREATE FUNCTION public.suite_api_check_connection_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hotels h
    WHERE h.id = NEW.hotel_id AND h.org_owner = NEW.organization_id AND NOT h.archived)
  THEN RAISE EXCEPTION 'Invalid API hotel organization' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND
    (NEW.organization_id, NEW.hotel_id, NEW.provider_id, NEW.environment, NEW.external_property_id)
      IS DISTINCT FROM
    (OLD.organization_id, OLD.hotel_id, OLD.provider_id, OLD.environment, OLD.external_property_id)
  THEN RAISE EXCEPTION 'API connection scope is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.suite_api_check_connection_scope() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suite_api_check_connection_scope() TO service_role;
CREATE TRIGGER api_connection_scope BEFORE INSERT OR UPDATE ON public.suite_api_connections
  FOR EACH ROW EXECUTE FUNCTION public.suite_api_check_connection_scope();

CREATE TABLE public.suite_api_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('reservations.pull', 'reservation.upsert',
    'reservation.cancel', 'availability.push', 'rates.push', 'restrictions.push')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 160),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'uncertain')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  error_code text CHECK (error_code IN ('provider_auth', 'rate_limit', 'unavailable', 'invalid_data', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  FOREIGN KEY (organization_id, hotel_id, connection_id)
    REFERENCES public.suite_api_connections(organization_id, hotel_id, id),
  UNIQUE (organization_id, hotel_id, connection_id, operation, idempotency_key),
  UNIQUE (organization_id, hotel_id, connection_id, id)
);
GRANT SELECT ON public.suite_api_runs TO authenticated;
GRANT ALL ON public.suite_api_runs TO service_role;
ALTER TABLE public.suite_api_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_runs_read ON public.suite_api_runs FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.suite_api_connections));
CREATE INDEX api_runs_hotel_date_idx ON public.suite_api_runs (hotel_id, created_at DESC);
CREATE INDEX api_runs_connection_idx ON public.suite_api_runs (connection_id, created_at DESC);

CREATE TABLE public.suite_api_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  run_id uuid NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  phase text NOT NULL CHECK (phase IN ('started', 'failed')),
  error_code text CHECK (error_code IN ('provider_auth', 'rate_limit', 'unavailable', 'invalid_data', 'unknown')),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (organization_id, hotel_id, connection_id, run_id)
    REFERENCES public.suite_api_runs(organization_id, hotel_id, connection_id, id),
  UNIQUE (run_id, attempt, phase)
);
GRANT SELECT ON public.suite_api_attempts TO authenticated;
GRANT ALL ON public.suite_api_attempts TO service_role;
ALTER TABLE public.suite_api_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_attempts_read ON public.suite_api_attempts FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.suite_api_connections));
CREATE INDEX api_attempts_scope_run_idx ON public.suite_api_attempts (organization_id, hotel_id, connection_id, run_id);
CREATE INDEX api_attempts_hotel_date_idx ON public.suite_api_attempts (hotel_id, occurred_at DESC);
CREATE INDEX api_attempts_connection_idx ON public.suite_api_attempts (connection_id);

CREATE TABLE public.suite_api_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  external_event_id text NOT NULL CHECK (length(external_event_id) BETWEEN 1 AND 160),
  body_digest text NOT NULL CHECK (body_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'applied', 'failed', 'uncertain')),
  error_code text CHECK (error_code IN ('provider_auth', 'rate_limit', 'unavailable', 'invalid_data', 'unknown')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  FOREIGN KEY (organization_id, hotel_id, connection_id)
    REFERENCES public.suite_api_connections(organization_id, hotel_id, id),
  UNIQUE (connection_id, external_event_id)
);
GRANT SELECT ON public.suite_api_webhook_events TO authenticated;
GRANT ALL ON public.suite_api_webhook_events TO service_role;
ALTER TABLE public.suite_api_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_webhooks_read ON public.suite_api_webhook_events FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.suite_api_connections));
CREATE INDEX api_webhooks_scope_idx ON public.suite_api_webhook_events (organization_id, hotel_id, connection_id);
CREATE INDEX api_webhooks_hotel_date_idx ON public.suite_api_webhook_events (hotel_id, received_at DESC);

CREATE TABLE public.suite_api_external_mappings (
  organization_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  entity_kind text NOT NULL CHECK (entity_kind IN ('reservation', 'room_type', 'rate_plan', 'guest')),
  external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 160),
  local_id text NOT NULL CHECK (length(local_id) BETWEEN 1 AND 160),
  external_revision text CHECK (length(external_revision) BETWEEN 1 AND 160),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, entity_kind, external_id),
  FOREIGN KEY (organization_id, hotel_id, connection_id)
    REFERENCES public.suite_api_connections(organization_id, hotel_id, id)
);
GRANT SELECT ON public.suite_api_external_mappings TO authenticated;
GRANT ALL ON public.suite_api_external_mappings TO service_role;
ALTER TABLE public.suite_api_external_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_mappings_read ON public.suite_api_external_mappings FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.suite_api_connections));
CREATE INDEX api_mappings_scope_idx ON public.suite_api_external_mappings (organization_id, hotel_id, connection_id);
CREATE INDEX api_mappings_hotel_idx ON public.suite_api_external_mappings (hotel_id);

-- REQUIRED BEFORE ACTIVATION (not supplied/validated by this structural draft):
-- 1. Authenticated atomic claim/journal/finish RPCs checking digest before replay;
--    never reclaim running/uncertain operations after a crash.
-- 2. A SECURITY INVOKER transaction using suite_apply_operations and the same
--    hotel advisory lock to commit PMS changes + mapping + revision/result.
-- 3. Webhook service writes must recheck connection scope, current membership,
--    modules and verified signature before touching PMS. Never use caller IDs.
-- 4. ACK only after durable commit; a lost ACK is reconciled from saved revision.
-- 5. RLS tests with two real test identities; failure/crash recovery tests.
-- No raw provider bodies, guest PII, payment card data, or secrets in these tables.