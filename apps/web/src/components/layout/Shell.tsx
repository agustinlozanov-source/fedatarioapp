'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, Plus, Users, BookOpen,
  Settings, LayoutDashboard, LogOut, FileCheck,
  Moon, Sun
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/instrumentos', label: 'Instrumentos', icon: LayoutDashboard, badge: '3' },
  { href: '/nuevo', label: 'Nuevo instrumento', icon: Plus },
  { href: '/documentos', label: 'Documentos', icon: FileCheck, badge: '2' },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/libro', label: 'Libro & Índice', icon: BookOpen },
  { href: '/config', label: 'Configuración', icon: Settings },
];

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
    setIsDark(!isDark);
  };

  return (
    <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-[var(--bg3)] transition-colors" title="Cambiar tema">
      {isDark ? <Sun size={14} style={{ color: 'var(--ink4)' }} /> : <Moon size={14} style={{ color: 'var(--ink4)' }} />}
    </button>
  );
}

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  return (
    <aside style={{ width: 'var(--sidebar)', background: 'var(--bg)', borderRight: '1px solid var(--border)' }} className="fixed left-0 top-0 h-screen flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-transparent" style={{ borderBottomColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold tracking-tight shrink-0"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
          FD
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Fedatario</div>
          <div className="text-[10px] font-medium" style={{ color: 'var(--ink4)' }}>Correduría Ramírez</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1.5 mb-1" style={{ color: 'var(--ink5)' }}>
          Principal
        </div>
        {navItems.map(item => {
          const active = path.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-[13px] no-underline transition-all"
              style={{
                background: active ? 'var(--blue-bg)' : 'transparent',
                color: active ? 'var(--blue)' : 'var(--ink3)',
                fontWeight: active ? 600 : 500,
              }}>
              <item.icon size={16} strokeWidth={1.8} style={{ color: active ? 'var(--blue)' : 'var(--ink4)', flexShrink: 0 }} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--orange-bg)', color: 'var(--orange)' }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2.5 py-3 border-t border-transparent" style={{ borderTopColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-1"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}>JR</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>Jorge Ramírez</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--ink4)' }}>Corredor Público</div>
          </div>
          <ThemeToggle />
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-[var(--bg3)] transition-colors" title="Cerrar sesión">
            <LogOut size={14} style={{ color: 'var(--ink4)' }} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ breadcrumb, title, actions }: {
  breadcrumb: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 h-[56px] flex items-center justify-between px-6 backdrop-blur-xl"
      style={{ background: 'rgba(var(--bg), 0.8)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[13px]" style={{ color: 'var(--ink4)' }}>{breadcrumb}</span>
        <span className="text-[16px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{title}</span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
