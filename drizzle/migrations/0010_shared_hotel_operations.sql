DO $$ DECLARE n text; rd text; wr text; ins text; upd text; BEGIN
FOREACH n IN ARRAY ARRAY['guests','reservations','tasks','incidents','room_operations'] LOOP
EXECUTE format('CREATE TABLE public.hotel_%I (hotel_id uuid NOT NULL REFERENCES public.hotels(id), id text NOT NULL, data jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, PRIMARY KEY(hotel_id,id))',n);
EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.hotel_%I TO authenticated',n);
EXECUTE format('GRANT ALL ON public.hotel_%I TO service_role',n);
EXECUTE format('ALTER TABLE public.hotel_%I ENABLE ROW LEVEL SECURITY',n);
rd='public.is_hotel_member(hotel_id,auth.uid())';
wr='public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''owner'',''director'',''reception'']::public.hotel_role[])';
IF n='guests' THEN wr=wr||' AND (public.suite_can_access(hotel_id,''huespedes'') OR public.suite_can_access(hotel_id,''reservas''))'; rd=wr;
ELSIF n='reservations' THEN wr=wr||' AND public.suite_can_access(hotel_id,''reservas'')';
ELSIF n='room_operations' THEN wr='public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''owner'',''director'',''reception'',''housekeeping'']::public.hotel_role[]) AND public.suite_can_access(hotel_id,''habitaciones'')';
ELSIF n='incidents' THEN wr='public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''owner'',''director'',''maintenance'']::public.hotel_role[]) AND public.suite_can_access(hotel_id,''tareas'')';
ELSE wr=wr||' AND public.suite_can_access(hotel_id,''tareas'')'; END IF;
ins=wr; upd=wr;
IF n='tasks' THEN
ins='('||wr||') OR (data->>''dept''=''mantenimiento'' AND public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''maintenance'']::public.hotel_role[]) AND public.suite_can_access(hotel_id,''tareas''))';
upd='('||wr||') OR (public.suite_can_access(hotel_id,''tareas'') AND ((data->>''dept''=''housekeeping'' AND public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''housekeeping'']::public.hotel_role[])) OR (data->>''dept''=''mantenimiento'' AND public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''maintenance'']::public.hotel_role[]))))';
ELSIF n='incidents' THEN ins=rd||' AND public.suite_can_access(hotel_id,''tareas'')'; END IF;
EXECUTE format('CREATE POLICY operational_read ON public.hotel_%I FOR SELECT TO authenticated USING (%s)',n,rd);
EXECUTE format('CREATE POLICY operational_insert ON public.hotel_%I FOR INSERT TO authenticated WITH CHECK (%s)',n,ins);
EXECUTE format('CREATE POLICY operational_update ON public.hotel_%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',n,upd,upd);
EXECUTE format('CREATE POLICY operational_delete ON public.hotel_%I FOR DELETE TO authenticated USING (public.has_hotel_role(hotel_id,auth.uid(),ARRAY[''owner'',''director'']::public.hotel_role[]))',n);
END LOOP; END $$;
ALTER TABLE public.hotel_reservations ADD COLUMN guest_id text GENERATED ALWAYS AS (data->>'guestId') STORED;
ALTER TABLE public.hotel_reservations ADD CONSTRAINT reservations_guest_fk FOREIGN KEY(hotel_id,guest_id) REFERENCES public.hotel_guests(hotel_id,id);
CREATE INDEX reservations_room ON public.hotel_reservations(hotel_id,(data->>'room'));
CREATE INDEX tasks_room ON public.hotel_tasks(hotel_id,(data->>'room'));
CREATE INDEX incidents_room ON public.hotel_incidents(hotel_id,(data->>'room'));
-- Backfill existing company data only; no demo seeds, legacy document untouched.
INSERT INTO public.hotel_guests(hotel_id,id,data) SELECT h.id,j->>'id',j FROM public.hotels h JOIN public.company_worlds w ON w.owner_id=h.org_owner CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.state->'data'->h.key->'guests','[]'::jsonb)) j WHERE j->>'id' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.hotel_reservations(hotel_id,id,data) SELECT h.id,j->>'id',j FROM public.hotels h JOIN public.company_worlds w ON w.owner_id=h.org_owner CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.state->'data'->h.key->'reservations','[]'::jsonb)) j WHERE j->>'id' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.hotel_tasks(hotel_id,id,data) SELECT h.id,j->>'id',j FROM public.hotels h JOIN public.company_worlds w ON w.owner_id=h.org_owner CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.state->'data'->h.key->'tasks','[]'::jsonb)) j WHERE j->>'id' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.hotel_incidents(hotel_id,id,data) SELECT h.id,j->>'id',j FROM public.hotels h JOIN public.company_worlds w ON w.owner_id=h.org_owner CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.state->'data'->h.key->'incidents','[]'::jsonb)) j WHERE j->>'id' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.hotel_room_operations(hotel_id,id,data) SELECT h.id,j->>'number',jsonb_build_object('number',j->>'number','hk',COALESCE(j->>'hk','clean'),'oos',COALESCE((j->>'oos')::boolean,false)) FROM public.hotels h JOIN public.company_worlds w ON w.owner_id=h.org_owner CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.state->'data'->h.key->'rooms','[]'::jsonb)) j WHERE j->>'number' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.hotel_room_operations(hotel_id,id,data) SELECT hotel_id,number,jsonb_build_object('number',number,'hk','clean','oos',false) FROM public.hotel_rooms ON CONFLICT DO NOTHING;
CREATE FUNCTION public.suite_operational_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE room_number text;
BEGIN
IF auth.uid() IS NOT NULL AND current_setting('suite.operation_batch',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Use atomic operation command' USING ERRCODE='42501'; END IF;
IF jsonb_typeof(NEW.data)<>'object' OR NEW.id='' THEN RAISE EXCEPTION 'Invalid operational record'; END IF;
IF TG_OP='UPDATE' AND (NEW.hotel_id,NEW.id) IS DISTINCT FROM (OLD.hotel_id,OLD.id) THEN RAISE EXCEPTION 'Immutable operational identity' USING ERRCODE='42501'; END IF;
IF TG_TABLE_NAME='hotel_room_operations' THEN
IF NEW.data->>'number' IS DISTINCT FROM NEW.id OR COALESCE(NEW.data->>'hk','') NOT IN ('clean','dirty','inspect','cleaning') OR jsonb_typeof(NEW.data->'oos') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid room operation'; END IF; room_number=NEW.id;
ELSE
IF NEW.data->>'id' IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Invalid entity identity'; END IF; room_number=NEW.data->>'room'; END IF;
IF room_number IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hotel_rooms WHERE hotel_id=NEW.hotel_id AND number=room_number AND NOT archived) THEN RAISE EXCEPTION 'Room not found'; END IF;
IF TG_TABLE_NAME='hotel_guests' AND COALESCE(trim(NEW.data->>'name'),'')='' THEN RAISE EXCEPTION 'Guest name required'; END IF;
IF TG_TABLE_NAME='hotel_reservations' THEN
IF COALESCE(NEW.data->>'status','') NOT IN ('confirmed','cancelled','noshow') OR COALESCE(NEW.data->>'stay','') NOT IN ('none','inhouse','finished') OR COALESCE((NEW.data->>'pax')::int,0)<1 OR COALESCE((NEW.data->>'amount')::numeric,-1)<0 OR NEW.data->>'guestId' IS NULL OR room_number IS NULL OR NEW.data->>'inDay' IS NULL OR NEW.data->>'outDay' IS NULL THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
IF NEW.data->>'stay'<>'finished' AND (NEW.data->>'outDay')::int <= (NEW.data->>'inDay')::int THEN RAISE EXCEPTION 'Checkout must follow checkin'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(NEW.hotel_id::text,0));
IF NEW.data->>'status'='confirmed' AND NEW.data->>'stay'<>'finished' AND EXISTS(SELECT 1 FROM public.hotel_reservations r WHERE r.hotel_id=NEW.hotel_id AND r.id<>NEW.id AND r.data->>'room'=room_number AND r.data->>'status'='confirmed' AND r.data->>'stay'<>'finished' AND (r.data->>'inDay')::int<(NEW.data->>'outDay')::int AND (NEW.data->>'inDay')::int<(r.data->>'outDay')::int) THEN RAISE EXCEPTION 'Reservation overlaps another stay' USING ERRCODE='23P01'; END IF; END IF;
IF TG_TABLE_NAME='hotel_tasks' AND (COALESCE(NEW.data->>'dept','') NOT IN ('housekeeping','mantenimiento','recepcion','revenue') OR COALESCE(NEW.data->>'status','') NOT IN ('pendiente','en_proceso','completada','bloqueada')) THEN RAISE EXCEPTION 'Invalid task'; END IF;
IF TG_TABLE_NAME='hotel_incidents' AND COALESCE(NEW.data->>'status','') NOT IN ('abierta','en_proceso','resuelta') THEN RAISE EXCEPTION 'Invalid incident'; END IF;
IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' AND NOT public.has_hotel_role(NEW.hotel_id,auth.uid(),ARRAY['owner','director','reception']::public.hotel_role[]) THEN
IF TG_TABLE_NAME='hotel_tasks' AND (NEW.data-ARRAY['status','startedAt','endedAt','assignee']) IS DISTINCT FROM (OLD.data-ARRAY['status','startedAt','endedAt','assignee']) THEN RAISE EXCEPTION 'Task fields restricted' USING ERRCODE='42501'; END IF;
IF TG_TABLE_NAME='hotel_room_operations' AND NEW.data->'oos' IS DISTINCT FROM OLD.data->'oos' THEN RAISE EXCEPTION 'Only reception or management can block rooms' USING ERRCODE='42501'; END IF; END IF;
IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' AND TG_TABLE_NAME='hotel_incidents' AND NOT public.has_hotel_role(NEW.hotel_id,auth.uid(),ARRAY['owner','director']::public.hotel_role[]) AND (NEW.data-ARRAY['status','startedAt','arrivedAt','resolvedAt']) IS DISTINCT FROM (OLD.data-ARRAY['status','startedAt','arrivedAt','resolvedAt']) THEN RAISE EXCEPTION 'Incident fields restricted' USING ERRCODE='42501'; END IF;
NEW.version=CASE WHEN TG_OP='UPDATE' THEN OLD.version+1 ELSE 1 END; NEW.updated_by=auth.uid(); NEW.updated_at=now(); RETURN NEW;
END $$;
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['guests','reservations','tasks','incidents','room_operations'] LOOP EXECUTE format('CREATE TRIGGER operational_guard BEFORE INSERT OR UPDATE ON public.hotel_%I FOR EACH ROW EXECUTE FUNCTION public.suite_operational_guard()',n); END LOOP; END $$;
CREATE FUNCTION public.suite_apply_operations(_hotel uuid,_changes jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c jsonb; table_name text; current_data jsonb; affected int;
BEGIN
IF auth.uid() IS NULL OR NOT public.is_hotel_member(_hotel,auth.uid()) THEN RAISE EXCEPTION 'Hotel access denied' USING ERRCODE='42501'; END IF;
IF jsonb_typeof(_changes)<>'array' OR jsonb_array_length(_changes)>200 THEN RAISE EXCEPTION 'Invalid operation batch'; END IF;
PERFORM set_config('suite.operation_batch','on',true); PERFORM pg_advisory_xact_lock(hashtextextended(_hotel::text,0));
FOR c IN SELECT value FROM jsonb_array_elements(_changes) LOOP
IF COALESCE(c->>'entity','') NOT IN ('guests','reservations','tasks','incidents','room_operations') THEN RAISE EXCEPTION 'Unknown entity'; END IF; table_name='hotel_'||(c->>'entity');
EXECUTE format('SELECT data FROM public.%I WHERE hotel_id=$1 AND id=$2 FOR UPDATE',table_name) INTO current_data USING _hotel,c->>'id';
IF current_data IS DISTINCT FROM NULLIF(c->'before','null'::jsonb) THEN RAISE EXCEPTION 'Another user changed this record; reload and retry' USING ERRCODE='40001'; END IF;
IF c->'after' IS NULL OR c->'after'='null'::jsonb THEN EXECUTE format('DELETE FROM public.%I WHERE hotel_id=$1 AND id=$2',table_name) USING _hotel,c->>'id';
ELSIF current_data IS NULL THEN EXECUTE format('INSERT INTO public.%I(hotel_id,id,data) VALUES($1,$2,$3)',table_name) USING _hotel,c->>'id',c->'after';
ELSE EXECUTE format('UPDATE public.%I SET data=$3 WHERE hotel_id=$1 AND id=$2',table_name) USING _hotel,c->>'id',c->'after'; END IF;
GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Operation not permitted' USING ERRCODE='42501'; END IF;
END LOOP; END $$;
REVOKE ALL ON FUNCTION public.suite_apply_operations(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suite_apply_operations(uuid,jsonb) TO authenticated;
CREATE FUNCTION public.suite_load_operations(_hotel uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE full_guests boolean; result jsonb;
BEGIN
IF auth.uid() IS NULL OR NOT public.is_hotel_member(_hotel,auth.uid()) THEN RAISE EXCEPTION 'Hotel access denied' USING ERRCODE='42501'; END IF;
full_guests=public.has_hotel_role(_hotel,auth.uid(),ARRAY['owner','director','reception']::public.hotel_role[]) AND (public.suite_can_access(_hotel,'huespedes') OR public.suite_can_access(_hotel,'reservas'));
SELECT jsonb_build_object(
'guests',(SELECT COALESCE(jsonb_agg(CASE WHEN full_guests THEN data ELSE jsonb_build_object('id',id,'name',data->>'name','doc','—','phone','—','email','—','lang','—','companions','[]'::jsonb,'notes','','country','—','messaging',false) END ORDER BY id),'[]'::jsonb) FROM public.hotel_guests WHERE hotel_id=_hotel),
'reservations',(SELECT COALESCE(jsonb_agg(data ORDER BY id),'[]'::jsonb) FROM public.hotel_reservations WHERE hotel_id=_hotel),
'tasks',(SELECT COALESCE(jsonb_agg(data ORDER BY updated_at DESC,id),'[]'::jsonb) FROM public.hotel_tasks WHERE hotel_id=_hotel),
'incidents',(SELECT COALESCE(jsonb_agg(data ORDER BY updated_at DESC,id),'[]'::jsonb) FROM public.hotel_incidents WHERE hotel_id=_hotel),
'room_operations',(SELECT COALESCE(jsonb_agg(data ORDER BY id),'[]'::jsonb) FROM public.hotel_room_operations WHERE hotel_id=_hotel)) INTO result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.suite_load_operations(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suite_load_operations(uuid) TO authenticated;
CREATE FUNCTION public.suite_init_room_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM set_config('suite.operation_batch','on',true); INSERT INTO public.hotel_room_operations(hotel_id,id,data) VALUES(NEW.hotel_id,NEW.number,jsonb_build_object('number',NEW.number,'hk','clean','oos',false)) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.suite_init_room_operation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER init_room_operation AFTER INSERT ON public.hotel_rooms FOR EACH ROW EXECUTE FUNCTION public.suite_init_room_operation();
COMMENT ON TABLE public.hotel_room_operations IS 'Shared housekeeping and out-of-service state, separate from room configuration.';