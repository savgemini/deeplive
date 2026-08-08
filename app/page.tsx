'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase, CreditPack } from '@/lib/supabase';
import { MarketingNav } from '@/components/marketing-nav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Zap,
  Video,
  Shield,
  Globe,
  Cpu,
  Monitor,
  Clock,
  Check,
  Star,
  ArrowRight,
  Sparkles,
  Lock,
  PlayCircle,
} from 'lucide-react';

const HERO_IMG =
  'https://images.pexels.com/photos/8107821/pexels-photo-8107821.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const features = [
  {
    icon: Cpu,
    title: 'Real-Time AI Engine',
    desc: 'Sub-100ms face and body transformation runs entirely in real-time — no post-processing, no lag.',
  },
  {
    icon: Monitor,
    title: 'Virtual Camera Output',
    desc: 'Works as a virtual camera on Zoom, Google Meet, OBS, Twitch, TikTok Live, WhatsApp, and more.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    desc: 'Your video never leaves your device unencrypted. Watermark-free on paid plans.',
  },
  {
    icon: Globe,
    title: 'Pay in USD or NGN',
    desc: 'Buy credits with Paystack or Stripe. Pricing in both US dollars and Nigerian Naira.',
  },
  {
    icon: Clock,
    title: 'Pay-Per-Minute',
    desc: 'Buy only the minutes you need. Credits deduct live while you stream — no subscriptions.',
  },
  {
    icon: Sparkles,
    title: 'Any Avatar, Any Look',
    desc: 'Upload a reference face or choose from our library. Swap identities in seconds.',
  },
];

const testimonials = [
  {
    name: 'Adaobi Nwosu',
    role: 'Twitch Streamer',
    quote:
      'DeepLive completely changed my streams. My viewers think I am a totally different person. The latency is unreal.',
    rating: 5,
  },
  {
    name: 'Marcus Lee',
    role: 'YouTube Creator',
    quote:
      'I run my entire channel behind an avatar now. Setup took five minutes and OBS integration just works.',
    rating: 5,
  },
  {
    name: 'Zainab Okoro',
    role: 'Online Educator',
    quote:
      'Being able to pay in Naira with Paystack made this accessible for me. My students love the avatar.',
    rating: 5,
  },
];

const faqs = [
  {
    q: 'What is DeepLive?',
    a: 'DeepLive transforms your webcam feed into a realistic AI avatar in real-time. You can use that transformed feed as a virtual camera on any video call or streaming app.',
  },
  {
    q: 'How does billing work?',
    a: 'You buy credit packs that give you a set number of minutes. Credits deduct live while a session is active. You only pay for what you use — no recurring subscription.',
  },
  {
    q: 'Which apps does it work with?',
    a: 'Any app that accepts a virtual camera: Zoom, Google Meet, OBS, Twitch, TikTok Live, WhatsApp, Telegram, and YouTube Live.',
  },
  {
    q: 'Do credits expire?',
    a: 'Yes — each pack has a validity period (1 to 6 months). You can see the expiry for each pack on the pricing section and in your dashboard.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new account gets a short free trial so you can test the transformation before buying any credits.',
  },
  {
    q: 'Can I pay in Naira?',
    a: 'Yes. We support Paystack for Nigerian and African users, and Stripe for international payments. Prices are shown in both USD and NGN.',
  },
];

