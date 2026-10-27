CREATE TYPE public.hotel_role AS ENUM ('owner','director','reception','housekeeping','maintenance','revenue');

CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_owner uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  check_in text, check_out text,
  zones text[] NOT NULL DEFAULT '{}',
  departments text[] NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_owner, key)
);
CREATE TABLE public.hotel_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  number int NOT NULL, name text NOT NULL DEFAULT '',
  UNIQUE (hotel_id, number)
);
CREATE TABLE public.hotel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  number text NOT NULL, floor int NOT NULL,
  type text NOT NULL DEFAULT '', rate numeric NOT NULL DEFAULT 0,
  capacity int, beds text, bath text, terrace boolean, view text, sqm numeric, notes text,
  archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, number)
);
CREATE TABLE public.hotel_members (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.hotel_role NOT NULL,
  PRIMARY KEY (hotel_id, user_id)
);
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  hotel_id uuid NOT NULL,
  actor uuid,
  entity text NOT NULL, entity_key text NOT NULL, action text NOT NULL,
  before jsonb, after jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hotels, public.hotel_floors, public.hotel_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_members TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.hotels, public.hotel_floors, public.hotel_rooms, public.hotel_members, public.audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_hotel_role(_hotel uuid, _uid uuid, _roles public.hotel_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = _hotel AND h.org_owner = _uid)
      OR EXISTS (SELECT 1 FROM public.hotel_members m WHERE m.hotel_id = _hotel AND m.user_id = _uid AND m.role = ANY(_roles))
$$;
CREATE OR REPLACE FUNCTION public.is_hotel_member(_hotel uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_hotel_role(_hotel, _uid, ARRAY['owner','director','reception','housekeeping','maintenance','revenue']::public.hotel_role[])
$$;

CREATE POLICY hotels_read ON public.hotels FOR SELECT TO authenticated USING (public.is_hotel_member(id, auth.uid()));
CREATE POLICY hotels_insert ON public.hotels FOR INSERT TO authenticated WITH CHECK (org_owner = auth.uid());
CREATE POLICY hotels_update ON public.hotels FOR UPDATE TO authenticated
  USING (public.has_hotel_role(id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]))
  WITH CHECK (public.has_hotel_role(id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));

CREATE POLICY floors_read ON public.hotel_floors FOR SELECT TO authenticated USING (public.is_hotel_member(hotel_id, auth.uid()));
CREATE POLICY floors_write ON public.hotel_floors FOR INSERT TO authenticated WITH CHECK (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE POLICY floors_update ON public.hotel_floors FOR UPDATE TO authenticated
  USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]))
  WITH CHECK (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));

CREATE POLICY rooms_read ON public.hotel_rooms FOR SELECT TO authenticated USING (public.is_hotel_member(hotel_id, auth.uid()));
CREATE POLICY rooms_insert ON public.hotel_rooms FOR INSERT TO authenticated WITH CHECK (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE POLICY rooms_update ON public.hotel_rooms FOR UPDATE TO authenticated
  USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]))
  WITH CHECK (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]));

CREATE POLICY members_read ON public.hotel_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));
CREATE POLICY members_manage ON public.hotel_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.org_owner = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.org_owner = auth.uid()));

CREATE POLICY audit_read ON public.audit_log FOR SELECT TO authenticated USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director']::public.hotel_role[]));

