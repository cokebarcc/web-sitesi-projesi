// ═══════════════════════════════════════════════════════════════
// Compliance Data Loader — Firebase'den kural verisi yükleme
// ═══════════════════════════════════════════════════════════════

import { getFinansalModuleFiles, getFinansalFileMetadata, downloadFinansalFile } from './finansalStorage';
import { parseEk2b, parseEk2c, parseEk2cd, ExcelData } from '../../components/EkListeTanimlama';
import { parseGilExcel, GilExcelData } from '../../components/GilModule';
import { buildRulesMaster, buildRulesMasterHybrid, buildRulesMasterFullAudit, BuildRulesMasterResult, FullAuditResult } from './ruleExtractor';
import {
  RuleLoadStatus, AnalysisProgress, SutMaddesi,
  RuleMasterEntry, ExtractedRulesJSON, ExtractedRulesMetadata,
} from '../types/complianceTypes';
import {
  extractAndSaveRules, loadExtractedRulesFromFirebase, getExtractedRulesMetadata,
  RegulationSourceData,
} from './ai/ruleExtractionAI';
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

/**
 * Hibrit pipeline: Yükle → Parse → RulesMaster (Regex + AI) oluştur
 */
export async function buildRulesMasterHybridFromFirebase(
  useAI: boolean = true,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<BuildRulesMasterResult & { loadStatus: RuleLoadStatus }> {
  const data = await loadAllRegulationData(onProgress);

  const result = await buildRulesMasterHybrid(
    data.ek2b, data.ek2c, data.ek2cd, data.gil, data.sutMaddeleri,
    useAI,
    onProgress
  );

  return { ...result, loadStatus: data.loadStatus };
}

/**
 * FULL AUDIT pipeline: Yükle → Parse → TÜM açıklamaları AI'a gönder → Regex vs AI karşılaştır
 * Tek seferlik çalıştırılır, sonuçlar JSON olarak export edilebilir
 */
export async function runFullAuditFromFirebase(
  onProgress?: (progress: AnalysisProgress) => void
): Promise<FullAuditResult & { loadStatus: RuleLoadStatus }> {
  const data = await loadAllRegulationData(onProgress);

  const result = await buildRulesMasterFullAudit(
    data.ek2b, data.ek2c, data.ek2cd, data.gil, data.sutMaddeleri,
    onProgress
  );

  return { ...result, loadStatus: data.loadStatus };
}

// ═══════════════════════════════════════════════════════════════
// YENİ v2.0: AI-Extracted Kural Sistemi
// ═══════════════════════════════════════════════════════════════

/**
 * ExtractedRulesJSON'dan RuleMasterEntry Map'e dönüştürücü.
 * Compliance engine mevcut Map<string, RuleMasterEntry> formatını bekler.
 */
export function convertExtractedRulesToMaster(
  extracted: ExtractedRulesJSON
): Map<string, RuleMasterEntry> {
  const master = new Map<string, RuleMasterEntry>();

  for (const [kodu, entry] of Object.entries(extracted.rules)) {
    const primaryKaynak = entry.kaynaklar.includes('EK-2C') ? 'EK-2C' :
                          entry.kaynaklar.includes('EK-2B') ? 'EK-2B' :
                          entry.kaynaklar.includes('GİL') ? 'GİL' :
                          entry.kaynaklar.includes('EK-2Ç') ? 'EK-2Ç' : 'SUT';

    // Tüm açıklamaları birleştir
    const allAciklama = Object.values(entry.aciklamaRaw).filter(Boolean).join('\n---\n');

    master.set(kodu, {
      islem_kodu: entry.islemKodu,
      islem_adi: entry.islemAdi,
      kaynak: primaryKaynak as any,
      islem_puani: entry.islemPuani,
      islem_fiyati: entry.islemFiyati,
      aciklama_raw: allAciklama,
      islem_grubu: entry.islemGrubu,
      ameliyat_grubu: entry.ameliyatGrubu,
      gil_aciklama: entry.aciklamaRaw['GİL'],
      gil_section_header: entry.sectionHeader,
      parsed_rules: entry.kurallar.map(r => ({
        type: r.type,
        rawText: r.rawText,
        params: r.params,
        kaynak: r.kaynak,
        fromSectionHeader: r.fromSectionHeader,
        confidence: r.confidence,
        extractionMethod: 'ai' as const,
        aiExplanation: r.explanation,
      })),
      section_header: entry.sectionHeader,
    });
  }

  // ── Post-processing: GENEL_ACIKLAMA'dan kaçırılmış kuralları kurtarma ──
  let recoveredCount = 0;
  for (const [kodu, entry] of master) {
    const genelRules = entry.parsed_rules.filter(r => r.type === 'GENEL_ACIKLAMA');
    if (genelRules.length === 0) continue;

    for (const genelRule of genelRules) {
      const rawLower = (genelRule.rawText || '').toLowerCase()
        .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ğ/g, 'ğ')
        .replace(/Ü/g, 'ü').replace(/Ş/g, 'ş').replace(/Ö/g, 'ö').replace(/Ç/g, 'ç');

      // (1) Sıklık limiti kurtarma: "en az N gün/ay arayla/sonra"
      const hasSiklik = entry.parsed_rules.some(r => r.type === 'SIKLIK_LIMIT');
      if (!hasSiklik) {
        const siklikMatch = rawLower.match(/en\s*az\s*(\d+)\s*(gün|ay)\s*(?:arayla|sonra|ara\s*ile)/);
        if (siklikMatch) {
          const miktar = parseInt(siklikMatch[1], 10);
          const birim = siklikMatch[2];
          entry.parsed_rules.push({
            type: 'SIKLIK_LIMIT',
            rawText: genelRule.rawText,
            params: {
              periyot: birim === 'gün' ? 'gun_aralik' : 'ay_aralik',
              miktar,
              maxTekrar: 1,
            },
            kaynak: genelRule.kaynak,
            fromSectionHeader: genelRule.fromSectionHeader,
            confidence: 0.7,
            extractionMethod: 'ai' as const,
            aiExplanation: 'GENEL_ACIKLAMA rawText kurtarma',
          });
          recoveredCount++;
        }
      }

      // (2) Branş kısıtı kurtarma: "X uzmanı tarafından yapılır/faturalandırılır"
      const hasBrans = entry.parsed_rules.some(r => r.type === 'BRANS_KISITI');
      if (!hasBrans) {
        const bransMatch = rawLower.match(/([\wçğıöşü\s]+?)\s+uzmanı\s+(?:tarafından|hekim)/);
        if (bransMatch && !/için\s+de|da\s+yapabilir|de\s+puanland/.test(rawLower)) {
          const bransAdi = bransMatch[1].trim();
          if (bransAdi.length > 3 && bransAdi.split(' ').length <= 5) {
            entry.parsed_rules.push({
              type: 'BRANS_KISITI',
              rawText: genelRule.rawText,
              params: {
                branslar: [bransAdi],
                mode: 'dahil',
              },
              kaynak: genelRule.kaynak,
              fromSectionHeader: genelRule.fromSectionHeader,
              confidence: 0.65,
              extractionMethod: 'ai' as const,
              aiExplanation: 'GENEL_ACIKLAMA rawText kurtarma',
            });
            recoveredCount++;
          }
        }
      }

      // (3) Birlikte yapılamaz kurtarma: "X kodlu işlem ile birlikte faturalandırılamaz"
      const hasBirlikte = entry.parsed_rules.some(r => r.type === 'BIRLIKTE_YAPILAMAZ');
      if (!hasBirlikte) {
        const birlikteMatch = rawLower.match(/(\d{6}(?:\s*,\s*\d{6})*)\s*kodlu\s*işlem(?:ler)?\s*ile\s*birlikte\s*(?:faturalandırılamaz|puanlandırılamaz)/);
        if (birlikteMatch) {
          const kodlar = birlikteMatch[1].split(/\s*,\s*/).map(k => k.trim()).filter(k => k.length === 6);
          if (kodlar.length > 0) {
            entry.parsed_rules.push({
              type: 'BIRLIKTE_YAPILAMAZ',
              rawText: genelRule.rawText,
              params: {
                yapilamazKodlari: kodlar,
              },
              kaynak: genelRule.kaynak,
              fromSectionHeader: genelRule.fromSectionHeader,
              confidence: 0.75,
              extractionMethod: 'ai' as const,
              aiExplanation: 'GENEL_ACIKLAMA rawText kurtarma',
            });
            recoveredCount++;
          }
        }
      }
    }
  }
  if (recoveredCount > 0) {
    console.log(`[LOADER v2] GENEL_ACIKLAMA kurtarma: ${recoveredCount} ek kural üretildi`);
  }

  // Kural istatistikleri
  let withRules = 0;
  let totalParsedRules = 0;
  for (const entry of master.values()) {
    if (entry.parsed_rules && entry.parsed_rules.length > 0) {
      withRules++;
      totalParsedRules += entry.parsed_rules.length;
    }
  }
  console.log(`[LOADER v2] ${master.size} işlem kodu dönüştürüldü → ${withRules} tanesinde kural var (toplam ${totalParsedRules} kural)`);
  return master;
}

