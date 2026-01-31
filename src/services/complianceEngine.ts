// ═══════════════════════════════════════════════════════════════
// Compliance Engine — Uygunluk Analiz Motoru
// ═══════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import {
  RuleMasterEntry,
  ComplianceResult,
  ComplianceAnalysisSummary,
  IhlalDetay,
  UygunlukDurumu,
  EslesmeGuveni,
  AnalysisProgress,
  ParsedRuleType,
} from '../types/complianceTypes';

// IslemSatiri ve KurumBilgisi HekimIslemListesiModule'den import edilecek ama
// circular dependency'den kaçınmak için arayüzleri burada tanımlayalım
export interface IslemSatiriLike {
  tarih: string;
  saat: string;
  uzmanlik: string;
  doktor: string;
  drTipi: string;
  gilKodu: string;
  gilAdi: string;
  miktar: number;
  puan: number;
  toplamPuan: number;
  fiyat: number;
  tutar: number;
  hastaTc: string;
  adiSoyadi: string;
  islemNo: string;
  disNumarasi: string;
}

export interface KurumBilgisiLike {
  ad: string;
  rolGrubu: string;
  basamak: 2 | 3;
}

// Türkçe güvenli lowercase
function turkishLower(str: string): string {
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase();
}

// ═══════════════════════════════════════════════════════════════
// BRANŞ EŞLEŞTİRME SİSTEMİ — Akıllı alias + fuzzy matching
// ═══════════════════════════════════════════════════════════════

// Branş eşdeğerlikleri: Her gruba ait tüm yazım varyasyonları
// Aynı gruptaki branşlar birbirinin eşdeğeridir
const BRANS_ALIAS_GROUPS: string[][] = [
  // Kadın Doğum varyasyonları
  ['kadın hastalıkları ve doğum', 'kadın doğum', 'kadın hastalıkları doğum', 'jinekoloji', 'jinekoloji ve obstetrik', 'obstetrik'],
  // Çocuk Sağlığı
  ['çocuk sağlığı ve hastalıkları', 'çocuk hastalıkları', 'pediatri', 'çocuk'],
  // Genel Cerrahi
  ['genel cerrahi', 'cerrahi'],
  // KBB
  ['kulak burun boğaz hastalıkları', 'kulak burun boğaz', 'kbb'],
  // Göz
  ['göz hastalıkları', 'göz'],
  // Ortopedi
  ['ortopedi ve travmatoloji', 'ortopedi', 'travmatoloji'],
  // İç Hastalıkları
  ['iç hastalıkları', 'dahiliye'],
  // Anestezi
  ['anesteziyoloji ve reanimasyon', 'anesteziyoloji', 'anestezi', 'reanimasyon'],
  // Göğüs Hastalıkları
  ['göğüs hastalıkları', 'göğüs'],
  // Göğüs Cerrahisi
  ['göğüs cerrahisi'],
  // Deri
  ['deri ve zührevi hastalıkları', 'deri hastalıkları', 'dermatoloji', 'cildiye'],
  // Nöroloji
  ['nöroloji', 'sinir hastalıkları'],
  // Beyin Cerrahisi
  ['beyin ve sinir cerrahisi', 'beyin cerrahisi', 'nöroşirürji'],
  // Kalp ve Damar Cerrahisi
  ['kalp ve damar cerrahisi', 'kalp damar cerrahisi', 'kardiyovasküler cerrahi'],
  // Kardiyoloji
  ['kardiyoloji', 'kalp hastalıkları'],
  // Üroloji
  ['üroloji', 'çocuk ürolojisi'],
  // FTR
  ['fiziksel tıp ve rehabilitasyon', 'fizik tedavi ve rehabilitasyon', 'fizik tedavi', 'ftr', 'rehabilitasyon'],
  // Ruh Sağlığı
  ['ruh sağlığı ve hastalıkları', 'psikiyatri', 'ruh sağlığı'],
  // Çocuk Ruh Sağlığı
  ['çocuk ve ergen ruh sağlığı ve hastalıkları', 'çocuk psikiyatrisi', 'çocuk ruh sağlığı'],
  // Plastik Cerrahi
  ['plastik, rekonstrüktif ve estetik cerrahi', 'plastik cerrahi', 'plastik rekonstrüktif cerrahi', 'estetik cerrahi'],
  // Enfeksiyon
  ['enfeksiyon hastalıkları ve klinik mikrobiyoloji', 'enfeksiyon hastalıkları', 'enfeksiyon'],
  // Acil
  ['acil tıp', 'acil'],
  // Aile Hekimliği
  ['aile hekimliği', 'aile hekimi', 'pratisyen'],
  // Radyoloji
  ['radyoloji', 'tıbbi görüntüleme'],
  // Nükleer Tıp
  ['nükleer tıp'],
  // Patoloji
  ['patoloji', 'tıbbi patoloji'],
  // Endokrinoloji
  ['endokrinoloji ve metabolizma hastalıkları', 'endokrinoloji', 'metabolizma'],
  // Gastroenteroloji
  ['gastroenteroloji', 'gastroenteroloji cerrahisi'],
  // Nefroloji
  ['nefroloji', 'böbrek hastalıkları'],
  // Hematoloji
  ['hematoloji', 'kan hastalıkları'],
  // Onkoloji
  ['tıbbi onkoloji', 'onkoloji'],
  // Romatoloji
  ['romatoloji'],
  // Perinatoloji
  ['perinatoloji', 'yüksek riskli gebelik'],
  // Jinekolojik Onkoloji
  ['jinekolojik onkoloji cerrahisi', 'jinekolojik onkoloji'],
  // Çocuk Cerrahisi
  ['çocuk cerrahisi'],
  // Spor Hekimliği
  ['spor hekimliği'],
  // Ağız Diş
  ['ağız, diş ve çene cerrahisi', 'ağız diş ve çene cerrahisi', 'diş hekimliği', 'diş'],
];

