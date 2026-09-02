'use client';

import { useEffect, useState } from 'react';
import { supabase, CreditPack } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

type PackForm = {
  slug: string;
  name: string;
  description: string;
  price_usd: number;
  price_ngn: number;
  credits: number;
  minutes: number;
  validity_months: number;
  discount_percent: number;
  popular: boolean;
  active: boolean;
  sort_order: number;
};

const emptyForm: PackForm = {
  slug: '',
  name: '',
  description: '',
  price_usd: 0,
  price_ngn: 0,
  credits: 0,
  minutes: 0,
  validity_months: 3,
  discount_percent: 0,
  popular: false,
  active: true,
  sort_order: 0,
};

export default function AdminPacks() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditPack | null>(null);
  const [form, setForm] = useState<PackForm>(emptyForm);

  const load = () => {
    supabase
      .from('credit_packs')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error(`Unable to load credit packs: ${error.message}`);
          return;
        }
        setPacks((data as CreditPack[]) ?? []);
      });
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: CreditPack) => {
    setEditing(p);
    setForm({
      slug: p.slug,
      name: p.name,
      description: p.description ?? '',
      price_usd: p.price_usd,
      price_ngn: p.price_ngn,
      credits: (p as any).credits ?? p.minutes,
      minutes: p.minutes,
      validity_months: p.validity_months,
      discount_percent: p.discount_percent,
      popular: p.popular,
      active: p.active,
      sort_order: p.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (editing) {
      const { error } = await supabase
        .from('credit_packs')
        .update(form)
        .eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Pack updated');
    } else {
      const { error } = await supabase.from('credit_packs').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Pack created');
    }
    setOpen(false);
    load();
  };

  const del = async (p: CreditPack) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    const { error } = await supabase.from('credit_packs').delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    load();
    toast.success('Pack deleted');
  };

  return (
    <AdminShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Packs</h1>
          <p className="mt-1 text-muted-foreground">Manage purchasable credit packages.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New Pack
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.popular && <Badge>Popular</Badge>}
                </div>
                {!p.active && <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">USD</p>
                  <p className="font-medium">${p.price_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NGN</p>
                  <p className="font-medium">₦{p.price_ngn.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="font-medium">{(p as any).credits ?? p.minutes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                  <p className="font-medium">{p.minutes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Validity</p>
                  <p className="font-medium">{p.validity_months}mo</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => del(p)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pack' : 'New Credit Pack'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price USD</Label>
              <Input type="number" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price NGN</Label>
              <Input type="number" value={form.price_ngn} onChange={(e) => setForm({ ...form, price_ngn: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Credits</Label>
              <Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Minutes</Label>
              <Input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validity (months)</Label>
              <Input type="number" value={form.validity_months} onChange={(e) => setForm({ ...form, validity_months: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Discount %</Label>
              <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-xs">Popular</Label>
              <Switch checked={form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-xs">Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
