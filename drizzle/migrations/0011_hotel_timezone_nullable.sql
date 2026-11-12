-- Nullable, no default, no backfill: existing hotels keep NULL and the app falls back to Europe/Madrid.
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.hotels ADD CONSTRAINT hotels_timezone_format CHECK (timezone IS NULL OR timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+)+$|^UTC$');