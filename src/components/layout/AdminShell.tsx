import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../features/auth/AuthContext';
import { Menu, X, ArrowLeft, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminShell: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ children, title, subtitle, actions }) => {
  const { user, logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-slate-50 text-slate-800 antialiased">
      {/* Desktop Sidebar: Locked to 100% viewport height, flex column with internal scroll */}
      <div className="hidden lg:flex lg:flex-col lg:h-full lg:w-64 shrink-0 bg-[#015237] border-r border-[#014730] z-20">
        <AdminSidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-dvh w-[min(18rem,calc(100vw-3.5rem))] flex-col bg-[#015237] shadow-2xl">
            <AdminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute right-1 top-[max(0.5rem,env(safe-area-inset-top))] inline-flex size-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 cursor-pointer"
            aria-label="Fechar menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Main Administrative Content Area: Occupies full remaining viewport and scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Admin Top Navbar */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 z-10 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[var(--brand-primary)] transition-colors px-2 py-1 rounded-md hover:bg-slate-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Portal do Colaborador</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{user?.displayName}</span>
              <span className="text-[10px] text-[var(--brand-primary)] font-bold uppercase tracking-wider">
                Administrador
              </span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Page Header (if title exists) */}
        {(title || subtitle || actions) && (
          <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {title && <h1 className="text-balance text-xl font-bold font-display text-slate-900 sm:text-2xl">{title}</h1>}
                {subtitle && <p className="mt-1 text-pretty text-xs text-slate-500">{subtitle}</p>}
              </div>
              {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
            </div>
          </div>
        )}

        {/* Dynamic content scrollable area */}
        <main className="flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] custom-scrollbar sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
