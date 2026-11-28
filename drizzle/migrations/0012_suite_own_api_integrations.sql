-- Suite Hotel OS own API. Additive only: no existing table, row or reservation is changed.
CREATE TABLE public.suite_api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  property_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  permissions text[] NOT NULL DEFAULT ARRAY['reservations:read','reservations:write'],
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL,
  api_key_ciphertext text NOT NULL,
  signing_secret_ciphertext text NOT NULL,
  request_limit_per_minute integer NOT NULL DEFAULT 120 CHECK (request_limit_per_minute BETWEEN 1 AND 10000),
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
CREATE TABLE public.suite_api_mappings (
  integration_id uuid NOT NULL REFERENCES public.suite_api_integrations(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  external_code text NOT NULL,
  room_number text NOT NULL,
  PRIMARY KEY (integration_id, external_code)
);
CREATE TABLE public.suite_api_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.suite_api_integrations(id) ON DELETE SET NULL,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL CHECK (status IN ('processing','applied','duplicate','ignored','rejected','pending')),
  payload_hash text NOT NULL,
  response jsonb,
  http_status integer,
  error_code text,
  reservation_id text,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (integration_id, event_id)
);
CREATE TABLE public.suite_api_rate_buckets (
  integration_id uuid NOT NULL REFERENCES public.suite_api_integrations(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (integration_id, window_start)
);

GRANT SELECT ON public.suite_api_integrations, public.suite_api_mappings, public.suite_api_events TO authenticated;
GRANT ALL ON public.suite_api_integrations, public.suite_api_mappings, public.suite_api_events, public.suite_api_rate_buckets TO service_role;
ALTER TABLE public.suite_api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_api_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_api_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_api_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY suite_api_integrations_read ON public.suite_api_integrations FOR SELECT TO authenticated USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE POLICY suite_api_mappings_read ON public.suite_api_mappings FOR SELECT TO authenticated USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE POLICY suite_api_events_read ON public.suite_api_events FOR SELECT TO authenticated USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE INDEX suite_api_integrations_hotel ON public.suite_api_integrations(hotel_id, created_at DESC);
CREATE INDEX suite_api_mappings_hotel ON public.suite_api_mappings(hotel_id, integration_id);
CREATE INDEX suite_api_events_hotel_at ON public.suite_api_events(hotel_id, received_at DESC);
CREATE INDEX suite_api_events_integration_at ON public.suite_api_events(integration_id, received_at DESC);

CREATE OR REPLACE FUNCTION public.suite_api_integration_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id=NEW.hotel_id AND h.org_owner=NEW.organization_id AND NOT h.archived) THEN RAISE EXCEPTION 'Invalid API hotel scope' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.hotel_id,NEW.organization_id,NEW.property_id) IS DISTINCT FROM (OLD.hotel_id,OLD.organization_id,OLD.property_id) THEN RAISE EXCEPTION 'Immutable API hotel scope' USING ERRCODE='42501'; END IF;
  IF NEW.name !~ '^.{2,100}$' OR NEW.property_id !~ '^suite-[0-9a-f-]{36}$' OR NEW.key_prefix !~ '^sk_suite_[a-f0-9]{16}$' OR NEW.key_hash !~ '^[a-f0-9]{64}$' OR NEW.api_key_ciphertext !~ '^v1\.' OR NEW.signing_secret_ciphertext !~ '^v1\.' THEN RAISE EXCEPTION 'Invalid API integration'; END IF;
  IF NEW.permissions <@ ARRAY['reservations:read','reservations:write','availability:read']::text[] AND array_length(NEW.permissions,1) >= 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid API permissions';
END $$;
CREATE TRIGGER suite_api_integration_guard BEFORE INSERT OR UPDATE ON public.suite_api_integrations FOR EACH ROW EXECUTE FUNCTION public.suite_api_integration_guard();
CREATE OR REPLACE FUNCTION public.suite_api_mapping_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.suite_api_integrations i WHERE i.id=NEW.integration_id AND i.hotel_id=NEW.hotel_id) OR NOT EXISTS (SELECT 1 FROM public.hotel_rooms r WHERE r.hotel_id=NEW.hotel_id AND r.number=NEW.room_number AND NOT r.archived) OR NEW.external_code !~ '^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'Invalid API room mapping' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER suite_api_mapping_guard BEFORE INSERT OR UPDATE ON public.suite_api_mappings FOR EACH ROW EXECUTE FUNCTION public.suite_api_mapping_guard();

