'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { CREDITS_PER_MINUTE, formatSessionDuration, getBillableMinutes } from '@/lib/session-usage';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Video,
  VideoOff,
  Play,
  Square,
  Settings2,
  Sparkles,
  Clock,
  Upload,
  Info,
  Loader2,
  Wifi,
  WifiOff,
  Camera,
  Wand2,
  Eye,
  EyeOff,
} from 'lucide-react';

const PRESETS = [
  { id: 'default', label: 'Default', prompt: 'Transform the person in the video with a subtle AI avatar style that preserves natural facial motion and lighting.' },
  { id: 'anime', label: 'Anime Hero', prompt: 'Substitute the character in the video with an anime-style hero with spiky silver hair and glowing blue eyes.' },
  { id: 'renaissance', label: 'Renaissance Painting', prompt: 'Substitute the character in the video with a Renaissance oil painting portrait.' },
  { id: 'cyberpunk', label: 'Cyberpunk', prompt: 'Transform the person into a cyberpunk character with neon cybernetic implants and glowing magenta visor.' },
  { id: 'claymation', label: 'Claymation', prompt: 'Transform the video into a claymation stop-motion animation style with visible fingerprints on the clay.' },
  { id: 'watercolor', label: 'Watercolor', prompt: 'Transform the video into a soft watercolor painting with pastel washes and visible paper texture.' },
  { id: 'pixar', label: '3D Cartoon', prompt: 'Transform the person into a 3D animated cartoon character with large expressive eyes and smooth skin.' },
];

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'generating' | 'disconnected' | 'reconnecting' | 'error';
type ActiveSession = {
  id: string;
  startedAt: number;
  chargedCredits: number;
  chargedMinutes: number;
  stopping: boolean;
  chargePromise: Promise<{ chargedCredits: number; balanceAfter: number } | null> | null;
};

