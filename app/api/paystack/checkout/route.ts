import { NextResponse } from 'next/server';

const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { packId, userId, email } = body as {
      packId: string;
      userId: string;
      email: string;
    };

    if (!packId || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing packId, userId, or email' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Server not configured for Paystack checkout. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.',
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !process.env.SUPABASE_SERVICE_ROLE_KEY,
          },
        },
        { status: 500 }
      );
    }

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/settings?select=paystack_public_key,paystack_secret_key&limit=1`,
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
      paystack_public_key: string | null;
      paystack_secret_key: string | null;
    }>;
    const paystackSecretKey = settingsData?.[0]?.paystack_secret_key;

    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack secret key is not configured' },
        { status: 500 }
      );
    }

    const packRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_packs?select=*&id=eq.${packId}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    if (!packRes.ok) {
      const text = await packRes.text();
      return NextResponse.json(
        { error: 'Failed to read credit pack', details: text },
        { status: 500 }
      );
    }

    const packs = (await packRes.json()) as Array<{
      id: string;
      price_ngn: number;
      credits: number;
    }>;
    const pack = packs[0];

    if (!pack) {
      return NextResponse.json({ error: 'Credit pack not found' }, { status: 404 });
    }

    const reference = `paystack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const transactionRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          user_id: userId,
          pack_id: packId,
          gateway: 'paystack',
          amount_usd: null,
          amount_ngn: pack.price_ngn,
          credits_added: pack.credits,
          status: 'pending',
          reference,
        },
      ]),
    });

    if (!transactionRes.ok) {
      const text = await transactionRes.text();
      return NextResponse.json(
        { error: 'Failed to create transaction', details: text },
        { status: 500 }
      );
    }

    const callbackUrl = new URL('/api/paystack/verify', req.url);
    callbackUrl.searchParams.set('reference', reference);

    const initializeRes = await fetch(PAYSTACK_INITIALIZE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(pack.price_ngn * 100),
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

    return NextResponse.json({ authorization_url: initializeData.data.authorization_url });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
