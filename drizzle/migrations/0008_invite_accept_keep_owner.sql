CREATE OR REPLACE FUNCTION public.suite_accept_invite(_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record; em text := lower(auth.jwt()->>'email');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para aceptar'; END IF;
  SELECT * INTO i FROM public.hotel_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND OR i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invitación no válida o anulada'; END IF;
  IF i.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Esta invitación ya se usó'; END IF;
  IF i.expires_at <= now() THEN RAISE EXCEPTION 'La invitación ha caducado'; END IF;
  IF em IS DISTINCT FROM i.email THEN RAISE EXCEPTION 'Esta invitación es para otro correo'; END IF;
  IF i.role = 'owner' THEN RAISE EXCEPTION 'Invitación no válida'; END IF;
  IF EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = i.hotel_id AND h.org_owner = auth.uid())
     OR EXISTS (SELECT 1 FROM public.hotel_members m WHERE m.hotel_id = i.hotel_id AND m.user_id = auth.uid() AND m.role = 'owner') THEN
    RAISE EXCEPTION 'Ya eres propietario de este hotel';
  END IF;
  INSERT INTO public.hotel_members(hotel_id, user_id, role, full_name, email, position, modules)
    VALUES (i.hotel_id, auth.uid(), i.role, i.full_name, em, i.position, i.modules)
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, email = EXCLUDED.email, position = EXCLUDED.position, modules = EXCLUDED.modules;
  UPDATE public.hotel_invites SET accepted_at = now(), accepted_by = auth.uid() WHERE hotel_id = i.hotel_id AND email = i.email;
  RETURN jsonb_build_object('hotel_id', i.hotel_id, 'role', i.role);
END $$;
REVOKE EXECUTE ON FUNCTION public.suite_accept_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_accept_invite(uuid) TO authenticated;