export default function LandingPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);

  useEffect(() => {
    supabase
      .from('credit_packs')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setPacks((data as CreditPack[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute left-1/2 top-0 -z-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="animate-fade-up">
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Real-time AI avatar streaming
              </Badge>
              <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
                Become anyone on
                <span className="gradient-text"> every video call</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                DeepLive turns your webcam into a realistic AI avatar in
                real-time. Use it on Zoom, Meet, OBS, Twitch, TikTok Live, and
                anywhere a virtual camera works.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard/livecam">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Try Demo
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" /> No subscription
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" /> Pay per minute
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" /> USD & NGN
                </div>
              </div>
            </div>

            <div className="relative animate-fade-up [animation-delay:150ms]">
              <div className="relative overflow-hidden rounded-2xl border border-border glow-primary">
                <img
                  src={HERO_IMG}
                  alt="AI avatar transformation"
                  className="aspect-video w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive animate-pulse-slow">
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">LIVE PREVIEW</p>
                    <p className="text-xs text-white/70">AI transform active</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 hidden rounded-xl border border-border bg-card p-3 shadow-xl sm:block">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                  <span className="text-xs font-medium">42ms latency</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / compatible apps */}
      <section className="border-y border-border/40 bg-card/30 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Works with every major platform
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-lg font-semibold text-muted-foreground">
            <span>Zoom</span>
            <span>Google Meet</span>
            <span>OBS</span>
            <span>Twitch</span>
            <span>TikTok Live</span>
            <span>YouTube</span>
            <span>WhatsApp</span>
            <span>Telegram</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Everything you need to go live as anyone
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built for creators, streamers, and professionals who want a
              real-time AI presence on any platform.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Three steps to go live
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { n: '01', icon: Video, t: 'Pick your camera', d: 'Select your webcam and upload or choose a reference avatar.' },
              { n: '02', icon: Cpu, t: 'AI transforms you', d: 'DeepLive maps your movements onto the avatar in real-time.' },
              { n: '03', icon: Monitor, t: 'Stream anywhere', d: 'Route the output to OBS, Zoom, or any virtual-camera app.' },
            ].map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-background p-8">
                <span className="text-5xl font-bold text-primary/20">{s.n}</span>
                <s.icon className="mt-4 h-8 w-8 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Buy minutes. Never a subscription.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Credits deduct live while you stream. Pay in USD or NGN.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                  pack.popular
                    ? 'border-primary glow-primary'
                    : 'border-border'
                }`}
              >
                {pack.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{pack.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pack.description}
                </p>
                <div className="mt-4">
                  <span className="text-2xl font-bold text-primary">{pack.credits}</span>
                  <span className="ml-1 text-sm text-muted-foreground">credits</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {pack.minutes} minutes
                </div>
                {pack.discount_percent > 0 && (
                  <Badge variant="secondary" className="mt-2 w-fit">
                    {pack.discount_percent}% off
                  </Badge>
                )}
                <div className="mt-4 flex items-baseline gap-2 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Validity</p>
                    <p className="text-sm font-semibold">{pack.validity_months} months</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Approx.</p>
                    <p className="text-sm font-semibold">{packMinutes(pack)} min</p>
                  </div>
                </div>
                <Link href="/signup" className="mt-6 block">
                  <Button
                    className="w-full"
                    variant={pack.popular ? 'default' : 'outline'}
                  >
                    Choose {pack.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Loved by creators
            </h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-background p-6">
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/90">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tutorials teaser */}
      <section id="tutorials" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Tutorials</Badge>
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Learn to set up in minutes
            </h2>
            <p className="mt-4 text-muted-foreground">
              Free and premium video guides for every integration.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: 'Getting Started with DeepLive', c: 'Getting Started', p: false },
              { t: 'OBS Virtual Camera Setup', c: 'Integrations', p: true },
              { t: 'Zoom & Google Meet Integration', c: 'Integrations', p: true },
            ].map((v) => (
              <div key={v.t} className="group cursor-pointer rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50">
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <PlayCircle className="h-12 w-12 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="outline">{v.c}</Badge>
                  {v.p ? (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" /> Premium
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{v.t}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-y border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-12 text-center">
            <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
            <div className="relative">
              <h2 className="text-balance text-4xl font-bold tracking-tight">
                Ready to go live as anyone?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Create your free account and get a trial to test the
                transformation. No card required.
              </p>
              <Link href="/signup" className="mt-8 inline-block">
                <Button size="lg">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
              </div>
              <span className="text-lg font-bold">DeepLive</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link href="/#features">Features</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/#faq">FAQ</Link>
              <Link href="/login">Log in</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} DeepLive. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
