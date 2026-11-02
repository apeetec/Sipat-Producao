import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  HelpCircle,
  Building2,
  Users,
  Upload,
  UserX,
  TableProperties,
  Gift,
  ShieldAlert,
  Settings,
  FileSpreadsheet,
  ArrowLeft,
  Palette,
} from 'lucide-react';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export const AdminSidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const sections: Array<{ title: string; items: SidebarItem[] }> = [
    {
      title: 'Visão Geral',
      items: [
        { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Programação & Conteúdo',
      items: [
        { label: 'Datas da Programação', href: '/admin/datas', icon: <CalendarDays className="w-4 h-4" /> },
        { label: 'Dias & Sessões', href: '/admin/dias', icon: <CalendarDays className="w-4 h-4" /> },
        { label: 'Perguntas & Gabarito', href: '/admin/perguntas', icon: <HelpCircle className="w-4 h-4" /> },
        { label: 'Unidades Fabris', href: '/admin/unidades', icon: <Building2 className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Usuários & Acessos',
      items: [
        { label: 'Colaboradores', href: '/admin/usuarios', icon: <Users className="w-4 h-4" /> },
        { label: 'Importar Usuários', href: '/admin/usuarios/importar', icon: <Upload className="w-4 h-4" /> },
        { label: 'Exclusão em Massa', href: '/admin/usuarios/excluir-em-massa', icon: <UserX className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Engajamento & Sorteios',
      items: [
        { label: 'Matriz de Resultados', href: '/admin/resultados', icon: <TableProperties className="w-4 h-4" /> },
        { label: 'Sorteador Oficial', href: '/admin/sorteios', icon: <Gift className="w-4 h-4 text-amber-400" /> },
      ],
    },
    {
      title: 'Identidade & Governança',
      items: [
        { label: 'Cores & Textos do Site', href: '/admin/personalizacao', icon: <Palette className="w-4 h-4 text-emerald-300" /> },
        { label: 'Trilha de Auditoria', href: '/admin/auditoria', icon: <ShieldAlert className="w-4 h-4" /> },
        { label: 'Regras da Campanha', href: '/admin/configuracoes', icon: <Settings className="w-4 h-4" /> },
        { label: 'Validador CSV', href: '/ferramentas/validar-csv', icon: <FileSpreadsheet className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <aside className="w-64 h-full bg-[#015237] text-white flex flex-col shrink-0 select-none overflow-hidden">
      {/* Brand header */}
      <div className="p-5 border-b border-[#014730] flex items-center justify-between shrink-0 bg-[#014730]/40">
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#66bd39] block">
            Módulo de Gestão
          </span>
          <h2 className="text-base font-bold font-display text-white tracking-tight">Admin & Campanhas</h2>
        </div>
        <NavLink
          to="/"
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Voltar ao Portal do Colaborador"
          onClick={onCloseMobile}
        >
          <ArrowLeft className="w-4 h-4" />
        </NavLink>
      </div>

      {/* Nav list - scrollable inside full sidebar height */}
      <div className="flex-1 p-3 space-y-5 overflow-y-auto custom-scrollbar">
        {sections.map(section => (
          <div key={section.title}>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-emerald-300/80 mb-1.5 px-3">
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map(item => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.href === '/admin'}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#66bd39] text-[#014730] font-bold shadow-xs translate-x-1'
                          : 'text-emerald-100/90 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-[#014730] shrink-0 text-[11px] text-emerald-200/80 bg-[#014730]/30">
        <p className="font-semibold text-white">Portal Multi-Campanhas</p>
        <p className="text-[10px] text-emerald-300/70">Ambiente Administrativo Seguro</p>
      </div>
    </aside>
  );
};
