// ═══════════════════════════════════════════════════════════════
// Compliance Engine — Barrel Re-export
// Analiz fonksiyonları complianceAnalysis.ts'de,
// Export fonksiyonu complianceExport.ts'de.
// Bu dosya mevcut import path'lerini korumak için re-export yapar.
// ═══════════════════════════════════════════════════════════════

export {
  runComplianceAnalysis,
  generateSummary,
  analyzeRow,
  applySiklikLimitChecks,
  turkishLower,
  normalizeGilKodu,
  branslarEslesiyor,
} from './complianceAnalysis';

export type {
  IslemSatiriLike,
  KurumBilgisiLike,
} from './complianceAnalysis';

export { exportResultsToExcel } from './complianceExport';
