'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, CreditPack, Transaction, SiteSettings, ManualPaymentMethod } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Zap, Check, Banknote, Upload, Loader2 } from 'lucide-react';

export default function BillingPage() {
  const { profile, refreshProfile } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Pick<SiteSettings, 'vpay_enabled' | 'manual_payment_methods'> | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [manualPack, setManualPack] = useState<CreditPack | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualStep, setManualStep] = useState<'methods' | 'loading-details' | 'details' | 'complete'>('methods');
  const [manualMethodId, setManualMethodId] = useState<string | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const manualProofInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedManualMethod = settings?.manual_payment_methods.find(
    (method) => method.id === manualMethodId
  ) ?? null;

  useEffect(() => {
    if (!manualDialogOpen || manualStep !== 'loading-details') return;
    const timeout = window.setTimeout(() => setManualStep('details'), 3000);
    return () => window.clearTimeout(timeout);
  }, [manualDialogOpen, manualStep]);

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

    toast.info('Vpay checkout is not configured yet. Please use crypto payment for now.');
    setPurchasing(null);
  };

  const submitManualPayment = async (proofFile: File) => {
    if (!profile || !manualPack) return;
    if (!selectedManualMethod) {
      toast.error('Please choose an available crypto payment method.');
      return;
    }
    if (proofFile.size > 10 * 1024 * 1024) {
      toast.error('Payment proof must be smaller than 10 MB.');
      return;
    }

    setSubmittingManual(true);

    try {
      const proofDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read payment proof.'));
        reader.readAsDataURL(proofFile);
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
        toast.error('Unable to submit crypto payment: ' + error.message);
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

      toast.success('Crypto payment submitted for review.');
      setManualNote('');
      setManualStep('complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit payment proof.');
    } finally {
      setSubmittingManual(false);
    }
  };

  const closeManualPayment = (open: boolean) => {
    setManualDialogOpen(open);
    if (!open) {
      setManualPack(null);
      setManualMethodId(null);
      setManualNote('');
      setManualStep('methods');
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
                  variant="outline"
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
                  className="w-full"
                  onClick={() => {
                    setManualPack(pack);
                    setManualDialogOpen(true);
                    setManualMethodId(null);
                    setManualStep('methods');
                  }}
                >
                  <Banknote className="mr-1.5 h-3.5 w-3.5" /> Pay with Crypto
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={manualDialogOpen} onOpenChange={closeManualPayment}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {manualStep === 'methods' && 'Choose a payment method'}
              {manualStep === 'loading-details' && 'Preparing payment details'}
              {(manualStep === 'details' || manualStep === 'complete') && 'Complete your transfer'}
            </DialogTitle>
            {manualPack && (
              <p className="text-sm text-muted-foreground">
                {manualPack.name} · ${manualPack.price_usd.toFixed(2)} · {manualPack.credits} credits
              </p>
            )}
          </DialogHeader>

          {manualStep === 'methods' && (
            <div className="space-y-3">
              {(settings?.manual_payment_methods ?? []).map((method: ManualPaymentMethod) => {
                const labels = method.fields
                  .map((field) => field.label.trim())
                  .filter(Boolean);
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setManualMethodId(method.id);
                      setManualStep('loading-details');
                    }}
                    className="w-full rounded-md border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <span className="block font-semibold">{method.name}</span>
                    {labels.length > 0 && (
                      <span className="mt-2 block text-sm text-muted-foreground">
                        {labels.join(' · ')}
                      </span>
                    )}
                  </button>
                );
              })}
              {!settings?.manual_payment_methods?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No crypto payment methods are currently available.
                </p>
              )}
            </div>
          )}

          {manualStep === 'loading-details' && (
            <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading payment details…</p>
            </div>
          )}

          {(manualStep === 'details' || manualStep === 'complete') && selectedManualMethod && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <h3 className="font-semibold">{selectedManualMethod.name}</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {selectedManualMethod.fields
                    .filter((field) => field.label.trim() && field.value.trim())
                    .map((field) => (
                      <p key={field.id} className="break-words">
                        <span className="font-medium">{field.label}:</span> {field.value}
                      </p>
                    ))}
                </div>
                {selectedManualMethod.qr_code_url && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-sm font-medium">Scan to pay</p>
                    <img
                      src={selectedManualMethod.qr_code_url}
                      alt={`${selectedManualMethod.name} payment QR code`}
                      className="mx-auto max-h-64 w-full max-w-64 rounded-md bg-white object-contain p-2"
                    />
                  </div>
                )}
              </div>

              {manualStep === 'complete' ? (
                <div role="status" className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-medium">Proof submitted</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your transaction is pending until an admin reviews and approves it.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment note (optional)</label>
                    <textarea
                      value={manualNote}
                      onChange={(event) => setManualNote(event.target.value)}
                      rows={2}
                      placeholder="Transfer reference or a note for the admin"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <input
                    ref={manualProofInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      void submitManualPayment(file);
                    }}
                  />
                  <DialogFooter className="gap-2 sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submittingManual}
                      onClick={() => {
                        setManualStep('methods');
                      }}
                    >
                      Back to methods
                    </Button>
                    <Button
                      type="button"
                      disabled={submittingManual}
                      onClick={() => manualProofInputRef.current?.click()}
                    >
                      {submittingManual ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading proof…</>
                      ) : (
                        <><Upload className="mr-2 h-4 w-4" /> I've made this transfer</>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}

          {manualStep === 'complete' && (
            <DialogFooter>
              <Button onClick={() => closeManualPayment(false)}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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
                        {t.credits_added} credits via {t.gateway === 'manual' ? 'Pay with Crypto' : t.gateway}
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
