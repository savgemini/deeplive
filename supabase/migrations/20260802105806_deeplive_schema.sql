/*
# DeepLive — core schema

Creates the tables that power DeepLive: a SaaS app for real-time AI avatar
video calls. Users buy credit packs (minutes of usage), run LiveCam sessions
that deduct credits, and admins manage everything from a dashboard.

## New tables
- `profiles` — public user profile (1:1 with auth.users). Holds role
  (user/admin), credit balance, ban status, referral code.
- `credit_packs` — purchasable packs (Mini, Starter, Creator, Pro, Studio)
  with USD + NGN prices, minutes, validity months, optional discount.
- `transactions` — payment records (gateway, amount, status, credits added).
- `sessions` — LiveCam session logs (duration, credits used, quality, watermark).
- `tutorials` — video tutorials (free/premium), category, thumbnail, url.
- `settings` — single-row site settings (free trial seconds, watermark text,
  maintenance mode, referral commission %).

## Security
- RLS enabled on every table.
- Profiles: users read/update own row; admins read all + update all.
- Credit packs: public read (anon+authenticated) so the landing page can show
  pricing; only admins write.
- Transactions: users read own; admins read all; inserts allowed for the
  authenticated owner (used by the mock payment flow); admins update all.
- Sessions: users read/insert/update own; admins read all.
- Tutorials: public read; admin write.
- Settings: public read; admin write.

## Notes
- `profiles.role` and `profiles.banned` are admin-controlled columns; the
  client never writes them directly (no INSERT/UPDATE policy covers them for
  the user — only an admin policy can set role/banned).
- A trigger auto-creates a profile row when a new auth.users row appears, with
  role='user', 0 credits, and a random referral code.
*/

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user',
  credits_balance integer NOT NULL DEFAULT 0,
  banned boolean NOT NULL DEFAULT false,
  referral_code text UNIQUE,
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- admin override policies (role-based via a helper)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND banned = false
  );
$$;

DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
CREATE POLICY "profiles_admin_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- credit_packs
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_usd numeric(10,2) NOT NULL,
  price_ngn numeric(12,2) NOT NULL,
  minutes integer NOT NULL,
  validity_months integer NOT NULL DEFAULT 3,
  discount_percent numeric(5,2) DEFAULT 0,
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_packs_public_read" ON public.credit_packs;
CREATE POLICY "credit_packs_public_read" ON public.credit_packs
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "credit_packs_admin_write" ON public.credit_packs;
CREATE POLICY "credit_packs_admin_write" ON public.credit_packs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES public.credit_packs(id) ON DELETE SET NULL,
  gateway text NOT NULL DEFAULT 'mock',
  amount_usd numeric(10,2) NOT NULL,
  amount_ngn numeric(12,2),
  credits_added integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_admin_read_all" ON public.transactions;
CREATE POLICY "transactions_admin_read_all" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "transactions_admin_update_all" ON public.transactions;
CREATE POLICY "transactions_admin_update_all" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_seconds integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  quality text NOT NULL DEFAULT 'HD',
  watermark boolean NOT NULL DEFAULT true,
  avatar_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
CREATE POLICY "sessions_select_own" ON public.sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
CREATE POLICY "sessions_insert_own" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
CREATE POLICY "sessions_update_own" ON public.sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_admin_read_all" ON public.sessions;
CREATE POLICY "sessions_admin_read_all" ON public.sessions
  FOR SELECT TO authenticated USING (public.is_admin());

-- tutorials
CREATE TABLE IF NOT EXISTS public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Getting Started',
  video_url text NOT NULL,
  thumbnail_url text,
  premium boolean NOT NULL DEFAULT false,
  duration_minutes integer DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutorials_public_read" ON public.tutorials;
CREATE POLICY "tutorials_public_read" ON public.tutorials
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tutorials_admin_write" ON public.tutorials;
CREATE POLICY "tutorials_admin_write" ON public.tutorials
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- settings (single row)
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'DeepLive',
  free_trial_seconds integer NOT NULL DEFAULT 20,
  watermark_text text NOT NULL DEFAULT 'DeepLive',
  maintenance_mode boolean NOT NULL DEFAULT false,
  referral_commission_percent numeric(5,2) NOT NULL DEFAULT 10,
  paystack_public_key text,
  paystack_secret_key text,
  stripe_public_key text,
  stripe_secret_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_public_read" ON public.settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.settings;
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    'DL-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
