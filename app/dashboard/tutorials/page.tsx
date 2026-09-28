'use client';

import { useEffect, useState } from 'react';
import { supabase, Tutorial } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, Lock, BookOpen } from 'lucide-react';

export default function TutorialsPage() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [active, setActive] = useState<Tutorial | null>(null);

  useEffect(() => {
    supabase
      .from('tutorials')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setTutorials((data as Tutorial[]) ?? []));
  }, []);

  const categories = Array.from(new Set(tutorials.map((t) => t.category)));
  const isDirectVideo = active
    ? /\.(mp4|webm|mov|m4v|ogg)(?:[?#]|$)/i.test(active.video_url)
    : false;

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Tutorials</h1>
        <p className="mt-1 text-muted-foreground">
          Learn to set up DeepLive with every platform.
        </p>
      </div>

      {active ? (
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-0">
            <div className="aspect-video bg-black">
              {isDirectVideo ? (
                <video src={active.video_url} controls playsInline className="h-full w-full" />
              ) : (
                <iframe
                  src={active.video_url.replace('watch?v=', 'embed/')}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{active.title}</h2>
                <Button variant="outline" size="sm" onClick={() => setActive(null)}>
                  Back to list
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {active.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {categories.map((cat) => (
        <div key={cat} className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-4 w-4 text-primary" />
            {cat}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tutorials
              .filter((t) => t.category === cat)
              .map((t) => (
                <Card
                  key={t.id}
                  className="group cursor-pointer transition-all hover:border-primary/50"
                  onClick={() => setActive(t)}
                >
                  <CardContent className="pt-6">
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-secondary">
                      <PlayCircle className="h-10 w-10 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="outline">{t.duration_minutes} min</Badge>
                      {t.premium ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" /> Premium
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Free</Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-medium">{t.title}</h3>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </DashboardShell>
  );
}
