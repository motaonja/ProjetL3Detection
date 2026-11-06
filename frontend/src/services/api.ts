import type {
  AnalysisHistoryItem,
  MatchPair,
  DataRecord,
  AnalysisSnapshot,
} from '../types';

const API_BASE_URL = '';

const apiFetch: typeof fetch = (input, init = {}) => fetch(input, { ...init, credentials: 'include' });

export interface AuthUser { id: string; name: string; email: string; }
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/me`);
  if (!response.ok) throw new Error('Session non connectee');
  return response.json();
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw await authError(response, 'Connexion impossible');
  return response.json();
}

async function authError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({}));
  return Object.assign(new Error(payload.detail || fallback), { status: response.status });
}

export async function register(name: string, email: string, password: string, passwordConfirmation: string): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, password_confirmation: passwordConfirmation }) });
  if (!response.ok) throw await authError(response, 'Creation du compte impossible');
}

export async function logout(): Promise<void> {
  await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
}


/**
 * Fichier retourné par le backend
 */
export interface BackendUploadedFile {
  id: string;
  sessionId: string;
  name: string;
  size: string;
  sizeBytes: number;
  format: string;
  rowCount: number;
  uploadDate: string;
  sourceColumns?: string[];
}

export interface UploadResponse {
  files: BackendUploadedFile[];
  records: DataRecord[];
  warnings: string[];
}

export interface AnalysisRunResponse {
  history: any;
  matches: MatchPair[];
  differentRecords: DataRecord[];
}

export interface AnalysisResultsResponse {
  analysis_id?: string;
  results: MatchPair[];
  differentRecords: DataRecord[];
  total: number;
  differentTotal: number;
  categoryCounts?: { duplicates: number; uncertain: number; different: number; total: number };
}

export interface FilePreviewResponse {
  sourceColumns: string[];
  records: Array<{ id: string; sourceValues: Record<string, string> }>;
}

export async function getFilePreview(fileId: string): Promise<FilePreviewResponse> {
  const response = await apiFetch(API_BASE_URL + "/api/files/" + encodeURIComponent(fileId) + "/preview");
  if (!response.ok) throw new Error("Erreur lors du chargement de l'aperçu : " + response.status);
  return response.json();
}

/**
 * Récupérer tous les fichiers enregistrés dans PostgreSQL
 */
export async function getFiles(): Promise<BackendUploadedFile[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/files`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors du chargement des fichiers : ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Envoyer un ou plusieurs fichiers au backend
 */
export async function uploadFiles(files: File[] | FileList, sessionId: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  const fileArray = Array.from(files);

  for (const f of fileArray) {
    formData.append('files', f);
  }

  const response = await apiFetch(
    `${API_BASE_URL}/api/files/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText ||
        `Erreur lors de l'import : ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Lancer une analyse
 */
export async function runAnalysis(
  sessionId: string
): Promise<AnalysisRunResponse> {
  const payload = {
    session_id: sessionId,
  };

  const response = await apiFetch(
    `${API_BASE_URL}/api/analysis/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      text ||
        `Erreur analyse : ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Récupérer les résultats de l'analyse
 */
export async function getResults(analysisId?: string): Promise<AnalysisResultsResponse> {
  const query = analysisId
    ? `?analysis_id=${encodeURIComponent(analysisId)}`
    : '';
  const response = await apiFetch(
    `${API_BASE_URL}/api/analysis/results${query}`
  );

  if (!response.ok) {
    throw new Error(
      `Erreur récupération résultats: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Récupérer les enregistrements
 */
export async function listRecords(): Promise<DataRecord[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/records`
  );

  if (!response.ok) {
    throw new Error(
      `Erreur récupération enregistrements: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Récupérer l'historique
 */
export async function listHistory(): Promise<AnalysisHistoryItem[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/history`
  );

  if (!response.ok) {
    throw new Error(
      `Erreur récupération historique: ${response.status}`
    );
  }

  return await response.json();
}

export async function getAnalysisSnapshot(analysisId: string): Promise<AnalysisSnapshot> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/history/${encodeURIComponent(analysisId)}`
  );

  if (!response.ok) {
    throw new Error(`Erreur chargement de l'analyse: ${response.status}`);
  }

  return await response.json();
}

export async function arbitrateHistoryMatch(
  analysisId: string,
  matchId: string,
  decision: 'confirmed' | 'rejected'
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/history/${encodeURIComponent(analysisId)}/arbitration/${encodeURIComponent(matchId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erreur arbitrage: ${response.status}`);
  }
}

export async function resetHistoryArbitration(analysisId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/history/${encodeURIComponent(analysisId)}/arbitration/reset`,
    { method: 'POST' }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erreur reset arbitrage: ${response.status}`);
  }
}

export async function deleteHistory(historyId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/history/${encodeURIComponent(historyId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error(`Erreur suppression historique: ${response.status}`);
  }
}

/**
 * Arbitrage d'une paire
 */
export async function arbitrate(
  matchId: string,
  decision: 'confirmed' | 'rejected',
  analysisId?: string
) {
  const query = analysisId
    ? `?analysis_id=${encodeURIComponent(analysisId)}`
    : '';
  const response = await apiFetch(
    `${API_BASE_URL}/api/arbitration/${encodeURIComponent(
      matchId
    )}${query}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decision,
      }),
    }
  );

  if (!response.ok) {
    const txt = await response.text();

    throw {
      status: response.status,
      text:
        txt ||
        `Erreur arbitrage: ${response.status}`,
    };
  }

  return await response.json();
}

/**
 * Réinitialiser les arbitrages
 */
export async function resetArbitration(analysisId?: string): Promise<any[]> {
  const query = analysisId
    ? `?analysis_id=${encodeURIComponent(analysisId)}`
    : '';
  const response = await apiFetch(
    `${API_BASE_URL}/api/arbitration/reset${query}`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const txt = await response.text();

    throw new Error(
      txt ||
        `Erreur reset arbitrage: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Récupérer toutes les statistiques
 */
export async function getDashboardStats(analysisId?: string): Promise<any> {
  const query = analysisId
    ? `?analysis_id=${encodeURIComponent(analysisId)}`
    : '';
  const response = await apiFetch(
    `${API_BASE_URL}/api/stats/dashboard${query}`
  );

  if (!response.ok) {
    throw new Error(
      `Erreur récupération stats: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Supprimer un fichier
 */
export async function deleteFile(
  fileId: string
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/files/${encodeURIComponent(
      fileId
    )}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText ||
        `Erreur lors de la suppression : ${response.status}`
    );
  }
}