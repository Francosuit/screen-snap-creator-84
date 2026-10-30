-- Only the recorded hotel creator can receive owner membership. Invites never grant owner.
CREATE OR REPLACE FUNCTION public.suite_clamp_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    IF TG_TABLE_NAME <> 'hotel_members' THEN
      RAISE EXCEPTION 'Owner access cannot be granted to staff' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id=NEW.hotel_id AND h.org_owner=NEW.user_id)
       OR (auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id) THEN
      RAISE EXCEPTION 'Only the hotel creator can hold owner membership' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.modules IS NOT NULL THEN
    NEW.modules := ARRAY(SELECT m FROM unnest(NEW.modules) m WHERE m = ANY(public.suite_role_modules(NEW.role)));
  END IF;
  RETURN NEW;
END $$;
-- Existing UPDATE policies allow directors to edit hotels, not to transfer ownership.
CREATE OR REPLACE FUNCTION public.suite_guard_hotel_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.org_owner IS DISTINCT FROM OLD.org_owner THEN
    RAISE EXCEPTION 'Hotel ownership cannot be reassigned' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hotels_guard_owner BEFORE UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.suite_guard_hotel_owner();