// Normalize: alias map oluştur (key: normalized alias → value: tüm gruptaki isimler)
const _bransAliasMap = new Map<string, Set<string>>();
for (const group of BRANS_ALIAS_GROUPS) {
  const normalized = group.map(g => turkishLower(g.trim()));
  const aliasSet = new Set(normalized);
  for (const alias of normalized) {
    _bransAliasMap.set(alias, aliasSet);
  }
}

/**
 * İki branş isminin eşleşip eşleşmediğini kontrol eder.
 * 1. Tam eşleşme (turkishLower)
 * 2. Alias grupları arasında eşleşme
 * 3. Token bazlı kısmi eşleşme (en az %60 token örtüşmesi)
 * 4. includes bazlı eşleşme (birisi diğerini içeriyor)
 */
function branslarEslesiyor(hekim: string, kural: string): boolean {
  const h = turkishLower(hekim.trim());
  const k = turkishLower(kural.trim());

  // 1. Tam eşleşme
  if (h === k) return true;

  // 2. Alias grubunda eşleşme
  const hGroup = _bransAliasMap.get(h);
  if (hGroup && hGroup.has(k)) return true;

  // Ayrıca alias grubundaki herhangi bir elemana includes ile bakalım
  if (hGroup) {
    for (const alias of hGroup) {
      if (alias.includes(k) || k.includes(alias)) return true;
    }
  }
  const kGroup = _bransAliasMap.get(k);
  if (kGroup) {
    for (const alias of kGroup) {
      if (alias.includes(h) || h.includes(alias)) return true;
    }
  }

  // 3. includes bazlı eşleşme
  if (h.includes(k) || k.includes(h)) return true;

  // 4. Token bazlı kısmi eşleşme
  const stopWords = new Set(['ve', 'ile', 'veya', 'için', 'olan', 'bir']);
  const hTokens = h.split(/[\s,;()]+/).filter(t => t.length > 1 && !stopWords.has(t));
  const kTokens = k.split(/[\s,;()]+/).filter(t => t.length > 1 && !stopWords.has(t));

  if (hTokens.length === 0 || kTokens.length === 0) return false;

  // Anahtar kelime örtüşmesi
  const matchCount = kTokens.filter(kt => hTokens.some(ht => ht.includes(kt) || kt.includes(ht))).length;
  const matchRatio = matchCount / kTokens.length;

  // %60 ve üzeri örtüşme → eşleşme
  if (matchRatio >= 0.6) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════
// TEK SATIR ANALİZİ
// ═══════════════════════════════════════════════════════════════
function analyzeRow(
  row: IslemSatiriLike,
  rowIndex: number,
  rulesMaster: Map<string, RuleMasterEntry>,
  kurumBasamak: number,
  sameSessionRows: IslemSatiriLike[]
): ComplianceResult {
  const normalizedKodu = row.gilKodu.trim();
  const entry = rulesMaster.get(normalizedKodu);

  // Eşleşme yoksa
  if (!entry) {
    return {
      satirIndex: rowIndex,
      uygunluk_durumu: 'MANUEL_INCELEME',
      eslesme_guveni: 'Düşük',
      ihlaller: [],
      eslesmeDurumu: 'ESLESEMEDI',
    };
  }

  const ihlaller: IhlalDetay[] = [];

  for (const rule of entry.parsed_rules) {
    switch (rule.type) {
      case 'BASAMAK_KISITI': {
        const allowed = rule.params.basamaklar as number[];
        if (allowed && !allowed.includes(kurumBasamak)) {
          ihlaller.push({
            ihlal_kodu: 'BASAMAK_001',
            ihlal_aciklamasi: `Bu işlem yalnızca ${allowed.join('. ve ')}. basamak hastanelerde yapılabilir. Kurum basamağı: ${kurumBasamak}`,
            kaynak: entry.kaynak,
            referans_kural_metni: rule.rawText,
            kural_tipi: 'BASAMAK_KISITI',
          });
        }
        break;
      }

      case 'BRANS_KISITI': {
        const allowed = rule.params.branslar as string[];
        if (allowed && allowed.length > 0) {
          const match = allowed.some(b => branslarEslesiyor(row.uzmanlik, b));
          if (!match) {
            // Branş isimlerini başharfleri büyük göster
            const formattedBranslar = allowed.map(b =>
              b.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            );
            ihlaller.push({
              ihlal_kodu: 'BRANS_002',
              ihlal_aciklamasi: `Bu işlem şu branşlara kısıtlıdır: ${formattedBranslar.join(', ')}. Hekim branşı: ${row.uzmanlik}`,
              kaynak: entry.kaynak,
              referans_kural_metni: rule.rawText,
              kural_tipi: 'BRANS_KISITI',
            });
          }
        }
        break;
      }

      case 'BIRLIKTE_YAPILAMAZ': {
        const yasakliKodlar = rule.params.yapilamazKodlari as string[];
        if (yasakliKodlar && yasakliKodlar.length > 0) {
          const conflicting = sameSessionRows.filter(r =>
            r !== row && yasakliKodlar.includes(r.gilKodu.trim())
          );
          if (conflicting.length > 0) {
            ihlaller.push({
              ihlal_kodu: 'BIRLIKTE_003',
              ihlal_aciklamasi: `Bu işlem şu kodlarla birlikte faturalandırılamaz: ${conflicting.map(c => c.gilKodu).join(', ')}`,
              kaynak: entry.kaynak,
              referans_kural_metni: rule.rawText,
              kural_tipi: 'BIRLIKTE_YAPILAMAZ',
            });
          }
        }
        break;
      }

      case 'SIKLIK_LIMIT': {
        // Bu kural post-processing'de kontrol edilecek
        // Burada sadece bilgi olarak ekleniyor
        break;
      }

      case 'TANI_KOSULU': {
        // İşlem verilerinde tanı kodu yok → Manuel inceleme
        ihlaller.push({
          ihlal_kodu: 'TANI_004',
          ihlal_aciklamasi: `Bu işlem belirli tanı kodu gerektirir: ${(rule.params.taniKodlari as string[] || []).join(', ')}. Tanı bilgisi mevcut değil.`,
          kaynak: entry.kaynak,
          referans_kural_metni: rule.rawText,
          kural_tipi: 'TANI_KOSULU',
        });
        break;
      }

      case 'DIS_TEDAVI': {
        // Diş tedavi kuralları — bilgilendirme
        if (row.disNumarasi === '' && turkishLower(row.uzmanlik).includes('diş')) {
          ihlaller.push({
            ihlal_kodu: 'DIS_005',
            ihlal_aciklamasi: `Diş tedavi kuralı mevcut ancak diş numarası boş.`,
            kaynak: entry.kaynak,
            referans_kural_metni: rule.rawText,
            kural_tipi: 'DIS_TEDAVI',
          });
        }
        break;
      }

      case 'GENEL_ACIKLAMA': {
        // Bilgilendirme — ihlal oluşturmaz
        break;
      }
    }
  }

  // Puan/fiyat farkı
  const puanFarki = entry.islem_puani > 0 ? Math.round((row.puan - entry.islem_puani) * 100) / 100 : undefined;
  const fiyatFarki = entry.islem_fiyati > 0 ? Math.round((row.fiyat - entry.islem_fiyati) * 100) / 100 : undefined;

  // Sonuç belirleme
  let uygunluk: UygunlukDurumu;
  if (ihlaller.length === 0) {
    uygunluk = 'UYGUN';
  } else if (ihlaller.some(i => ['BASAMAK_KISITI', 'BIRLIKTE_YAPILAMAZ', 'BRANS_KISITI'].includes(i.kural_tipi))) {
    uygunluk = 'UYGUNSUZ';
  } else {
    uygunluk = 'MANUEL_INCELEME';
  }

  // Güven seviyesi
  let guven: EslesmeGuveni = 'Yüksek';
  if (entry.parsed_rules.length === 0) guven = 'Orta';
  if (ihlaller.some(i => i.kural_tipi === 'TANI_KOSULU')) guven = 'Orta';

  return {
    satirIndex: rowIndex,
    uygunluk_durumu: uygunluk,
    eslesme_guveni: guven,
    ihlaller,
    eslesen_kural: entry,
    eslesmeDurumu: 'ESLESTI',
    puan_farki: puanFarki,
    fiyat_farki: fiyatFarki,
  };
}

// ═══════════════════════════════════════════════════════════════
// SIKLIK LİMİT POST-PROCESSING
// ═══════════════════════════════════════════════════════════════
function applySiklikLimitChecks(
  rows: IslemSatiriLike[],
  results: ComplianceResult[],
  rulesMaster: Map<string, RuleMasterEntry>
) {
  // hasta+kod bazında gruplama
  const freqMap = new Map<string, number[]>(); // key → satır index'leri

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = `${row.hastaTc}_${row.gilKodu.trim()}`;
    if (!freqMap.has(key)) freqMap.set(key, []);
    freqMap.get(key)!.push(i);
  }

  for (const [key, indices] of freqMap) {
    if (indices.length <= 1) continue;

    const gilKodu = key.split('_').slice(1).join('_');
    const entry = rulesMaster.get(gilKodu);
    if (!entry) continue;

    const siklikRule = entry.parsed_rules.find(r => r.type === 'SIKLIK_LIMIT');
    if (!siklikRule) continue;

    const limit = siklikRule.params.limit as number;
    const periyot = siklikRule.params.periyot as string;

    // Basit kontrol: toplam sayı limiti aşıyor mu?
    if (indices.length > limit) {
      // limit aşan satırları işaretle
      for (let j = limit; j < indices.length; j++) {
        const result = results[indices[j]];
        if (result) {
          result.ihlaller.push({
            ihlal_kodu: 'SIKLIK_006',
            ihlal_aciklamasi: `Bu işlem ${periyot === 'gun' ? 'günde' : periyot === 'ay' ? 'ayda' : periyot === 'yil' ? 'yılda' : 'haftada'} en fazla ${limit} kez yapılabilir. Toplam: ${indices.length}`,
            kaynak: result.eslesen_kural?.kaynak || 'GİL',
            referans_kural_metni: siklikRule.rawText,
            kural_tipi: 'SIKLIK_LIMIT',
          });
          if (result.uygunluk_durumu === 'UYGUN') {
            result.uygunluk_durumu = 'UYGUNSUZ';
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ANA ANALİZ FONKSİYONU (Batch + Progress)
// ═══════════════════════════════════════════════════════════════
export async function runComplianceAnalysis(
  rows: IslemSatiriLike[],
  rulesMaster: Map<string, RuleMasterEntry>,
  kurumBilgisi: KurumBilgisiLike | undefined,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const BATCH_SIZE = 2000;
  const kurumBasamak = kurumBilgisi?.basamak || 2;
  const startTime = Date.now();

  onProgress?.({
    phase: 'analyzing',
    current: 0,
    total: rows.length,
    message: 'Seans grupları oluşturuluyor...'
  });

  // Seans grupları ön-hesaplama (hasta + tarih)
  const sessionMap = new Map<string, IslemSatiriLike[]>();
  for (const row of rows) {
    const key = `${row.hastaTc}_${row.tarih}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(row);
  }

  // Batch processing
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, rows.length);

    for (let j = i; j < batchEnd; j++) {
      const row = rows[j];
      const sessionKey = `${row.hastaTc}_${row.tarih}`;
      const sameSessionRows = sessionMap.get(sessionKey) || [];
      results.push(analyzeRow(row, j, rulesMaster, kurumBasamak, sameSessionRows));
    }

    onProgress?.({
      phase: 'analyzing',
      current: batchEnd,
      total: rows.length,
      message: `${batchEnd.toLocaleString('tr-TR')} / ${rows.length.toLocaleString('tr-TR')} satır analiz ediliyor...`
    });

    // UI thread'e nefes aldır
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Post-processing: Sıklık kontrolü
  onProgress?.({
    phase: 'analyzing',
    current: rows.length,
    total: rows.length,
    message: 'Sıklık limitleri kontrol ediliyor...'
  });

  applySiklikLimitChecks(rows, results, rulesMaster);

  const elapsed = Date.now() - startTime;

  onProgress?.({
    phase: 'complete',
    current: rows.length,
    total: rows.length,
    message: `Analiz tamamlandı (${(elapsed / 1000).toFixed(1)}s)`
  });

  console.log(`[COMPLIANCE ENGINE] ${rows.length} satır analiz edildi, süre: ${elapsed}ms`);

  return results;
}

// ═══════════════════════════════════════════════════════════════
// ÖZET İSTATİSTİK
// ═══════════════════════════════════════════════════════════════
export function generateSummary(results: ComplianceResult[], elapsedMs?: number): ComplianceAnalysisSummary {
  const ihlalDagilimi: Record<ParsedRuleType, number> = {
    BASAMAK_KISITI: 0,
    BRANS_KISITI: 0,
    TANI_KOSULU: 0,
    BIRLIKTE_YAPILAMAZ: 0,
    SIKLIK_LIMIT: 0,
    DIS_TEDAVI: 0,
    GENEL_ACIKLAMA: 0,
  };

  let uygun = 0, uygunsuz = 0, manuel = 0, eslesen = 0, eslesmeyen = 0, toplamIhlal = 0;

  for (const r of results) {
    if (r.uygunluk_durumu === 'UYGUN') uygun++;
    else if (r.uygunluk_durumu === 'UYGUNSUZ') uygunsuz++;
    else manuel++;

    if (r.eslesmeDurumu === 'ESLESTI') eslesen++;
    else eslesmeyen++;

    toplamIhlal += r.ihlaller.length;
    for (const i of r.ihlaller) {
      ihlalDagilimi[i.kural_tipi] = (ihlalDagilimi[i.kural_tipi] || 0) + 1;
    }
  }

  return {
    toplamAnaliz: results.length,
    uygunSayisi: uygun,
    uygunsuzSayisi: uygunsuz,
    manuelIncelemeSayisi: manuel,
    eslesenSayisi: eslesen,
    eslesemeyenSayisi: eslesmeyen,
    toplamIhlalSayisi: toplamIhlal,
    ihlalDagilimi,
    analizSuresiMs: elapsedMs || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════
export function exportResultsToExcel(
  rows: IslemSatiriLike[],
  results: ComplianceResult[]
): ArrayBuffer {
  const exportData: any[][] = [];

  // Header
  exportData.push([
    'Tarih', 'Saat', 'Uzmanlık', 'Doktor', 'Dr.Tipi',
    'GİL Kodu', 'GİL Adı', 'Miktar', 'Puan', 'Toplam Puan',
    'Fiyat', 'Tutar', 'Hasta TC', 'Adı Soyadı', 'İşlem No', 'Diş No',
    '— Uygunluk Durumu', '— Eşleşme', '— Güven', '— İhlal Sayısı',
    '— İhlal Açıklaması', '— Kaynak', '— Referans Kural', '— Puan Farkı', '— Fiyat Farkı'
  ]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = results[i];
    if (!result) continue;

    const ihlalAciklama = result.ihlaller.map(ih => `[${ih.ihlal_kodu}] ${ih.ihlal_aciklamasi}`).join(' | ');
    const kaynak = result.eslesen_kural?.kaynak || '';
    const refKural = result.ihlaller.map(ih => ih.referans_kural_metni).join(' | ');

    exportData.push([
      row.tarih, row.saat, row.uzmanlik, row.doktor, row.drTipi,
      row.gilKodu, row.gilAdi, row.miktar, row.puan, row.toplamPuan,
      row.fiyat, row.tutar, row.hastaTc, row.adiSoyadi, row.islemNo, row.disNumarasi,
      result.uygunluk_durumu, result.eslesmeDurumu, result.eslesme_guveni, result.ihlaller.length,
      ihlalAciklama, kaynak, refKural,
      result.puan_farki ?? '', result.fiyat_farki ?? ''
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Uygunluk Analizi');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
