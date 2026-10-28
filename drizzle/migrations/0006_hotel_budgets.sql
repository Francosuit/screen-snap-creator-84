CREATE TABLE public.hotel_budgets (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  months numeric[] NOT NULL CHECK (array_length(months, 1) = 12),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, year)
);
GRANT SELECT, INSERT, UPDATE ON public.hotel_budgets TO authenticated;
GRANT ALL ON public.hotel_budgets TO service_role;
ALTER TABLE public.hotel_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budgets_read ON public.hotel_budgets FOR SELECT TO authenticated
  USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]));
CREATE POLICY budgets_insert ON public.hotel_budgets FOR INSERT TO authenticated
  WITH CHECK (updated_by = auth.uid() AND public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]));
CREATE POLICY budgets_update ON public.hotel_budgets FOR UPDATE TO authenticated
  USING (public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]))
  WITH CHECK (updated_by = auth.uid() AND public.has_hotel_role(hotel_id, auth.uid(), ARRAY['owner','director','revenue']::public.hotel_role[]));