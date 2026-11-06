import React, { useState, useMemo } from 'react';
import {
  Table,
  Search,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Play,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { DataRecord, UploadedFile } from '../types';
import { formatBirthDate } from '../utils/formatBirthDate';

function formatImportTimestamp(value: string): string {
  const timestamp = value.trim();
  const localMatch = timestamp.match(/^(\d{2}\/\d{2}\/\d{4})[ T]+(\d{2}:\d{2})(?::\d{2})?$/);
  if (localMatch) {
    return `Import\u00e9 le ${localMatch[1]} \u00e0 ${localMatch[2]}`;
  }

  const parsed = new Date(timestamp);
  if (!Number.isNaN(parsed.getTime())) {
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(parsed).replace(',', '');
    const [date, time] = formatted.split(' ');
    return `Import\u00e9 le ${date} \u00e0 ${time}`;
  }

  return `Import\u00e9 le ${timestamp}`;
}

interface DataPreviewViewProps {
  records: DataRecord[];
  files: UploadedFile[];
  onStartAnalysis: () => void;
}

export const DataPreviewView: React.FC<DataPreviewViewProps> = ({
  records,
  files,
  onStartAnalysis,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<Exclude<keyof DataRecord, 'sourceValues'>>('nom');
  const [sortAsc, setSortAsc] = useState(true);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        const matchesFile =
          selectedFileFilter === 'all' || rec.sourceFile === selectedFileFilter;
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          rec.nom.toLowerCase().includes(q) ||
          rec.email.toLowerCase().includes(q) ||
          rec.telephone.toLowerCase().includes(q) ||
          rec.adresse.toLowerCase().includes(q) ||
          rec.ville.toLowerCase().includes(q) ||
          rec.sourceFile.toLowerCase().includes(q);
        return matchesFile && matchesQuery;
      })
      .sort((a, b) => {
        const valA = (a[sortField] || '').toLowerCase();
        const valB = (b[sortField] || '').toLowerCase();
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [records, searchQuery, selectedFileFilter, sortField, sortAsc]);

  const uploadDateByFileName = useMemo(
    () => new Map(files.map((file) => [file.name, file.uploadDate])),
    [files]
  );

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, DataRecord[]>();

    filteredRecords.forEach((record) => {
      const sourceFile = record.sourceFile || 'Fichier inconnu';
      const fileRecords = groups.get(sourceFile) ?? [];
      fileRecords.push(record);
      groups.set(sourceFile, fileRecords);
    });

    return Array.from(groups.entries());
  }, [filteredRecords]);

  const handleSort = (field: Exclude<keyof DataRecord, 'sourceValues'>) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div id="data-preview-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#E4E9E1] tracking-tight">
            Voir les données
          </h2>
          <p className="text-xs text-[#8F8F8A] mt-1">
            Consultez et filtrez les enregistrements importés avant de lancer le traitement.
          </p>
        </div>

        
      </div>

      {/* Summary Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#191919] rounded-2xl p-4 border border-[#2C2C2C] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111111] text-[#8EB735] border border-[#2C2C2C] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-[#8F8F8A] font-medium">Nombre de lignes</div>
            <div className="text-base font-bold text-[#E4E9E1]">
              {filteredRecords.length} enregistrements
            </div>
          </div>
        </div>

        <div className="bg-[#191919] rounded-2xl p-4 border border-[#2C2C2C] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111111] text-[#D3DBA2] border border-[#2C2C2C] flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-[#8F8F8A] font-medium">Fichiers sources</div>
            <div className="text-base font-bold text-[#E4E9E1]">{files.length} fichiers actifs</div>
          </div>
        </div>
      </div>

      {/* Table Filter Controls */}
      <div className="bg-[#191919] rounded-2xl border border-[#2C2C2C] p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8F8F8A]" />
          <input
            type="text"
            id="data-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone, ville..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#111111] text-[#E4E9E1] placeholder-[#8F8F8A] border border-[#2C2C2C] focus:border-[#8EB735] focus:outline-none transition-all"
          />
        </div>

        {/* Source File Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#8F8F8A]" />
          <span className="text-xs text-[#8F8F8A] whitespace-nowrap">Fichier :</span>
          <select
            id="data-file-filter"
            value={selectedFileFilter}
            onChange={(e) => setSelectedFileFilter(e.target.value)}
            className="text-xs rounded-xl border border-[#2C2C2C] py-2 px-3 bg-[#111111] text-[#E4E9E1] focus:border-[#8EB735] focus:outline-none font-medium cursor-pointer shadow-2xs"
          >
            <option value="all">Tous les fichiers ({records.length})</option>
            {files.map((file) => (
              <option key={file.id} value={file.name}>
                {file.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#191919] rounded-2xl border border-[#2C2C2C] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111111] border-b border-[#2C2C2C] text-[#8F8F8A] font-semibold uppercase tracking-wider text-[10px]">
                <th
                  onClick={() => handleSort('nom')}
                  className="py-3 px-4 cursor-pointer hover:text-[#E4E9E1] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nom</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8F8F8A]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="py-3 px-4 cursor-pointer hover:text-[#E4E9E1] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Email</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8F8F8A]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('telephone')}
                  className="py-3 px-4 cursor-pointer hover:text-[#E4E9E1] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Téléphone</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8F8F8A]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('adresse')}
                  className="py-3 px-4 cursor-pointer hover:text-[#E4E9E1] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Adresse</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8F8F8A]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ville')}
                  className="py-3 px-4 cursor-pointer hover:text-[#E4E9E1] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Ville</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8F8F8A]" />
                  </div>
                </th>
                <th className="py-3 px-4">Date de naissance</th>
                <th className="py-3 px-4">CIN</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span>Fichier source</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2C] text-[#E4E9E1]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8F8F8A]">
                    Aucun enregistrement ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                groupedRecords.map(([sourceFile, fileRecords]) => (
                  <React.Fragment key={sourceFile}>
                    <tr className="border-t border-[#2C2C2C] bg-[#111111]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[#8EB735]">
                            <FileSpreadsheet className="h-4 w-4 shrink-0" />
                            <span className="truncate">{sourceFile}</span>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] font-medium text-[#8F8F8A]">
                            <span>
                              {fileRecords.length} enregistrement{fileRecords.length !== 1 ? 's' : ''}
                            </span>
                            {uploadDateByFileName.get(sourceFile) && (
                              <span>
                                {formatImportTimestamp(uploadDateByFileName.get(sourceFile)!)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {fileRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#111111]/80 transition-colors">
                        <td className="py-3 px-4 font-medium text-[#E4E9E1] flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[#111111] border border-[#2C2C2C] text-[#8EB735] flex items-center justify-center font-bold text-[10px]">
                            {rec.nom.charAt(0)}
                          </div>
                          <span>{rec.nom}</span>
                        </td>
                        <td className="py-3 px-4 text-[#8F8F8A] font-mono text-[11px]">
                          {rec.email}
                        </td>
                        <td className="py-3 px-4 text-[#E4E9E1] font-mono text-[11px]">
                          {rec.telephone}
                        </td>
                        <td className="py-3 px-4 text-[#8F8F8A] truncate max-w-[200px]" title={rec.adresse}>
                          {rec.adresse}
                        </td>
                        <td className="py-3 px-4 text-[#E4E9E1] font-medium">
                          {rec.ville}
                        </td>
                        <td className="py-3 px-4">{formatBirthDate(rec.date_naissance)}</td>
                        <td className="py-3 px-4 font-mono">{rec.cin || ''}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-[#111111] text-[#AEB4C1] border border-[#2C2C2C]">
                            <FileText className="w-3 h-3 text-[#AEB4C1]" />
                            <span className="truncate max-w-[140px]" title={rec.sourceFile}>
                              {rec.sourceFile}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & bottom launch action */}
        <div className="p-4 bg-[#111111]/80 border-t border-[#2C2C2C] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#8F8F8A]">
          <div>
            Affichage de <strong className="text-[#E4E9E1]">{filteredRecords.length}</strong> lignes sur {records.length} enregistrements au total
          </div>
        </div>
      </div>
    </div>
  );
};
