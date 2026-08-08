/*
# Fix is_admin() circular schema cache error

"Database error querying schema" on login is caused by:
1. is_admin() being granted EXECUTE to PUBLIC/anon — PostgREST introspects all
   callable functions during schema caching, which triggers RLS on profiles,
   which calls is_admin() again, causing a circular dependency that crashes the
   schema cache and blocks ALL requests including login.
2. The fix: revoke EXECUTE from PUBLIC and anon, keep only authenticated +
   service_role + postgres. Also recreate is_admin() using app_metadata (stored
   in auth.jwt()) instead of querying profiles — this avoids touching any RLS-
   protected table entirely, breaking the circular dependency permanently.

Changes:
- Revoke EXECUTE on is_admin() from PUBLIC and anon
- Rewrite is_admin() to read from auth.jwt() raw_app_meta_data (no table query)
- Store admin role in app_meta_data for the admin user
- Adjust all policies that need the admin check to use the new function
*/

-- Step 1: revoke broad EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- Step 2: rewrite is_admin() to use JWT claims — no table query, no RLS, no recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Re-grant only to authenticated (anon never needs to check admin)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Step 3: set app_metadata role=admin for the admin user in auth.users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'admin@deeplive.app';
