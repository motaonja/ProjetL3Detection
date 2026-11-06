import React, { useState } from 'react';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { AnalysisSnapshot, MatchPair } from '../types';
import { formatBirthDate } from '../utils/formatBirthDate';
import { StatisticsView } from './StatisticsView';
import { ResultsView } from './ResultsView';
import { ArbitrationView } from './ArbitrationView';

interface AnalysisDetailViewProps {
  snapshot: AnalysisSnapshot;
  onBack: () => void;
  onOpenDetails: (match: MatchPair) => void;
  onArbitrate: (matchId: string, decision: 'confirmed' | 'rejected') => Promise<void> | void;
  onResetArbitration: () => Promise<void> | void;
}

type DetailSection = 'files' | 'stats' | 'results' | 'arbitration';

export function AnalysisDetailView({
  snapshot,
  onBack,
  onOpenDetails,
  onArbitrate,
  onResetArbitration,
}: AnalysisDetailViewProps) {
  const [section, setSection] = useState<DetailSection>('files');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [arbitrationFocusMatchId, setArbitrationFocusMatchId] = useState<string | null>(null);
  const selectedFile = snapshot.files.find((file) => file.id === selectedFileId);
  const visibleRecords = selectedFileId
    ? snapshot.records.filter((record) => String(record.fileId) === selectedFileId || (!record.fileId && record.sourceFile === selectedFile?.name))
    : snapshot.records;
  const sections: { id: DetailSection; label: string }[] = [
    { id: 'files', label: 'Fichiers' },
    { id: 'stats', label: 'Statistiques' },
    { id: 'results', label: 'Résultats' },
    { id: 'arbitration', label: 'Arbitrages' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[#8F8F8A] transition hover:text-[#8EB735]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'historique
          </button>
          <h2 className="text-xl font-bold tracking-tight text-[#E4E9E1]">
            Analyse du {snapshot.analysis.date}
          </h2>
          <p className="mt-1 text-xs text-[#8F8F8A]">
            {snapshot.analysis.totalRecords} enregistrements - {snapshot.files.length} fichiers
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#2C2C2C] pb-3">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${section === item.id ? 'border-[#8EB735]/40 bg-[#8EB735]/10 text-[#8EB735]' : 'border-[#2C2C2C] bg-[#191919] text-[#8F8F8A] hover:text-[#E4E9E1]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'files' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot.files.map((file) => (
              <button key={file.id} type="button" aria-pressed={selectedFileId === file.id} onClick={() => setSelectedFileId((current) => current === file.id ? null : file.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors hover:border-[#8EB735]/50 ${selectedFileId === file.id ? 'border-[#8EB735]/50 bg-[#8EB735]/5' : 'border-[#2C2C2C] bg-[#191919]'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2C2C2C] bg-[#111111] text-[#8EB735]">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#E4E9E1]">{file.name}</div>
                    <div className="mt-1 text-[10px] text-[#8F8F8A]">{file.format} - {file.size} - {file.rowCount} lignes</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#2C2C2C] bg-[#191919]">
            <div className="border-b border-[#2C2C2C] bg-[#111111] px-4 py-3 text-xs font-semibold text-[#8F8F8A]">
              Enregistrements archivés : {visibleRecords.length}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-[#111111] text-[10px] uppercase tracking-wider text-[#8F8F8A]">
                  <tr>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Téléphone</th>
                    <th className="px-4 py-3">Adresse</th>
                    <th className="px-4 py-3">Ville</th>
                    <th className="px-4 py-3">Date de naissance</th>
                    <th className="px-4 py-3">CIN</th>
                    <th className="px-4 py-3">Fichier source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C] text-[#E4E9E1]">
                  {visibleRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-[#111111]/80">
                      <td className="px-4 py-3">{[record.nom, record.prenom].filter(Boolean).join(' ')}</td>
                      <td className="px-4 py-3 text-[#8F8F8A]">{record.email}</td>
                      <td className="px-4 py-3">{record.telephone}</td>
                      <td className="px-4 py-3">{record.adresse}</td>
                      <td className="px-4 py-3">{record.ville}</td>
                      <td className="px-4 py-3">{formatBirthDate(record.date_naissance)}</td>
                      <td className="px-4 py-3 font-mono">{record.cin ?? ''}</td>
                      <td className="px-4 py-3 text-[#8F8F8A]">{snapshot.files.find((file) => file.id === record.fileId)?.name ?? record.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'stats' && (
        <StatisticsView
          matches={snapshot.results}
          differentRecords={snapshot.differentRecords}
          files={snapshot.files}
          totalRecordsCount={visibleRecords.length}
          activeAnalysisId={snapshot.analysis.id}
          snapshotStats={snapshot.stats}
        />
      )}

      {section === 'results' && (
        <ResultsView
          matches={snapshot.results}
          differentRecords={snapshot.differentRecords}
          exportFileName={`resultats-analyse-${snapshot.analysis.id}.csv`}
          onOpenDetails={onOpenDetails}
          onGoToArbitration={(matchId) => {
            setArbitrationFocusMatchId(matchId);
            setSection('arbitration');
          }}
        />
      )}

      {section === 'arbitration' && (
        <ArbitrationView
          matches={snapshot.results}
          onArbitrate={onArbitrate}
          onResetArbitration={onResetArbitration}
        />
      )}
    </div>
  );
}

