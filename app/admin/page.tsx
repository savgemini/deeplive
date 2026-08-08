'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, Zap, Clock } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

export default function AdminOverview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRevenue: 0,
    totalCreditsSold: 0,
    totalMinutesUsed: 0,
  activeToday: 0,
    revenueToday: 0,
    revenueMonth: 0,
  });
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number }[]>([]);
  const [userGrowth, setUserGrowth] = useState<{ date: string; users: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: users }, { data: txns }, { data: sessions }] = await Promise.all([
        supabase.from('profiles').select('id, created_at'),
        supabase.from('transactions').select('amount_usd, credits_added, status, created_at'),
        supabase.from('sessions').select('duration_seconds'),
      ]);

      const successful = (txns ?? []).filter((t) => t.status === 'success');
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      setStats({
        totalUsers: users?.length ?? 0,
        totalRevenue: successful.reduce((a, t) => a + Number(t.amount_usd), 0),
        totalCreditsSold: successful.reduce((a, t) => a + (t.credits_added ?? 0), 0),
        totalMinutesUsed: (sessions ?? []).reduce((a, s) => a + Math.floor(s.duration_seconds / 60), 0),
        activeToday: 0,
        revenueToday: successful
          .filter((t) => new Date(t.created_at).getTime() >= todayStart)
          .reduce((a, t) => a + Number(t.amount_usd), 0),
        revenueMonth: successful
          .filter((t) => new Date(t.created_at).getTime() >= monthStart)
          .reduce((a, t) => a + Number(t.amount_usd), 0),
      });

      // build last 7 days revenue chart
      const days: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart - i * 86400000);
        const label = d.toLocaleDateString('en', { weekday: 'short' });
        const rev = successful
          .filter((t) => {
            const td = new Date(t.created_at).getTime();
            return td >= d.getTime() && td < d.getTime() + 86400000;
          })
          .reduce((a, t) => a + Number(t.amount_usd), 0);
        days.push({ date: label, revenue: rev });
      }
      setRevenueChart(days);

      // user growth (cumulative)
      const sortedUsers = (users ?? []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const growth: { date: string; users: number }[] = [];
      let count = 0;
      sortedUsers.forEach((u) => {
        count++;
        growth.push({
          date: new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          users: count,
        });
      });
      setUserGrowth(growth.slice(-14));
    })();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users },
    { label: 'Revenue Today', value: `$${stats.revenueToday.toFixed(2)}`, icon: DollarSign },
    { label: 'Revenue This Month', value: `$${stats.revenueMonth.toFixed(2)}`, icon: DollarSign },
    { label: 'Credits Sold', value: stats.totalCreditsSold, icon: Zap },
    { label: 'Minutes Used', value: stats.totalMinutesUsed, icon: Clock },
    { label: 'Total Revenue', value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="mt-1 text-muted-foreground">Platform analytics and key metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueChart}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#revGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
