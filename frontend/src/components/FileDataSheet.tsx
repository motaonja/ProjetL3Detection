import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { DataRecord, UploadedFile } from '../types';
import { getFilePreview } from '../services/api';

interface FileDataSheetProps {
  file: UploadedFile;
  records: DataRecord[];
  onClose: () => void;
}

const aliases: Record<string, string[]> = {
  nom: ['nom', 'name', 'nom complet', 'fullname', 'full name', 'nom prenom', 'client'],
  prenom: ['prenom', 'firstname', 'first name'],
  date_naissance: ['date naissance', 'date de naissance', 'naissance', 'birth date', 'date of birth', 'dob'],
  cin: ['cin', 'numero cin', 'numero de cin', 'n cin', 'no cin', 'cin n'],
  email: ['email', 'mail', 'e mail', 'courriel', 'adresse email', 'adresse mail'],
  telephone: ['telephone', 'tel', 'phone', 'numero', 'contact', 'mobile'],
  adresse: ['adresse', 'address', 'adress'],
  ville: ['ville', 'city', 'commune', 'localite'],
};
const normalizeHeader = (value: string) =>
  value.normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fieldForHeader = (header: string) => {
  const normalized = normalizeHeader(header);
  const compact = normalized.replace(/ /g, '');
  return Object.entries(aliases).find(([field, names]) =>
    names.some((name) => {
      const alias = normalizeHeader(name);
      return alias === normalized || (
        field === 'date_naissance' &&
        (alias.replace(/ /g, '') === compact || normalized.startsWith(alias + ' '))
      );
    }),
  )?.[0];
};

