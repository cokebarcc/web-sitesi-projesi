// ═══════════════════════════════════════════════════════════════
// Compliance Data Loader — Firebase'den kural verisi yükleme
// ═══════════════════════════════════════════════════════════════

import { getFinansalModuleFiles, getFinansalFileMetadata, downloadFinansalFile } from './finansalStorage';
import { parseEk2b, parseEk2c, parseEk2cd, ExcelData } from '../../components/EkListeTanimlama';
import { parseGilExcel, GilExcelData } from '../../components/GilModule';
import { buildRulesMaster, BuildRulesMasterResult } from './ruleExtractor';
import { RuleLoadStatus, AnalysisProgress, SutMaddesi } from '../types/complianceTypes';
import mammoth from 'mammoth';

export interface RegulationDataResult {
  ek2b: ExcelData | null;
  ek2c: ExcelData | null;
  ek2cd: ExcelData | null;
  gil: GilExcelData | null;
  sutMaddeleri: SutMaddesi[];
  loadStatus: RuleLoadStatus;
}

/**
 * DOCX ArrayBuffer → düz metin olarak parse et (mammoth extractRawText)
 */
async function parseSutDocxToText(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || null;
  } catch (error) {
    console.error('[SUT PARSE] DOCX parse hatası:', error);
    return null;
  }
}

/**
 * SUT düz metninden maddeleri ayrıştır
 * SUT madde formatları: "1.2.3", "1.2.3.A", "2.4.4.D-1", "(1)", "(a)" vb.
 */
export function parseSutMaddeleri(rawText: string): SutMaddesi[] {
  if (!rawText || rawText.trim().length === 0) return [];

  const maddeler: SutMaddesi[] = [];
  const lines = rawText.split('\n');

  // SUT madde numarası pattern'i: "1.2", "1.2.3", "2.4.4.D", "2.4.4.D-1" vb.
  const maddeNoPattern = /^(\d+\.\d+(?:\.\d+)*(?:\.[A-ZÇĞİÖŞÜ](?:-\d+)?)?)\s*[-–—.]\s*(.+)/;
  // Alt madde pattern'i: "(1)", "(2)", "(a)", "(b)", "a)", "b)" vb.
  const altMaddePattern = /^\s*(?:\([a-zA-ZçğıöşüÇĞİÖŞÜ0-9]+\)|[a-zA-Z]\))\s+(.+)/;

  let currentMadde: SutMaddesi | null = null;
  let currentIcerik: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const maddeMatch = trimmed.match(maddeNoPattern);
    if (maddeMatch) {
      // Önceki maddeyi kaydet
      if (currentMadde) {
        currentMadde.icerik = currentIcerik.join('\n').trim();
        if (currentMadde.icerik.length > 0) {
          maddeler.push(currentMadde);
        }
      }

      // Yeni madde başlat
      currentMadde = {
        maddeNo: maddeMatch[1],
        baslik: maddeMatch[2].trim(),
        icerik: '',
        altMaddeler: [],
      };
      currentIcerik = [maddeMatch[2].trim()];
    } else if (currentMadde) {
      // Alt madde mi?
      const altMatch = trimmed.match(altMaddePattern);
      if (altMatch) {
        currentMadde.altMaddeler?.push(trimmed);
      }
      currentIcerik.push(trimmed);
    }
  }

  // Son maddeyi kaydet
  if (currentMadde) {
    currentMadde.icerik = currentIcerik.join('\n').trim();
    if (currentMadde.icerik.length > 0) {
      maddeler.push(currentMadde);
    }
  }

  console.log(`[SUT PARSE] ${maddeler.length} madde ayrıştırıldı`);
  return maddeler;
}

/**
 * Firebase'den tüm mevzuat verilerini paralel olarak yükler ve parse eder
 */
