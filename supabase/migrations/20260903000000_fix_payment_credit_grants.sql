/* The previous migration copied minutes into credits. Usage consumes 125 credits per minute. */
UPDATE public.credit_packs
SET credits = minutes * 125
WHERE credits = minutes;

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
    IF NEW.pack_id IS NOT NULL THEN
      SELECT credits INTO pack_credits
      FROM public.credit_packs
      WHERE id = NEW.pack_id;

      IF pack_credits IS NOT NULL THEN
        NEW.credits_added := pack_credits;
      END IF;
    END IF;

    UPDATE public.profiles
    SET credits_balance = credits_balance + NEW.credits_added,
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_grant_credits ON public.transactions;
CREATE TRIGGER transactions_grant_credits
  BEFORE UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_transaction_credits();

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;

NOTIFY pgrst, 'reload schema';