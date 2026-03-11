'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, Plus, Users, BookOpen,
  Settings, LayoutDashboard, LogOut, FileCheck,
  Moon, Sun, ChevronLeft, ChevronRight
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSidebar } from '@/context/SidebarContext';

const navItems = [
  { href: '/resumen', label: 'Resumen', icon: LayoutDashboard },
  { href: '/instrumentos', label: 'Instrumentos', icon: LayoutDashboard, badge: '3' },
  { href: '/nuevo', label: 'Nuevo instrumento', icon: Plus },
  { href: '/documentos', label: 'Documentos', icon: FileCheck, badge: '2' },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/libro', label: 'Libro & Índice', icon: BookOpen },
  { href: '/config', label: 'Configuración', icon: Settings },
];

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggle = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button onClick={toggle} className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Cambiar tema">
      {isDark ? <Sun size={18} className="text-gray-600 dark:text-gray-400" /> : <Moon size={18} className="text-gray-600" />}
    </button>
  );
}

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col z-50 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo */}
      <div className="h-20 flex items-center justify-center px-6 border-b border-gray-100 dark:border-gray-700 relative">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold tracking-tight shrink-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900">
              FD
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">Fedatario</div>
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Correduría Ramírez</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold tracking-tight shrink-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900">
            FD
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <div className={`text-xs font-bold uppercase tracking-[0.08em] px-4 py-3 text-gray-500 dark:text-gray-400 ${collapsed ? 'hidden' : ''}`}>
          Principal
        </div>
        <div className="space-y-2">
          {navItems.map(item => {
            const active = path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all ${
                  active
                    ? 'bg-black dark:bg-gray-700 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={collapsed ? item.label : ''}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center px-4 py-2.5 rounded-2xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          title={collapsed ? 'Expandir' : 'Compactar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Logout' : ''}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
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
    <header className="sticky top-0 z-40 h-20 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-8">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{breadcrumb}</span>
        <span className="text-xl font-bold text-gray-900 dark:text-white">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
