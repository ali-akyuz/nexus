'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { LayoutDashboard, Briefcase, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-muted/40 md:min-h-screen flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight text-primary">NEXUS</h2>
          <p className="text-xs text-muted-foreground mt-1">Distributed AI Processing</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
              pathname === '/dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/jobs"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
              pathname?.startsWith('/jobs') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Jobs
          </Link>
        </nav>

        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 mb-4 text-sm truncate">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
              {user?.email?.[0] || 'U'}
            </div>
            <span className="truncate">{user?.email}</span>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="h-14 border-b flex items-center px-6 md:hidden">
          <h2 className="font-semibold">NEXUS</h2>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
