import { NextResponse } from 'next/server';

const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server not configured for Paystack verification' },
        { status: 500 }
      );
    }

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/settings?select=paystack_secret_key&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    if (!settingsRes.ok) {
      const text = await settingsRes.text();
      return NextResponse.json(
        { error: 'Failed to read payment settings', details: text },
        { status: 500 }
      );
    }

    const settingsData = (await settingsRes.json()) as Array<{
      paystack_secret_key: string | null;
    }>;
    const paystackSecretKey = settingsData?.[0]?.paystack_secret_key;

    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack secret key is not configured' },
        { status: 500 }
      );
    }

    const verifyRes = await fetch(`${PAYSTACK_VERIFY_URL}/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.data?.status !== 'success') {
      await fetch(`${supabaseUrl}/rest/v1/transactions?reference=eq.${reference}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'failed' }),
      });

      return NextResponse.json(
        { error: 'Payment verification failed', details: verifyData },
        { status: 400 }
      );
    }

    const transactionRes = await fetch(
      `${supabaseUrl}/rest/v1/transactions?reference=eq.${reference}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    if (!transactionRes.ok) {
      const text = await transactionRes.text();
      return NextResponse.json(
        { error: 'Failed to read transaction', details: text },
        { status: 500 }
      );
    }

    const transactions = (await transactionRes.json()) as Array<{
      id: string;
      user_id: string;
      pack_id: string;
      credits_added: number;
      amount_ngn: number;
    }>;
    const transaction = transactions[0];

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=credits_balance&user_id=eq.${transaction.user_id}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    if (!profileRes.ok) {
      const text = await profileRes.text();
      return NextResponse.json(
        { error: 'Failed to read profile', details: text },
        { status: 500 }
      );
    }

    const profiles = (await profileRes.json()) as Array<{ credits_balance: number }>;
    const currentBalance = profiles[0]?.credits_balance ?? 0;

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${transaction.user_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits_balance: currentBalance + transaction.credits_added }),
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return NextResponse.json(
        { error: 'Failed to update profile balance', details: text },
        { status: 500 }
      );
    }

    await fetch(`${supabaseUrl}/rest/v1/transactions?reference=eq.${reference}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'success' }),
    });

    const successUrl = new URL('/dashboard/billing?status=success', req.url);
    return NextResponse.redirect(successUrl);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
