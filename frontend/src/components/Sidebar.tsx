import React from 'react';
import {
  BarChart3,
  FileCheck,
  FolderUp,
  History,
  LayoutDashboard,
  LogOut,
  Scale,
  X,
} from 'lucide-react';
import { ActiveTab } from '../types';
import recmatchIcon from '../logo/recmatch-icon.svg';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingArbitrationCount: number;
  totalFilesCount: number;
  userEmail: string;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingArbitrationCount,
  totalFilesCount,
  userEmail,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const primaryItems = [
    { id: 'dashboard' as ActiveTab, label: 'Accueil', icon: LayoutDashboard },
    { id: 'import' as ActiveTab, label: 'Importer des fichiers', icon: FolderUp, badge: totalFilesCount > 0 ? String(totalFilesCount) : undefined },
    { id: 'data' as ActiveTab, label: 'Voir les données', icon: FileCheck },
    { id: 'results' as ActiveTab, label: 'Résultats', icon: BarChart3 },
    { id: 'arbitration' as ActiveTab, label: 'Arbitrage', icon: Scale, badge: pendingArbitrationCount > 0 ? String(pendingArbitrationCount) : undefined },
    { id: 'stats' as ActiveTab, label: 'Statistiques', icon: BarChart3 },
    { id: 'history' as ActiveTab, label: 'Historique', icon: History },
  ];

  const renderItem = (item: (typeof primaryItems)[number]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        id={`nav-item-${item.id}`}
        type="button"
        title={item.label}
        aria-current={active ? 'page' : undefined}
        onClick={() => { setActiveTab(item.id); onCloseMobile(); }}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors duration-150 ${active ? 'bg-[var(--primary-light)] font-semibold text-[var(--primary)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'}`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[var(--primary)]' : 'text-current'}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.id === 'arbitration' ? 'bg-[#fbefed] text-[#b34d45]' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{item.badge}</span>}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Fermer le menu" onClick={onCloseMobile} className="fixed inset-0 z-40 bg-[#18231d]/30 backdrop-blur-[2px] md:hidden" />}
      <aside id="app-sidebar" className={`fixed inset-y-0 left-0 z-50 flex h-full w-[264px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 transition-transform duration-200 md:relative md:inset-auto md:z-auto md:w-[232px] md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[var(--border)] px-2">
          <div className="flex min-w-0 items-center gap-3">
            <img src={recmatchIcon} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0"><div className="truncate text-[15px] font-bold tracking-tight text-[var(--text)]">RecMatch</div><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">Rapprochement de données</p></div>
          </div>
          <button type="button" aria-label="Fermer le menu" onClick={onCloseMobile} className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--bg)] md:hidden"><X className="h-4 w-4" /></button>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 space-y-1 overflow-y-auto py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Menu</p>
          {primaryItems.slice(0, 5).map(renderItem)}
          <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Analyse</p>
          {primaryItems.slice(5).map(renderItem)}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] py-4">
          <div className="mb-3 rounded-2xl bg-[var(--primary-dark)] p-4 text-white">
            <p className="text-sm font-semibold">Prêt à rapprocher vos données ?</p>
            <p className="mt-1.5 text-xs leading-5 text-white/70">Importez un fichier pour démarrer une analyse.</p>
            <button type="button" onClick={() => { setActiveTab('import'); onCloseMobile(); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"><FolderUp className="h-3.5 w-3.5" />Importer un fichier</button>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">{userEmail.trim().charAt(0).toUpperCase() || 'U'}</div>
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted)]" title={userEmail}>{userEmail}</span>
            <button type="button" onClick={onLogout} aria-label="Déconnexion" title="Déconnexion" className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--text)]"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
};