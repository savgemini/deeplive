ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_used boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_free_trial()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_seconds integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT GREATEST(COALESCE(settings.free_trial_seconds, 0), 0)
  INTO trial_seconds
  FROM public.settings
  WHERE settings.id = 1;

  IF NOT FOUND OR trial_seconds <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET free_trial_used = true
  WHERE id = auth.uid()
    AND free_trial_used = false
    AND credits_balance <= 0
    AND role = 'user'
    AND banned = false;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN trial_seconds;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_trial() TO authenticated;

NOTIFY pgrst, 'reload schema';
