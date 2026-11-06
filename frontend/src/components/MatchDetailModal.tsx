import React from 'react';
import { formatBirthDate } from '../utils/formatBirthDate';
import {
  X,
  FileText,
  Check,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
} from 'lucide-react';
import { MatchPair } from '../types';

interface MatchDetailModalProps {
  match: MatchPair | null;
  onClose: () => void;
  onArbitrate: (matchId: string, decision: 'confirmed' | 'rejected') => Promise<void> | void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  onClose,
  onArbitrate,
}) => {
  if (!match) return null;

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'nom':
        return <User className="w-4 h-4 text-[#8F8F8A]" />;
      case 'email':
        return <Mail className="w-4 h-4 text-[#8F8F8A]" />;
      case 'telephone':
        return <Phone className="w-4 h-4 text-[#8F8F8A]" />;
      case 'adresse':
        return <MapPin className="w-4 h-4 text-[#8F8F8A]" />;
      case 'ville':
        return <Building2 className="w-4 h-4 text-[#8F8F8A]" />;
      default:
        return <FileText className="w-4 h-4 text-[#8F8F8A]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        id="match-detail-modal"
        className="bg-[#191919] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#2C2C2C] overflow-hidden text-[#E4E9E1]"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#2C2C2C] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                match.score >= 90
                  ? 'bg-[#8EB735]/15 text-[#8EB735] border border-[#8EB735]/30'
                  : match.score >= 70
                  ? 'bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30'
                  : 'bg-[#111111] text-[#AEB4C1] border border-[#2C2C2C]'
              }`}
            >
              {match.score}%
            </div>
            <div>
              <h3 className="text-base font-bold text-[#E4E9E1]">
                Comparaison détaillée de correspondance
              </h3>
              <div className="flex items-center gap-2 text-xs text-[#8F8F8A] mt-0.5">
                <span>Statut : <strong className="text-[#E4E9E1]">{match.statusLabel}</strong></span>
                {match.decision && (
                  <span className="text-[#8EB735] font-semibold">
                    • Arbitrage : {match.decision === 'confirmed' ? 'Confirmé ✓' : 'Refusé ✕'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F8F8A] hover:text-[#E4E9E1] hover:bg-[#2C2C2C] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Side by side comparison */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Header Row: Enregistrement A vs B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#111111] border border-[#2C2C2C]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#8F8F8A] uppercase tracking-wider">
                  Enregistrement A
                </span>
                <span className="text-[11px] text-[#AEB4C1] font-medium truncate max-w-[180px]">
                  {match.recordA.sourceFile}
                </span>
              </div>
              <div className="text-base font-bold text-[#E4E9E1]">{match.recordA.nom}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#111111] border border-[#8EB735]/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#8EB735] uppercase tracking-wider">
                  Enregistrement B
                </span>
                <span className="text-[11px] text-[#AEB4C1] font-medium truncate max-w-[180px]">
                  {match.recordB.sourceFile}
                </span>
              </div>
              <div className="text-base font-bold text-[#E4E9E1]">{match.recordB.nom}</div>
            </div>
          </div>

          {/* Fields Diff Table */}
          <div>
            <h4 className="text-[11px] font-bold text-[#8F8F8A] uppercase tracking-wider mb-3">
              Mise en évidence des différences par champ
            </h4>

            <div className="space-y-2.5">
              {match.fieldComparisons.map((item, idx) => {
                const isExact = item.similarity === 100;
                const isNear = item.similarity >= 80 && !isExact;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs transition-colors ${
                      isExact
                        ? 'bg-[#111111] border-[#8EB735]/30'
                        : isNear
                        ? 'bg-[#111111] border-[#D3DBA2]/30'
                        : 'bg-[#111111] border-[#D87A71]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-semibold text-[#E4E9E1]">
                        {getFieldIcon(item.field)}
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isExact
                              ? 'bg-[#8EB735]/15 text-[#8EB735] border border-[#8EB735]/30'
                              : isNear
                              ? 'bg-[#D3DBA2]/15 text-[#D3DBA2] border border-[#D3DBA2]/30'
                              : 'bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30'
                          }`}
                        >
                          {isExact
                            ? 'Identique (100%)'
                            : isNear
                            ? `Variation mineure (${item.similarity}%)`
                            : `Discordance (${item.similarity}%)`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2C2C2C] shadow-2xs">
                        <div className="text-[10px] text-[#8F8F8A] font-semibold mb-0.5">
                          Valeur Enregistrement A
                        </div>
                        <div className="font-mono text-[#E4E9E1] break-words">{(item.field === 'date_naissance' ? formatBirthDate(item.valA) : item.valA) || '—'}</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2C2C2C] shadow-2xs">
                        <div className="text-[10px] text-[#8F8F8A] font-semibold mb-0.5">
                          Valeur Enregistrement B
                        </div>
                        <div className="font-mono text-[#E4E9E1] break-words">{(item.field === 'date_naissance' ? formatBirthDate(item.valB) : item.valB) || '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer with Arbitration Action if Uncertain */}
        <div className="p-4 bg-[#111111] border-t border-[#2C2C2C] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#8F8F8A]">
            Score global calculé sans identifiant commun :{' '}
            <strong className="text-[#8EB735] font-bold">{match.score}%</strong>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {match.status === 'uncertain' && (
              <>
                <button
                  id="btn-modal-confirm-match"
                  onClick={async () => {
                    try {
                      await onArbitrate(match.id, 'confirmed');
                      onClose();
                    } catch {
                      // L'erreur est deja affichee par le gestionnaire.
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8EB735] hover:bg-[#8EB735]/90 text-[#111111] text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmer</span>
                </button>
                <button
                  id="btn-modal-reject-match"
                  onClick={async () => {
                    try {
                      await onArbitrate(match.id, 'rejected');
                      onClose();
                    } catch {
                      // L'erreur est deja affichee par le gestionnaire.
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D87A71]/15 hover:bg-[#D87A71]/25 border border-[#D87A71]/30 text-[#D87A71] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Refuser</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#2C2C2C] hover:bg-[#2C2C2C] text-[#E4E9E1] text-xs font-medium transition-colors bg-[#191919] cursor-pointer shadow-2xs"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
