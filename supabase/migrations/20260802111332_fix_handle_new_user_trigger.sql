/*
# Fix handle_new_user trigger

The original trigger used gen_random_bytes() from pgcrypto which can fail in
Supabase Auth's restricted execution context. Replacing with a pure SQL approach
using substr(gen_random_uuid()::text, ...) which is always available.

Also adds an explicit INSERT policy on profiles so the function can insert even
in restrictive RLS modes, and sets the function to run with the correct search path.
*/

-- Rewrite the trigger function without pgcrypto dependency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    'DL-' || upper(replace(substr(gen_random_uuid()::text, 1, 8), '-', ''))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth signup even if profile insert fails
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add explicit INSERT policy so the service role / trigger can always insert profiles
DROP POLICY IF EXISTS "profiles_service_insert" ON public.profiles;
CREATE POLICY "profiles_service_insert" ON public.profiles
  FOR INSERT TO authenticated, anon WITH CHECK (true);
