'use client';

import { useEffect, useState } from 'react';
import { supabase, SessionLog } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatSessionDuration, getBillableMinutes } from '@/lib/session-usage';

export default function AdminSessions() {
  const [sessions, setSessions] = useState<(SessionLog & { user_email: string | null })[]>([]);

  useEffect(() => {
    const loadSessions = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) {
        toast.error('Unable to load sessions.');
        return;
      }

      const sessionRows = (data as SessionLog[]) ?? [];
      const userIds = Array.from(new Set(sessionRows.map((session) => session.user_id)));
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id, email').in('id', userIds)
        : { data: [], error: null };

      if (profilesError) toast.error('Unable to load session user emails.');
      const emailsByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
      setSessions(sessionRows.map((session) => ({
        ...session,
        user_email: emailsByUserId.get(session.user_id) ?? null,
      })));
    };

    loadSessions();
  }, []);

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
        <p className="mt-1 text-muted-foreground">All LiveCam session usage and credit consumption across the platform.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Clock className="mb-3 h-10 w-10" />
              <p className="text-sm">No sessions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">User Email</th>
                    <th className="pb-3 pr-4 font-medium">Duration</th>
                    <th className="pb-3 pr-4 font-medium">Billable Minutes</th>
                    <th className="pb-3 pr-4 font-medium">Credits Used</th>
                    <th className="pb-3 pr-4 font-medium">Quality</th>
                    <th className="pb-3 pr-4 font-medium">Watermark</th>
                    <th className="pb-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">{s.user_email ?? 'Unknown user'}</td>
                      <td className="py-3 pr-4">
                        {formatSessionDuration(s.duration_seconds)}
                      </td>
                      <td className="py-3 pr-4">
                        {getBillableMinutes(s.duration_seconds)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-primary">
                        -{s.credits_used}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{s.quality}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {s.watermark ? (
                          <Badge variant="secondary">On</Badge>
                        ) : (
                          <Badge variant="outline">Off</Badge>
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
