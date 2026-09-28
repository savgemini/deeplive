'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, CreditPack, Transaction, SiteSettings, ManualPaymentMethod } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Zap, Check, Banknote, Upload, X } from 'lucide-react';

export default function BillingPage() {
  const { profile, refreshProfile } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Pick<SiteSettings, 'vpay_enabled' | 'manual_payment_methods'> | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [manualPack, setManualPack] = useState<CreditPack | null>(null);
  const [manualMethodId, setManualMethodId] = useState<string | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [manualProof, setManualProof] = useState<File | null>(null);
  const [submittingManual, setSubmittingManual] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    supabase
      .from('credit_packs')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setPacks((data as CreditPack[]) ?? []));

    supabase
      .from('settings_public')
      .select('vpay_enabled, manual_payment_methods')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setSettings(data as Pick<SiteSettings, 'vpay_enabled' | 'manual_payment_methods'> | null));

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

        refreshProfile();
        const { data: updatedTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });
        setTransactions((updatedTransactions as Transaction[]) ?? []);
        toast.success('Payment successful! Your credits have been added.');
      };

      completePaystackSuccess();
      router.replace('/dashboard/billing');
    }
  }, [profile, refreshProfile, router, searchParams]);

  const buyPack = async (pack: CreditPack, gateway: 'paystack' | 'vpay') => {
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

    const reference = `${gateway}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from('transactions').insert({
      user_id: profile.id,
      pack_id: pack.id,
      gateway,
      amount_usd: pack.price_usd,
      amount_ngn: pack.price_ngn,
      credits_added: pack.credits,
      status: 'pending',
      reference,
    });

    if (error) {
      toast.error('Vpay checkout could not be started: ' + error.message);
      setPurchasing(null);
      return;
    }

    setTransactions((prev) => [
      {
        id: 'temp_' + Date.now(),
        user_id: profile.id,
        pack_id: pack.id,
        gateway,
        payment_method: null,
        amount_usd: pack.price_usd,
        amount_ngn: pack.price_ngn,
        credits_added: pack.credits,
        status: 'pending',
        reference,
        proof_url: null,
        payment_note: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    toast.info('Vpay checkout is not configured yet. Please use manual payment for now.');
    setPurchasing(null);
  };

  const submitManualPayment = async () => {
    if (!profile || !manualPack) return;
    const selectedManualMethod = settings?.manual_payment_methods.find(
      (method) => method.id === manualMethodId
    );
    if (!selectedManualMethod) {
      toast.error('Please choose an available manual payment method.');
      return;
    }
    if (!manualProof) {
      toast.error('Please upload a payment proof before submitting.');
      return;
    }

    setSubmittingManual(true);

    try {
      const proofDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read payment proof.'));
        reader.readAsDataURL(manualProof);
      });

      const reference = `manual_${Date.now()}`;
      const { error } = await supabase.from('transactions').insert({
        user_id: profile.id,
        pack_id: manualPack.id,
        gateway: 'manual',
        payment_method: selectedManualMethod.name,
        amount_usd: manualPack.price_usd,
        amount_ngn: manualPack.price_ngn,
        credits_added: manualPack.credits,
        status: 'pending',
        reference,
        proof_url: proofDataUrl,
        payment_note: manualNote.trim() || null,
      });

      if (error) {
        toast.error('Unable to submit manual payment: ' + error.message);
        return;
      }

      setTransactions((prev) => [
        {
          id: 'temp_manual_' + Date.now(),
          user_id: profile.id,
          pack_id: manualPack.id,
          gateway: 'manual',
          payment_method: selectedManualMethod.name,
          amount_usd: manualPack.price_usd,
          amount_ngn: manualPack.price_ngn,
          credits_added: manualPack.credits,
          status: 'pending',
          reference,
          proof_url: proofDataUrl,
          payment_note: manualNote.trim() || null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      toast.success('Manual payment submitted for review.');
      setManualPack(null);
      setManualNote('');
      setManualProof(null);
    } finally {
      setSubmittingManual(false);
    }
  };

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
                {settings?.vpay_enabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={purchasing === pack.id + 'vpay'}
                    onClick={() => buyPack(pack, 'vpay')}
                  >
                    {purchasing === pack.id + 'vpay' ? 'Processing…' : 'Pay with Vpay'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setManualPack(pack);
                    setManualMethodId(settings?.manual_payment_methods?.[0]?.id ?? null);
                  }}
                >
                  <Banknote className="mr-1.5 h-3.5 w-3.5" /> Manual Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {manualPack && (
        <Card className="mt-6 border-dashed">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Manual payment for {manualPack.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Pay ${manualPack.price_usd.toFixed(2)} (${manualPack.credits} credits) and upload proof below.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setManualPack(null)} aria-label="Close manual payment form">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(settings?.manual_payment_methods ?? []).map((method: ManualPaymentMethod) => (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={manualMethodId === method.id}
                  onClick={() => setManualMethodId(method.id)}
                  className={`rounded-md border p-4 text-left ${
                    manualMethodId === method.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <p className="mb-2 text-sm font-semibold">{method.name}</p>
                  <div className="space-y-1 text-sm">
                    {method.fields
                      .filter((field) => field.label?.trim() && field.value?.trim())
                      .map((field) => (
                        <p key={field.id} className="break-words">
                          <span className="font-medium">{field.label}:</span> {field.value}
                        </p>
                      ))}
                  </div>
                </button>
              ))}
              {!settings?.manual_payment_methods?.length && (
                <p className="text-sm text-muted-foreground">No manual payment methods are currently available.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                <span>{manualProof ? manualProof.name : 'Upload payment proof'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setManualProof(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment note (optional)</label>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                rows={3}
                placeholder="Add a note for the admin, such as the transfer reference or time sent."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setManualPack(null); setManualMethodId(null); }}>
                Cancel
              </Button>
              <Button onClick={submitManualPayment} disabled={submittingManual || !manualProof || !manualMethodId}>
                {submittingManual ? 'Submitting…' : 'Submit Payment Proof'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t.credits_added} credits via {t.gateway === 'manual' ? 'Manual Payment' : t.gateway}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} · ${t.amount_usd.toFixed(2)}
                      </p>
                      {t.payment_note && (
                        <p className="mt-1 text-xs text-muted-foreground">Note: {t.payment_note}</p>
                      )}
                      {t.proof_url && (
                        <a href={t.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                          View proof
                        </a>
                      )}
                    </div>
                  </div>
                  <Badge variant={t.status === 'success' ? 'default' : t.status === 'failed' ? 'destructive' : 'secondary'}>
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
