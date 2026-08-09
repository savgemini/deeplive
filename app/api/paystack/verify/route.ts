import { NextResponse } from 'next/server';

const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
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
