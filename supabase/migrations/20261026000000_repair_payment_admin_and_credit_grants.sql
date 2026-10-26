CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND banned = false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_admin_read_all" ON public.transactions;
CREATE POLICY "transactions_admin_read_all" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "transactions_admin_update_all" ON public.transactions;
CREATE POLICY "transactions_admin_update_all" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.grant_transaction_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pack_credits integer;
BEGIN
  IF OLD.status = 'success' AND NEW.status <> 'success' THEN
    RAISE EXCEPTION 'Successful transactions cannot be reversed';
  END IF;

  IF OLD.status IS DISTINCT FROM 'success' AND NEW.status = 'success' THEN
    IF NEW.pack_id IS NULL THEN
      RAISE EXCEPTION 'A credit pack is required for successful transactions';
    END IF;

    SELECT credits
    INTO pack_credits
    FROM public.credit_packs
    WHERE id = NEW.pack_id
      AND active = true;

    IF pack_credits IS NULL THEN
      RAISE EXCEPTION 'The credit pack is unavailable';
    END IF;

    NEW.credits_added := pack_credits;

    UPDATE public.profiles
    SET credits_balance = credits_balance + pack_credits,
        updated_at = now()
    WHERE id = NEW.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment user not found';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_grant_credits ON public.transactions;
CREATE TRIGGER transactions_grant_credits
  BEFORE UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_transaction_credits();

NOTIFY pgrst, 'reload schema';