/**
 * Mevzuat verilerini RegulationSourceData formatına dönüştür (AI extraction için)
 */
function regulationDataToSources(data: RegulationDataResult): RegulationSourceData[] {
  const sources: RegulationSourceData[] = [];

  // EK-2B
  if (data.ek2b && data.ek2b.rows.length > 0) {
    sources.push({
      kaynak: 'EK-2B',
      fileName: data.ek2b.fileName,
      entries: data.ek2b.rows
        .filter((r: any[]) => r[0] && String(r[0]).trim())
        .map((r: any[]) => ({
          kodu: String(r[0]).trim(),
          adi: String(r[1] || '').trim(),
          aciklama: String(r[2] || '').trim(),
          puani: typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3])) || 0,
          fiyati: typeof r[4] === 'number' ? r[4] : parseFloat(String(r[4])) || 0,
        })),
    });
  }

  // EK-2C
  if (data.ek2c && data.ek2c.rows.length > 0) {
    sources.push({
      kaynak: 'EK-2C',
      fileName: data.ek2c.fileName,
      entries: data.ek2c.rows
        .filter((r: any[]) => r[0] && String(r[0]).trim())
        .map((r: any[]) => ({
          kodu: String(r[0]).trim(),
          adi: String(r[1] || '').trim(),
          aciklama: String(r[2] || '').trim(),
          islemGrubu: String(r[3] || '').trim(),
          puani: typeof r[4] === 'number' ? r[4] : parseFloat(String(r[4])) || 0,
          fiyati: typeof r[5] === 'number' ? r[5] : parseFloat(String(r[5])) || 0,
        })),
    });
  }

  // EK-2Ç
  if (data.ek2cd && data.ek2cd.rows.length > 0) {
    sources.push({
      kaynak: 'EK-2Ç',
      fileName: data.ek2cd.fileName,
      entries: data.ek2cd.rows
        .filter((r: any[]) => r[0] && String(r[0]).trim())
        .map((r: any[]) => ({
          kodu: String(r[0]).trim(),
          adi: String(r[1] || '').trim(),
          aciklama: String(r[2] || '').trim(),
          puani: typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3])) || 0,
          fiyati: typeof r[4] === 'number' ? r[4] : parseFloat(String(r[4])) || 0,
        })),
    });
  }

  // GİL
  if (data.gil && data.gil.rows.length > 0) {
    let currentSectionHeader = '';
    sources.push({
      kaynak: 'GİL',
      fileName: data.gil.fileName,
      entries: data.gil.rows
        .filter((r: any[]) => {
          // Bölüm başlığı satırlarını tespit et (kod yok ama açıklama var)
          const kodu = String(r[0] || '').trim();
          const adi = String(r[1] || '').trim();
          if (!kodu && adi) {
            currentSectionHeader = adi;
            return false;
          }
          return kodu.length > 0;
        })
        .map((r: any[]) => ({
          kodu: String(r[0]).trim(),
          adi: String(r[1] || '').trim(),
          aciklama: String(r[2] || '').trim(),
          puani: typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3])) || 0,
          fiyati: 0,
          ameliyatGrubu: String(r[4] || '').trim(),
          sectionHeader: currentSectionHeader,
        })),
    });
  }

  // SUT
  if (data.sutMaddeleri && data.sutMaddeleri.length > 0) {
    sources.push({
      kaynak: 'SUT',
      entries: data.sutMaddeleri.map(m => ({
        kodu: m.maddeNo,
        adi: m.baslik,
        aciklama: m.icerik,
        puani: 0,
        fiyati: 0,
      })),
    });
  }

  return sources;
}

