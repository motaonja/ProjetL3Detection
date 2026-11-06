export interface DataRecord {
  id: string;
  nom: string;
  prenom?: string;
  date_naissance?: string | null;
  cin?: string | null;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  sourceFile: string;
  sourceValues?: Record<string, string>;
}

export type MatchStatus = 'duplicate' | 'uncertain' | 'different';

export type ArbitrationDecision = 'confirmed' | 'rejected' | null;

export interface FieldComparison {
  field: string;
  label: string;
  valA: string;
  valB: string;
  isMatch: boolean;
  similarity: number; // 0 - 100
}

export interface MatchPair {
  id: string;
  recordA: DataRecord;
  recordB: DataRecord;
  score: number; // 0 - 100
  status: MatchStatus;
  statusLabel: string;
  fieldComparisons: FieldComparison[];
  decision?: ArbitrationDecision;
  decisionDate?: string;
}

export interface UploadedFile {
  id: string;
  sessionId?: string;
  name: string;
  size: string; // e.g. "245 Ko"
  sizeBytes: number;
  format: 'CSV' | 'XLSX' | 'XLS';
  rowCount: number;
  uploadDate: string;
  sourceColumns?: string[];
}

export interface AnalysisHistoryItem {
  id: string;
  date: string;
  files: string[];
  totalRecords: number;
  duplicatesFound: number;
  uncertainCases: number;
  differentCount: number;
  status: 'Terminé' | 'En cours' | 'Arbitré';
  executionTime: string;
  hasSnapshot?: boolean;
}

export type ActiveTab = 'dashboard' | 'import' | 'data' | 'results' | 'arbitration' | 'stats' | 'history';


export interface AnalysisSnapshot {
  analysis: AnalysisHistoryItem;
  files: UploadedFile[];
  records: (DataRecord & { fileId?: string | null })[];
  results: MatchPair[];
  differentRecords: (DataRecord & { fileId?: string | null })[];
  stats: {
    totalFiles: number;
    totalRecords: number;
    totalPairs: number;
    duplicatesFound: number;
    uncertainCases: number;
    differentCount: number;
    pendingArbitrationCount: number;
    attributeConcordance: { field: string; rate: number }[];
  };
}
