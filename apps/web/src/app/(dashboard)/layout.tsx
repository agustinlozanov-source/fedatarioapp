'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Sidebar } from '@/components/layout/Shell';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const [listo, setListo] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) router.push('/login');
      else setListo(true);
    });
    return () => unsub();
  }, []);

  if (!listo) return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen transition-all duration-300" style={{ marginLeft: collapsed ? '80px' : '256px' }}>
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