export const FileDataSheet: React.FC<FileDataSheetProps> = ({ file, records, onClose }) => {
  const [query, setQuery] = useState('');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    let cancelled = false;
    setPreviewValues({});
    getFilePreview(file.id)
      .then((preview) => {
        if (!cancelled) setPreviewValues(Object.fromEntries(preview.records.map((record) => [record.id, record.sourceValues])));
      })
      .catch(() => {
        // Keep the already available values if the preview request cannot be completed.
      });
    return () => { cancelled = true; };
  }, [file.id]);
  const fileRecords = useMemo(() => records.filter((record) => record.sourceFile === file.name), [records, file.name]);
  const columns = useMemo(() => {
    if (file.sourceColumns?.length) return file.sourceColumns;
    if (fileRecords[0]?.sourceValues && Object.keys(fileRecords[0].sourceValues).length) return Object.keys(fileRecords[0].sourceValues);
    // Compatibility with records imported before source headers were retained:
    // only show fields actually present in those records.
    const metadata = new Set(['id', 'sourceFile', 'sourceValues']);
    const firstRecord = fileRecords[0] as (DataRecord & Record<string, unknown>) | undefined;
    if (!firstRecord) return [];
    return Object.keys(firstRecord).filter((key) =>
      !metadata.has(key) && fileRecords.some((record) => {
        const value = (record as DataRecord & Record<string, unknown>)[key];
        return value != null && value !== '';
      }),
    );
  }, [file.sourceColumns, fileRecords]);
  const headerFor = (field: string) => columns.find((header) => aliases[field]?.includes(normalizeHeader(header)));
  const emailCounts = useMemo(() => {
    const counts = new Map<string, number>();
    fileRecords.forEach((record) => {
      const email = record.email.trim().toLowerCase();
      if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
    });
    return counts;
  }, [fileRecords]);
  const duplicateEmails = useMemo(() => new Set([...emailCounts].filter(([, count]) => count > 1).map(([email]) => email)), [emailCounts]);
  const shownRecords = useMemo(() => fileRecords.filter((record) => {
    const duplicate = duplicateEmails.has(record.email.trim().toLowerCase());
    const values = [...Object.values(record.sourceValues ?? {}), record.nom, record.prenom, record.date_naissance, record.cin, record.email, record.telephone, record.adresse, record.ville];
    const searchMatch = values.some((value) => String(value ?? '').toLowerCase().includes(query.trim().toLowerCase()));
    return searchMatch && (!duplicatesOnly || duplicate);
  }), [fileRecords, duplicateEmails, query, duplicatesOnly]);
  const cellValue = (record: DataRecord, header: string) => {
    const originalValues = previewValues[record.id] ?? record.sourceValues;
    const originalValue = originalValues?.[header];
    if (originalValue != null && String(originalValue).trim() !== '') return String(originalValue);
    const field = fieldForHeader(header);
    if (!field) return originalValue == null ? '' : String(originalValue);
    const value = record[field as keyof DataRecord];
    return value == null || value === '' ? (originalValue == null ? '' : String(originalValue)) : String(value);
  };

  return (
    <section className="basis-full min-w-0 overflow-hidden rounded-xl border border-[#2b2f3a] bg-[#101115] text-[#e5e7eb] shadow-xl" aria-label={`Apercu du fichier `+file.name}>
      <div className="flex flex-col gap-3 border-b border-[#252832] bg-[#14161b] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <label className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#747b88]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans ce fichier..." className="w-full rounded-lg border border-[#2b2f3a] bg-[#0f1014] py-2 pl-9 pr-3 text-xs text-[#18231d] outline-none placeholder:text-[#626875] focus:border-[#a3e635]/60" /></label>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDuplicatesOnly(false)} className={duplicatesOnly ? 'rounded-lg border border-[#2b2f3a] px-3 py-2 text-xs text-[#9298a5]' : 'rounded-lg border border-[#444a57] bg-[#252832] px-3 py-2 text-xs text-[#18231d]'}>Tous les contacts <span className="ml-1 font-mono text-[10px]">{fileRecords.length}</span></button><button type="button" onClick={() => setDuplicatesOnly(true)} className={duplicatesOnly ? 'rounded-lg border border-[#a16207]/50 bg-[#211c14] px-3 py-2 text-xs text-[#fbbf24]' : 'rounded-lg border border-[#2b2f3a] px-3 py-2 text-xs text-[#9298a5]'}>Doublons uniquement <span className="ml-1 font-mono text-[10px]">{fileRecords.filter((record) => duplicateEmails.has(record.email.trim().toLowerCase())).length}</span></button></div>
      </div>

      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full min-w-[850px] border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#17191f] text-[#a1a6b2]">
            <tr>
              <th className="sticky left-0 z-20 border-b border-r border-[#292d36] bg-[#121419] px-3 py-2.5 font-mono text-[10px]">#</th>
              {columns.map((column) => <th key={column} className="border-b border-[#292d36] px-3 py-2.5 font-medium">{column}</th>)}
              <th className="border-b border-[#292d36] px-3 py-2.5 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {shownRecords.map((record) => {
              const email = record.email.trim().toLowerCase();
              const duplicate = duplicateEmails.has(email);
              const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email);
              const emailColumn = headerFor('email');
              return (
                <tr key={record.id} className="group hover:bg-[#181a20]">
                  <td className="sticky left-0 border-b border-r border-[#242730] bg-[#121316] px-3 py-2.5 font-mono text-[10px] text-[#777e8b] group-hover:bg-[#181a20]">{fileRecords.findIndex((item) => item.id === record.id) + 1}</td>
                  {columns.map((column) => <td key={column} className={column === emailColumn ? (duplicate ? 'border-b border-[#242730] px-3 py-2.5 font-mono bg-[#211c14] text-[#18231d]' : 'border-b border-[#242730] px-3 py-2.5 font-mono text-[#18231d]') : 'border-b border-[#242730] px-3 py-2.5 text-[#c2c6ce]'}>{cellValue(record, column)}{column === emailColumn && duplicate && <span className="ml-2 rounded border border-[#854d0e]/40 bg-[#f59e0b]/10 px-1.5 py-0.5 font-sans text-[9px] text-[#fbbf24]">Doublon</span>}</td>)}
                  <td className="border-b border-[#242730] px-3 py-2.5">{duplicate ? <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/10 px-2 py-1 text-[10px] text-[#fbbf24]"><AlertTriangle className="h-3 w-3" /> Doublon</span> : valid ? <span className="inline-flex items-center gap-1 rounded-full bg-[#a3e635]/10 px-2 py-1 text-[10px] text-[#a3e635]"><CheckCircle2 className="h-3 w-3" /> Valide</span> : <span className="rounded-full bg-[#252832] px-2 py-1 text-[10px] text-[#9ca3af]">Email invalide</span>}</td>
                </tr>
              );
            })}
            {shownRecords.length === 0 && <tr><td colSpan={columns.length + 2} className="px-4 py-10 text-center text-xs text-[#777e8b]">Aucun contact ne correspond a ce filtre.</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-col gap-3 border-t border-[#252832] bg-[#14161b] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><p className="text-[11px] text-[#777e8b]">Affichage de <span className="font-mono text-[#cbd0d8]">{shownRecords.length}</span> sur <span className="font-mono text-[#cbd0d8]">{fileRecords.length}</span> contacts</p><button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border border-[#343844] px-3 py-2.5 text-xs text-[#a1a6b2] transition-colors hover:bg-[#252832] hover:text-[#18231d]"><X className="h-3.5 w-3.5" />Fermer le fichier</button></footer>
    </section>
  );
};
