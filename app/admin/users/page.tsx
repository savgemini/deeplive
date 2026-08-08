'use client';

import { useEffect, useState } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle, Plus, Minus, Trash2, Eye } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [creditAmount, setCreditAmount] = useState(50);
  const pageSize = 20;

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .then(({ data }) => setUsers((data as Profile[]) ?? []));
  }, [page]);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleBan = async (user: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ banned: !user.banned })
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to update user');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, banned: !u.banned } : u))
    );
    toast.success(user.banned ? 'User unbanned' : 'User banned');
  };

  const adjustCredits = async (user: Profile, amount: number) => {
    const newBalance = Math.max(0, user.credits_balance + amount);
    const { error } = await supabase
      .from('profiles')
      .update({ credits_balance: newBalance })
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to adjust credits');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, credits_balance: newBalance } : u))
    );
    setSelected((prev) =>
      prev?.id === user.id ? { ...prev, credits_balance: newBalance } : prev
    );
    toast.success(`${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} credits`);
  };

  const deleteUser = async (user: Profile) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to delete user');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    toast.success('User deleted');
  };

  return (
    <AdminShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-muted-foreground">Search, manage, and moderate users.</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Credits</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium">{u.full_name ?? 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 font-medium">{u.credits_balance}</td>
                    <td className="py-3 pr-4">
                      {u.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setSelected(u)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{u.email}</DialogTitle>
                            </DialogHeader>
                            {selected && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Name</p>
                                    <p className="font-medium">{u.full_name ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Role</p>
                                    <p className="font-medium">{u.role}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Credits</p>
                                    <p className="font-medium">{u.credits_balance}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Referral</p>
                                    <p className="font-medium">{u.referral_code ?? '—'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-border pt-4">
                                  <Input
                                    type="number"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                                    className="w-24"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => adjustCredits(u, creditAmount)}
                                  >
                                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => adjustCredits(u, -creditAmount)}
                                  >
                                    <Minus className="mr-1 h-3.5 w-3.5" /> Remove
                                  </Button>
                                </div>
                                <div className="flex gap-2 border-t border-border pt-4">
                                  <Button
                                    size="sm"
                                    variant={u.banned ? 'default' : 'destructive'}
                                    onClick={() => toggleBan(u)}
                                  >
                                    {u.banned ? (
                                      <><CheckCircle className="mr-1 h-3.5 w-3.5" /> Unban</>
                                    ) : (
                                      <><Ban className="mr-1 h-3.5 w-3.5" /> Ban</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteUser(u)}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleBan(u)}
                        >
                          {u.banned ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <Ban className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page + 1}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