export async function loadAllRegulationData(
  onProgress?: (progress: AnalysisProgress) => void
): Promise<RegulationDataResult> {
  const result: RegulationDataResult = {
    ek2b: null,
    ek2c: null,
    ek2cd: null,
    gil: null,
    sutMaddeleri: [],
    loadStatus: {
      ek2b: { loaded: false, count: 0 },
      ek2c: { loaded: false, count: 0 },
      ek2cd: { loaded: false, count: 0 },
      gil: { loaded: false, count: 0 },
      sut: { loaded: false, count: 0 },
      totalRules: 0,
    }
  };

  onProgress?.({
    phase: 'loading',
    current: 0,
    total: 5,
    message: 'Firebase\'den mevzuat verileri yükleniyor...'
  });

  try {
    // Metadata'ları paralel al
    const [ekFiles, gilMeta, sutMeta] = await Promise.all([
      getFinansalModuleFiles('ekListe'),
      getFinansalFileMetadata('gil', 'gil'),
      getFinansalFileMetadata('sutMevzuati', 'sut'),
    ]);

    // Dosyaları paralel indir
    const downloads = await Promise.all([
      ekFiles.ek2b?.storagePath ? downloadFinansalFile(ekFiles.ek2b.storagePath) : null,
      ekFiles.ek2c?.storagePath ? downloadFinansalFile(ekFiles.ek2c.storagePath) : null,
      ekFiles.ek2cd?.storagePath ? downloadFinansalFile(ekFiles.ek2cd.storagePath) : null,
      gilMeta?.storagePath ? downloadFinansalFile(gilMeta.storagePath) : null,
      sutMeta?.storagePath ? downloadFinansalFile(sutMeta.storagePath) : null,
    ]);

    const [ek2bAb, ek2cAb, ek2cdAb, gilAb, sutAb] = downloads;

    onProgress?.({
      phase: 'loading',
      current: 2,
      total: 5,
      message: 'Dosyalar indirildi, parse ediliyor...'
    });

    // Parse et
    if (ek2bAb) {
      result.ek2b = parseEk2b(ek2bAb, ekFiles.ek2b?.fileName || 'ek2b.xlsx');
      if (result.ek2b) {
        result.loadStatus.ek2b = { loaded: true, count: result.ek2b.rows.length };
      }
    }

    if (ek2cAb) {
      result.ek2c = parseEk2c(ek2cAb, ekFiles.ek2c?.fileName || 'ek2c.xlsx');
      if (result.ek2c) {
        result.loadStatus.ek2c = { loaded: true, count: result.ek2c.rows.length };
      }
    }

    if (ek2cdAb) {
      result.ek2cd = parseEk2cd(ek2cdAb, ekFiles.ek2cd?.fileName || 'ek2cd.xlsx');
      if (result.ek2cd) {
        result.loadStatus.ek2cd = { loaded: true, count: result.ek2cd.rows.length };
      }
    }

    if (gilAb) {
      result.gil = parseGilExcel(gilAb, gilMeta?.fileName || 'gil.xlsx');
      if (result.gil) {
        result.loadStatus.gil = { loaded: true, count: result.gil.rows.length };
      }
    }

    // SUT Mevzuatı parse et
    if (sutAb) {
      onProgress?.({
        phase: 'loading',
        current: 3,
        total: 5,
        message: 'SUT Mevzuatı parse ediliyor...'
      });

      const sutText = await parseSutDocxToText(sutAb);
      if (sutText) {
        result.sutMaddeleri = parseSutMaddeleri(sutText);
        result.loadStatus.sut = { loaded: true, count: result.sutMaddeleri.length };
        console.log(`[COMPLIANCE LOADER] SUT: ${result.sutMaddeleri.length} madde yüklendi`);
      }
    }

    result.loadStatus.totalRules =
      result.loadStatus.ek2b.count +
      result.loadStatus.ek2c.count +
      result.loadStatus.ek2cd.count +
      result.loadStatus.gil.count +
      result.loadStatus.sut.count;

    onProgress?.({
      phase: 'loading',
      current: 5,
      total: 5,
      message: `${result.loadStatus.totalRules.toLocaleString('tr-TR')} kayıt yüklendi.`
    });

    console.log('[COMPLIANCE LOADER] Yükleme tamamlandı:', result.loadStatus);

  } catch (error) {
    console.error('[COMPLIANCE LOADER] Yükleme hatası:', error);
    onProgress?.({
      phase: 'error',
      current: 0,
      total: 0,
      message: `Yükleme hatası: ${error}`
    });
  }

  return result;
}

/**
 * Tam pipeline: Yükle → Parse → RulesMaster oluştur
 */
export async function buildRulesMasterFromFirebase(
  onProgress?: (progress: AnalysisProgress) => void
): Promise<BuildRulesMasterResult & { loadStatus: RuleLoadStatus }> {
  const data = await loadAllRegulationData(onProgress);

  onProgress?.({
    phase: 'building-rules',
    current: 0,
    total: 1,
    message: 'Kural veritabanı oluşturuluyor...'
  });

  const result = buildRulesMaster(data.ek2b, data.ek2c, data.ek2cd, data.gil, data.sutMaddeleri);

  onProgress?.({
    phase: 'building-rules',
    current: 1,
    total: 1,
    message: `${result.rulesMaster.size.toLocaleString('tr-TR')} benzersiz kural oluşturuldu.`
  });

  return { ...result, loadStatus: data.loadStatus };
}
