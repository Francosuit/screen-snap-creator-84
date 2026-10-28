ALTER TABLE public.hotel_invites ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE public.hotel_invites ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT '';
ALTER TABLE public.hotel_members ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE public.hotel_members ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.hotel_members ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT '';
ALTER TABLE public.hotel_members ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.hotel_members ADD COLUMN IF NOT EXISTS modules text[];
ALTER TABLE public.hotel_invites ADD COLUMN IF NOT EXISTS modules text[];

-- Modules each job role may ever reach; per-person modules are clamped to this
CREATE OR REPLACE FUNCTION public.suite_role_modules(_role public.hotel_role) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE _role
    WHEN 'owner' THEN ARRAY['dashboard','hotel','reservas','habitaciones','control','personal','tareas','huespedes','mensajes','integraciones','configuracion']
    WHEN 'director' THEN ARRAY['dashboard','hotel','reservas','habitaciones','control','personal','tareas','huespedes','mensajes','integraciones','configuracion']
    WHEN 'reception' THEN ARRAY['hotel','reservas','habitaciones','huespedes','mensajes','tareas']
    WHEN 'housekeeping' THEN ARRAY['hotel','habitaciones','tareas']
    WHEN 'maintenance' THEN ARRAY['hotel','habitaciones','tareas']
    WHEN 'revenue' THEN ARRAY['dashboard','reservas','habitaciones','control']
  END
$$;

CREATE OR REPLACE FUNCTION public.suite_clamp_modules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.role = 'owner' THEN RAISE EXCEPTION 'Owner access cannot be granted to staff' USING ERRCODE='42501'; END IF;
  IF NEW.modules IS NOT NULL THEN
    NEW.modules := ARRAY(SELECT m FROM unnest(NEW.modules) m WHERE m = ANY(public.suite_role_modules(NEW.role)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER members_clamp_modules BEFORE INSERT OR UPDATE ON public.hotel_members FOR EACH ROW EXECUTE FUNCTION public.suite_clamp_modules();
CREATE TRIGGER invites_clamp_modules BEFORE INSERT OR UPDATE ON public.hotel_invites FOR EACH ROW EXECUTE FUNCTION public.suite_clamp_modules();

-- Deactivated staff lose every permission immediately; their history stays
CREATE OR REPLACE FUNCTION public.has_hotel_role(_hotel uuid, _uid uuid, _roles public.hotel_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = _hotel AND h.org_owner = _uid)
      OR EXISTS (SELECT 1 FROM public.hotel_members m WHERE m.hotel_id = _hotel AND m.user_id = _uid AND m.active AND m.role = ANY(_roles))
$$;

-- Module check for backend use: owner always; active member if role allows it and (no custom list or listed)
CREATE OR REPLACE FUNCTION public.suite_can_access(_hotel uuid, _module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id=_hotel AND h.org_owner=auth.uid())
      OR EXISTS (SELECT 1 FROM public.hotel_members m WHERE m.hotel_id=_hotel AND m.user_id=auth.uid() AND m.active
                 AND _module = ANY(public.suite_role_modules(m.role)) AND (m.modules IS NULL OR _module = ANY(m.modules)))
$$;
REVOKE ALL ON FUNCTION public.suite_can_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_can_access(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.suite_claim_invites() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text := lower(auth.jwt()->>'email'); n int;
BEGIN
  IF auth.uid() IS NULL OR em IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.hotel_members(hotel_id, user_id, role, full_name, email, position, modules)
    SELECT hotel_id, auth.uid(), role, full_name, em, position, modules FROM public.hotel_invites WHERE lower(email) = em
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, email = EXCLUDED.email, position = EXCLUDED.position, modules = EXCLUDED.modules;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.suite_claim_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_claim_invites() TO authenticated;