import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Database,
  FileSpreadsheet,
  GitCompareArrows,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { AnalysisSnapshot, DataRecord, MatchPair, UploadedFile } from '../types';
import { getDashboardStats } from '../services/api';

interface StatisticsViewProps {
  matches: MatchPair[];
  differentRecords: DataRecord[];
  files: UploadedFile[];
  totalRecordsCount: number;
  activeAnalysisId: string | null;
  snapshotStats?: AnalysisSnapshot['stats'];
}

interface AttributeStatistic {
  name: string;
  rate: number;
  desc: string;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  matches,
  differentRecords,
  files,
  totalRecordsCount,
  activeAnalysisId,
  snapshotStats,
}) => {
  const [remoteStats, setRemoteStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  /**
   * Charger les statistiques depuis le backend
   */
  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      if (snapshotStats || !activeAnalysisId) {
        setRemoteStats(null);
        setLoadingStats(false);
        return;
      }

      try {
        setLoadingStats(true);

        const stats = await getDashboardStats(activeAnalysisId);

        if (!cancelled) {
          setRemoteStats(stats);
        }
      } catch (err) {
        console.warn(
          'Impossible de récupérer les statistiques distantes:',
          err
        );

        if (!cancelled) {
          setRemoteStats(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [snapshotStats, activeAnalysisId, matches.length, differentRecords.length, files.length, totalRecordsCount]);

  const activeStats = snapshotStats ?? remoteStats;

  /**
   * Statistiques générales
   */
  const { duplicatesCount, uncertainCount } = React.useMemo(() => {
    const duplicateRecordIds = new Set<string>();
    const pendingUncertainRecordIds = new Set<string>();

    matches.forEach((match) => {
      const ids = [match.recordA?.id, match.recordB?.id].filter((id): id is string => Boolean(id));
      if (match.status === 'duplicate' || (match.status === 'uncertain' && match.decision === 'confirmed')) {
        ids.forEach((id) => duplicateRecordIds.add(String(id)));
      } else if (match.status === 'uncertain' && !match.decision) {
        ids.forEach((id) => pendingUncertainRecordIds.add(String(id)));
      }
    });
    const differentIds = new Set(differentRecords.map((record) => String(record.id)));
    const uncertainIds = [...pendingUncertainRecordIds].filter((id) => !duplicateRecordIds.has(id) && !differentIds.has(id));
    return { duplicatesCount: duplicateRecordIds.size, uncertainCount: uncertainIds.length };
  }, [matches, differentRecords]);

  const differentCount = differentRecords.length;

  /**
   * Cas ayant reçu une décision d'arbitrage
   */
  const arbitratedCount = matches.filter(
    (m) =>
      m.decision === 'confirmed' ||
      m.decision === 'rejected'
  ).length;

  /**
   * Nombre total de paires
   */
  const totalPairs =
    activeStats?.totalPairs ?? matches.length;

  /**
   * Pourcentages
   */
  const categorizedTotal =
    duplicatesCount + uncertainCount + differentCount;

  const duplicatesPct =
    categorizedTotal > 0
      ? Math.round((duplicatesCount / categorizedTotal) * 100)
      : 0;

  const uncertainPct =
    categorizedTotal > 0
      ? Math.round((uncertainCount / categorizedTotal) * 100)
      : 0;

  const differentPct =
    categorizedTotal > 0
      ? Math.round((differentCount / categorizedTotal) * 100)
      : 0;

  /**
   * Distribution des scores
   */
  const visibleCategoryTotal = duplicatesCount + uncertainCount + differentCount;
  const scoreDistribution = [
    {
      label: 'Doublons probables',
      count: duplicatesCount,
      color: 'bg-[#16734f]',
    },
    {
      label: 'Cas incertains',
      count: uncertainCount,
      color: 'bg-[#63b48f]',
    },
    {
      label: 'Différents',
      count: differentCount,
      color: 'bg-[#d7e3db]',
    },
  ].map((item) => ({
    ...item,
    pct: visibleCategoryTotal > 0
      ? Math.round((item.count / visibleCategoryTotal) * 100)
      : 0,
  }));

  /**
   * Récupérer le taux réel d'un attribut
   */
  const getAttributeRate = (
    field: string
  ): number => {
    if (!activeStats?.attributeConcordance) {
      return 0;
    }

    const attribute =
      activeStats.attributeConcordance.find(
        (item: any) =>
          String(item.field).toLowerCase() ===
          field.toLowerCase()
      );

    if (!attribute) {
      return 0;
    }

    const rate = Number(attribute.rate);

    return Number.isFinite(rate)
      ? Math.round(rate)
      : 0;
  };

  /**
   * Attributs affichés
   */
  const attributeConcordance: AttributeStatistic[] = [
    {
      name: 'Nom & Prénom',
      rate: getAttributeRate('nom'),
      desc: 'Concordance moyenne des noms comparés',
    },
    {
      name: 'Téléphone',
      rate: getAttributeRate('telephone'),
      desc: 'Concordance moyenne des numéros comparés',
    },
    {
      name: 'Ville / Localité',
      rate: getAttributeRate('ville'),
      desc: 'Concordance moyenne des villes comparées',
    },
    {
      name: 'Adresse / Rue',
      rate: getAttributeRate('adresse'),
      desc: 'Concordance moyenne des adresses comparées',
    },
    {
      name: 'Adresse Email',
      rate: getAttributeRate('email'),
      desc: 'Concordance moyenne des emails comparés',
    },
  ];

  /**
   * Score moyen global
   */
  const averageScore =
    totalPairs > 0 && matches.length > 0
      ? Math.round(
          matches.reduce(
            (sum, match) => sum + Number(match.score || 0),
            0
          ) / matches.length
        )
      : 0;

  const pieCircumference = 2 * Math.PI * 68;

  return (
    <div id="statistics-view" className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#dcebe2] bg-[#f2f8f4] px-3 py-1.5 text-xs font-semibold text-[#16734f]">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Vue d’ensemble
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#18231d] sm:text-3xl">Statistiques</h2>
          <p className="mt-1.5 text-sm text-[#77847d]">Suivez l’activité et la qualité de vos rapprochements.</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-[#104c36] p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-sm text-white/80"><span>Enregistrements</span><Database className="h-4 w-4" aria-hidden="true" /></div>
          <p className="mt-5 text-3xl font-semibold tracking-tight">{totalRecordsCount.toLocaleString('fr-FR')}</p>
          <p className="mt-1 text-xs text-white/65">dans {files.length} fichier{files.length === 1 ? '' : 's'}</p>
        </article>
        <article className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#68766e]"><span>Doublons repérés</span><GitCompareArrows className="h-4 w-4 text-[#16734f]" aria-hidden="true" /></div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-[#18231d]">{duplicatesCount.toLocaleString('fr-FR')}</p>
          <p className="mt-1 text-xs text-[#77847d]">{duplicatesPct}% des résultats classés</p>
        </article>
        <article className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#68766e]"><span>Cas à vérifier</span><PieChart className="h-4 w-4 text-[#16734f]" aria-hidden="true" /></div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-[#18231d]">{uncertainCount.toLocaleString('fr-FR')}</p>
          <p className="mt-1 text-xs text-[#77847d]">{arbitratedCount} décision{arbitratedCount === 1 ? '' : 's'} d’arbitrage</p>
        </article>
        <article className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#68766e]"><span>Enregistrements différents</span><TrendingUp className="h-4 w-4 text-[#16734f]" aria-hidden="true" /></div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-[#18231d]">{differentCount.toLocaleString('fr-FR')}</p>
          <p className="mt-1 text-xs text-[#77847d]">enregistrements classés différents</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><h3 className="text-base font-semibold text-[#18231d]">Répartition des résultats</h3><p className="mt-1 text-sm text-[#77847d]">Vue d’ensemble des catégories analysées.</p></div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f3ed] text-[#16734f]"><PieChart className="h-5 w-5" aria-hidden="true" /></div>
          </div>
          <div className="flex flex-col items-center gap-7 sm:flex-row sm:justify-center sm:gap-10">
            <div className="relative h-48 w-48 shrink-0" role="img" aria-label={`Répartition : ${duplicatesPct}% doublons, ${uncertainPct}% incertains, ${differentPct}% différents`}>
              <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
                <circle cx="88" cy="88" r="68" fill="none" stroke="var(--chart-neutral)" strokeWidth="18" />
                <circle className="statistics-chart-segment" cx="88" cy="88" r="68" fill="none" stroke="#16734f" strokeWidth="18" strokeDasharray={`${(duplicatesPct / 100) * pieCircumference} ${pieCircumference}`} strokeDashoffset="0" />
                <circle className="statistics-chart-segment" cx="88" cy="88" r="68" fill="none" stroke="#63b48f" strokeWidth="18" strokeDasharray={`${(uncertainPct / 100) * pieCircumference} ${pieCircumference}`} strokeDashoffset={-((duplicatesPct / 100) * pieCircumference)} />
              </svg>
              <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-3xl font-semibold tracking-tight text-[#18231d]">{categorizedTotal.toLocaleString('fr-FR')}</span>
                <span className="mt-1 text-xs text-[#77847d]">{categorizedTotal === 1 ? 'résultat' : 'résultats'}</span>
              </div>
            </div>
            <div className="w-full max-w-xs space-y-4">
              {scoreDistribution.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} /><span className="text-sm text-[#68766e]">{item.label}</span></div>
                  <span className="shrink-0 text-sm font-semibold text-[#18231d]">{item.count.toLocaleString('fr-FR')} <span className="font-normal text-[#77847d]">· {item.pct}%</span></span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><h3 className="text-base font-semibold text-[#18231d]">Répartition par catégorie</h3><p className="mt-1 text-sm text-[#77847d]">Part de chaque type de résultat.</p></div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f3ed] text-[#16734f]"><BarChart3 className="h-5 w-5" aria-hidden="true" /></div>
          </div>
          <div className="grid min-h-[220px] grid-cols-3 items-end gap-3 border-b border-[var(--border)] pb-4 pt-3" role="group" aria-label="Pourcentage par catégorie">
            {scoreDistribution.map((item) => (
              <div key={item.label} className="flex h-full flex-col items-center justify-end gap-2 text-center">
                <span className="text-xs font-semibold tabular-nums text-[#18231d]">{item.pct}%</span>
                <div className="flex h-36 w-full max-w-16 items-end justify-center rounded-t-xl bg-[var(--chart-track)]">
                  <div
                    className={`statistics-chart-bar w-full rounded-t-xl ${item.color}`}
                    style={{ height: `${item.pct}%` }}
                    role="img"
                    aria-label={`${item.label} : ${item.pct}%`}
                    title={`${item.label} : ${item.count.toLocaleString('fr-FR')} (${item.pct}%)`}
                  />
                </div>
                <span className="min-h-8 text-[11px] leading-4 text-[var(--muted)]">{item.label}</span>
                <span className="text-xs font-medium tabular-nums text-[#18231d]">{item.count.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
          {categorizedTotal === 0 && <p className="mt-3 text-center text-xs text-[var(--muted)]">Les graphiques apparaîtront après la première analyse.</p>}
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#f7f9f7] p-3 text-xs text-[#77847d]"><FileSpreadsheet className="h-4 w-4 shrink-0 text-[#16734f]" aria-hidden="true" />{visibleCategoryTotal.toLocaleString('fr-FR')} enregistrement{visibleCategoryTotal === 1 ? '' : 's'} répartis dans les catégories ci-dessus.</div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#e8ece9] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h3 className="text-base font-semibold text-[#18231d]">Concordance des attributs</h3><p className="mt-1 text-sm text-[#77847d]">Taux moyen de similarité des champs comparés.</p></div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f3ed] text-[#16734f]"><TrendingUp className="h-5 w-5" aria-hidden="true" /></div>
        </div>
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          {attributeConcordance.map((attr) => (
            <div key={attr.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
              <div className="min-w-0"><div className="truncate text-sm font-medium text-[#34423a]">{attr.name.replace('Ville / Localité', 'Ville').replace('Adresse / Rue', 'Adresse').replace('Adresse Email', 'Email')}</div><div className="mt-0.5 truncate text-xs text-[#849088]">{attr.desc}</div></div>
              <span className="text-sm font-semibold tabular-nums text-[#16734f]">{loadingStats ? '…' : `${attr.rate}%`}</span>
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]"><div className="h-full rounded-full bg-[#16734f] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, attr.rate))}%` }} role="progressbar" aria-label={`Concordance ${attr.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, attr.rate))} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
