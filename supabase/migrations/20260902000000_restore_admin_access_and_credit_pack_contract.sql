/* Keep the JWT claim used by RLS aligned with existing admin profiles. */
UPDATE auth.users AS users
SET raw_app_meta_data = COALESCE(users.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
FROM public.profiles AS profiles
WHERE users.id = profiles.id
  AND profiles.role = 'admin'
  AND profiles.banned = false;

/* The client has always treated credits and minutes as separate values. */
ALTER TABLE public.credit_packs
  ADD COLUMN IF NOT EXISTS credits integer;

UPDATE public.credit_packs
SET credits = minutes
WHERE credits IS NULL;

ALTER TABLE public.credit_packs
  ALTER COLUMN credits SET DEFAULT 0,
  ALTER COLUMN credits SET NOT NULL;

NOTIFY pgrst, 'reload schema';