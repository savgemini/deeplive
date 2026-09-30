'use client';

import { useEffect, useState } from 'react';
import { supabase, SiteSettings, ManualPaymentField, ManualPaymentMethod } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Upload, X } from 'lucide-react';

const MAX_HERO_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null);
  const [qrCodeFiles, setQrCodeFiles] = useState<Record<string, File>>({});
  const [heroVideoSettingAvailable, setHeroVideoSettingAvailable] = useState(false);

  const updateManualMethod = (methodId: string, updates: Partial<ManualPaymentMethod>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      manual_payment_methods: (settings.manual_payment_methods ?? []).map((method) =>
        method.id === methodId ? { ...method, ...updates } : method
      ),
    });
  };

  const updateManualField = (
    method: ManualPaymentMethod,
    fieldId: string,
    updates: Partial<ManualPaymentField>
  ) => {
    updateManualMethod(method.id, {
      fields: method.fields.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      ),
    });
  };

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        toast.error(`Unable to load settings: ${error.message}`);
        return;
      }

      if (data) {
        setHeroVideoSettingAvailable(Object.prototype.hasOwnProperty.call(data, 'hero_video_url'));
        setSettings(data as SiteSettings);
      }
    };

    loadSettings();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const uploadedFiles: { bucket: string; path: string }[] = [];

    try {
      let heroVideoUrl = settings.hero_video_url?.trim() || null;
      if (heroVideoFile && !heroVideoSettingAvailable) {
        throw new Error('Apply the homepage hero video Supabase migration before uploading a video.');
      }
      if (heroVideoFile) {
        const extension = heroVideoFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('site-media')
          .upload(path, heroVideoFile, { contentType: heroVideoFile.type, upsert: false });

        if (uploadError) throw uploadError;
        uploadedFiles.push({ bucket: 'site-media', path });
        heroVideoUrl = supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
      }

      let manualPaymentMethods = settings.manual_payment_methods ?? [];
      for (const method of manualPaymentMethods) {
        const qrFile = qrCodeFiles[method.id];
        if (!qrFile) continue;

        const extension = qrFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'png';
        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-method-qrs')
          .upload(path, qrFile, { contentType: qrFile.type, upsert: false });

        if (uploadError) throw uploadError;
        uploadedFiles.push({ bucket: 'payment-method-qrs', path });
        const qrCodeUrl = supabase.storage.from('payment-method-qrs').getPublicUrl(path).data.publicUrl;
        manualPaymentMethods = manualPaymentMethods.map((item) =>
          item.id === method.id ? { ...item, qr_code_url: qrCodeUrl } : item
        );
      }

      const payload: Record<string, unknown> = {
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
        vpay_enabled: settings.vpay_enabled,
        manual_payment_methods: manualPaymentMethods,
        manual_payment_bank_name: settings.manual_payment_bank_name,
        manual_payment_account_name: settings.manual_payment_account_name,
        manual_payment_account_number: settings.manual_payment_account_number,
        manual_payment_wallet_name: settings.manual_payment_wallet_name,
        manual_payment_wallet_number: settings.manual_payment_wallet_number,
        manual_payment_instructions: settings.manual_payment_instructions,
        decart_api_key: settings.decart_api_key,
        updated_at: new Date().toISOString(),
      };

      if (heroVideoSettingAvailable) payload.hero_video_url = heroVideoUrl;

      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'id' }).select();
      if (error) throw error;

      setSettings({ ...settings, hero_video_url: heroVideoUrl, manual_payment_methods: manualPaymentMethods });
      setHeroVideoFile(null);
      setQrCodeFiles({});
      toast.success('Settings saved');
    } catch (error) {
      await Promise.all(
        uploadedFiles.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path]))
      );
      console.error('Failed to save settings:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
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
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Show Pay with Vpay</Label>
                <p className="text-xs text-muted-foreground">Display the Vpay option on the billing page</p>
              </div>
              <Switch
                checked={settings.vpay_enabled ?? false}
                onCheckedChange={(value) => setSettings({ ...settings, vpay_enabled: value })}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Manual Payment Methods</Label>
                  <p className="text-xs text-muted-foreground">Add bank accounts, wallets, or other transfer options.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSettings({
                    ...settings,
                    manual_payment_methods: [
                      ...(settings.manual_payment_methods ?? []),
                      { id: crypto.randomUUID(), name: 'New payment method', fields: [] },
                    ],
                  })}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Method
                </Button>
              </div>

              {(settings.manual_payment_methods ?? []).map((method) => (
                <div key={method.id} className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label className="text-xs">Method Name</Label>
                      <Input
                        value={method.name}
                        onChange={(event) => updateManualMethod(method.id, { name: event.target.value })}
                        placeholder="USD bank transfer"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${method.name || 'payment method'}`}
                      onClick={() => setSettings({
                        ...settings,
                        manual_payment_methods: (settings.manual_payment_methods ?? []).filter(
                          (item) => item.id !== method.id
                        ),
                      })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {method.fields.map((field) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label className="text-xs">Field Label</Label>
                        <Input
                          value={field.label}
                          onChange={(event) => updateManualField(method, field.id, { label: event.target.value })}
                          placeholder="Account number"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={field.value}
                          onChange={(event) => updateManualField(method, field.id, { value: event.target.value })}
                          placeholder="Enter payment detail"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${field.label || 'payment field'}`}
                        onClick={() => updateManualMethod(method.id, {
                          fields: method.fields.filter((item) => item.id !== field.id),
                        })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateManualMethod(method.id, {
                      fields: [
                        ...method.fields,
                        { id: crypto.randomUUID(), label: '', value: '' },
                      ],
                    })}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add Field
                  </Button>

                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-xs">QR Code (optional)</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30">
                        <Upload className="h-4 w-4" />
                        <span>
                          {qrCodeFiles[method.id]?.name ??
                            (method.qr_code_url ? 'Replace QR code' : 'Upload QR code')}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (!file) return;
                            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                              toast.error('QR codes must be PNG, JPEG, or WebP images.');
                              return;
                            }
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('QR code images must be smaller than 10 MB.');
                              return;
                            }
                            setQrCodeFiles((current) => ({ ...current, [method.id]: file }));
                          }}
                        />
                      </label>
                      {(method.qr_code_url || qrCodeFiles[method.id]) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateManualMethod(method.id, { qr_code_url: null });
                            setQrCodeFiles((current) => {
                              const next = { ...current };
                              delete next[method.id];
                              return next;
                            });
                          }}
                        >
                          <X className="mr-1 h-4 w-4" /> Remove QR
                        </Button>
                      )}
                    </div>
                    {method.qr_code_url && (
                      <img
                        src={method.qr_code_url}
                        alt={`${method.name} payment QR code`}
                        className="h-32 w-32 rounded-md border border-border bg-white object-contain p-2"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Decart API Key</Label>
              <Input type="password" value={settings.decart_api_key ?? ''} onChange={(e) => setSettings({ ...settings, decart_api_key: e.target.value })} placeholder="decart_…" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Homepage Hero Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!heroVideoSettingAvailable && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Apply migration 20260906000000 in Supabase SQL Editor to enable homepage video editing.
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Upload a video</Label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                <span>{heroVideoFile ? heroVideoFile.name : 'Choose a video from this device'}</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg"
                  className="hidden"
                  disabled={!heroVideoSettingAvailable}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (!file.type.startsWith('video/')) {
                      toast.error('Choose a video file.');
                      event.target.value = '';
                      return;
                    }
                    if (file.size > MAX_HERO_VIDEO_SIZE_BYTES) {
                      toast.error('Video must be smaller than 500 MB.');
                      event.target.value = '';
                      return;
                    }
                    setHeroVideoFile(file);
                    setSettings({ ...settings, hero_video_url: null });
                  }}
                />
              </label>
              {heroVideoFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setHeroVideoFile(null)}>
                  <X className="mr-1.5 h-4 w-4" /> Remove selected video
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Or enter a direct video URL</Label>
              <Input
                value={settings.hero_video_url ?? ''}
                disabled={!heroVideoSettingAvailable}
                onChange={(event) => {
                  setSettings({ ...settings, hero_video_url: event.target.value || null });
                  if (event.target.value) setHeroVideoFile(null);
                }}
                placeholder="https://example.com/hero-video.mp4"
              />
            </div>
            {settings.hero_video_url && (
              <div className="max-w-xl overflow-hidden rounded-md border border-border bg-black">
                <video src={settings.hero_video_url} controls playsInline className="aspect-video w-full object-contain" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
