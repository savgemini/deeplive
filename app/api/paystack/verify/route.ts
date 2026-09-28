import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Payment verification is not configured. Add PAYSTACK_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY to the server environment.',
        },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: transaction, error: transactionError } = await adminSupabase
      .from('transactions')
      .select('id, user_id, pack_id, amount_ngn, credits_added, gateway, status')
      .eq('reference', reference)
      .maybeSingle();

    if (transactionError || !transaction || transaction.gateway !== 'paystack') {
      return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
    }

    if (transaction.status === 'success') {
      return NextResponse.json({ success: true, reference, status: 'success' });
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Payment transaction is not pending.' }, { status: 409 });
    }

    const verifyRes = await fetch(`${PAYSTACK_VERIFY_URL}/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed', details: verifyData },
        { status: 400 }
      );
    }

    const expectedAmount = Math.round(Number(transaction.amount_ngn) * 100);
    if (
      !expectedAmount ||
      Number(verifyData.data.amount) !== expectedAmount ||
      verifyData.data.metadata?.userId !== transaction.user_id ||
      verifyData.data.metadata?.packId !== transaction.pack_id
    ) {
      return NextResponse.json(
        { error: 'Verified payment does not match the transaction.' },
        { status: 400 }
      );
    }

    const { data: updatedTransaction, error: updateError } = await adminSupabase
      .from('transactions')
      .update({ status: 'success' })
      .eq('id', transaction.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: 'Unable to approve the payment.' }, { status: 500 });
    }

    if (!updatedTransaction) {
      const { data: latestTransaction } = await adminSupabase
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .maybeSingle();

      if (latestTransaction?.status !== 'success') {
        return NextResponse.json({ error: 'Unable to approve the payment.' }, { status: 409 });
      }
    }

    return NextResponse.json({
      success: true,
      reference,
      status: 'success',
      amount: verifyData.data.amount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
