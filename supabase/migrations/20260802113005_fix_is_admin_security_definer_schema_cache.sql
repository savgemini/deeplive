/*
# Fix schema cache error - is_admin() SECURITY DEFINER causing PostgREST crash

PostgREST builds its schema cache by introspecting all tables, policies, and
functions. When is_admin() is SECURITY DEFINER, PostgREST encounters issues
during schema caching. The fix: recreate as SECURITY INVOKER with CREATE OR
REPLACE (which preserves dependent policies), then grant EXECUTE to both anon
and authenticated so PostgREST can resolve policies during schema caching.
*/

-- Use CREATE OR REPLACE to preserve dependent policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Grant to both anon and authenticated so PostgREST can resolve policies
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
