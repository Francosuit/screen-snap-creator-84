DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'has_hotel_role','is_hotel_member','suite_api_integration_guard','suite_api_mapping_guard',
      'suite_audit','suite_clamp_modules','suite_guard_hotel_owner','suite_guard_invite',
      'suite_guard_room_config','suite_operational_guard','suite_role_modules','suite_signup_profile',
      'suite_sync_world','suite_validate_world')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;