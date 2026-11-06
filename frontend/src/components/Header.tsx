import React from 'react';
import { Database, Menu, Moon, Sun } from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  totalRecordsCount: number;
  totalFilesCount: number;
  userEmail: string;
  onMenuClick: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const TAB_META: Record<ActiveTab, { title: string; description: string }> = {
  dashboard: { title: 'Accueil', description: 'Votre espace de rapprochement de données.' },
  import: { title: 'Importer des fichiers', description: 'Importez vos bases de données clients, fournisseurs ou contacts (CSV, XLSX, XLS).' },
  data: { title: 'Voir les données', description: 'Explorez et prévisualisez vos enregistrements sources.' },
  results: { title: 'Résultats du rapprochement', description: 'Consultez les enregistrements comparés et leurs indices de ressemblance.' },
  arbitration: { title: 'Arbitrage humain', description: 'Comparez les cas incertains et validez vos décisions.' },
  stats: { title: 'Statistiques & Performance', description: 'Visualisez la répartition des résultats et la concordance des attributs.' },
  history: { title: 'Historique des analyses', description: 'Retrouvez vos analyses et leurs résultats sauvegardés.' },
};

export const Header: React.FC<HeaderProps> = ({ activeTab, totalRecordsCount, totalFilesCount, userEmail, onMenuClick, theme, onToggleTheme }) => {
  const currentMeta = TAB_META[activeTab] || TAB_META.dashboard;
  const userName = userEmail.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Utilisateur';
  const initials = userName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header id="app-header" className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onMenuClick} aria-label="Ouvrir le menu" className="rounded-full bg-[var(--bg)] p-2.5 text-[var(--text)] md:hidden"><Menu className="h-4 w-4" /></button>
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{currentMeta.title}</h1><p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">{currentMeta.description}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button type="button" onClick={onToggleTheme} aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'} title={theme === 'light' ? 'Mode sombre' : 'Mode clair'} className="rounded-full border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--text)] transition hover:bg-[var(--primary-light)]">{theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <div className="hidden items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs sm:flex">
            <span className="flex items-center gap-1.5 text-[var(--muted)]"><Database className="h-3.5 w-3.5 text-[var(--primary)]" />{totalFilesCount} fichier{totalFilesCount === 1 ? '' : 's'}</span>
            <span className="h-4 w-px bg-[var(--border)]" />
            <span className="font-semibold tabular-nums text-[var(--text)]">{totalRecordsCount.toLocaleString('fr-FR')} <span className="font-normal text-[var(--muted)]">lignes</span></span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 sm:border-l sm:border-[var(--border)] sm:pl-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">{initials || 'U'}</div>
            <div className="hidden min-w-0 sm:block"><p className="max-w-40 truncate text-xs font-semibold capitalize text-[var(--text)]">{userName}</p><p className="max-w-40 truncate text-[11px] text-[var(--muted)]">{userEmail}</p></div>
          </div>
        </div>
      </div>
    </header>
  );
};