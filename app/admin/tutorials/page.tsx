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
import { Plus, Pencil, Trash2, BookOpen, Upload, X } from 'lucide-react';

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase
      .from('tutorials')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setTutorials((data as Tutorial[]) ?? []));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setVideoFile(null);
    setOpen(true);
  };

  const openEdit = (t: Tutorial) => {
    setEditing(t);
    setVideoFile(null);
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
    if (!form.title.trim()) {
      toast.error('Enter a tutorial title.');
      return;
    }
    if (!videoFile && !form.video_url.trim()) {
      toast.error('Choose a video file or enter a video URL.');
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let videoUrl = form.video_url.trim();
      if (videoFile) {
        const extension = videoFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
        uploadedPath = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('tutorial-videos')
          .upload(uploadedPath, videoFile, { contentType: videoFile.type, upsert: false });

        if (uploadError) throw uploadError;
        videoUrl = supabase.storage.from('tutorial-videos').getPublicUrl(uploadedPath).data.publicUrl;
      }

      const payload = { ...form, video_url: videoUrl };
      const { error } = editing
        ? await supabase.from('tutorials').update(payload).eq('id', editing.id)
        : await supabase.from('tutorials').insert(payload);

      if (error) {
        if (uploadedPath) await supabase.storage.from('tutorial-videos').remove([uploadedPath]);
        throw error;
      }

      toast.success(editing ? 'Tutorial updated' : 'Tutorial created');
      setOpen(false);
      setVideoFile(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save tutorial.');
    } finally {
      setSaving(false);
    }
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
            <div className="space-y-2">
              <Label className="text-xs">Upload Video</Label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                <span>{videoFile ? videoFile.name : 'Choose a video from this device'}</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (!file.type.startsWith('video/')) {
                      toast.error('Choose a video file.');
                      event.target.value = '';
                      return;
                    }
                    if (file.size > MAX_VIDEO_SIZE_BYTES) {
                      toast.error('Video must be smaller than 500 MB.');
                      event.target.value = '';
                      return;
                    }
                    setVideoFile(file);
                    setForm({ ...form, video_url: '' });
                  }}
                />
              </label>
              {videoFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setVideoFile(null)}>
                  <X className="mr-1.5 h-4 w-4" /> Remove selected video
                </Button>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Or use an external video URL</Label>
                <Input
                  value={form.video_url}
                  onChange={(event) => {
                    setForm({ ...form, video_url: event.target.value });
                    if (event.target.value) setVideoFile(null);
                  }}
                  placeholder="https://youtube.com/…"
                />
              </div>
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
            <Button onClick={save} disabled={saving}>
              {saving ? (videoFile ? 'Uploading…' : 'Saving…') : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
