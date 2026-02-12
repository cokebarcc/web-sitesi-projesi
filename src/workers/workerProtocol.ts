// ═══════════════════════════════════════════════════════════════
// Worker Message Protocol — Paylaşımlı tip tanımları
// ═══════════════════════════════════════════════════════════════

import type { IslemSatiriLike, KurumBilgisiLike } from '../services/complianceAnalysis';
import type {
  ComplianceResult,
  ComplianceAnalysisSummary,
  RuleMasterEntry,
  AnalysisProgress,
} from '../types/complianceTypes';

// ── Excel Parse Worker Mesajları ──

export interface ExcelParseRequest {
  type: 'PARSE_EXCEL';
  arrayBuffer: ArrayBuffer;
}

export interface ExcelParseProgressMessage {
  type: 'PARSE_PROGRESS';
  phase: 'reading' | 'converting' | 'mapping';
  message: string;
}

export interface ExcelParseSuccessMessage {
  type: 'PARSE_SUCCESS';
  rows: IslemSatiriLike[];
  extraColumns: { key: string; label: string }[];
  rowCount: number;
}

export interface ExcelParseErrorMessage {
  type: 'PARSE_ERROR';
  error: string;
}

export type ExcelParseWorkerRequest = ExcelParseRequest;
export type ExcelParseWorkerResponse =
  | ExcelParseProgressMessage
  | ExcelParseSuccessMessage
  | ExcelParseErrorMessage;

// ── Compliance Analysis Worker Mesajları ──

export type SerializedRulesMaster = [string, RuleMasterEntry][];

export interface ComplianceAnalysisRequest {
  type: 'RUN_ANALYSIS';
  rows: IslemSatiriLike[];
  rulesMasterEntries: SerializedRulesMaster;
  kurumBilgisi: KurumBilgisiLike | undefined;
}

export interface ComplianceProgressMessage {
  type: 'ANALYSIS_PROGRESS';
  progress: AnalysisProgress;
}

export interface ComplianceSuccessMessage {
  type: 'ANALYSIS_SUCCESS';
  results: ComplianceResult[];
  summary: ComplianceAnalysisSummary;
  elapsedMs: number;
}

export interface ComplianceErrorMessage {
  type: 'ANALYSIS_ERROR';
  error: string;
}

export type ComplianceWorkerRequest = ComplianceAnalysisRequest;
export type ComplianceWorkerResponse =
  | ComplianceProgressMessage
  | ComplianceSuccessMessage
  | ComplianceErrorMessage;
