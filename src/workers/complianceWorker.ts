/// <reference lib="webworker" />
// ═══════════════════════════════════════════════════════════════
// Compliance Analysis Worker — Analiz off main thread
// ═══════════════════════════════════════════════════════════════

import {
  analyzeRow,
  applySiklikLimitChecks,
  generateSummary,
  turkishLower,
} from '../services/complianceAnalysis';
import type { IslemSatiriLike } from '../services/complianceAnalysis';
import type { RuleMasterEntry } from '../types/complianceTypes';
import { normalizeGilKodu } from '../services/complianceAnalysis';
import type {
  ComplianceWorkerRequest,
  ComplianceWorkerResponse,
} from './workerProtocol';

declare const self: DedicatedWorkerGlobalScope;

function postMsg(msg: ComplianceWorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<ComplianceWorkerRequest>) => {
  const { type, rows, rulesMasterEntries, kurumBilgisi } = event.data;
  if (type !== 'RUN_ANALYSIS') return;

  try {
    const startTime = Date.now();
    const rulesMaster = new Map<string, RuleMasterEntry>(rulesMasterEntries);
    const kurumBasamak = kurumBilgisi?.basamak || 2;

    postMsg({
      type: 'ANALYSIS_PROGRESS',
      progress: { phase: 'analyzing', current: 0, total: rows.length, message: 'Seans grupları oluşturuluyor...' }
    });

    // Seans grupları ön-hesaplama
    const sessionMap = new Map<string, IslemSatiriLike[]>();
    for (const row of rows) {
      const key = `${row.hastaTc}_${row.tarih}`;
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(row);
    }

    // Mevcut uzmanlıklar
    const mevcutUzmanliklar = new Set<string>();
    for (const row of rows) {
      if (row.uzmanlik) mevcutUzmanliklar.add(turkishLower(row.uzmanlik).trim());
    }

    // Batch processing — worker'da setTimeout yield gereksiz
    const BATCH_SIZE = 5000;
    const results = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, rows.length);

      for (let j = i; j < batchEnd; j++) {
        const row = rows[j];
        const sessionKey = `${row.hastaTc}_${row.tarih}`;
        const sameSessionRows = sessionMap.get(sessionKey) || [];
        results.push(analyzeRow(row, j, rulesMaster, kurumBasamak, sameSessionRows, mevcutUzmanliklar));
      }

      postMsg({
        type: 'ANALYSIS_PROGRESS',
        progress: {
          phase: 'analyzing',
          current: batchEnd,
          total: rows.length,
          message: `${batchEnd.toLocaleString('tr-TR')} / ${rows.length.toLocaleString('tr-TR')} satır analiz ediliyor...`
        }
      });
    }

    // Post-processing: Sıklık kontrolü
    postMsg({
      type: 'ANALYSIS_PROGRESS',
      progress: { phase: 'analyzing', current: rows.length, total: rows.length, message: 'Sıklık limitleri kontrol ediliyor...' }
    });

    applySiklikLimitChecks(rows, results, rulesMaster);

    const elapsed = Date.now() - startTime;
    const summary = generateSummary(results, elapsed);

    postMsg({
      type: 'ANALYSIS_SUCCESS',
      results,
      summary,
      elapsedMs: elapsed,
    });
  } catch (err: any) {
    postMsg({
      type: 'ANALYSIS_ERROR',
      error: err?.message || String(err),
    });
  }
};
