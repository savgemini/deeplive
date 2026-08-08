'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Zap,
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Clock,
  BookOpen,
  Settings,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/packs', label: 'Credit Packs', icon: Package },
  { href: '/admin/sessions', label: 'Sessions', icon: Clock },
  { href: '/admin/tutorials', label: 'Tutorials', icon: BookOpen },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && profile?.role !== 'admin') router.replace('/dashboard');
  }, [loading, user, profile, router]);

  if (loading || !user || profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <span className="text-sm font-bold">DeepLive</span>
            <p className="text-[10px] uppercase tracking-wider text-primary">Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to app
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
