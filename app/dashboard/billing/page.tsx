'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, CreditPack, Transaction } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Zap, Check } from 'lucide-react';

export default function BillingPage() {
  const { profile, refreshProfile } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    supabase
      .from('credit_packs')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setPacks((data as CreditPack[]) ?? []));
    if (profile) {
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
    }
  }, [profile]);

  useEffect(() => {
    const status = searchParams.get('status');
    const reference = searchParams.get('reference');

    if (status === 'success' && reference && profile) {
      const completePaystackSuccess = async () => {
        const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          toast.error(data.error || 'Paystack verification failed.');
          return;
        }

        const { data: existingTx, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('reference', reference)
          .maybeSingle();

        if (txError) {
          toast.error('Unable to update transaction record.');
          return;
        }

        if (!existingTx) {
          toast.error('Payment was completed but the transaction record was not found.');
          return;
        }

        const { error: updateTxError } = await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('reference', reference);

        if (updateTxError) {
          toast.error('Unable to finalize the payment record.');
          return;
        }

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ credits_balance: (profile.credits_balance ?? 0) + existingTx.credits_added })
          .eq('id', profile.id);

        if (updateProfileError) {
          toast.error('Payment succeeded but credits were not added.');
          return;
        }

        refreshProfile();
        toast.success('Payment successful! Your credits have been added.');
      };

      completePaystackSuccess();
      router.replace('/dashboard/billing');
    }
  }, [profile, refreshProfile, router, searchParams]);

  const buyPack = async (pack: CreditPack, gateway: 'paystack' | 'stripe') => {
    if (!profile) return;
    setPurchasing(pack.id + gateway);

    if (gateway === 'paystack') {
      const reference = `paystack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: profile.id,
        pack_id: pack.id,
        gateway,
        amount_usd: pack.price_usd,
        amount_ngn: pack.price_ngn,
        credits_added: pack.credits,
        status: 'pending',
        reference,
      });

      if (txError) {
        toast.error('Unable to start payment: ' + txError.message);
        setPurchasing(null);
        return;
      }

      const response = await fetch('/api/paystack/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packId: pack.id,
          amount: pack.price_ngn,
          userId: profile.id,
          email: profile.email,
          reference,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.authorization_url) {
        toast.error(data.error || data.message || 'Paystack checkout failed.');
        setPurchasing(null);
        return;
      }

      window.location.assign(data.authorization_url);
      return;
    }

    // Stripe payment remains mocked for now.
    await new Promise((r) => setTimeout(r, 1200));

    const { error } = await supabase.from('transactions').insert({
      user_id: profile.id,
      pack_id: pack.id,
      gateway,
      amount_usd: pack.price_usd,
      amount_ngn: pack.price_ngn,
      credits_added: pack.credits,
      status: 'success',
      reference: `${gateway}_${Date.now()}`,
    });

    if (error) {
      toast.error('Payment failed: ' + error.message);
      setPurchasing(null);
      return;
    }

    // add credits to profile
    await supabase
      .from('profiles')
      .update({
        credits_balance: profile.credits_balance + pack.credits,
      })
      .eq('id', profile.id);

    refreshProfile();
    setTransactions((prev) => [
      {
        id: 'temp_' + Date.now(),
        user_id: profile.id,
        pack_id: pack.id,
        gateway,
        amount_usd: pack.price_usd,
        amount_ngn: pack.price_ngn,
        credits_added: pack.credits,
        status: 'success',
        reference: `${gateway}_${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    toast.success(`${pack.credits} credits added to your account!`);
    setPurchasing(null);
  };

  const packMinutes = (pack: CreditPack) => pack.minutes;

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
        <p className="mt-1 text-muted-foreground">
          Buy credits and view your purchase history.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" fill="currentColor" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current balance</p>
              <p className="text-2xl font-bold">{profile?.credits_balance ?? 0} credits</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Approx. minutes</p>
            <p className="text-2xl font-bold">
              {Math.floor((profile?.credits_balance ?? 0) / 125)}
            </p>
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-xl font-semibold">Buy Credit Packs</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {packs.map((pack) => (
          <Card
            key={pack.id}
            className={`relative flex flex-col ${
              pack.popular ? 'border-primary glow-primary' : ''
            }`}
          >
            {pack.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Popular
              </Badge>
            )}
            <CardContent className="flex flex-1 flex-col pt-6">
              <h3 className="text-lg font-semibold">{pack.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {pack.description}
              </p>
              <div className="mt-4">
                <span className="text-2xl font-bold">
                  ${pack.price_usd.toFixed(0)}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">USD</span>
              </div>
              <div className="text-sm text-muted-foreground">
                ₦{pack.price_ngn.toLocaleString()}
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold">{pack.credits}</span>
                <span className="ml-1 text-xs text-muted-foreground">credits</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {pack.minutes} minutes
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Valid {pack.validity_months} months
              </p>
              <div className="mt-4 space-y-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={purchasing === pack.id + 'paystack'}
                  onClick={() => buyPack(pack, 'paystack')}
                >
                  {purchasing === pack.id + 'paystack' ? (
                    'Processing…'
                  ) : (
                    <>
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Pay with Paystack
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={purchasing === pack.id + 'stripe'}
                  onClick={() => buyPack(pack, 'stripe')}
                >
                  {purchasing === pack.id + 'stripe' ? 'Processing…' : 'Pay with Stripe'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Purchase History</h2>
      <Card>
        <CardContent className="pt-6">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchases yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t.credits_added} credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} · {t.gateway} ·{' '}
                        ${t.amount_usd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={t.status === 'success' ? 'default' : 'secondary'}>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
