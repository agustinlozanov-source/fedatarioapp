'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Sidebar } from '@/components/layout/Shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar)' }} className="flex-1 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
}
