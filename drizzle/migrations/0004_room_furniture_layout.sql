ALTER TABLE public.hotel_rooms ADD COLUMN IF NOT EXISTS layout jsonb;
CREATE OR REPLACE FUNCTION public.suite_edit_room(_hotel uuid,_number text,_edit jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.hotel_rooms; h public.hotels; patch jsonb; arr jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_hotel_role(_hotel,auth.uid(),ARRAY['owner','director']::public.hotel_role[]) THEN RAISE EXCEPTION 'Only Owner and Director can edit room configuration' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.hotels WHERE id=_hotel AND NOT archived;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hotel not found'; END IF;
 PERFORM 1 FROM public.company_worlds WHERE owner_id=h.org_owner FOR UPDATE;
 SELECT * INTO r FROM public.hotel_rooms WHERE hotel_id=_hotel AND number=_number AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF jsonb_typeof(_edit)<>'object' OR COALESCE(trim(_edit->>'type'),'')='' OR COALESCE((_edit->>'rate')::numeric,0)<=0 OR (_edit ? 'capacity' AND (_edit->>'capacity') IS NOT NULL AND ((_edit->>'capacity')::int NOT BETWEEN 1 AND 10)) OR (_edit ? 'sqm' AND (_edit->>'sqm') IS NOT NULL AND (_edit->>'sqm')::numeric<=0) THEN RAISE EXCEPTION 'Invalid room configuration'; END IF;
 IF _edit ? 'layout' AND jsonb_typeof(_edit->'layout') NOT IN ('array','null') THEN RAISE EXCEPTION 'Invalid room layout'; END IF;
 IF _edit ? 'layout' AND jsonb_typeof(_edit->'layout')='array' AND (jsonb_array_length(_edit->'layout')>40 OR EXISTS (SELECT 1 FROM jsonb_array_elements(_edit->'layout') e WHERE jsonb_typeof(e)<>'object' OR jsonb_typeof(e->'x')<>'number' OR jsonb_typeof(e->'y')<>'number' OR (e->>'x')::numeric NOT BETWEEN 0 AND 6 OR (e->>'y')::numeric NOT BETWEEN 0 AND 4.6 OR COALESCE(e->>'rot','') NOT IN ('0','90','180','270') OR COALESCE(e->>'kind','')='')) THEN RAISE EXCEPTION 'Invalid room layout'; END IF;
 patch=(SELECT jsonb_object_agg(key,value) FROM jsonb_each(_edit) WHERE key=ANY(ARRAY['type','rate','capacity','beds','bath','terrace','view','sqm','notes','extras','window','layout']));
 UPDATE public.hotel_rooms SET type=patch->>'type',rate=(patch->>'rate')::numeric,
 capacity=CASE WHEN patch ? 'capacity' THEN (patch->>'capacity')::int ELSE r.capacity END,
 beds=CASE WHEN patch ? 'beds' THEN patch->>'beds' ELSE r.beds END,
 bath=CASE WHEN patch ? 'bath' THEN patch->>'bath' ELSE r.bath END,
 terrace=CASE WHEN patch ? 'terrace' THEN (patch->>'terrace')::boolean ELSE r.terrace END,
 view=CASE WHEN patch ? 'view' THEN patch->>'view' ELSE r.view END,
 sqm=CASE WHEN patch ? 'sqm' THEN (patch->>'sqm')::numeric ELSE r.sqm END,
 notes=CASE WHEN patch ? 'notes' THEN patch->>'notes' ELSE r.notes END,
 extras=CASE WHEN patch ? 'extras' THEN ARRAY(SELECT jsonb_array_elements_text(patch->'extras')) ELSE r.extras END,
 window_side=CASE WHEN patch ? 'window' THEN patch->>'window' ELSE r.window_side END,
 layout=CASE WHEN patch ? 'layout' THEN NULLIF(patch->'layout','null'::jsonb) ELSE r.layout END WHERE id=r.id RETURNING * INTO r;
 SELECT jsonb_agg(CASE WHEN j->>'number'=_number THEN j||patch ELSE j END ORDER BY ord) INTO arr FROM public.company_worlds w, LATERAL jsonb_array_elements(w.state->'data'->h.key->'rooms') WITH ORDINALITY a(j,ord) WHERE w.owner_id=h.org_owner;
 IF arr IS NOT NULL THEN UPDATE public.company_worlds SET state=jsonb_set(state,ARRAY['data',h.key,'rooms'],arr) WHERE owner_id=h.org_owner; END IF;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.suite_edit_room(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suite_edit_room(uuid,text,jsonb) TO authenticated;