/**
 * AI master'ına regex kurallarını birleştir.
 * Regex kuralları confidence=1.0 (doğrudan mevzuattan), AI kaçırdıklarını tamamlar.
 * Aynı tip kural AI'da zaten varsa regex eklenmez (AI daha detaylı params üretir).
 */
function mergeRegexRulesIntoMaster(
  aiMaster: Map<string, RuleMasterEntry>,
  regexResult: BuildRulesMasterResult,
): { mergedCount: number; newCodeCount: number } {
  let mergedCount = 0;
  let newCodeCount = 0;

  for (const [kodu, regexEntry] of regexResult.rulesMaster) {
    if (aiMaster.has(kodu)) {
      // AI'da var: eksik kural tiplerini regex'ten ekle
      const aiEntry = aiMaster.get(kodu)!;
      const aiTypes = new Set(aiEntry.parsed_rules.map(r => r.type));

      for (const regexRule of regexEntry.parsed_rules) {
        if (!aiTypes.has(regexRule.type)) {
          aiEntry.parsed_rules.push({
            ...regexRule,
            extractionMethod: 'regex' as const,
            confidence: 1.0,
          });
          mergedCount++;
        }
      }
    } else {
      // AI'da yok: regex entry'sini olduğu gibi ekle
      const newEntry: RuleMasterEntry = {
        ...regexEntry,
        parsed_rules: regexEntry.parsed_rules.map(r => ({
          ...r,
          extractionMethod: 'regex' as const,
          confidence: 1.0,
        })),
      };
      aiMaster.set(kodu, newEntry);
      newCodeCount++;
    }
  }

  return { mergedCount, newCodeCount };
}

