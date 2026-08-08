'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, Transaction, SessionLog } from '@/lib/supabase';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Video, TrendingUp, ArrowRight } from 'lucide-react';

export default function DashboardHome() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', profile.id)
      .order('started_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setSessions((data as SessionLog[]) ?? []));
  }, [profile]);

  const totalMinutesUsed = sessions.reduce(
    (acc, s) => acc + s.duration_seconds,
    0
  );

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile?.full_name ?? 'there'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your credits, start a session, and track your usage.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credit Balance
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" fill="currentColor" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.credits_balance ?? 0}</div>
            <p className="text-xs text-muted-foreground">credits remaining</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Minutes Left
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor((profile?.credits_balance ?? 0) / 125)}
            </div>
            <p className="text-xs text-muted-foreground">approx. minutes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessions Run
            </CardTitle>
            <Video className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">total sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Minutes Used
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(totalMinutesUsed / 60)}
            </div>
            <p className="text-xs text-muted-foreground">total minutes</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card className="mt-6 overflow-hidden">
        <div className="relative">
          <div className="absolute left-1/2 top-0 h-[200px] w-[400px] -translate-x-1/2 rounded-full bg-primary/10 blur-[80px]" />
          <CardContent className="relative flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
            <div>
              <h2 className="text-xl font-bold">Ready to go live?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Launch the LiveCam workspace and start your AI transformation.
              </p>
            </div>
            <Link href="/dashboard/livecam">
              <Button size="lg">
                <Video className="mr-2 h-4 w-4" /> Start LiveCam
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No purchases yet.{' '}
                <Link href="/dashboard/billing" className="text-primary hover:underline">
                  Buy credits
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {t.credits_added} credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()} · {t.gateway}
                      </p>
                    </div>
                    <Badge
                      variant={t.status === 'success' ? 'default' : 'secondary'}
                    >
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sessions yet. Start your first LiveCam session.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleDateString()} · {s.quality}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      -{s.credits_used}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
