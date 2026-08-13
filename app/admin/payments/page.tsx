'use client';

import { useEffect, useState } from 'react';
import { supabase, Transaction } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPayments() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTxns = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setTxns((data as Transaction[]) ?? []);
  };

  useEffect(() => {
    loadTxns();
  }, []);

  const handleDecision = async (transaction: Transaction, decision: 'success' | 'failed') => {
    if (!transaction.id) return;
    setUpdatingId(transaction.id);

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: decision })
        .eq('id', transaction.id);

      if (error) {
        toast.error('Could not update payment status.');
        return;
      }

      if (decision === 'success') {
        const { data: profile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('credits_balance')
          .eq('id', transaction.user_id)
          .maybeSingle();

        if (profileFetchError) {
          toast.error('Payment approved but the user balance could not be loaded.');
          return;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            credits_balance: (profile?.credits_balance ?? 0) + transaction.credits_added,
          })
          .eq('id', transaction.user_id);

        if (profileError) {
          toast.error('Payment approved but credits were not added.');
          return;
        }
      }

      toast.success(`Payment marked as ${decision}.`);
      await loadTxns();
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = txns.filter((t) => {
    const matchesSearch =
      t.reference?.toLowerCase().includes(search.toLowerCase()) ||
      t.gateway.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Deposits</h1>
        <p className="mt-1 text-muted-foreground">All successful and pending deposits across gateways.</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference or gateway…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'success', 'failed', 'pending'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Reference</th>
                  <th className="pb-3 pr-4 font-medium">Gateway</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Credits</th>
                  <th className="pb-3 pr-4 font-medium">Proof</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Actions</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-4 font-mono text-xs">
                      {t.reference ?? t.id.slice(0, 8)}
                    </td>
                    <td className="py-3 pr-4 capitalize">{t.gateway}</td>
                    <td className="py-3 pr-4">
                      ${t.amount_usd.toFixed(2)}
                      {t.amount_ngn && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          / ₦{t.amount_ngn.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{t.credits_added}</td>
                    <td className="py-3 pr-4">
                      {t.proof_url ? (
                        <a href={t.proof_url} target="_blank" rel="noreferrer" className="text-primary underline">
                          View proof
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          t.status === 'success'
                            ? 'default'
                            : t.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {t.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleDecision(t, 'success')}
                            disabled={updatingId === t.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDecision(t, 'failed')}
                            disabled={updatingId === t.id}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
