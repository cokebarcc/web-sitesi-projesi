/// <reference lib="webworker" />
// ═══════════════════════════════════════════════════════════════
// Excel Parse Worker — XLSX parsing off main thread
// ═══════════════════════════════════════════════════════════════

import { parseHekimIslemExcel } from '../services/excelParseHekim';
import type {
  ExcelParseWorkerRequest,
  ExcelParseWorkerResponse,
} from './workerProtocol';

declare const self: DedicatedWorkerGlobalScope;

function postMsg(msg: ExcelParseWorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<ExcelParseWorkerRequest>) => {
  const { type, arrayBuffer } = event.data;
  if (type !== 'PARSE_EXCEL') return;

  try {
    postMsg({ type: 'PARSE_PROGRESS', phase: 'reading', message: 'Excel dosyası okunuyor...' });

    const result = parseHekimIslemExcel(arrayBuffer);

    postMsg({
      type: 'PARSE_SUCCESS',
      rows: result.rows,
      extraColumns: result.extraColumns,
      rowCount: result.rows.length,
    });
  } catch (err: any) {
    postMsg({
      type: 'PARSE_ERROR',
      error: err?.message || String(err),
    });
  }
};
