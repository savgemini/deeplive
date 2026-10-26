'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPayments() {
  const { session } = useAuth();
  const [txns, setTxns] = useState<(Transaction & { user_email: string | null })[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTxns = async () => {
    if (!session?.access_token) return;

    const response = await fetch('/api/admin/payments', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || 'Unable to load payments.');
      return;
    }

    setTxns(data.transactions as (Transaction & { user_email: string | null })[]);
  };

  useEffect(() => {
    if (session) void loadTxns();
  }, [session]);

  const handleDecision = async (transaction: Transaction, decision: 'success' | 'failed') => {
    if (!transaction.id || transaction.gateway !== 'manual' || transaction.status !== 'pending') return;
    setUpdatingId(transaction.id);

    try {
      if (!session?.access_token) {
        toast.error('Authentication required.');
        return;
      }

      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId: transaction.id, decision }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Could not update payment status.');
        return;
      }

      toast.success(`Payment marked as ${decision}.`);
      await loadTxns();
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleTxns = txns.filter((t) => t.gateway === 'manual' || t.status !== 'pending');
  const filtered = visibleTxns.filter((t) => {
    const matchesSearch =
      t.reference?.toLowerCase().includes(search.toLowerCase()) ||
      t.gateway.toLowerCase().includes(search.toLowerCase()) ||
      t.user_email?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Deposits</h1>
        <p className="mt-1 text-muted-foreground">Crypto deposits awaiting review and completed gateway payments.</p>
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
                  <th className="pb-3 pr-4 font-medium">User Email</th>
                  <th className="pb-3 pr-4 font-medium">Gateway</th>
                  <th className="pb-3 pr-4 font-medium">Payment Method</th>
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
                    <td className="py-3 pr-4">{t.user_email ?? 'Unknown user'}</td>
                    <td className="py-3 pr-4 capitalize">{t.gateway}</td>
                    <td className="py-3 pr-4">{t.payment_method || '—'}</td>
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
                      {t.status === 'pending' && t.gateway === 'manual' && (
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
                    <td colSpan={10} className="py-8 text-center text-muted-foreground">
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
