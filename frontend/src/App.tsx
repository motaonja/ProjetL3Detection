import React, { useEffect, useState } from 'react';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ImportFilesView } from './components/ImportFilesView';
import { DataPreviewView } from './components/DataPreviewView';
import { ResultsView } from './components/ResultsView';
import { ArbitrationView } from './components/ArbitrationView';
import { StatisticsView } from './components/StatisticsView';
import { HistoryView } from './components/HistoryView';
import { AnalysisDetailView } from './components/AnalysisDetailView';
import { AnalysisModal } from './components/AnalysisModal';
import { MatchDetailModal } from './components/MatchDetailModal';
import { LoginView } from './components/LoginView';

import {
  ActiveTab,
  UploadedFile,
  DataRecord,
  MatchPair,
  AnalysisHistoryItem,
  AnalysisSnapshot,
} from './types';

import {
  deleteFile,
  arbitrate,
  resetArbitration,
  getDashboardStats,
  getResults,
  getFiles,
  listRecords,
  listHistory,
  deleteHistory,
  getAnalysisSnapshot,
  arbitrateHistoryMatch,
  resetHistoryArbitration,
  getCurrentUser,
  logout,
  type AuthUser,
} from './services/api';
import { confirmAction, showError, showSuccess } from './services/alerts';
import { getPendingArbitrationMatches } from './utils/arbitration';
type ColorTheme = 'light' | 'dark';
const themeStorageKey = 'connectiq-color-theme';
const getInitialTheme = (): ColorTheme => { try { return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };

const importSessionStorageKey = 'connectiq-current-import-session-id';

const createImportSessionId = () => {
  const uniquePart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `session-${uniquePart}`;
};

const getCurrentImportSessionId = () => {
  if (typeof window === 'undefined') return createImportSessionId();
  try {
    const savedSessionId = window.localStorage.getItem(importSessionStorageKey);
    if (savedSessionId) return savedSessionId;
    const newSessionId = createImportSessionId();
    window.localStorage.setItem(importSessionStorageKey, newSessionId);
    return newSessionId;
  } catch {
    return createImportSessionId();
  }
};
export default function App() {
  const [theme, setTheme] = useState<ColorTheme>(getInitialTheme);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'anonymous'>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authNotice, setAuthNotice] = useState('');
  const [arbitrationFocusMatchId, setArbitrationFocusMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [files, setFiles] =
    useState<UploadedFile[]>([]);

  const [currentImportSessionId, setCurrentImportSessionId] = useState(getCurrentImportSessionId);
  const [runningAnalysisSessionId, setRunningAnalysisSessionId] = useState('');

  const [analysisFileIds, setAnalysisFileIds] =
    useState<string[]>([]);

  const [records, setRecords] =
    useState<DataRecord[]>([]);

  const [matches, setMatches] =
    useState<MatchPair[]>([]);

  /*
   * Les enregistrements classés "Différent"
   * sont stockés séparément des MatchPair.
   */
  const [differentRecords, setDifferentRecords] =
    useState<DataRecord[]>([]);

  const [historyItems, setHistoryItems] =
    useState<AnalysisHistoryItem[]>([]);

  const [activeAnalysisId, setActiveAnalysisId] =
    useState<string | null>(null);

  const [selectedAnalysis, setSelectedAnalysis] =
    useState<AnalysisSnapshot | null>(null);

  const [isAnalysisModalOpen, setIsAnalysisModalOpen] =
    useState(false);

  const [selectedMatchForDetail, setSelectedMatchForDetail] =
    useState<MatchPair | null>(null);

  const [remoteTotalRecords, setRemoteTotalRecords] =
    useState<number | null>(null);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { window.localStorage.setItem(themeStorageKey, theme); } catch { /* Theme stays in memory. */ } }, [theme]);

  /**
   * Recharger l'historique depuis PostgreSQL.
   */
  const refreshHistoryFromBackend = async (): Promise<AnalysisHistoryItem[]> => {
    try {
      const backendHistory = (await listHistory()) as AnalysisHistoryItem[];
      setHistoryItems(backendHistory || []);
      return backendHistory || [];
    } catch (error) {
      console.warn("Impossible de recharger l'historique depuis le backend :", error);
      return [];
    }
  };

  /**
   * Recharger les résultats depuis PostgreSQL.
   *
   * Le backend retourne normalement :
   *
   * {
   *   results: [...],
   *   differentRecords: [...],
   *   total: number,
   *   differentTotal: number
   * }
   */
  const refreshMatchesFromBackend = async (analysisId?: string) => {
    try {
      const backendResponse = await getResults(analysisId);

      console.log(
        'Résultats chargés depuis PostgreSQL :',
        backendResponse
      );

      /*
       * Compatibilité avec une ancienne réponse
       * qui retournerait directement un tableau.
       */
      const backendMatches = Array.isArray(
        backendResponse
      )
        ? backendResponse
        : backendResponse?.results ?? [];

      /*
       * Récupération des enregistrements différents.
       */
      const backendDifferentRecords =
        Array.isArray(backendResponse)
          ? []
          : backendResponse?.differentRecords ?? [];

      setMatches(
        backendMatches as MatchPair[]
      );

      setDifferentRecords(
        backendDifferentRecords as DataRecord[]
      );

      console.log(
        'Correspondances :',
        backendMatches
      );

      console.log(
        'Enregistrements différents :',
        backendDifferentRecords
      );

      return backendMatches as MatchPair[];
    } catch (error) {
      console.warn(
        'Impossible de recharger les résultats depuis le backend :',
        error
      );

      setMatches([]);
      setDifferentRecords([]);

      return [];
    }
  };

  /**
   * Chargement initial des données depuis le backend.
   */
  useEffect(() => {
    let mounted = true;
    const initializeAuthentication = async () => {
      try {
        const user = await getCurrentUser();
        if (mounted) { setCurrentUser(user); setAuthStatus('authenticated'); }
      } catch {
        if (mounted) setAuthStatus('anonymous');
      }
    };
    void initializeAuthentication();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const loadInitialData = async () => {
      setRemoteTotalRecords(null);
      setActiveAnalysisId(null);
      try {
        const [storedFiles, storedRecords] = await Promise.all([getFiles(), listRecords()]);
        setFiles(storedFiles.map((file) => ({ ...file, format: file.format as UploadedFile['format'] })));
        setRecords(storedRecords);
      } catch (error) {
        console.warn('Impossible de recharger les fichiers importes :', error);
      }

      const initialHistory = await refreshHistoryFromBackend();
      const initialAnalysisId = initialHistory[0]?.id ?? null;
      setActiveAnalysisId(initialAnalysisId);
      await refreshMatchesFromBackend(initialAnalysisId ?? undefined);

      if (initialAnalysisId) {
        try {
          const stats = await getDashboardStats(initialAnalysisId);
          setRemoteTotalRecords(stats?.totalRecords ?? null);
        } catch (error) {
          console.warn('Impossible de recuperer les statistiques distantes :', error);
        }
      }
    };

    void loadInitialData();
  }, [authStatus]);

  /**
   * Nombre de cas necessitant une arbitration.
   */
  const pendingArbitrationCount = getPendingArbitrationMatches(matches).length;

  /**
   * Ajouter les fichiers importés.
   */
  const handleAddFiles = (
    newFiles: UploadedFile[],
    newRecords?: DataRecord[]
  ) => {
    setFiles((prev) => [
      ...prev,
      ...newFiles,
    ]);
    setAnalysisFileIds((prev) => [...prev, ...newFiles.map((file) => file.id)]);

    if (
      newRecords &&
      newRecords.length > 0
    ) {
      setRecords((prev) => [
        ...prev,
        ...newRecords,
      ]);
    }
  };

  /**
   * Supprimer un fichier.
   */
  const handleRemoveFile = async (
    fileId: string
  ) => {
    const fileToRemove = files.find((file) => file.id === fileId);
    const confirmed = await confirmAction(
      "Supprimer ce fichier ?",
      fileToRemove
        ? "Voulez-vous vraiment supprimer le fichier " + fileToRemove.name + " ?"
        : "Voulez-vous vraiment supprimer ce fichier importe ?",
      "Supprimer"
    );
    if (!confirmed) return;

    try {
      await deleteFile(fileId);

      setFiles((prev) =>
        prev.filter((file) => file.id !== fileId)
      );
      setAnalysisFileIds((prev) => prev.filter((id) => id !== fileId));

      if (fileToRemove) {
        setRecords((prev) =>
          prev.filter(
            (record) => record.sourceFile !== fileToRemove.name
          )
        );
      }

      if (activeAnalysisId) {
        await refreshMatchesFromBackend(activeAnalysisId);
      }
      await refreshHistoryFromBackend();
      await showSuccess("Fichier supprime", "Le fichier a ete supprime.");
    } catch (error) {
      console.error("Erreur lors de la suppression du fichier :", error);
      await showError(
        "Suppression impossible",
        error instanceof Error ? error.message : "Impossible de supprimer le fichier."
      );
    }
  };

  /**
   * Réinitialiser l'affichage local.
   */
  const handleResetToDemo = () => {
    setRecords([]);
    setMatches([]);
    setDifferentRecords([]);
  };

  /**
   * Gestion de l'arbitrage humain.
   */
  const handleArbitrate = async (
    matchId: string,
    decision: 'confirmed' | 'rejected'
  ) => {
    const confirmed = await confirmAction(
      decision === 'confirmed' ? 'Confirmer ce doublon ?' : 'Refuser ce doublon ?',
      decision === 'confirmed'
        ? 'Voulez-vous vraiment confirmer cette correspondance comme doublon ?'
        : 'Voulez-vous vraiment refuser cette correspondance ?',
      decision === 'confirmed' ? 'Confirmer' : 'Refuser'
    );
    if (!confirmed) return;

    try {
      console.log(
        'Arbitrage demandé :',
        {
          matchId,
          decision,
        }
      );

      let currentMatch = matches.find(
        (match) => match.id === matchId
      );

      if (!currentMatch) {
        console.warn(
          `La correspondance ${matchId} n'existe plus dans l'état local.`
        );

        const refreshedMatches =
          await refreshMatchesFromBackend(activeAnalysisId ?? undefined);

        currentMatch =
          refreshedMatches.find(
            (match) =>
              match.id === matchId
          );

        if (!currentMatch) {
          throw new Error('Correspondance indisponible');
        }
      }

      const updated = await arbitrate(
        matchId,
        decision,
        activeAnalysisId ?? undefined
      );

      console.log(
        'Arbitrage enregistré :',
        updated
      );

      await refreshMatchesFromBackend(activeAnalysisId ?? undefined);

      if (
        selectedMatchForDetail &&
        selectedMatchForDetail.id ===
          matchId
      ) {
        setSelectedMatchForDetail(
          updated as MatchPair
        );
      }

      await refreshHistoryFromBackend();
      await showSuccess(
        'Decision enregistree',
        decision === 'confirmed' ? 'La correspondance a ete confirmee.' : 'La correspondance a ete refusee.'
      );
    } catch (error: any) {
      console.error(
        'Erreur lors de l’arbitrage :',
        error
      );

      if (error?.status === 404) {
        await refreshMatchesFromBackend(activeAnalysisId ?? undefined);

        await showError("Correspondance indisponible", "Cette correspondance n'existe plus. Les resultats ont ete actualises.");
        throw new Error('Correspondance indisponible');
      }

      const message =
        error?.text ||
        error?.message ||
        'Impossible d’enregistrer la décision.';

      await showError("Echec de l'arbitrage", message);
      throw error;
    }
  };

  /**
   * Réinitialiser toutes les arbitrations.
   */
  const handleResetArbitration = async () => {
    try {
      if (!activeAnalysisId) return;
      await resetArbitration(activeAnalysisId);

      await refreshMatchesFromBackend(activeAnalysisId);
      await refreshHistoryFromBackend();
    } catch (error) {
      console.error(
        'Erreur reset arbitrage :',
        error
      );

      alert(
        'Impossible de réinitialiser les arbitrages.'
      );
    }
  };

  /**
   * Ouvrir la fenêtre d'analyse.
   */
  const handleNewAnalysis = () => {
    setSelectedAnalysis(null);
    setSelectedMatchForDetail(null);
    setAnalysisFileIds([]);
    setMatches([]);
    setDifferentRecords([]);
    setActiveAnalysisId(null);
    setRemoteTotalRecords(null);
    setActiveTab('import');
  };

  const handleStartAnalysis = () => {
    if (analysisFileIds.length === 0) {
      setActiveTab('import');
      void showError('Fichier requis', "Veuillez importer au moins un nouveau fichier avant de lancer l\u2019analyse.");
      return;
    }
    setRunningAnalysisSessionId(currentImportSessionId);

    const nextSessionId = createImportSessionId();
    setCurrentImportSessionId(nextSessionId);
    try {
      window.localStorage.setItem(importSessionStorageKey, nextSessionId);
    } catch {
      // Keep the new session ID in memory if browser storage is unavailable.
    }

    setIsAnalysisModalOpen(true);
  };

  /**
   * Analyse terminée.
   */
  const handleAnalysisComplete = async () => {
    /*
     * Recharge les doublons, incertains
     * ET les différents.
     */
    await refreshHistoryFromBackend();

    try {
      const stats =
        await getDashboardStats(activeAnalysisId ?? undefined);

      setRemoteTotalRecords(
        stats?.totalRecords ?? null
      );
    } catch (error) {
      console.warn(
        'Impossible de mettre à jour les statistiques :',
        error
      );
    }

    setIsAnalysisModalOpen(false);
    setActiveTab('results');
  };

  /**
   * Réponse reçue après le lancement d'une analyse.
   */
  const handleRunComplete = async (
    resp: any
  ) => {
    console.log(
      'Réponse de l’analyse :',
      resp
    );

    const runAnalysisId = resp?.history?.id ?? resp?.history?.analysis_id ?? null;
    if (runAnalysisId) setActiveAnalysisId(String(runAnalysisId));
    setAnalysisFileIds([]);
    /*
     * Recharge les résultats depuis PostgreSQL
     * pour être certain d'avoir les différents.
     */
    if (
      Array.isArray(resp?.matches) &&
      Array.isArray(resp?.differentRecords)
    ) {
      const runMatches = resp.matches as MatchPair[];
      let runDifferentRecords = resp.differentRecords as DataRecord[];
      const expectedDifferentCount = Number(
        resp.history?.differentCount ?? resp.history?.different_count ?? 0
      );

      /*
       * Repli si le backend annonce des differents dans l'historique
       * mais renvoie une liste vide : les enregistrements sans paire
       * de cette analyse sont reconstruits depuis les donnees importees.
       */
      if (runDifferentRecords.length === 0 && expectedDifferentCount > 0) {
        const analyzedFileNames = new Set<string>(
          Array.isArray(resp.history?.files) ? resp.history.files : []
        );
        let analysisRecords = records.filter(
          (record) =>
            analyzedFileNames.size === 0 ||
            analyzedFileNames.has(record.sourceFile)
        );

        const expectedRecordCount = Number(
          resp.history?.totalRecords ?? resp.history?.total_records ?? 0
        );
        if (
          expectedRecordCount > 0 &&
          analysisRecords.length !== expectedRecordCount &&
          records.length === expectedRecordCount
        ) {
          analysisRecords = records;
        }

        const matchedRecordIds = new Set(
          runMatches.flatMap((match) =>
            [match.recordA?.id, match.recordB?.id]
              .filter((id) => id !== undefined && id !== null)
              .map(String)
          )
        );
        const unmatchedRecords = analysisRecords.filter(
          (record) => !matchedRecordIds.has(String(record.id))
        );

        if (unmatchedRecords.length > 0) {
          runDifferentRecords = unmatchedRecords;
        }
      }

      setMatches(runMatches);
      setDifferentRecords(runDifferentRecords);
    } else {
      await refreshMatchesFromBackend(runAnalysisId ?? undefined);
    }

    await refreshHistoryFromBackend();

    try {
      const stats =
        await getDashboardStats(runAnalysisId ?? undefined);

      setRemoteTotalRecords(
        stats?.totalRecords ?? null
      );
    } catch (error) {
      console.warn(
        'Impossible de rafraîchir les statistiques :',
        error
      );
    }
  };

  const handleDeleteHistory = async (item: AnalysisHistoryItem) => {
    await deleteHistory(item.id);
    const remainingHistory = await refreshHistoryFromBackend();
    if (activeAnalysisId === item.id) {
      const nextAnalysisId = remainingHistory[0]?.id ?? null;
      setActiveAnalysisId(nextAnalysisId);
      await refreshMatchesFromBackend(nextAnalysisId ?? undefined);
      try {
        const stats = await getDashboardStats(nextAnalysisId ?? undefined);
        setRemoteTotalRecords(stats?.totalRecords ?? null);
      } catch {
        setRemoteTotalRecords(null);
      }
    }
  };

  const handleViewHistoryAnalysis = async (item: AnalysisHistoryItem) => {
    const snapshot = await getAnalysisSnapshot(item.id);
    setSelectedAnalysis(snapshot);
  };

  const handleHistoricalArbitrate = async (
    matchId: string,
    decision: 'confirmed' | 'rejected'
  ) => {
    if (!selectedAnalysis) return;

    const confirmed = await confirmAction(
      decision === 'confirmed' ? 'Confirmer ce doublon ?' : 'Refuser ce doublon ?',
      decision === 'confirmed'
        ? 'Voulez-vous vraiment confirmer cette correspondance comme doublon ?'
        : 'Voulez-vous vraiment refuser cette correspondance ?',
      decision === 'confirmed' ? 'Confirmer' : 'Refuser'
    );
    if (!confirmed) return;

    const analysisId = selectedAnalysis.analysis.id;
    try {
      await arbitrateHistoryMatch(analysisId, matchId, decision);
      const snapshot = await getAnalysisSnapshot(analysisId);
      setSelectedAnalysis(snapshot);
      if (selectedMatchForDetail?.id === matchId) {
        const updatedMatch = snapshot.results.find((match) => match.id === matchId);
        if (updatedMatch) setSelectedMatchForDetail(updatedMatch);
      }
      await refreshHistoryFromBackend();
      await showSuccess(
        'Decision enregistree',
        decision === 'confirmed' ? 'La correspondance a ete confirmee.' : 'La correspondance a ete refusee.'
      );
    } catch (error) {
      await showError("Echec de l'arbitrage", error instanceof Error ? error.message : "Impossible d'enregistrer la decision.");
      throw error;
    }
  };

  const handleHistoricalResetArbitration = async () => {
    if (!selectedAnalysis) return;

    const analysisId = selectedAnalysis.analysis.id;
    await resetHistoryArbitration(analysisId);
    const snapshot = await getAnalysisSnapshot(analysisId);
    setSelectedAnalysis(snapshot);
    if (selectedMatchForDetail) {
      const updatedMatch = snapshot.results.find(
        (match) => match.id === selectedMatchForDetail.id
      );
      if (updatedMatch) setSelectedMatchForDetail(updatedMatch);
    }
    await refreshHistoryFromBackend();
  };

  const handleContextArbitrate = async (
    matchId: string,
    decision: 'confirmed' | 'rejected'
  ) => {
    if (selectedAnalysis && activeTab === 'history') {
      await handleHistoricalArbitrate(matchId, decision);
      return;
    }
    await handleArbitrate(matchId, decision);
  };

  const handleLogout = async () => {
    const confirmed = await confirmAction('Confirmer la deconnexion', 'Voulez-vous vraiment vous deconnecter de ConnectiQ ?', 'Me deconnecter');
    if (!confirmed) return;

    await logout();
    setCurrentUser(null);
    setAuthStatus('anonymous');
    setFiles([]);
    setRecords([]);
    setMatches([]);
    setDifferentRecords([]);
    setHistoryItems([]);
    setActiveAnalysisId(null);
    setRemoteTotalRecords(null);
    setAnalysisFileIds([]);
    setSelectedAnalysis(null);
  };

  if (authStatus === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-[#111111] text-sm text-[#8F8F8A]">Chargement...</div>;
  }
  if (authStatus === 'anonymous') {
    return <LoginView theme={theme} onToggleTheme={() => setTheme((v) => v === 'light' ? 'dark' : 'light')} notice={authNotice} onAuthenticated={(user) => { setCurrentUser(user); setAuthStatus('authenticated'); }} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f0f3f1] p-0 text-[#18231d] antialiased md:p-3 lg:p-5"><div className="flex h-full min-h-0 w-full overflow-hidden rounded-none bg-white shadow-sm sm:rounded-[1.75rem]">
      {authNotice && <div role="status" className="fixed right-4 top-4 z-[100] max-w-sm rounded-lg border border-[#8EB735]/40 bg-[#191919] p-3 text-sm text-[#D3DBA2] shadow-xl">{authNotice}</div>}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingArbitrationCount={pendingArbitrationCount}
        totalFilesCount={files.length}
        userEmail={currentUser?.email ?? ""}
        onLogout={handleLogout}
        mobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <Header
          activeTab={activeTab}
          totalRecordsCount={records.length}
          totalFilesCount={files.length}
          userEmail={currentUser?.email ?? ""}
          onMenuClick={() => setIsSidebarOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((v) => v === 'light' ? 'dark' : 'light')}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-8">
          <div className="mx-auto max-w-7xl">

            {activeTab === 'dashboard' && (
              <DashboardView setActiveTab={setActiveTab} />
            )}

            {activeTab === 'import' && (
              <ImportFilesView
                files={files}
                sessionId={currentImportSessionId}
                records={records}
                onAddFiles={
                  handleAddFiles
                }
                onRemoveFile={
                  handleRemoveFile
                }
                onGoToDataPreview={() =>
                  setActiveTab('data')
                }
                onStartAnalysis={handleStartAnalysis}
                onResetToDemo={
                  handleResetToDemo
                }
              />
            )}

            {activeTab === 'data' && (
              <DataPreviewView
                records={records}
                files={files}
                onStartAnalysis={
                  handleStartAnalysis
                }
              />
            )}

            {activeTab === 'results' && (
              <ResultsView
                matches={matches}
                differentRecords={
                  differentRecords
                }
                onOpenDetails={(match) =>
                  setSelectedMatchForDetail(
                    match
                  )
                }
                onGoToArbitration={(matchId) => {
                  setArbitrationFocusMatchId(matchId);
                  setActiveTab('arbitration');
                }}
              />
            )}

            {activeTab === 'arbitration' && (
              <ArbitrationView
                matches={matches}
                focusMatchId={arbitrationFocusMatchId}
                onArbitrate={
                  handleArbitrate
                }
                onResetArbitration={
                  handleResetArbitration
                }
              />
            )}

            {activeTab === 'stats' && (
              <StatisticsView
                totalRecordsCount={
                  records.length
                }
                matches={matches}
                differentRecords={differentRecords}
                files={files}
                activeAnalysisId={activeAnalysisId}
              />
            )}

            {activeTab === 'history' && (
              selectedAnalysis ? (
                <AnalysisDetailView
                  snapshot={selectedAnalysis}
                  onBack={() => setSelectedAnalysis(null)}
                  onOpenDetails={setSelectedMatchForDetail}
                  onArbitrate={handleHistoricalArbitrate}
                  onResetArbitration={handleHistoricalResetArbitration}
                />
              ) : (
                <HistoryView
                  historyItems={historyItems}
                  onViewAnalysis={handleViewHistoryAnalysis}
                  onDeleteHistory={handleDeleteHistory}
                />
              )
            )}

          </div>
        </main>
      </div>

      </div>
      <AnalysisModal
        isOpen={
          isAnalysisModalOpen
        }
        totalRecords={
          records.length > 0
            ? records.length
            : (remoteTotalRecords ?? 0)
        }
        onComplete={
          handleAnalysisComplete
        }
        onClose={() =>
          setIsAnalysisModalOpen(false)
        }
        sessionId={runningAnalysisSessionId}
        onRunComplete={
          handleRunComplete
        }
      />

      <MatchDetailModal
        match={
          selectedMatchForDetail
        }
        onClose={() =>
          setSelectedMatchForDetail(
            null
          )
        }
        onArbitrate={
          handleContextArbitrate
        }
      />
    </div>
  );
}




