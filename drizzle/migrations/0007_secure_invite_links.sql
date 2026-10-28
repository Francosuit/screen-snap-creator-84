ALTER TABLE public.hotel_invites
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS hotel_invites_token_key ON public.hotel_invites(token);

-- Owner-side guard: token/acceptance fields cannot be forged; expiry max 30 days
CREATE OR REPLACE FUNCTION public.suite_guard_invite() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('suite.accepting', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.token := gen_random_uuid(); NEW.accepted_at := NULL; NEW.accepted_by := NULL; NEW.revoked_at := NULL;
  ELSE
    -- re-sending an invite renews the link and clears acceptance
    IF NEW.revoked_at IS NULL AND OLD.revoked_at IS NULL AND NEW.expires_at = OLD.expires_at THEN
      NEW.token := OLD.token; NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
    ELSIF NEW.revoked_at IS NULL THEN
      NEW.token := gen_random_uuid(); NEW.accepted_at := NULL; NEW.accepted_by := NULL;
    ELSE
      NEW.token := OLD.token; NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
    END IF;
  END IF;
  NEW.email := lower(trim(NEW.email));
  IF NEW.expires_at > now() + interval '30 days' THEN NEW.expires_at := now() + interval '30 days'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invites_guard ON public.hotel_invites;
CREATE TRIGGER invites_guard BEFORE INSERT OR UPDATE ON public.hotel_invites FOR EACH ROW EXECUTE FUNCTION public.suite_guard_invite();

-- Email-only auto-claim is retired: access is granted only through a valid link
CREATE OR REPLACE FUNCTION public.suite_claim_invites() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 0 $$;

CREATE OR REPLACE FUNCTION public.suite_invite_info(_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE i record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status','signin'); END IF;
  SELECT inv.*, h.name AS hotel_name INTO i FROM public.hotel_invites inv JOIN public.hotels h ON h.id = inv.hotel_id WHERE inv.token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
  IF i.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status','revoked'); END IF;
  IF i.accepted_at IS NOT NULL THEN RETURN jsonb_build_object('status','used','hotel',i.hotel_name); END IF;
  IF i.expires_at <= now() THEN RETURN jsonb_build_object('status','expired'); END IF;
  IF lower(auth.jwt()->>'email') IS DISTINCT FROM i.email THEN RETURN jsonb_build_object('status','wrong_email'); END IF;
  RETURN jsonb_build_object('status','ok','hotel',i.hotel_name,'role',i.role,'position',i.position);
END $$;

CREATE OR REPLACE FUNCTION public.suite_accept_invite(_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record; em text := lower(auth.jwt()->>'email');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para aceptar la invitación'; END IF;
  SELECT * INTO i FROM public.hotel_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND OR i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invitación no válida o anulada'; END IF;
  IF i.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Esta invitación ya se usó'; END IF;
  IF i.expires_at <= now() THEN RAISE EXCEPTION 'La invitación ha caducado'; END IF;
  IF em IS DISTINCT FROM i.email THEN RAISE EXCEPTION 'Esta invitación es para otro correo'; END IF;
  IF EXISTS (SELECT 1 FROM public.hotels WHERE id = i.hotel_id AND org_owner = auth.uid()) THEN RAISE EXCEPTION 'Ya eres propietario de este hotel'; END IF;
  INSERT INTO public.hotel_members(hotel_id, user_id, role, full_name, email, position, modules)
    VALUES (i.hotel_id, auth.uid(), i.role, i.full_name, em, i.position, i.modules)
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, email = EXCLUDED.email, position = EXCLUDED.position, modules = EXCLUDED.modules;
  PERFORM set_config('suite.accepting','on',true);
  UPDATE public.hotel_invites SET accepted_at = now(), accepted_by = auth.uid() WHERE hotel_id = i.hotel_id AND email = i.email;
  PERFORM set_config('suite.accepting','off',true);
  RETURN jsonb_build_object('hotel_id', i.hotel_id, 'role', i.role);
END $$;

REVOKE EXECUTE ON FUNCTION public.suite_invite_info(uuid), public.suite_accept_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_invite_info(uuid), public.suite_accept_invite(uuid) TO authenticated;