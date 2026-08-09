import { NextResponse } from 'next/server';

const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { packId, userId, email, amount, reference } = body as {
      packId: string;
      userId: string;
      email: string;
      amount?: number;
      reference?: string;
    };

    if (!packId || !userId || !email || !amount) {
      return NextResponse.json(
        { error: 'Missing packId, userId, email, or amount' },
        { status: 400 }
      );
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return NextResponse.json(
        {
          error:
            'Paystack secret key is not configured. Add PAYSTACK_SECRET_KEY to the Vercel environment before redeploying.',
        },
        { status: 500 }
      );
    }

    const transactionReference = reference || `paystack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const callbackUrl = new URL('/dashboard/billing', req.url);
    callbackUrl.searchParams.set('status', 'success');
    callbackUrl.searchParams.set('reference', transactionReference);

    const initializeRes = await fetch(PAYSTACK_INITIALIZE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        callback_url: callbackUrl.toString(),
        metadata: {
          packId,
          userId,
          reference: transactionReference,
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
      reference: transactionReference,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
