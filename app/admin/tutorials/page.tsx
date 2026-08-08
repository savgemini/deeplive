'use client';

import { useEffect, useState } from 'react';
import { supabase, Tutorial } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';

type TForm = {
  title: string;
  description: string;
  category: string;
  video_url: string;
  premium: boolean;
  duration_minutes: number;
  sort_order: number;
};

const empty: TForm = {
  title: '',
  description: '',
  category: 'Getting Started',
  video_url: '',
  premium: false,
  duration_minutes: 5,
  sort_order: 0,
};

export default function AdminTutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [form, setForm] = useState<TForm>(empty);

  const load = () => {
    supabase
      .from('tutorials')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setTutorials((data as Tutorial[]) ?? []));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };

  const openEdit = (t: Tutorial) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      category: t.category,
      video_url: t.video_url,
      premium: t.premium,
      duration_minutes: t.duration_minutes,
      sort_order: t.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (editing) {
      const { error } = await supabase.from('tutorials').update(form).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Tutorial updated');
    } else {
      const { error } = await supabase.from('tutorials').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Tutorial created');
    }
    setOpen(false);
    load();
  };

  const del = async (t: Tutorial) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from('tutorials').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    load();
    toast.success('Tutorial deleted');
  };

  return (
    <AdminShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutorials Management</h1>
          <p className="mt-1 text-muted-foreground">Manage video tutorials and categories.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New Tutorial
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">{t.title}</h3>
                </div>
                {t.premium ? (
                  <Badge variant="secondary">Premium</Badge>
                ) : (
                  <Badge variant="outline">Free</Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline">{t.category}</Badge>
                <span className="text-xs text-muted-foreground">{t.duration_minutes} min</span>
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => del(t)}>
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
            <DialogTitle>{editing ? 'Edit Tutorial' : 'New Tutorial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Video URL</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label className="text-xs">Premium</Label>
                <Switch checked={form.premium} onCheckedChange={(v) => setForm({ ...form, premium: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
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
