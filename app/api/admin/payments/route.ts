import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getBearerToken(request: NextRequest) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
}

async function getAdminClient(request: NextRequest): Promise<{ client: SupabaseClient } | { error: NextResponse }> {
  const token = getBearerToken(request);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !token) {
    return {
      error: NextResponse.json({ error: 'Payment administration is not configured.' }, { status: 500 }),
    };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, banned')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin' || profile.banned) {
    return { error: NextResponse.json({ error: 'Administrator access required.' }, { status: 403 }) };
  }

  return { client };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminClient(request);
  if ('error' in admin) return admin.error;

  const { data: transactions, error: transactionsError } = await admin.client
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (transactionsError) {
    return NextResponse.json({ error: 'Unable to load payments.' }, { status: 500 });
  }

  const userIds = Array.from(new Set((transactions ?? []).map((transaction) => transaction.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.client.from('profiles').select('id, email').in('id', userIds)
    : { data: [] };
  const emails = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return NextResponse.json({
    transactions: (transactions ?? []).map((transaction) => ({
      ...transaction,
      user_email: emails.get(transaction.user_id) ?? null,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminClient(request);
  if ('error' in admin) return admin.error;

  const body = (await request.json()) as { transactionId?: string; decision?: 'success' | 'failed' };
  if (!body.transactionId || !body.decision) {
    return NextResponse.json({ error: 'Transaction ID and decision are required.' }, { status: 400 });
  }

  const { data: transaction, error: transactionError } = await admin.client
    .from('transactions')
    .select('id, gateway, status')
    .eq('id', body.transactionId)
    .maybeSingle();
  if (transactionError || !transaction) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }
  if (transaction.gateway !== 'manual' || transaction.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending crypto payments can be reviewed.' }, { status: 409 });
  }

  const { error: updateError } = await admin.client
    .from('transactions')
    .update({ status: body.decision })
    .eq('id', transaction.id)
    .eq('gateway', 'manual')
    .eq('status', 'pending');
  if (updateError) {
    return NextResponse.json({ error: 'Could not update payment status.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