-- Immutable audit trail for hotel and room changes
CREATE OR REPLACE FUNCTION public.suite_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid; k text;
BEGIN
  IF TG_TABLE_NAME = 'hotels' THEN hid := NEW.id; k := NEW.key; ELSE hid := NEW.hotel_id; k := NEW.number; END IF;
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) - 'updated_at' = to_jsonb(NEW) - 'updated_at' THEN RETURN NEW; END IF;
  INSERT INTO public.audit_log(hotel_id, actor, entity, entity_key, action, before, after)
  VALUES (hid, auth.uid(), TG_TABLE_NAME, k, lower(TG_OP), CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER hotels_audit AFTER INSERT OR UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.suite_audit();
CREATE TRIGGER rooms_audit AFTER INSERT OR UPDATE ON public.hotel_rooms FOR EACH ROW EXECUTE FUNCTION public.suite_audit();

-- Mirror the saved world into the relational tables (never deletes: missing items are archived)
CREATE OR REPLACE FUNCTION public.suite_sync_world() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h jsonb; hid uuid; f jsonb; rm jsonb; keys text[] := '{}';
BEGIN
  FOR h IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.state->'hotels','[]'::jsonb)) LOOP
    keys := keys || (h->>'id');
    INSERT INTO public.hotels(org_owner, key, name, address, city, category, check_in, check_out, zones, departments, archived, updated_at)
    VALUES (NEW.owner_id, h->>'id', COALESCE(h->>'name',''), COALESCE(h->>'address',''), COALESCE(h->>'city',''), COALESCE(h->>'category',''),
      h->>'checkIn', h->>'checkOut',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(h->'zones','[]'::jsonb))),'{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(h->'departments','[]'::jsonb))),'{}'), false, now())
    ON CONFLICT (org_owner, key) DO UPDATE SET name=EXCLUDED.name, address=EXCLUDED.address, city=EXCLUDED.city, category=EXCLUDED.category,
      check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out, zones=EXCLUDED.zones, departments=EXCLUDED.departments, archived=false, updated_at=now()
    RETURNING id INTO hid;
    INSERT INTO public.hotel_members(hotel_id, user_id, role) VALUES (hid, NEW.owner_id, 'owner') ON CONFLICT DO NOTHING;
    FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(h->'floors','[]'::jsonb)) LOOP
      INSERT INTO public.hotel_floors(hotel_id, number, name) VALUES (hid, (f->>'number')::int, COALESCE(f->>'name',''))
      ON CONFLICT (hotel_id, number) DO UPDATE SET name=EXCLUDED.name;
    END LOOP;
    UPDATE public.hotel_rooms SET archived = true WHERE hotel_id = hid AND NOT archived
      AND number NOT IN (SELECT x->>'number' FROM jsonb_array_elements(COALESCE(NEW.state->'data'->(h->>'id')->'rooms','[]'::jsonb)) x);
    FOR rm IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.state->'data'->(h->>'id')->'rooms','[]'::jsonb)) LOOP
      INSERT INTO public.hotel_rooms(hotel_id, number, floor, type, rate, capacity, beds, bath, terrace, view, sqm, notes, archived, updated_at)
      VALUES (hid, rm->>'number', COALESCE((rm->>'floor')::int,0), COALESCE(rm->>'type',''), COALESCE((rm->>'rate')::numeric,0),
        (rm->>'capacity')::int, rm->>'beds', rm->>'bath', (rm->>'terrace')::boolean, rm->>'view', (rm->>'sqm')::numeric, rm->>'notes', false, now())
      ON CONFLICT (hotel_id, number) DO UPDATE SET floor=EXCLUDED.floor, type=EXCLUDED.type, rate=EXCLUDED.rate, capacity=EXCLUDED.capacity,
        beds=EXCLUDED.beds, bath=EXCLUDED.bath, terrace=EXCLUDED.terrace, view=EXCLUDED.view, sqm=EXCLUDED.sqm, notes=EXCLUDED.notes, archived=false, updated_at=now();
    END LOOP;
  END LOOP;
  UPDATE public.hotels SET archived = true WHERE org_owner = NEW.owner_id AND NOT archived AND NOT (key = ANY(keys));
  RETURN NEW;
END $$;
CREATE TRIGGER suite_world_sync AFTER INSERT OR UPDATE OF state ON public.company_worlds FOR EACH ROW EXECUTE FUNCTION public.suite_sync_world();

-- Backfill existing saved worlds
UPDATE public.company_worlds SET state = state;