CREATE OR REPLACE FUNCTION public.suite_create_api_integration(_id uuid,_hotel uuid,_name text,_permissions text[],_key_prefix text,_key_hash text,_api_key_ciphertext text,_secret text,_created_by uuid,_mappings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m jsonb; org uuid;
BEGIN
  SELECT h.org_owner INTO org FROM public.hotels h WHERE h.id=_hotel AND NOT h.archived;
  IF org IS NULL OR jsonb_typeof(_mappings)<>'array' OR jsonb_array_length(_mappings)>100 THEN RAISE EXCEPTION 'Invalid API hotel or mappings' USING ERRCODE='42501'; END IF;
  INSERT INTO public.suite_api_integrations(id,hotel_id,organization_id,name,property_id,permissions,key_prefix,key_hash,api_key_ciphertext,signing_secret_ciphertext,created_by) VALUES(_id,_hotel,org,_name,'suite-'||_id::text,_permissions,_key_prefix,_key_hash,_api_key_ciphertext,_secret,_created_by);
  FOR m IN SELECT value FROM jsonb_array_elements(_mappings) LOOP INSERT INTO public.suite_api_mappings(integration_id,hotel_id,external_code,room_number) VALUES(_id,_hotel,m->>'externalCode',m->>'roomNumber'); END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.suite_configure_api_integration(_integration uuid,_hotel uuid,_name text,_permissions text[],_mappings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.suite_api_integrations i WHERE i.id=_integration AND i.hotel_id=_hotel AND i.status='active') OR jsonb_typeof(_mappings)<>'array' OR jsonb_array_length(_mappings)>100 THEN RAISE EXCEPTION 'API integration not active' USING ERRCODE='42501'; END IF;
  UPDATE public.suite_api_integrations SET name=_name,permissions=_permissions WHERE id=_integration AND hotel_id=_hotel;
  DELETE FROM public.suite_api_mappings WHERE integration_id=_integration AND hotel_id=_hotel;
  FOR m IN SELECT value FROM jsonb_array_elements(_mappings) LOOP INSERT INTO public.suite_api_mappings(integration_id,hotel_id,external_code,room_number) VALUES(_integration,_hotel,m->>'externalCode',m->>'roomNumber'); END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.suite_rotate_api_integration(_integration uuid,_hotel uuid,_prefix text,_hash text,_api_key_ciphertext text,_secret text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.suite_api_integrations SET key_prefix=_prefix,key_hash=_hash,api_key_ciphertext=_api_key_ciphertext,signing_secret_ciphertext=_secret,credential_version=credential_version+1,rotated_at=now(),last_used_at=NULL WHERE id=_integration AND hotel_id=_hotel AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION 'API integration not active' USING ERRCODE='42501'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.suite_revoke_api_integration(_integration uuid,_hotel uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.suite_api_integrations SET status='revoked',revoked_at=now() WHERE id=_integration AND hotel_id=_hotel AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION 'API integration not active' USING ERRCODE='42501'; END IF; END $$;

CREATE OR REPLACE FUNCTION public.suite_apply_api_reservation(_integration uuid,_expected_version bigint,_guest jsonb,_reservation jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h uuid; org uuid; current_data jsonb; current_version bigint; rid text; gid text; incoming_revision bigint; stored_revision bigint;
BEGIN
  SELECT i.hotel_id,i.organization_id INTO h,org FROM public.suite_api_integrations i WHERE i.id=_integration AND i.status='active' AND 'reservations:write'=ANY(i.permissions);
  IF h IS NULL OR NOT EXISTS(SELECT 1 FROM public.hotels x WHERE x.id=h AND x.org_owner=org AND NOT x.archived) THEN RAISE EXCEPTION 'API integration not authorized' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(_guest)<>'object' OR jsonb_typeof(_reservation)<>'object' THEN RAISE EXCEPTION 'Invalid API reservation'; END IF;
  rid=_reservation->>'id'; gid=_reservation->>'guestId';
  IF rid IS NULL OR rid !~ '^A-[A-Za-z0-9_-]{1,64}$' OR gid IS NULL OR gid !~ '^ga-[A-Za-z0-9_-]{1,64}$' OR _guest->>'id'<>gid OR COALESCE(_reservation->'external'->>'integrationId','')<>_integration::text OR COALESCE(_reservation->'external'->>'provider','')<>'suite' THEN RAISE EXCEPTION 'Invalid API reservation scope' USING ERRCODE='42501'; END IF;
  incoming_revision=COALESCE((_reservation->'external'->>'revisionId')::bigint,0);
  PERFORM pg_advisory_xact_lock(hashtextextended(h::text,0));
  SELECT r.data,r.version INTO current_data,current_version FROM public.hotel_reservations r WHERE r.hotel_id=h AND r.id=rid FOR UPDATE;
  IF current_data IS NOT NULL THEN
    IF COALESCE(current_data->'external'->>'integrationId','')<>_integration::text THEN RAISE EXCEPTION 'API reservation scope denied' USING ERRCODE='42501'; END IF;
    stored_revision=COALESCE((current_data->'external'->>'revisionId')::bigint,0);
    IF stored_revision>=incoming_revision THEN RETURN jsonb_build_object('status','duplicate','version',current_version); END IF;
  END IF;
  IF (_expected_version IS NULL AND current_data IS NOT NULL) OR (_expected_version IS NOT NULL AND (current_data IS NULL OR current_version<>_expected_version)) THEN RETURN jsonb_build_object('status','conflict'); END IF;
  IF current_data IS NULL THEN
    INSERT INTO public.hotel_guests(hotel_id,id,data) VALUES(h,gid,_guest) ON CONFLICT(hotel_id,id) DO UPDATE SET data=EXCLUDED.data;
    INSERT INTO public.hotel_reservations(hotel_id,id,data) VALUES(h,rid,_reservation);
  ELSE
    INSERT INTO public.hotel_guests(hotel_id,id,data) VALUES(h,gid,_guest) ON CONFLICT(hotel_id,id) DO UPDATE SET data=EXCLUDED.data;
    UPDATE public.hotel_reservations SET data=_reservation WHERE hotel_id=h AND id=rid;
  END IF;
  RETURN jsonb_build_object('status','applied','version',COALESCE(current_version,0)+1);
EXCEPTION WHEN SQLSTATE '23P01' THEN RETURN jsonb_build_object('status','overlap');
END $$;

CREATE OR REPLACE FUNCTION public.suite_api_claim_event(_integration uuid,_event_id text,_event_type text,_payload_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h uuid; new_id uuid; existing public.suite_api_events%ROWTYPE;
BEGIN
  SELECT i.hotel_id INTO h FROM public.suite_api_integrations i WHERE i.id=_integration AND i.status='active';
  IF h IS NULL OR _event_id IS NULL OR length(_event_id)>160 OR _payload_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid API event'; END IF;
  INSERT INTO public.suite_api_events(integration_id,hotel_id,event_id,event_type,direction,status,payload_hash) VALUES(_integration,h,_event_id,_event_type,'inbound','processing',_payload_hash) ON CONFLICT(integration_id,event_id) DO NOTHING RETURNING id INTO new_id;
  IF new_id IS NOT NULL THEN RETURN jsonb_build_object('kind','claimed'); END IF;
  SELECT * INTO existing FROM public.suite_api_events WHERE integration_id=_integration AND event_id=_event_id FOR UPDATE;
  IF existing.payload_hash<>_payload_hash THEN RETURN jsonb_build_object('kind','conflict'); END IF;
  IF existing.status='processing' AND existing.received_at>now()-interval '5 minutes' THEN RETURN jsonb_build_object('kind','busy'); END IF;
  IF existing.status<>'processing' THEN RETURN jsonb_build_object('kind','replay','response',existing.response,'httpStatus',existing.http_status); END IF;
  UPDATE public.suite_api_events SET status='processing',received_at=now(),processed_at=NULL,attempts=attempts+1 WHERE id=existing.id;
  RETURN jsonb_build_object('kind','claimed');
END $$;
CREATE OR REPLACE FUNCTION public.suite_api_finish_event(_integration uuid,_event_id text,_status text,_http_status integer,_error_code text,_reservation_id text,_response jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.suite_api_events SET status=_status,http_status=_http_status,error_code=_error_code,reservation_id=_reservation_id,response=_response,processed_at=now() WHERE integration_id=_integration AND event_id=_event_id; IF NOT FOUND THEN RAISE EXCEPTION 'API event missing'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.suite_api_consume_rate_limit(_integration uuid,_limit integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.suite_api_rate_buckets(integration_id,window_start,request_count) VALUES(_integration,date_trunc('minute',now()),1)
  ON CONFLICT(integration_id,window_start) DO UPDATE SET request_count=suite_api_rate_buckets.request_count+1 RETURNING request_count INTO n;
  RETURN n<=_limit;
END $$;

REVOKE ALL ON FUNCTION public.suite_create_api_integration(uuid,uuid,text,text[],text,text,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_configure_api_integration(uuid,uuid,text,text[],jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_rotate_api_integration(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_revoke_api_integration(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_apply_api_reservation(uuid,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_api_claim_event(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_api_finish_event(uuid,text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suite_api_consume_rate_limit(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suite_create_api_integration(uuid,uuid,text,text[],text,text,text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_configure_api_integration(uuid,uuid,text,text[],jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_rotate_api_integration(uuid,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_revoke_api_integration(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_apply_api_reservation(uuid,bigint,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_api_claim_event(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_api_finish_event(uuid,text,text,integer,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.suite_api_consume_rate_limit(uuid,integer) TO service_role;
COMMENT ON TABLE public.suite_api_integrations IS 'Own Suite API credentials; hashes and backend-only encrypted credentials, never plaintext.';
COMMENT ON TABLE public.suite_api_events IS 'Metadata-only durable API event journal; no guest payloads or credentials.';
