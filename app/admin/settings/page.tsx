'use client';

import { useEffect, useState } from 'react';
import { supabase, SiteSettings } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setSettings(data as SiteSettings | null));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);

    const payload = {
      id: 1,
      site_name: settings.site_name,
      free_trial_seconds: settings.free_trial_seconds,
      watermark_text: settings.watermark_text,
      maintenance_mode: settings.maintenance_mode,
      referral_commission_percent: settings.referral_commission_percent,
      paystack_public_key: settings.paystack_public_key,
      paystack_secret_key: settings.paystack_secret_key,
      vpay_public_key: settings.vpay_public_key,
      vpay_secret_key: settings.vpay_secret_key,
      decart_api_key: settings.decart_api_key,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'id' }).select();
    setSaving(false);

    if (error) {
      console.error('Failed to save settings:', error);
      toast.error(error.message || 'Failed to save settings');
      return;
    }

    toast.success('Settings saved');
  };

  if (!settings) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Settings</h1>
          <p className="mt-1 text-muted-foreground">Configure global platform settings.</p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Site Name</Label>
              <Input value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Free Trial Duration (seconds)</Label>
              <Input type="number" value={settings.free_trial_seconds} onChange={(e) => setSettings({ ...settings, free_trial_seconds: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Watermark Text</Label>
              <Input value={settings.watermark_text} onChange={(e) => setSettings({ ...settings, watermark_text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Referral Commission (%)</Label>
              <Input type="number" value={settings.referral_commission_percent} onChange={(e) => setSettings({ ...settings, referral_commission_percent: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Block user access temporarily</p>
              </div>
              <Switch checked={settings.maintenance_mode} onCheckedChange={(v) => setSettings({ ...settings, maintenance_mode: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Gateways</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Paystack Public Key</Label>
              <Input value={settings.paystack_public_key ?? ''} onChange={(e) => setSettings({ ...settings, paystack_public_key: e.target.value })} placeholder="pk_test_…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Paystack Secret Key</Label>
              <Input type="password" value={settings.paystack_secret_key ?? ''} onChange={(e) => setSettings({ ...settings, paystack_secret_key: e.target.value })} placeholder="sk_test_…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vpay Public Key</Label>
              <Input value={settings.vpay_public_key ?? ''} onChange={(e) => setSettings({ ...settings, vpay_public_key: e.target.value })} placeholder="pk_live_…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vpay Secret Key</Label>
              <Input type="password" value={settings.vpay_secret_key ?? ''} onChange={(e) => setSettings({ ...settings, vpay_secret_key: e.target.value })} placeholder="sk_live_…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Decart API Key</Label>
              <Input type="password" value={settings.decart_api_key ?? ''} onChange={(e) => setSettings({ ...settings, decart_api_key: e.target.value })} placeholder="decart_…" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
