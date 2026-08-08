'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, SessionLog } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function SessionsPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionLog[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', profile.id)
      .order('started_at', { ascending: false })
      .then(({ data }) => setSessions((data as SessionLog[]) ?? []));
  }, [profile]);

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
        <p className="mt-1 text-muted-foreground">
          All your LiveCam sessions and credit usage.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="mb-3 h-10 w-10" />
              <p className="text-sm">No sessions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.quality}</Badge>
                    {s.watermark && <Badge variant="secondary">Watermark</Badge>}
                    {s.avatar_name && s.avatar_name !== 'none' && (
                      <Badge variant="secondary">{s.avatar_name}</Badge>
                    )}
                    <span className="text-sm font-medium text-primary">
                      -{s.credits_used} credits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
