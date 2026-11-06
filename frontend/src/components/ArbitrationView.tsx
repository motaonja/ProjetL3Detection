import React, { useEffect, useMemo, useState } from 'react';
import {
  Scale,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MatchPair } from '../types';
import { formatBirthDate } from '../utils/formatBirthDate';
import { getPendingArbitrationMatches } from '../utils/arbitration';

interface ArbitrationViewProps {
  matches: MatchPair[];
  onArbitrate: (
    matchId: string,
    decision: 'confirmed' | 'rejected'
  ) => Promise<void> | void;
  onResetArbitration: () => void;
  focusMatchId?: string | null;
}

export const ArbitrationView: React.FC<ArbitrationViewProps> = ({
  matches,
  onArbitrate,
  onResetArbitration,
  focusMatchId = null,
}) => {
  // Tous les cas incertains ayant déjà été traités.
  const arbitratedMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          Boolean(m.decision) &&
          (m.status === 'duplicate' || m.status === 'different' || m.status === 'uncertain')
      ),
    [matches]
  );

  // Cas qui doivent encore apparaître dans le tableau d'arbitrage.
  const pendingMatches = useMemo(() => getPendingArbitrationMatches(matches), [matches]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!focusMatchId) return;
    const focusedIndex = pendingMatches.findIndex((match) => match.id === focusMatchId);
    if (focusedIndex >= 0) setCurrentIndex(focusedIndex);
  }, [focusMatchId, pendingMatches]);

  // Toujours garder un index valide lorsque la liste diminue.
  useEffect(() => {
    if (pendingMatches.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= pendingMatches.length) {
      setCurrentIndex(
        pendingMatches.length - 1
      );
    }
  }, [pendingMatches.length, currentIndex]);

  const safeIndex = Math.min(
    currentIndex,
    Math.max(
      0,
      pendingMatches.length - 1
    )
  );

  const currentMatch =
    pendingMatches[safeIndex];

  const processedCount =
    arbitratedMatches.length;

  const pendingCount =
    pendingMatches.length;

  // ============================================================
  // Décision : confirmer ou refuser
  // ============================================================

  const handleDecision = async (
    decision: 'confirmed' | 'rejected'
  ) => {
    if (!currentMatch) {
      return;
    }

    const currentMatchId = currentMatch.id;
    const currentRecordName =
      currentMatch.recordA.nom;

    try {
      await onArbitrate(
        currentMatchId,
        decision
      );

      const label =
        decision === 'confirmed'
          ? 'Confirmé comme doublon'
          : 'Refusé comme doublon';

      setToastMessage(
        `✓ Décision enregistrée : ${label} pour "${currentRecordName}".`
      );

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);

      /*
       * Le cas traité disparaît automatiquement du tableau
       * car pendingMatches ne contient que les cas sans décision.
       *
       * On garde le même index pour afficher directement
       * le prochain cas.
       */
      setCurrentIndex((previousIndex) => {
        if (
          pendingMatches.length <= 1
        ) {
          return 0;
        }

        if (
          previousIndex >=
          pendingMatches.length - 1
        ) {
          return previousIndex - 1;
        }

        return previousIndex;
      });
    } catch (error) {
      console.error(
        "Erreur d'arbitrage côté interface:",
        error
      );

      setToastMessage(
        "❌ Impossible d'enregistrer la décision."
      );

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    }
  };

  // ============================================================
  // Cas suivant
  // ============================================================

  const handleNextCase = () => {
    if (pendingMatches.length === 0) {
      return;
    }

    if (
      safeIndex <
      pendingMatches.length - 1
    ) {
      setCurrentIndex(
        safeIndex + 1
      );
    } else {
      setCurrentIndex(0);
    }
  };

  // ============================================================
  // Cas précédent
  // ============================================================

  const handlePrevCase = () => {
    if (safeIndex > 0) {
      setCurrentIndex(
        safeIndex - 1
      );
    }
  };

  // ============================================================
  // Réinitialisation
  // ============================================================

  const handleReset = () => {
    setCurrentIndex(0);
    setToastMessage(null);
    onResetArbitration();
  };

  return (
    <div
      id="arbitration-view"
      className="space-y-6"
    >
      {/* ======================================================
          Header
      ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#E4E9E1] tracking-tight">
            Arbitrage
          </h2>

          <p className="text-xs text-[#8F8F8A] mt-1">
            Examinez les cas de ressemblance
            incertains afin de confirmer ou
            refuser la correspondance.
          </p>
        </div>

        {/* Progression + reset */}
        <div className="flex items-center gap-3">
          <div className="bg-[#191919] border border-[#2C2C2C] rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-2xs">
            <span className="text-[#8F8F8A]">
              Statut :
            </span>

            <span className="font-semibold text-[#8EB735]">
              {processedCount} traités
            </span>

            <span className="text-[#2C2C2C]">
              |
            </span>

            <span className="font-semibold text-[#D87A71]">
              {pendingCount} en attente
            </span>
          </div>

          <button
            onClick={handleReset}
            title="Réinitialiser l'arbitrage"
            className="p-2 rounded-xl border border-[#2C2C2C] hover:bg-[#2C2C2C] text-[#8F8F8A] hover:text-[#E4E9E1] transition-colors bg-[#191919] shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ======================================================
          Message de décision
      ====================================================== */}

      {toastMessage && (
        <div
          id="arbitration-decision-toast"
          className="p-3.5 rounded-xl bg-[#8EB735]/15 border border-[#8EB735]/30 text-[#8EB735] text-xs font-semibold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#8EB735]" />
            <span>{toastMessage}</span>
          </div>

          <span className="text-[11px] text-[#D3DBA2] font-normal">
            La décision a été enregistrée.
          </span>
        </div>
      )}

      {/* ======================================================
          Aucun cas en attente
      ====================================================== */}

      {pendingMatches.length === 0 ? (
        <div className="bg-[#191919] rounded-2xl p-12 text-center border border-[#2C2C2C] shadow-2xs">
          <CheckCircle2 className="w-12 h-12 text-[#8EB735] mx-auto mb-3" />

          <h3 className="text-base font-bold text-[#E4E9E1]">
            Aucun cas incertain en attente
          </h3>

          <p className="text-xs text-[#8F8F8A] mt-1">
            Toutes les correspondances incertaines
            ont déjà été traitées.
          </p>
        </div>
      ) : currentMatch ? (
        <div className="bg-[#191919] rounded-2xl border border-[#2C2C2C] shadow-2xs overflow-hidden">

          {/* ==================================================
              Navigation
          ================================================== */}

          <div className="p-4 bg-[#111111] border-b border-[#2C2C2C] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30 font-bold text-xs">
                Cas {safeIndex + 1} sur {pendingMatches.length}
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30 font-semibold text-xs">
                À arbitrer
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevCase}
                disabled={safeIndex === 0}
                className="p-1.5 rounded-lg border border-[#2C2C2C] disabled:opacity-40 hover:bg-[#2C2C2C] text-[#8F8F8A] hover:text-[#E4E9E1] transition-colors cursor-pointer bg-[#111111]"
                title="Cas précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextCase}
                className="p-1.5 rounded-lg border border-[#2C2C2C] hover:bg-[#2C2C2C] text-[#8F8F8A] hover:text-[#E4E9E1] transition-colors cursor-pointer bg-[#111111]"
                title="Cas suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ==================================================
              Comparaison
          ================================================== */}

          <div className="p-6 sm:p-8 space-y-6">

            {/* Score */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#111111] border border-[#2C2C2C]">
              <div>
                <div className="text-[10px] font-bold text-[#8F8F8A] uppercase tracking-wider">
                  Score de ressemblance
                </div>

                <div className="text-2xl sm:text-3xl font-black text-[#8EB735] tracking-tight mt-0.5">
                  Score : {currentMatch.score} %
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30">
                  Cas incertain à arbitrer
                </span>

                <p className="text-[11px] text-[#8F8F8A] mt-1">
                  Ressemblance partielle détectée
                  entre les 2 sources
                </p>
              </div>
            </div>

            {/* ==================================================
                Enregistrements A / B
            ================================================== */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Enregistrement A */}
              <div className="p-5 rounded-2xl border border-[#2C2C2C] bg-[#111111] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2C]">
                  <span className="font-bold text-[#E4E9E1] text-sm tracking-tight">
                    Enregistrement A
                  </span>

                  <span className="text-[11px] text-[#8F8F8A] font-mono truncate max-w-[170px]">
                    {currentMatch.recordA.sourceFile}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Nom complet
                    </span>

                    <span className="text-base font-bold text-[#E4E9E1]">
                      {currentMatch.recordA.nom}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Téléphone
                    </span>

                    <span className="font-mono text-[#8EB735] text-sm font-semibold">
                      {currentMatch.recordA.telephone}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Email
                    </span>

                    <span className="font-mono text-[#8F8F8A]">
                      {currentMatch.recordA.email}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Adresse
                    </span>

                    <span className="text-[#8F8F8A]">
                      {currentMatch.recordA.adresse}
                    </span>
                  </div>

                  {currentMatch.recordA.date_naissance && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">Date de naissance</span>
                      <span className="font-mono text-[#8F8F8A]">{formatBirthDate(currentMatch.recordA.date_naissance)}</span>
                    </div>
                  )}
                  {currentMatch.recordA.cin && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">CIN</span>
                      <span className="font-mono text-[#8F8F8A]">{currentMatch.recordA.cin}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Ville
                    </span>

                    <span className="font-semibold text-[#E4E9E1]">
                      {currentMatch.recordA.ville}
                    </span>
                  </div>

                </div>
              </div>

              {/* Enregistrement B */}
              <div className="p-5 rounded-2xl border border-[#2C2C2C] bg-[#111111] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2C]">
                  <span className="font-bold text-[#D3DBA2] text-sm tracking-tight">
                    Enregistrement B
                  </span>

                  <span className="text-[11px] text-[#8F8F8A] font-mono truncate max-w-[170px]">
                    {currentMatch.recordB.sourceFile}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Nom complet
                    </span>

                    <span className="text-base font-bold text-[#E4E9E1]">
                      {currentMatch.recordB.nom}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Téléphone
                    </span>

                    <span className="font-mono text-[#8EB735] text-sm font-semibold">
                      {currentMatch.recordB.telephone}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Email
                    </span>

                    <span className="font-mono text-[#8F8F8A]">
                      {currentMatch.recordB.email}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Adresse
                    </span>

                    <span className="text-[#8F8F8A]">
                      {currentMatch.recordB.adresse}
                    </span>
                  </div>

                  {currentMatch.recordB.date_naissance && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">Date de naissance</span>
                      <span className="font-mono text-[#8F8F8A]">{formatBirthDate(currentMatch.recordB.date_naissance)}</span>
                    </div>
                  )}
                  {currentMatch.recordB.cin && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">CIN</span>
                      <span className="font-mono text-[#8F8F8A]">{currentMatch.recordB.cin}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8F8F8A] block">
                      Ville
                    </span>

                    <span className="font-semibold text-[#E4E9E1]">
                      {currentMatch.recordB.ville}
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* ==================================================
                Comparaison des attributs
            ================================================== */}

            <div className="p-4 rounded-xl bg-[#111111] border border-[#2C2C2C] space-y-2">

              <div className="text-xs font-bold text-[#8F8F8A]">
                Analyse comparative des attributs :
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">

                {currentMatch.fieldComparisons.map(
                  (fc, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border ${
                        fc.similarity === 100
                          ? 'bg-[#8EB735]/15 text-[#8EB735] border-[#8EB735]/30'
                          : fc.similarity >= 80
                            ? 'bg-[#D3DBA2]/15 text-[#D3DBA2] border-[#D3DBA2]/30'
                            : 'bg-[#D87A71]/15 text-[#D87A71] border-[#D87A71]/30'
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase">
                        {fc.label}
                      </div>

                      <div className="font-bold text-sm mt-0.5">
                        {fc.similarity}%
                      </div>
                    </div>
                  )
                )}

              </div>
            </div>

            {/* ==================================================
                Boutons
            ================================================== */}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">

              {/* Confirmer */}
              <button
                id="btn-arbitrage-confirmer"
                onClick={() =>
                  handleDecision(
                    'confirmed'
                  )
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#8EB735] hover:bg-[#7ea32e] active:bg-[#6f9027] text-[#0A0A0A] font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />

                <span>
                  ✓ Confirmer la ressemblance
                </span>
              </button>

              {/* Refuser */}
              <button
                id="btn-arbitrage-refuser"
                onClick={() =>
                  handleDecision(
                    'rejected'
                  )
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#D87A71]/15 hover:bg-[#D87A71]/25 border border-[#D87A71]/30 text-[#D87A71] font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />

                <span>
                  ✕ Refuser la ressemblance
                </span>
              </button>

              {/* Cas suivant */}
              <button
                id="btn-arbitrage-suivant"
                onClick={handleNextCase}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#111111] hover:bg-[#2C2C2C] text-[#E4E9E1] font-semibold text-xs border border-[#2C2C2C] transition-all cursor-pointer shadow-2xs"
              >
                <span>
                  → Cas suivant
                </span>

                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          </div>
        </div>
      ) : null}

      {/* ======================================================
          Historique des décisions
      ====================================================== */}

      {processedCount > 0 && (
        <div className="bg-[#191919] rounded-2xl border border-[#2C2C2C] shadow-2xs p-5">

          <h3 className="text-sm font-bold text-[#E4E9E1] mb-3">
            Décisions prises lors de cette session ({processedCount})
          </h3>

          <div className="divide-y divide-[#2C2C2C] text-xs">

            {arbitratedMatches.map(
              (m) => (
                <div
                  key={m.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-[#E4E9E1]">
                      {m.recordA.nom}
                    </span>

                    <span className="text-[#8F8F8A]">
                      ⟷
                    </span>

                    <span className="font-semibold text-[#E4E9E1]">
                      {m.recordB.nom}
                    </span>

                    <span className="text-[#8F8F8A] font-mono text-[11px]">
                      ({m.score}%)
                    </span>

                  </div>

                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-full text-[10px] ${
                      m.decision === 'confirmed'
                        ? 'bg-[#8EB735]/15 text-[#8EB735] border border-[#8EB735]/30'
                        : 'bg-[#D87A71]/15 text-[#D87A71] border border-[#D87A71]/30'
                    }`}
                  >
                    {m.decision === 'confirmed'
                      ? '✓ Ressemblance Confirmée'
                      : '✕ Ressemblance Refusée'}
                  </span>
                </div>
              )
            )}

          </div>
        </div>
      )}
    </div>
  );
};
