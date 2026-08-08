import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type CreditPack = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_usd: number;
  price_ngn: number;
  credits: number;
  minutes: number;
  validity_months: number;
  discount_percent: number;
  popular: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  credits_balance: number;
  banned: boolean;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  pack_id: string | null;
  gateway: string;
  amount_usd: number;
  amount_ngn: number | null;
  credits_added: number;
  status: 'pending' | 'success' | 'failed';
  reference: string | null;
  created_at: string;
};

export type SessionLog = {
  id: string;
  user_id: string;
  duration_seconds: number;
  credits_used: number;
  quality: string;
  watermark: boolean;
  avatar_name: string | null;
  started_at: string;
  ended_at: string | null;
};

export type Tutorial = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  video_url: string;
  thumbnail_url: string | null;
  premium: boolean;
  duration_minutes: number;
  sort_order: number;
  created_at: string;
};

export type SiteSettings = {
  id: number;
  site_name: string;
  free_trial_seconds: number;
  watermark_text: string;
  maintenance_mode: boolean;
  referral_commission_percent: number;
  paystack_public_key: string | null;
  paystack_secret_key: string | null;
  stripe_public_key: string | null;
  stripe_secret_key: string | null;
  decart_api_key: string | null;
  updated_at: string;
};
