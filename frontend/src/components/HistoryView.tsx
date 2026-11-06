import React, { useMemo, useState } from 'react';
import {
  History,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  Trash2,
  Eye,
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';
import { confirmAction, showError, showSuccess } from '../services/alerts';

interface HistoryViewProps {
  historyItems: AnalysisHistoryItem[];
  onViewAnalysis: (item: AnalysisHistoryItem) => Promise<void> | void;
  onDeleteHistory: (item: AnalysisHistoryItem) => Promise<void> | void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  historyItems,
  onViewAnalysis,
  onDeleteHistory,
}) => {
  const [dateFilter, setDateFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredHistoryItems = useMemo(() => {
    if (!dateFilter) return historyItems;

    return historyItems.filter((item) => {
      const [datePart] = item.date.split(' ');
      const [day, month, year] = datePart.split('/');
      const isoDate = year && month && day
        ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        : datePart;
      return isoDate === dateFilter;
    });
  }, [historyItems, dateFilter]);

  const handleDelete = async (item: AnalysisHistoryItem) => {
    const confirmed = await confirmAction(
      'Supprimer cette analyse ?',
      'Voulez-vous vraiment supprimer cette analyse du ' + item.date + ' ?',
      'Supprimer'
    );
    if (!confirmed) return;
    setDeletingId(item.id);
    try {
      await onDeleteHistory(item);
      await showSuccess("Analyse supprimee", "L'analyse a ete supprimee de l'historique.");
    } catch (error) {
      await showError('Suppression impossible', error instanceof Error ? error.message : 'Impossible de supprimer cette analyse.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewAnalysis = async (item: AnalysisHistoryItem) => {
    const confirmed = await confirmAction(
      'Voir les donnees de cette analyse ?',
      'Voulez-vous ouvrir les donnees enregistrees pour cette analyse ?',
      'Voir les donnees'
    );
    if (!confirmed) return;
    try {
      await onViewAnalysis(item);
      await showSuccess('Analyse ouverte', 'Les donnees de cette analyse sont affichees.');
    } catch (error) {
      await showError('Ouverture impossible', error instanceof Error ? error.message : 'Impossible de charger les donnees de cette analyse.');
    }
  };

  return (
    <div id="history-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#E4E9E1] tracking-tight">
            Historique
          </h2>
          <p className="text-xs text-[#8F8F8A] mt-1">
            Consultez les sessions antérieures de détection et de rapprochement.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="history-date-filter" className="text-xs text-[#8F8F8A]">
          Rechercher par date
        </label>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8F8F8A]" />
          <input
            id="history-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="w-full rounded-xl border border-[#2C2C2C] bg-[#111111] py-2 pl-9 pr-3 text-xs text-[#E4E9E1] focus:border-[#8EB735] focus:outline-none"
          />
        </div>
      </div>

      {/* Compact history cards for phones and tablets */}
      <div className="space-y-3 lg:hidden">
        {filteredHistoryItems.length === 0 ? (
          <div className="rounded-2xl border border-[#2C2C2C] bg-[#191919] p-6 text-center text-xs text-[#8F8F8A]">
            Aucune session pour cette date.
          </div>
        ) : filteredHistoryItems.map((item) => (
          <article key={`mobile-${item.id}`} className="space-y-4 rounded-2xl border border-[#2C2C2C] bg-[#191919] p-4 shadow-2xs">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#E4E9E1]"><Calendar className="h-3.5 w-3.5 shrink-0 text-[#8F8F8A]" /><span className="break-words">{item.date}</span></div>
                <p className="mt-1 text-[10px] text-[#8F8F8A]">Duree : {item.executionTime}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.status.startsWith('Termin') ? 'border-[#2C2C2C] bg-[#111111] text-[#AEB4C1]' : item.status.startsWith('Arbitr') ? 'border-[#8EB735]/30 bg-[#8EB735]/15 text-[#8EB735]' : 'border-[#2C2C2C] bg-[#111111] text-[#8F8F8A]'}`}>{item.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#2C2C2C] bg-[#111111] p-3"><p className="text-[10px] text-[#8F8F8A]">Enregistrements</p><p className="mt-1 font-mono text-sm font-bold text-[#E4E9E1]">{item.totalRecords.toLocaleString('fr-FR')}</p></div>
              <div className="rounded-xl border border-[#8EB735]/20 bg-[#8EB735]/5 p-3"><p className="text-[10px] text-[#8F8F8A]">Doublons</p><p className="mt-1 font-mono text-sm font-bold text-[#8EB735]">{item.duplicatesFound}</p></div>
              <div className="rounded-xl border border-[#D87A71]/20 bg-[#D87A71]/5 p-3"><p className="text-[10px] text-[#8F8F8A]">Cas incertains</p><p className="mt-1 font-mono text-sm font-bold text-[#D87A71]">{item.uncertainCases}</p></div>
              <div className="rounded-xl border border-[#2C2C2C] bg-[#111111] p-3"><p className="text-[10px] text-[#8F8F8A]">Differents</p><p className="mt-1 font-mono text-sm font-bold text-[#E4E9E1]">{item.differentCount ?? 0}</p></div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8F8F8A]">Fichiers analyses</p>
              <div className="flex flex-wrap gap-1.5">
                {item.files.map((fileName, idx) => <span key={idx} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[#2C2C2C] bg-[#111111] px-2.5 py-1 text-[10px] text-[#AEB4C1]"><FileSpreadsheet className="h-3 w-3 shrink-0 text-[#8F8F8A]" /><span className="break-all">{fileName}</span></span>)}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button id={`btn-view-history-mobile-${item.id}`} type="button" onClick={() => void handleViewAnalysis(item)} disabled={!item.hasSnapshot} title={!item.hasSnapshot ? "Archive detaillee indisponible pour cette ancienne analyse" : "Voir l'analyse"} className="inline-flex flex-row items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2C2C2C] bg-[#111111] px-3 py-2.5 text-xs font-medium text-[#E4E9E1] transition-colors hover:bg-[#2C2C2C] hover:text-[#8EB735] disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-3.5 w-3.5 text-[#8F8F8A]" /><span>Voir l'analyse</span></button>
              <button id={`btn-delete-history-mobile-${item.id}`} type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} aria-label={`Supprimer la session du ${item.date}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2C2C2C] bg-[#111111] px-3 py-2.5 text-xs font-medium text-[#E4E9E1] transition-colors hover:bg-[#2C2C2C] hover:text-[#8EB735] disabled:cursor-wait disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /><span>Supprimer</span></button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-[#2C2C2C] bg-[#191919] p-3 text-[10px] text-[#8F8F8A] lg:hidden">
        <span>Sessions visibles : {filteredHistoryItems.length} / {historyItems.length}</span>
        <span className="opacity-75">Archives stockees dans la base de donnees</span>
      </div>
      {/* History Table */}
      <div className="hidden lg:block bg-[#191919] rounded-2xl border border-[#2C2C2C] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111111] border-b border-[#2C2C2C] text-[#8F8F8A] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Fichiers analysés</th>
                <th className="py-3 px-4 text-center">Enregistrements</th>
                <th className="py-3 px-4 text-center">Doublons trouvés</th>
                <th className="py-3 px-4 text-center">Cas incertains</th>
                <th className="py-3 px-4 text-center">Différents</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2C] text-[#E4E9E1]">
              {filteredHistoryItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8F8F8A]">
                    Aucune session pour cette date.
                  </td>
                </tr>
              ) : filteredHistoryItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#111111]/80 transition-colors">
                  {/* Date */}
                  <td className="py-3.5 px-4 font-semibold text-[#E4E9E1]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#8F8F8A]" />
                      <span>{item.date}</span>
                    </div>
                    <div className="text-[10px] text-[#8F8F8A] font-normal mt-0.5">
                      Durée : {item.executionTime}
                    </div>
                  </td>

                  {/* Fichiers analysés */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {item.files.map((fileName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#111111] text-[#AEB4C1] text-[10px] font-medium border border-[#2C2C2C]"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-[#8F8F8A]" />
                          <span className="truncate max-w-[150px]">{fileName}</span>
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Nombre d'enregistrements */}
                  <td className="py-3.5 px-4 text-center font-bold font-mono text-[#E4E9E1]">
                    {item.totalRecords.toLocaleString('fr-FR')}
                  </td>

                  {/* Doublons trouvés */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8EB735]/15 text-[#8EB735] border border-[#8EB735]/30">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{item.duplicatesFound}</span>
                    </span>
                  </td>

                  {/* Cas incertains */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{item.uncertainCases}</span>
                    </span>
                  </td>

                  {/* Différents */}
                  <td className="py-3.5 px-4 text-center font-bold font-mono text-[#E4E9E1]">
                    {item.differentCount ?? 0}
                  </td>

                  {/* Statut */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.status.startsWith('Termin')
                          ? 'bg-[#111111] text-[#AEB4C1] border border-[#2C2C2C]'
                          : item.status.startsWith('Arbitr')
                          ? 'bg-[#8EB735]/15 text-[#8EB735] border border-[#8EB735]/30'
                          : 'bg-[#111111] text-[#8F8F8A] border border-[#2C2C2C]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                    <button
                      id={`btn-view-history-${item.id}`}
                      type="button"
                      onClick={() => void handleViewAnalysis(item)}
                      disabled={!item.hasSnapshot}
                      title={!item.hasSnapshot ? "Archive detaillee indisponible pour cette ancienne analyse" : "Voir l'analyse"}
                      className="inline-flex flex-row items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2C2C2C] bg-[#111111] px-2.5 py-1.5 text-xs font-medium text-[#E4E9E1] shadow-2xs transition-colors hover:bg-[#2C2C2C] hover:text-[#8EB735] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Eye className="h-3 w-3 text-[#8F8F8A]" />
                      <span>Voir l'analyse</span>
                    </button>
                    <button
                      type="button"
                      id={`btn-delete-history-${item.id}`}
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2C2C2C] bg-[#111111] px-2.5 py-1.5 text-xs font-medium text-[#E4E9E1] transition-colors hover:bg-[#2C2C2C] hover:text-[#8EB735] disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Supprimer la session du ${item.date}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Supprimer</span>
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#111111]/80 border-t border-[#2C2C2C] text-xs text-[#8F8F8A] flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>Sessions visibles : {filteredHistoryItems.length} / {historyItems.length}</span>
          <span className="text-[#8F8F8A] opacity-75">Archives stockees dans la base de donnees</span>
        </div>
      </div>
    </div>
  );
};


