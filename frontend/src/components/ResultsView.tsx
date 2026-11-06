import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Scale,
  Sparkles,
} from 'lucide-react';

import { DataRecord, MatchPair } from '../types';
import { formatBirthDate } from '../utils/formatBirthDate';
import { getPendingArbitrationMatches } from '../utils/arbitration';

interface ResultsViewProps {
  matches: MatchPair[];
  differentRecords: DataRecord[];
  exportFileName?: string;
  onOpenDetails: (match: MatchPair) => void;
  onGoToArbitration: (matchId: string) => void;
}

type FilterType = 'all' | 'duplicate' | 'uncertain' | 'different';

function repairDisplayText(value: string): string {
  let text = value;
  const cp1252: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
    0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };

  for (let attempt = 0; attempt < 2 && /[\u00c3\u00c2\u00e2]/.test(text); attempt += 1) {
    try {
      const bytes = Array.from(text, (character) => {
        const codePoint = character.codePointAt(0)!;
        const byte = codePoint <= 0xff ? codePoint : cp1252[codePoint];
        if (byte === undefined) throw new Error('Invalid text encoding');
        return byte;
      });
      text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      break;
    }
  }

  return text.replace(/\u00e2\u20ac\u201d/g, '\u2014');
}

export function ResultsView({
  matches,
  differentRecords,
  exportFileName = 'resultats-analyse.csv',
  onOpenDetails,
  onGoToArbitration,
}: ResultsViewProps) {
  const [activeFilter, setActiveFilter] =
    useState<FilterType>('all');

  const [searchQuery, setSearchQuery] = useState('');

  const pendingMatchIds = useMemo(
    () => new Set(getPendingArbitrationMatches(matches).map((match) => match.id)),
    [matches]
  );

  const { duplicatesCount, uncertainCount } = useMemo(() => {
    const duplicateRecordIds = new Set<string>();
    const pendingUncertainRecordIds = new Set<string>();

    matches.forEach((match) => {
      const recordIds = [match.recordA?.id, match.recordB?.id]
        .filter((id): id is string => Boolean(id));
      if (match.status === 'duplicate' || (match.status === 'uncertain' && match.decision === 'confirmed')) {
        recordIds.forEach((id) => duplicateRecordIds.add(String(id)));
      } else if (match.status === 'uncertain' && !match.decision) {
        recordIds.forEach((id) => pendingUncertainRecordIds.add(String(id)));
      }
    });

    const differentRecordIds = new Set(differentRecords.map((record) => String(record.id)));
    const uncertainRecordIds = new Set(
      [...pendingUncertainRecordIds].filter((id) => !duplicateRecordIds.has(id) && !differentRecordIds.has(id))
    );
    return { duplicatesCount: duplicateRecordIds.size, uncertainCount: uncertainRecordIds.size };
  }, [matches, differentRecords]);

  const differentCount = differentRecords.length;
  const totalCount = duplicatesCount + uncertainCount + differentCount;

  const filteredMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return matches.filter((match) => {
      const isDuplicate =
        match.status === 'duplicate' ||
        (match.status === 'uncertain' && match.decision === 'confirmed');
      const isPendingUncertain =
        match.status === 'uncertain' && !match.decision;

      if (activeFilter === 'duplicate' && !isDuplicate) return false;
      if (activeFilter === 'uncertain' && !isPendingUncertain) return false;

      if (activeFilter === 'different') {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        match.recordA.nom,
        match.recordA.prenom,
        match.recordA.email,
        match.recordA.telephone,
        match.recordA.adresse,
        match.recordA.ville,
        match.recordA.date_naissance,
        match.recordA.cin,
        match.recordB.nom,
        match.recordB.prenom,
        match.recordB.email,
        match.recordB.telephone,
        match.recordB.adresse,
        match.recordB.ville,
        match.recordB.date_naissance,
        match.recordB.cin,
        match.statusLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [matches, activeFilter, searchQuery]);

  const filteredDifferentRecords = useMemo(() => {
    if (
      activeFilter !== 'all' &&
      activeFilter !== 'different'
    ) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return differentRecords;
    }

    return differentRecords.filter((record) => {
      const searchableText = [
        record.nom,
        record.prenom,
        record.email,
        record.telephone,
        record.adresse,
        record.ville,
        record.date_naissance,
        record.cin,
        record.sourceFile,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [
    differentRecords,
    activeFilter,
    searchQuery,
  ]);

  const visibleCount =
    activeFilter === 'different'
      ? filteredDifferentRecords.length
      : activeFilter === 'all'
        ? filteredMatches.length +
          filteredDifferentRecords.length
        : filteredMatches.length;

  const handleExport = () => {
    const rows: string[][] = [
      [
        'Statut',
        'Nom A',
        'Prénom A',
        'Email A',
        'Téléphone A',
        'Adresse A',
        'Ville A',
        'Date de naissance A',
        'CIN A',
        'Nom B',
        'Prénom B',
        'Email B',
        'Téléphone B',
        'Adresse B',
        'Ville B',
        'Date de naissance B',
        'CIN B',
        'Score',
      ],
    ];

    if (
      activeFilter === 'all' ||
      activeFilter === 'duplicate' ||
      activeFilter === 'uncertain'
    ) {
      filteredMatches.forEach((match) => {
        rows.push([
          match.statusLabel,
          match.recordA.nom,
          match.recordA.prenom ?? '',
          match.recordA.email,
          match.recordA.telephone,
          match.recordA.adresse,
          match.recordA.ville,
          match.recordA.date_naissance ?? '',
          match.recordA.cin ?? '',
          match.recordB.nom,
          match.recordB.prenom ?? '',
          match.recordB.email,
          match.recordB.telephone,
          match.recordB.adresse,
          match.recordB.ville,
          match.recordB.date_naissance ?? '',
          match.recordB.cin ?? '',
          typeof match.score === 'number' && Number.isFinite(match.score) ? `${Math.round(match.score)} %` : '\u2014',
        ]);
      });
    }

    if (
      activeFilter === 'all' ||
      activeFilter === 'different'
    ) {
      filteredDifferentRecords.forEach((record) => {
        rows.push([
          'Différent',
          record.nom,
          record.prenom ?? '',
          record.email,
          record.telephone,
          record.adresse,
          record.ville,
          record.date_naissance ?? '',
          record.cin ?? '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });
    }

    if (rows.length <= 1) {
      return;
    }

    const csvContent = rows
      .map((row) =>
        row
          .map((value) => {
            const safeValue = String(value ?? '');
            return `"${safeValue.replace(/"/g, '""')}"`;
          })
          .join(';')
      )
      .join('\n');

    const blob = new Blob(
      ['\ufeff' + csvContent],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = exportFileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const getStatusStyle = (
    status: MatchPair['status']
  ) => {
    if (status === 'duplicate') {
      return {
        container:
          'bg-[#e8f3ed] border-green-500/20 text-[#16734f]',
        icon: <CheckCircle2 size={15} />,
      };
    }

    if (status === 'uncertain') {
      return {
        container:
          'bg-yellow-500/10 border-yellow-500/20 text-[#946000]',
        icon: <AlertTriangle size={15} />,
      };
    }

    return {
      container:
        'bg-red-500/10 border-red-500/20 text-[#b42318]',
      icon: <XCircle size={15} />,
    };
  };

  const getRecordName = (record: DataRecord) => {
    return [repairDisplayText(record.nom), record.prenom ? repairDisplayText(record.prenom) : '']
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles
              size={22}
              className="text-[#16734f]"
            />

            <h1 className="text-2xl font-semibold text-[#18231d]">
              Résultats
            </h1>
          </div>

          <p className="mt-1 text-sm text-[#68766e]">
            Consultez les résultats de l'analyse et
            arbitrez les cas nécessaires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={visibleCount === 0}
            className="flex items-center gap-2 rounded-lg border border-[#2C2C2C] bg-[#191919] px-4 py-2.5 text-sm font-medium text-[#34423a] transition hover:border-[#b7d5c4] hover:text-[#18231d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} />
            Exporter les résultats
          </button>
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`rounded-xl border p-4 text-left transition ${
            activeFilter === 'all'
              ? 'border-[#b7d5c4] bg-[#e8f3ed]'
              : 'border-[#2C2C2C] bg-[#191919] hover:border-[#444]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#68766e]">
              Tous
            </span>

            <Filter
              size={17}
              className="text-[#68766e]"
            />
          </div>

          <div className="mt-2 text-2xl font-semibold text-[#18231d]">
            {totalCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveFilter('duplicate')
          }
          className={`rounded-xl border p-4 text-left transition ${
            activeFilter === 'duplicate'
              ? 'border-[#b7d5c4] bg-[#e8f3ed]'
              : 'border-[#2C2C2C] bg-[#191919] hover:border-[#444]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#68766e]">
              Doublons
            </span>

            <CheckCircle2
              size={17}
              className="text-[#16734f]"
            />
          </div>

          <div className="mt-2 text-2xl font-semibold text-[#18231d]">
            {duplicatesCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveFilter('uncertain')
          }
          className={`rounded-xl border p-4 text-left transition ${
            activeFilter === 'uncertain'
              ? 'border-yellow-500/40 bg-yellow-500/5'
              : 'border-[#2C2C2C] bg-[#191919] hover:border-[#444]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#68766e]">
              Incertains
            </span>

            <AlertTriangle
              size={17}
              className="text-[#946000]"
            />
          </div>

          <div className="mt-2 text-2xl font-semibold text-[#18231d]">
            {uncertainCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveFilter('different')
          }
          className={`rounded-xl border p-4 text-left transition ${
            activeFilter === 'different'
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-[#2C2C2C] bg-[#191919] hover:border-[#444]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#68766e]">
              Différents
            </span>

            <XCircle
              size={17}
              className="text-[#b42318]"
            />
          </div>

          <div className="mt-2 text-2xl font-semibold text-[#18231d]">
            {differentCount}
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#77847d]"
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Rechercher un nom, email, téléphone, adresse..."
            className="w-full rounded-lg border border-[#2C2C2C] bg-[#191919] py-2.5 pl-10 pr-4 text-sm text-[#18231d] outline-none placeholder:text-[#849088] focus:border-green-500/50"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#2C2C2C] bg-[#191919] px-4 py-2.5 text-sm text-[#68766e]">
          <Scale size={16} />
          {visibleCount} résultat
          {visibleCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Results */}
      {visibleCount === 0 ? (
        <div className="rounded-xl border border-[#2C2C2C] bg-[#191919] p-12 text-center">
          <XCircle
            size={40}
            className="mx-auto text-[#849088]"
          />

          <h2 className="mt-4 text-lg font-medium text-[#18231d]">
            Aucun résultat
          </h2>

          <p className="mt-2 text-sm text-[#77847d]">
            Aucun enregistrement ne correspond au
            filtre sélectionné.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2C2C2C] bg-[#191919]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#2C2C2C] bg-[#111111]">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-[#77847d]">
                    Enregistrement A
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-[#77847d]">
                    Enregistrement B
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-[#77847d]">
                    Score
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-[#77847d]">
                    Statut
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-[#77847d]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#2C2C2C]">
                {/* Match rows */}
                {filteredMatches.map((match) => {
                  const statusStyle =
                    getStatusStyle(match.status);

                  return (
                    <tr
                      key={match.id}
                      className="transition hover:bg-[#202020]"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-[#18231d]">
                          {getRecordName(
                            match.recordA
                          )}
                        </div>

                        <div className="mt-1 text-xs text-[#77847d]">
                          {(match.recordA.email && repairDisplayText(match.recordA.email)) ||
                            'Email non renseigné'}
                        </div>
                        <div className="mt-1 text-xs text-[#77847d]">Naissance : {formatBirthDate(match.recordA.date_naissance) || '—'} · CIN : {match.recordA.cin || '—'}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <ArrowRight
                            size={15}
                            className="text-[#849088]"
                          />

                          <div>
                            <div className="font-medium text-[#18231d]">
                              {getRecordName(
                                match.recordB
                              )}
                            </div>

                            <div className="mt-1 text-xs text-[#77847d]">
                              {(match.recordB.email && repairDisplayText(match.recordB.email)) ||
                                'Email non renseigné'}
                            </div>
                            <div className="mt-1 text-xs text-[#77847d]">Naissance : {formatBirthDate(match.recordB.date_naissance) || '—'} · CIN : {match.recordB.cin || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#18231d]">
                          {typeof match.score === 'number' && Number.isFinite(match.score) ? `${Math.round(match.score)} %` : '\u2014'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusStyle.container}`}
                        >
                          {statusStyle.icon}
                          {repairDisplayText(match.status === 'different' ? 'Diff\u00e9rent' : match.statusLabel)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {match.status ===
                            'uncertain' &&
                            !match.decision && pendingMatchIds.has(match.id) && (
                              <button
                                type="button"
                                onClick={() => onGoToArbitration(match.id)}
                                className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-[#946000] transition hover:bg-yellow-500/20"
                              >
                                Arbitrer
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() =>
                              onOpenDetails(match)
                            }
                            className="flex items-center gap-2 rounded-lg border border-[#2C2C2C] bg-[#111111] px-3 py-2 text-xs font-medium text-[#34423a] transition hover:border-[#b7d5c4] hover:text-[#18231d]"
                          >
                            <Eye size={15} />
                            Détails
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Different records */}
                {filteredDifferentRecords.map(
                  (record) => (
                    <tr
                      key={`different-${record.id}`}
                      className="transition hover:bg-[#202020]"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-[#18231d]">
                          {getRecordName(record)}
                        </div>

                        <div className="mt-1 text-xs text-[#77847d]">
                          {(record.email && repairDisplayText(record.email)) ||
                            'Email non renseigné'}
                        </div>
                        <div className="mt-1 text-xs text-[#77847d]">Naissance : {formatBirthDate(record.date_naissance) || '—'} · CIN : {record.cin || '—'}</div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm text-[#849088]">
                          Aucun rapprochement
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-[#77847d]">
                          {'\u2014'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-[#b42318]">
                          <XCircle size={15} />
                          Différent
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="text-xs text-[#849088]">
                          Aucun détail
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

