import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { MobileDrawer } from './MobileDrawer';
import { LogOut, Menu, Shield, Award, Calendar, FileText, UserCheck } from 'lucide-react';

export const AuthenticatedHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Palestras & Dias', href: '/', icon: <Calendar className="w-4 h-4" /> },
    { label: 'Ganhadores & Sorteios', href: '/ganhadores', icon: <Award className="w-4 h-4" /> },
    { label: 'Regulamento', href: '/regulamento', icon: <FileText className="w-4 h-4" /> },
  ];

  if (user?.role === 'admin') {
    navLinks.push({
      label: 'Painel Admin',
      href: '/admin',
      icon: <Shield className="w-4 h-4 text-[#028056]" />,
    });
  }

  const [settings, setSettings] = useState<{ brandName?: string; primaryLogoUrl?: string } | null>(null);

  React.useEffect(() => {
    import('../../services/repositories').then(({ settingsRepository }) => {
      settingsRepository.getSettings().then(s => setSettings(s)).catch(() => {});
    });
  }, []);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6 lg:gap-8 lg:px-8">
          {/* Zone 1: Wordmark */}
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 text-slate-900 transition-opacity hover:opacity-90"
          >
            {settings?.primaryLogoUrl ? (
              <img src={settings.primaryLogoUrl} alt="Logo" className="h-8 max-w-[120px] object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary,#028056)] text-white flex items-center justify-center font-bold font-display text-sm">
                {(settings?.brandName || 'SIPAT')[0]}
              </div>
            )}
            <span className="truncate text-base font-bold font-display text-slate-900">
              {settings?.brandName || 'Portal SIPAT Honda'}
            </span>
          </Link>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            {navLinks.map(link => {
              const isActive = location.pathname === link.href || (link.href !== '/' && location.pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 hover:text-[#028056] ${
                    isActive ? 'text-[#028056] font-bold border-b-2 border-[#028056]' : ''
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: User Details & Logout Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-[#028056]" />
                  {user.displayName}
                </span>
                <span className="text-[10px] text-slate-500">
                  Matrícula: {user.employeeNumber} {user.unitSlug ? `• ${user.unitSlug.toUpperCase()}` : ''}
                </span>
              </div>
            )}

            <button
              onClick={logout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 cursor-pointer whitespace-nowrap shrink-0"
              title="Encerrar sessão com segurança"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer md:hidden"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={navLinks}
        user={user}
        onLogout={logout}
      />
    </>
  );
};
