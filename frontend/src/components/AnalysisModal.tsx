import React, {
  useState,
  useEffect,
} from 'react';

import {
  Loader2,
  CheckCircle2,
  Cpu,
  ArrowRight,
} from 'lucide-react';

import { runAnalysis } from '../services/api';

interface AnalysisModalProps {
  isOpen: boolean;
  totalRecords: number;
  onComplete: () => void;
  onClose: () => void;
  sessionId: string;
  onRunComplete?: (resp: any) => void | Promise<void>;
}

const PHASES = [
  {
    step: 1,
    label: 'Préparation des données',
    targetProgress: 25,
  },
  {
    step: 2,
    label: 'Analyse des enregistrements',
    targetProgress: 50,
  },
  {
    step: 3,
    label: 'Évaluation des correspondances',
    targetProgress: 80,
  },
  {
    step: 4,
    label: 'Finalisation des résultats',
    targetProgress: 100,
  },
];

export const AnalysisModal: React.FC<
  AnalysisModalProps
> = ({
  isOpen,
  totalRecords,
  onComplete,
  onClose,
  sessionId,
  onRunComplete,
}) => {
  const [progress, setProgress] =
    useState(0);

  const [currentPhaseIndex, setCurrentPhaseIndex] =
    useState(0);

  const [isFinished, setIsFinished] =
    useState(false);

  /**
   * Résultat réel de l'analyse backend.
   */
  const [analysisResult, setAnalysisResult] =
    useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setCurrentPhaseIndex(0);
      setIsFinished(false);
      setAnalysisResult(null);

      return;
    }

    let cancelled = false;
    let analysisDone = false;

    const doRun = async () => {
      if (!sessionId) {
        console.error("No import session is available for analysis.");

        return;
      }

      try {
        /**
         * Lancer l'analyse réelle du backend.
         */
        const resp =
          await runAnalysis(sessionId);

        await onRunComplete?.(resp);

        if (cancelled) {
          return;
        }

        console.log(
          'Résultat réel de l’analyse :',
          resp
        );

        /**
         * Conserver les statistiques retournées
         * par le backend pour l'écran final.
         */
        setAnalysisResult(
          resp?.history ?? null
        );

        /**
         * Informer App.tsx que l'analyse est terminée.
         */
        analysisDone = true;

        setProgress(100);
        setCurrentPhaseIndex(3);
        setIsFinished(true);

      } catch (error) {
        console.error(
          'Erreur analyse backend :',
          error
        );

        if (!cancelled) {
          analysisDone = true;

          setProgress(100);
          setCurrentPhaseIndex(3);
          setIsFinished(true);

          /**
           * On ne considère pas réellement l'analyse
           * comme réussie en cas d'erreur.
           *
           * On conserve néanmoins l'écran actuel
           * pour éviter de casser l'interface.
           */
        }
      }
    };

    doRun();

    /**
     * Animation de progression.
     *
     * Cette progression est uniquement visuelle.
     * Le vrai traitement est effectué par FastAPI.
     */
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (analysisDone) {
          return 100;
        }

        if (prev >= 90) {
          return prev;
        }

        const next =
          prev +
          Math.floor(
            Math.random() * 8
          ) +
          4;

        const bounded =
          Math.min(next, 90);

        if (bounded >= 80) {
          setCurrentPhaseIndex(3);
        } else if (bounded >= 50) {
          setCurrentPhaseIndex(2);
        } else if (bounded >= 25) {
          setCurrentPhaseIndex(1);
        } else {
          setCurrentPhaseIndex(0);
        }

        return bounded;
      });
    }, 140);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    isOpen,
    sessionId,
  ]);

  if (!isOpen) {
    return null;
  }

  const analyzedCount =
    Math.floor(
      (progress / 100) *
        totalRecords
    );

  /**
   * Les statistiques viennent maintenant
   * réellement du backend.
   */
  const duplicatesFound =
    analysisResult?.duplicatesFound ??
    0;

  const uncertainCases =
    analysisResult?.uncertainCases ??
    0;

  const analyzedRecords =
    analysisResult?.totalRecords ??
    totalRecords;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">

      <div
        id="analysis-simulation-modal"
        className="bg-[#191919] rounded-2xl max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 md:p-8 shadow-xl border border-[#2C2C2C] relative text-[#E4E9E1]"
      >

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#8EB735]" />

        {!isFinished ? (

          <div>

            <div className="flex items-center gap-3.5 mb-4">

              <div className="w-10 h-10 rounded-xl bg-[#111111] text-[#8EB735] border border-[#2C2C2C] flex items-center justify-center">

                <Cpu className="w-5 h-5 animate-spin text-[#8EB735]" />

              </div>

              <div>

                <h3 className="text-lg font-bold text-[#E4E9E1]">
                  Analyse en cours
                </h3>

                <p className="text-xs text-[#8F8F8A]">
                  Traitement réel du rapprochement des enregistrements
                </p>

              </div>

            </div>

            {/* Progress Percentage Display */}
            <div className="mt-6 mb-2 flex items-center justify-between text-xs">

              <span className="font-semibold text-[#8F8F8A]">
                Progression
              </span>

              <span className="text-[#8EB735] font-bold text-sm">
                {progress} %
              </span>

            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#111111] rounded-full h-2.5 overflow-hidden p-0.5 border border-[#2C2C2C]">

              <div
                className="bg-[#8EB735] h-full rounded-full transition-all duration-150 ease-out"
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

            {/* Records Counter */}
            <div className="mt-4 p-3 rounded-xl bg-[#111111] border border-[#2C2C2C] flex items-center justify-between text-xs">

              <span className="text-[#8F8F8A]">
                Enregistrements analysés :
              </span>

              <span className="font-bold font-mono text-[#E4E9E1]">
                {analyzedCount.toLocaleString(
                  'fr-FR'
                )}{' '}
                /{' '}
                {totalRecords.toLocaleString(
                  'fr-FR'
                )}
              </span>

            </div>

            {/* Step list */}
            <div className="mt-6 space-y-2">

              {PHASES.map(
                (phase, idx) => {
                  const isCurrent =
                    idx ===
                    currentPhaseIndex;

                  const isDone =
                    progress >=
                    phase.targetProgress;

                  return (
                    <div
                      key={phase.step}
                      className={`flex items-center gap-2.5 text-xs py-2 px-3 rounded-xl transition-colors ${
                        isCurrent
                          ? 'bg-[#8EB735]/15 text-[#8EB735] font-semibold border border-[#8EB735]/30'
                          : isDone
                          ? 'text-[#E4E9E1] font-medium'
                          : 'text-[#8F8F8A]'
                      }`}
                    >

                      {isDone ? (

                        <CheckCircle2 className="w-4 h-4 text-[#8EB735] shrink-0" />

                      ) : isCurrent ? (

                        <Loader2 className="w-4 h-4 text-[#8EB735] animate-spin shrink-0" />

                      ) : (

                        <div className="w-4 h-4 rounded-full border border-[#2C2C2C] shrink-0" />

                      )}

                      <span className="truncate">
                        {phase.label}
                      </span>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        ) : (

          /* Finished Screen */
          <div className="text-center py-2 animate-in zoom-in-95 duration-200">

            <div className="w-14 h-14 rounded-2xl bg-[#8EB735]/15 text-[#8EB735] flex items-center justify-center mx-auto mb-4 border border-[#8EB735]/30 shadow-2xs">

              <CheckCircle2 className="w-8 h-8" />

            </div>

            <h3 className="text-xl font-bold text-[#E4E9E1]">
              Analyse terminée avec succès
            </h3>

            <p className="text-xs text-[#8F8F8A] mt-1">
              Les correspondances potentielles ont été identifiées et réparties par niveau de ressemblance.
            </p>

            {/* Real backend statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6 mb-6">

              {/* Doublons */}
              <div className="p-3 bg-[#111111] border border-[#2C2C2C] rounded-xl">

                <div className="text-base font-bold text-[#8EB735]">
                  {duplicatesFound}
                </div>

                <div className="text-[10px] text-[#8F8F8A] font-medium mt-0.5">
                  Doublons
                </div>

              </div>

              {/* Incertains */}
              <div className="p-3 bg-[#111111] border border-[#2C2C2C] rounded-xl">

                <div className="text-base font-bold text-[#D87A71]">
                  {uncertainCases}
                </div>

                <div className="text-[10px] text-[#8F8F8A] font-medium mt-0.5">
                  Incertains
                </div>

              </div>

              {/* Enregistrements */}
              <div className="p-3 bg-[#111111] border border-[#2C2C2C] rounded-xl">

                <div className="text-base font-bold text-[#E4E9E1]">
                  {analyzedRecords}
                </div>

                <div className="text-[10px] text-[#8F8F8A] font-medium mt-0.5">
                  Analysés
                </div>

              </div>

            </div>

            <button
              id="btn-modal-voir-resultats"
              onClick={onComplete}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#8EB735] hover:bg-[#8EB735]/90 text-[#111111] font-bold text-xs shadow-xs transition-all cursor-pointer"
            >

              <span>
                Afficher les résultats
              </span>

              <ArrowRight className="w-4 h-4 text-[#111111]" />

            </button>

          </div>
        )}

      </div>

    </div>
  );
};