export default function LiveCamPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<ActiveSession | null>(null);
  const realtimeClientRef = useRef<{
    disconnect: () => void;
    setPrompt: (p: string, opts?: { enhance?: boolean }) => Promise<void>;
    set: (input: { prompt?: string; image?: Blob | File | string | null; enhance?: boolean }) => Promise<void>;
  } | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPreviewBlurred, setCameraPreviewBlurred] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [watermark, setWatermark] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [customPrompt, setCustomPrompt] = useState(PRESETS[0].prompt);
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState({ durationSeconds: 0, creditsUsed: 0, minutesUsed: 0, balanceAfter: 0 });

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then((devices) => {
        const cams = devices.filter((d) => d.kind === 'videoinput');
        setCameras(cams);
        if (cams[0]) setSelectedCamera(cams[0].deviceId);
      })
      .catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setLoadingCamera(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1088 },
          height: { ideal: 624 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access and reload.');
      } else {
        toast.error('Could not access camera.');
      }
    } finally {
      setLoadingCamera(false);
    }
  }, [selectedCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startSession = async () => {
    if (!profile) return;
    if (!customPrompt.trim()) {
      toast.error('Enter an AI prompt before starting the session.');
      return;
    }
    if (profile.credits_balance <= 0) {
      toast.error('You have no credits. Buy a pack to continue.');
      router.push('/dashboard/billing');
      return;
    }
    if (!cameraOn || !streamRef.current) {
      await startCamera();
      if (!streamRef.current) return;
    }

    setConnecting(true);
    setConnState('connecting');

    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      if (!accessToken) {
        toast.error('Not authenticated. Please log in again.');
        setConnecting(false);
        setConnState('error');
        return;
      }

      const tokenResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/decart-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ expiresIn: 3600, allowedModels: ['lucy-2.1'] }),
        }
      );

      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get Decart token');
      }

      const tokenData = await tokenResponse.json();
      console.debug('Decart token response', tokenData);
      const clientApiKey = tokenData.apiKey as string;
      if (!clientApiKey) throw new Error('No API key returned from token service');

      const { createDecartClient, models } = await import('@decartai/sdk');
      const model = models.realtime('lucy-2.1');
      const client = createDecartClient({ apiKey: clientApiKey });

      const initialState: { prompt: { text: string; enhance: boolean }; image?: Blob | File } = {
        prompt: { text: customPrompt, enhance: true },
      };
      if (referenceImage) {
        initialState.image = referenceImage;
      }

      const realtimeClient = await client.realtime.connect(streamRef.current, {
        model,
        mirror: 'auto',
        onRemoteStream: (remoteStream: MediaStream) => {
          if (outputVideoRef.current) {
            outputVideoRef.current.srcObject = remoteStream;
            outputVideoRef.current.play().catch(() => {});
          }
          setConnState('generating');
          setQueuePosition(null);
        },
        onConnectionChange: (state: string) => {
          setConnState(state as ConnectionState);
        },
        onQueuePosition: (qp: { position: number; queueSize: number }) => {
          setQueuePosition(qp.position);
        },
        initialState,
      });

      realtimeClientRef.current = realtimeClient;

      realtimeClient.on('error', (err: { message: string }) => {
        toast.error(`AI connection error: ${err.message}`);
        setConnState('error');
      });

      const { data } = await supabase
        .from('sessions')
        .insert({
          user_id: profile.id,
          quality: 'HD',
          watermark,
          avatar_name: selectedPreset,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (data) {
        sessionRef.current = {
          id: data.id,
          startedAt: Date.now(),
          chargedCredits: 0,
          chargedMinutes: 0,
          stopping: false,
          chargePromise: null,
        };
      }
      setElapsed(0);
      setActive(true);
      setConnState('connected');
      toast.success('LiveCam session started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start AI session');
      setConnState('error');
    } finally {
      setConnecting(false);
    }
  };

  const stopSession = async () => {
    const session = sessionRef.current;
    if (session?.stopping) return;
    if (session) session.stopping = true;
    setActive(false);
    setConnState('disconnected');

    if (realtimeClientRef.current) {
      try {
        realtimeClientRef.current.disconnect();
      } catch {
        // ignore
      }
      realtimeClientRef.current = null;
    }

    if (outputVideoRef.current) {
      outputVideoRef.current.srcObject = null;
    }

    if (session && profile) {
      const durationSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
      const minutesUsed = getBillableMinutes(durationSeconds);
      const targetCredits = minutesUsed * CREDITS_PER_MINUTE;

      while (session.chargePromise) await session.chargePromise;
      const finalCharge = await chargeSessionCredits(session, targetCredits);
      const { data: latestProfile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', profile.id)
        .maybeSingle();
      const balanceAfter = latestProfile?.credits_balance ?? finalCharge?.balanceAfter ?? profile.credits_balance;
      const creditsUsed = session.chargedCredits;

      setElapsed(durationSeconds);
      setSessionSummary({ durationSeconds, creditsUsed, minutesUsed, balanceAfter });
      setSessionSummaryOpen(true);
      await supabase
        .from('sessions')
        .update({
          duration_seconds: durationSeconds,
          credits_used: creditsUsed,
          ended_at: new Date().toISOString(),
        })
        .eq('id', session.id);
      sessionRef.current = null;
    }
    setElapsed(0);
    setQueuePosition(null);
    refreshProfile();
    toast.success('Session ended');
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setCustomPrompt(preset.prompt);
    if (realtimeClientRef.current && active) {
      realtimeClientRef.current.setPrompt(preset.prompt, { enhance: true }).catch(() => {
        toast.error('Failed to switch transformation');
      });
    }
  };

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    setSelectedPreset('default');
  };

  const applyCustomPrompt = () => {
    if (!realtimeClientRef.current || !active) return;
    realtimeClientRef.current.setPrompt(customPrompt, { enhance: true }).catch(() => {
      toast.error('Failed to apply prompt');
    });
    toast.success('Transformation updated');
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setReferenceImage(file);
    setReferencePreview(URL.createObjectURL(file));
    toast.success('Reference image loaded');
  };

  const applyReferenceImage = async () => {
    if (!referenceImage) return;
    if (!realtimeClientRef.current || !active) {
      toast('Reference image loaded. Start a session to apply it live.');
      return;
    }
    setUploadingImage(true);
    try {
      await realtimeClientRef.current.set({
        prompt: customPrompt,
        image: referenceImage,
        enhance: true,
      });
      toast.success('Reference image applied to AI transformation');
    } catch {
      toast.error('Failed to apply reference image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (referencePreview) URL.revokeObjectURL(referencePreview);
    setReferencePreview(null);
    if (realtimeClientRef.current && active) {
      realtimeClientRef.current.set({ prompt: customPrompt, image: null }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!active || !profile) return;
    const interval = setInterval(async () => {
      const session = sessionRef.current;
      if (!session) return;

      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
      setElapsed(elapsedSeconds);
      const completedMinutes = Math.floor(elapsedSeconds / 60);
      if (completedMinutes <= session.chargedMinutes || session.chargePromise) return;

      const charge = await chargeSessionCredits(session, completedMinutes * CREDITS_PER_MINUTE);
      if (!charge) {
        await stopSession();
        return;
      }

      session.chargedMinutes = completedMinutes;
      if (charge.balanceAfter <= 0) await stopSession();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, profile?.id]);

  const chargeSessionCredits = async (session: ActiveSession, targetCredits: number) => {
    while (session.chargePromise) await session.chargePromise;
    const amountDue = Math.max(0, targetCredits - session.chargedCredits);
    if (amountDue === 0 || !profile) return null;

    const chargePromise = (async () => {
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', profile.id)
        .maybeSingle();

      if (fetchError || !currentProfile) {
        toast.error('Unable to load your credit balance.');
        return null;
      }

      const chargedCredits = Math.min(amountDue, Math.max(0, currentProfile.credits_balance));
      const balanceAfter = Math.max(0, currentProfile.credits_balance - chargedCredits);
      if (chargedCredits > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ credits_balance: balanceAfter })
          .eq('id', profile.id);

        if (updateError) {
          toast.error('Unable to deduct session credits.');
          return null;
        }
      }

      return { chargedCredits, balanceAfter };
    })();

    session.chargePromise = chargePromise;
    try {
      const result = await chargePromise;
      if (result) {
        session.chargedCredits += result.chargedCredits;
        refreshProfile();
      }
      return result;
    } finally {
      session.chargePromise = null;
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (realtimeClientRef.current) {
        try { realtimeClientRef.current.disconnect(); } catch { /* ignore */ }
      }
    };
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const connStateLabel: Record<ConnectionState, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    connected: 'Connected',
    generating: 'Generating',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting…',
    error: 'Error',
  };

  const connStateColor: Record<ConnectionState, string> = {
    idle: 'bg-muted-foreground',
    connecting: 'bg-amber-500',
    connected: 'bg-emerald-500',
    generating: 'bg-emerald-500',
    disconnected: 'bg-muted-foreground',
    reconnecting: 'bg-amber-500',
    error: 'bg-destructive',
  };

  return (
    <DashboardShell>
      <Dialog open={sessionSummaryOpen} onOpenChange={setSessionSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Session Duration</p>
              <p className="mt-2 text-3xl font-semibold">{formatSessionDuration(sessionSummary.durationSeconds)}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Credits Used</p>
              <p className="mt-2 text-3xl font-semibold">{sessionSummary.creditsUsed}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billable Minutes</p>
              <p className="mt-2 text-3xl font-semibold">{sessionSummary.minutesUsed}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Credit Balance After</p>
              <p className="mt-2 text-3xl font-semibold">{sessionSummary.balanceAfter}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSessionSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LiveCam Workspace</h1>
          <p className="mt-1 text-muted-foreground">
            Transform your webcam in real-time with AI.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2">
            <span className={`h-2 w-2 rounded-full ${connStateColor[connState]} ${connState === 'connecting' || connState === 'reconnecting' ? 'animate-pulse' : ''}`} />
            {connStateLabel[connState]}
          </Badge>
          <Badge variant="outline" className="gap-2">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsed)}
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        {/* Dual preview windows */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Camera Input */}
          <Card className="overflow-hidden sm:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Camera className="h-4 w-4 text-primary" />
                  Camera Input
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative aspect-video bg-black">
                  <video
                    ref={cameraVideoRef}
                    playsInline
                    muted
                    className={`h-full w-full object-cover transition-[filter,transform] duration-300 ${
                      cameraPreviewBlurred ? 'scale-105 blur-xl' : ''
                    }`}
                  />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <VideoOff className="h-10 w-10" />
                      <p className="text-sm">Camera is off</p>
                    </div>
                  )}
                  {cameraOn && (
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-medium text-white">CAM</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={cameraPreviewBlurred ? 'Show camera preview' : 'Blur camera preview'}
                    title={cameraPreviewBlurred ? 'Show camera preview' : 'Blur camera preview'}
                    aria-pressed={cameraPreviewBlurred}
                    onClick={() => setCameraPreviewBlurred((blurred) => !blurred)}
                    className="absolute bottom-3 right-3 z-10 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                  >
                    {cameraPreviewBlurred ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

          {/* AI Output */}
          <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Output
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative aspect-video bg-black">
                  <video
                    ref={outputVideoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {!active && connState !== 'connecting' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Wand2 className="h-10 w-10" />
                      <p className="text-sm">
                        {cameraOn ? 'Press Start to begin AI transformation' : 'Turn on camera first'}
                      </p>
                    </div>
                  )}
                  {(connState === 'connecting' || connState === 'reconnecting') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-white">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm">
                        {queuePosition !== null
                          ? `In queue: position ${queuePosition}`
                          : connState === 'connecting'
                            ? 'Connecting to AI engine…'
                            : 'Reconnecting…'}
                      </p>
                    </div>
                  )}
                  {active && connState === 'generating' && (
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-500/80 px-2.5 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      <span className="text-xs font-semibold text-white">AI LIVE</span>
                    </div>
                  )}
                  {active && (
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/80 px-2.5 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      <span className="text-xs font-semibold text-white">REC</span>
                    </div>
                  )}
                  {watermark && active && (
                    <div className="absolute bottom-3 right-3 text-sm font-bold text-white/50">
                      DeepLive
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
        </div>

        {/* Controls bar */}
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
              <Button
                variant="outline"
                onClick={() => (cameraOn ? stopCamera() : startCamera())}
                disabled={loadingCamera || active}
              >
                {loadingCamera ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : cameraOn ? (
                  <VideoOff className="mr-2 h-4 w-4" />
                ) : (
                  <Video className="mr-2 h-4 w-4" />
                )}
                {cameraOn ? 'Turn off camera' : 'Turn on camera'}
              </Button>

              {active ? (
                <Button variant="destructive" onClick={stopSession}>
                  <Square className="mr-2 h-4 w-4" fill="currentColor" /> Stop Session
                </Button>
              ) : (
                <Button
                  onClick={startSession}
                  disabled={!cameraOn || connecting || !customPrompt.trim()}
                >
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" fill="currentColor" />
                  )}
                  {connecting ? 'Starting…' : 'Start Session'}
                </Button>
              )}
            </CardContent>
        </Card>

        {/* Prompt controls */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4 text-primary" /> AI Transformation Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Quick Presets</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        selectedPreset === p.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Default Prompt</Label>
                <div className="flex gap-2">
                  <Input
                    value={customPrompt}
                    onChange={(e) => handleCustomPromptChange(e.target.value)}
                    placeholder="Type your own prompt here…"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={applyCustomPrompt}
                    disabled={!active || !customPrompt.trim()}
                  >
                    Apply
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  Switch transformations live while the session is running. The AI
                  engine seamlessly transitions to the new prompt.
                </p>
              </div>
            </CardContent>
          </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-primary" /> Camera
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Select Camera</Label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={active}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {cameras.length === 0 && <option>Default camera</option>}
                  {cameras.map((c, i) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {cameraOn ? (
                  <><Wifi className="h-4 w-4 text-emerald-500" /> Camera active</>
                ) : (
                  <><WifiOff className="h-4 w-4" /> Camera off</>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-primary" /> Reference Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {referencePreview ? (
                <div className="relative">
                  <img src={referencePreview} alt="Reference" className="w-full rounded-lg border border-border object-cover" style={{ maxHeight: '160px' }} />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute right-2 top-2 h-7 w-7 p-0"
                    onClick={removeReferenceImage}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload a reference face</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReferenceUpload}
                  />
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={applyReferenceImage}
                disabled={!referenceImage || uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                )}
                {uploadingImage ? 'Applying…' : 'Apply to AI'}
              </Button>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Upload a reference photo to guide the AI transformation. The AI will substitute the character in your video with the person in this image.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Session Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Watermark</Label>
                  <p className="text-xs text-muted-foreground">
                    Show DeepLive watermark on output
                  </p>
                </div>
                <Switch checked={watermark} onCheckedChange={setWatermark} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Picture-in-Picture</Label>
                  <p className="text-xs text-muted-foreground">Floating preview</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const v = outputVideoRef.current;
                    if (v && v.srcObject) {
                      try {
                        await v.requestPictureInPicture();
                      } catch {
                        toast.error('PiP not available');
                      }
                    } else {
                      toast.error('Start a session first');
                    }
                  }}
                  disabled={!active}
                >
                  Enable
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Credits left</span>
                <span className="text-lg font-bold text-primary">
                  {profile?.credits_balance ?? 0}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Approx. minutes</span>
                <span className="text-sm font-medium">
                  {Math.floor((profile?.credits_balance ?? 0) / 125)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
