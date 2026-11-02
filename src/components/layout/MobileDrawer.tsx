import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppUser } from '../../types';
import { X, LogOut, User } from 'lucide-react';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  links: Array<{ label: string; href: string; icon: React.ReactNode }>;
  user: AppUser | null;
  onLogout: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  links,
  user,
  onLogout,
}) => {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-10 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col justify-between bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl sm:p-6">
        <div className="min-h-0 overflow-y-auto custom-scrollbar">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <span className="font-bold text-base text-slate-900 font-display">Portal SIPAT</span>
            <button
              onClick={onClose}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {user && (
            <div className="p-3 bg-slate-50 rounded-xl mb-6 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#028056]/15 text-[#028056] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{user.displayName}</h4>
                  <p className="text-[11px] text-slate-500">
                    Matrícula: {user.employeeNumber} {user.role === 'admin' ? '• Admin' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          <nav className="space-y-1">
            {links.map(link => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={onClose}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-[#028056]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