/**
 * v2.2 ANA FONKSİYON: Sadece kendi regex kurallarımız (AI devre dışı)
 * 1. Mevzuat verilerini yükle
 * 2. Regex ile kendi kurallarımızı çıkar (başlık propagasyonu dahil)
 * NOT: AI kuralları şimdilik devre dışı, ileride tekrar aktif edilebilir.
 */
export async function loadOrExtractRules(
  forceExtract: boolean = false,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<{ rulesMaster: Map<string, RuleMasterEntry>; loadStatus: RuleLoadStatus; extractedJSON: ExtractedRulesJSON | null }> {

  // 1. Mevzuat verilerini yükle
  onProgress?.({
    phase: 'loading',
    current: 0,
    total: 2,
    message: 'Mevzuat verileri yükleniyor...',
  });

  const data = await loadAllRegulationData(onProgress);

  // 2. Regex ile kendi kurallarımızı çıkar (başlık propagasyonu dahil)
  onProgress?.({
    phase: 'building-rules',
    current: 1,
    total: 2,
    message: 'Regex ile kurallar çıkarılıyor (başlık propagasyonu dahil)...',
  });

  const regexResult = buildRulesMaster(data.ek2b, data.ek2c, data.ek2cd, data.gil, data.sutMaddeleri);
  console.log(`[LOADER v2.2] Regex kuralları: ${regexResult.rulesMaster.size} işlem, ${regexResult.stats.withRules} kural içeren`);

  const finalMaster = regexResult.rulesMaster;

  // Regex kurallarına extractionMethod ekle
  for (const entry of finalMaster.values()) {
    for (const rule of entry.parsed_rules) {
      if (!rule.extractionMethod) {
        rule.extractionMethod = 'regex' as const;
        rule.confidence = 1.0;
      }
    }
  }

  // İstatistikler
  let totalRulesCount = 0;
  let withRulesCount = 0;

  for (const entry of finalMaster.values()) {
    if (entry.parsed_rules.length > 0) withRulesCount++;
    totalRulesCount += entry.parsed_rules.length;
  }

  console.log(`[LOADER v2.2] Final master: ${finalMaster.size} işlem, ${withRulesCount} kural içeren, ${totalRulesCount} toplam kural`);

  const loadStatus: RuleLoadStatus = {
    ek2b: { loaded: data.loadStatus.ek2b.loaded, count: data.loadStatus.ek2b.count },
    ek2c: { loaded: data.loadStatus.ek2c.loaded, count: data.loadStatus.ek2c.count },
    ek2cd: { loaded: data.loadStatus.ek2cd.loaded, count: data.loadStatus.ek2cd.count },
    gil: { loaded: data.loadStatus.gil.loaded, count: data.loadStatus.gil.count },
    sut: { loaded: data.loadStatus.sut.loaded, count: data.loadStatus.sut.count },
    totalRules: finalMaster.size,
  };

  onProgress?.({
    phase: 'complete',
    current: 2,
    total: 2,
    message: `${finalMaster.size} kural yüklendi (Regex: ${withRulesCount} işlem, ${totalRulesCount} kural)`,
  });

  // Debug: window'a expose et
  (window as any).__RULES_MASTER__ = finalMaster;
  (window as any).__EXTRACTED_JSON__ = null;
  console.log('[DEBUG] window.__RULES_MASTER__ erişime açıldı (sadece regex kuralları)');

  return { rulesMaster: finalMaster, loadStatus, extractedJSON: null };
}
