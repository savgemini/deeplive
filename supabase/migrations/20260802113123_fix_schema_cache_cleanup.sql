/*
# Fix schema cache error - clean up policies and trigger function

The "Database error querying schema" error is caused by PostgREST failing to
build its schema cache. Root causes:
1. profiles_service_insert policy allows anon INSERT with WITH CHECK (true) —
   too permissive, can cause schema cache issues
2. handle_new_user is SECURITY DEFINER and callable by anon via REST API —
   advisors flagged this as a security risk

Fix:
- Drop the overly permissive profiles_service_insert policy (the trigger uses
  SECURITY DEFINER so it bypasses RLS anyway)
- Revoke EXECUTE on handle_new_user from anon and authenticated (it's a trigger,
  only the database should call it, not the REST API)
- Reload PostgREST schema cache
*/

-- Drop the permissive insert policy
DROP POLICY IF EXISTS "profiles_service_insert" ON public.profiles;

-- Revoke EXECUTE on handle_new_user from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
