import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { packId, userId, email, reference } = body as {
      packId: string;
      userId: string;
      email: string;
      reference?: string;
    };

    if (!packId || !userId || !email || !reference) {
      return NextResponse.json({ error: 'Missing packId, userId, email, or reference' }, { status: 400 });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Payment checkout is not configured. Add PAYSTACK_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY to the server environment.',
        },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: transaction, error: transactionError } = await adminSupabase
      .from('transactions')
      .select('id, user_id, pack_id, gateway, status')
      .eq('reference', reference)
      .maybeSingle();

    if (
      transactionError ||
      !transaction ||
      transaction.gateway !== 'paystack' ||
      transaction.status !== 'pending' ||
      transaction.user_id !== userId ||
      transaction.pack_id !== packId
    ) {
      return NextResponse.json({ error: 'Pending payment transaction not found.' }, { status: 404 });
    }

    const [{ data: pack, error: packError }, { data: profile, error: profileError }] = await Promise.all([
      adminSupabase
        .from('credit_packs')
        .select('price_usd, price_ngn, credits, active')
        .eq('id', packId)
        .maybeSingle(),
      adminSupabase.from('profiles').select('email').eq('id', userId).maybeSingle(),
    ]);

    if (
      packError ||
      !pack ||
      !pack.active ||
      profileError ||
      !profile ||
      profile.email.toLowerCase() !== email.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Unable to validate the selected credit pack.' }, { status: 400 });
    }

    const { error: transactionUpdateError } = await adminSupabase
      .from('transactions')
      .update({
        amount_usd: pack.price_usd,
        amount_ngn: pack.price_ngn,
        credits_added: pack.credits,
      })
      .eq('id', transaction.id)
      .eq('status', 'pending');

    if (transactionUpdateError) {
      return NextResponse.json({ error: 'Unable to prepare the payment transaction.' }, { status: 500 });
    }

    const callbackUrl = new URL('/dashboard/billing', req.url);
    callbackUrl.searchParams.set('status', 'success');
    callbackUrl.searchParams.set('reference', reference);

    const initializeRes = await fetch(PAYSTACK_INITIALIZE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(pack.price_ngn) * 100),
        callback_url: callbackUrl.toString(),
        metadata: {
          packId,
          userId,
          reference,
        },
      }),
    });

    const initializeData = await initializeRes.json();

    if (!initializeRes.ok || !initializeData.data?.authorization_url) {
      return NextResponse.json(
        { error: 'Paystack initialization failed', details: initializeData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization_url: initializeData.data.authorization_url,
      reference,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
