CREATE TABLE public.hotel_invites (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.hotel_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_invites TO authenticated;
GRANT ALL ON public.hotel_invites TO service_role;
ALTER TABLE public.hotel_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_owner ON public.hotel_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.org_owner = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.org_owner = auth.uid()) AND role <> 'owner');

-- Staff turn their pending invitations into memberships (matched on their verified sign-in email)
CREATE OR REPLACE FUNCTION public.suite_claim_invites() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text := lower(auth.jwt()->>'email'); n int;
BEGIN
  IF auth.uid() IS NULL OR em IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.hotel_members(hotel_id, user_id, role)
    SELECT hotel_id, auth.uid(), role FROM public.hotel_invites WHERE lower(email) = em
  ON CONFLICT (hotel_id, user_id) DO UPDATE SET role = EXCLUDED.role WHERE public.hotel_members.role <> 'owner';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.suite_claim_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_claim_invites() TO authenticated;

-- Members must not be able to escalate: only the hotel owner manages memberships (already enforced), and owners cannot be demoted by invites.
CREATE INDEX IF NOT EXISTS audit_log_hotel_at ON public.audit_log(hotel_id, at DESC);