// ═══════════════════════════════════════════════════════════════
// Kural Çıkarma ve RULES_MASTER Oluşturma Servisi
// ═══════════════════════════════════════════════════════════════

import {
  ParsedRule,
  ParsedRuleType,
  RuleMasterEntry,
  RuleKaynak,
  SutMaddesi,
} from '../types/complianceTypes';
import { ExcelData } from '../../components/EkListeTanimlama';
import { GilExcelData } from '../../components/GilModule';

// ── Türkçe güvenli lowercase ──
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

// ── Sayıdan basamak oku ──
function wordToBasamak(word: string): number | null {
  const lower = turkishLower(word.trim());
  if (lower.includes('birinci') || lower === '1') return 1;
  if (lower.includes('ikinci') || lower === '2') return 2;
  if (lower.includes('üçüncü') || lower.includes('ucuncu') || lower === '3') return 3;
  return null;
}

// Artık rawText olarak açıklamanın tamamı kullanılıyor
// extractFullSentence kaldırıldı — mevzuat açıklamaları zaten tam referans metnidir

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON: Açıklama metninden kuralları çıkar
// ═══════════════════════════════════════════════════════════════
export function extractRulesFromAciklama(aciklama: string): ParsedRule[] {
  if (!aciklama || aciklama.trim().length === 0) return [];

  const rules: ParsedRule[] = [];
  const text = aciklama; // Orijinal metin (rawText için)
  const lower = turkishLower(aciklama);

  // ── 1. BASAMAK_KISITI ──
  extractBasamakRules(lower, text, rules);

  // ── 2. BRANS_KISITI ──
  extractBransRules(lower, text, rules);

  // ── 3. BIRLIKTE_YAPILAMAZ ──
  extractBirlikteYapilamazRules(lower, text, rules);

  // ── 4. SIKLIK_LIMIT ──
  extractSiklikRules(lower, text, rules);

  // ── 5. TANI_KOSULU ──
  extractTaniRules(aciklama, text, rules);

  // ── 6. DIS_TEDAVI ──
  extractDisRules(lower, text, rules);

  return rules;
}

// ── BASAMAK KISITI Çıkarma ──
function extractBasamakRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns: { regex: RegExp; extractor: (m: RegExpMatchArray) => number[] }[] = [
    // "yalnızca 3. basamak" / "sadece 3. basamak"
    {
      regex: /(?:yalnızca|yalnizca|sadece)\s+(\d)\.\s*basamak/gi,
      extractor: (m) => [parseInt(m[1])]
    },
    // "3. basamak sağlık hizmeti sunucuları"
    {
      regex: /(\d)\.\s*basamak\s+sağlık/gi,
      extractor: (m) => [parseInt(m[1])]
    },
    // "2. ve 3. basamak"
    {
      regex: /(\d)\.\s*ve\s+(\d)\.\s*basamak/gi,
      extractor: (m) => [parseInt(m[1]), parseInt(m[2])]
    },
    // "üçüncü basamak"
    {
      regex: /üçüncü\s+basamak/gi,
      extractor: () => [3]
    },
    // "ikinci basamak"
    {
      regex: /ikinci\s+basamak/gi,
      extractor: () => [2]
    },
    // "ikinci ve üçüncü basamak"
    {
      regex: /ikinci\s+ve\s+üçüncü\s+basamak/gi,
      extractor: () => [2, 3]
    },
  ];

  for (const { regex, extractor } of patterns) {
    const r = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const basamaklar = extractor(match);
      if (basamaklar.length > 0) {
        rules.push({
          type: 'BASAMAK_KISITI',
          rawText: rawText.trim(),
          params: { basamaklar }
        });
        return; // Bir basamak kuralı yeterli
      }
    }
  }
}

// ── BRANŞ KISITI Çıkarma ──
function extractBransRules(lower: string, rawText: string, rules: ParsedRule[]) {
  // Daha geniş yakalama pattern'leri
  const patterns = [
    // "sadece/yalnızca ... uzmanları/hekimleri/tarafından"
    /(?:yalnızca|yalnizca|sadece)\s+(.+?)\s+(?:uzmanları|uzmanlari|uzmanlarınca|uzmanlarinca|hekimleri|hekimlerince|tarafından|tarafindan|branşı|bransi)/gi,
    // "... uzmanı olmak üzere ..."
    /(?:uzmanı|uzmani)\s+olmak\s+üzere\s+(.+?)(?:\s+uzmanları|\s+uzmanlari|\s+hekimleri|\s+tarafından|\s+tarafindan|\.)/gi,
    // "branş kısıtlaması: ..."
    /branş\s*kısıtlaması\s*[:;]\s*(.+?)(?:\.|$)/gi,
    // "... cerrahisi ve/veya ... tarafından yapılır/faturalandırılır"
    /(.+?(?:cerrahisi|cerrahı|uzmanı|uzmani|hekimi|hekimliği)(?:\s+(?:ve\/veya|ve|veya)\s+.+?)*)\s+(?:tarafından|tarafindan)\s+(?:yapılır|yapilir|faturalandırılır|faturalandirilir)/gi,
  ];

  for (const pattern of patterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const captured = match[1] || '';
      if (captured.length > 2) {
        // "ve/veya", "ve", "veya", virgül, noktalı virgülle ayır
        const branslar = captured
          .split(/[,;]|\s+ve\/veya\s+|\s+veya\s+|\s+ve\s+/)
          .map(b => b.trim())
          // Gereksiz sözcükleri temizle (başındaki/sonundaki uzmanı, hekimi vs.)
          .map(b => b
            .replace(/\s*(uzmanı|uzmani|uzmanları|uzmanlari|hekimi|hekimleri|cerrahı|cerrahisi)\s*$/gi, '')
            .replace(/^\s*(biri?|birisi)\s+/gi, '')
            .trim()
          )
          .filter(b => b.length > 2);

        if (branslar.length > 0) {
          rules.push({
            type: 'BRANS_KISITI',
            rawText: rawText.trim(),
            params: { branslar }
          });
          return;
        }
      }
    }
  }

  // Fallback: Metin içinde bilinen branş isimlerini doğrudan ara
  // (Eğer yukarıdaki pattern'ler yakalamazsa)
  if (lower.includes('branş') || lower.includes('uzman') || lower.includes('hekim')) {
    const bilinen = [
      'çocuk cerrahisi', 'çocuk üroloji', 'kadın doğum', 'kadın hastalıkları',
      'plastik cerrahi', 'çocuk endokrinoloji', 'genel cerrahi', 'ortopedi',
      'göz hastalıkları', 'kulak burun boğaz', 'nöroloji', 'beyin cerrahisi',
      'üroloji', 'kalp damar cerrahisi', 'göğüs cerrahisi', 'gastroenteroloji',
      'kardiyoloji', 'dermatoloji', 'fizik tedavi', 'anesteziyoloji',
      'enfeksiyon hastalıkları', 'endokrinoloji', 'nefroloji', 'hematoloji',
      'romatoloji', 'onkoloji', 'radyoloji', 'nükleer tıp', 'acil tıp',
      'perinatoloji', 'jinekolojik onkoloji', 'ağız diş',
    ];

    const bulunan: string[] = [];
    for (const brans of bilinen) {
      if (lower.includes(brans)) {
        bulunan.push(brans);
      }
    }

    if (bulunan.length > 0) {
      rules.push({
        type: 'BRANS_KISITI',
        rawText: rawText.trim(),
        params: { branslar: bulunan }
      });
    }
  }
}

// ── BİRLİKTE YAPILAMAZ Çıkarma ──
function extractBirlikteYapilamazRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns = [
    /birlikte\s+(?:faturalandırılamaz|faturalandirilama|kodlanamaz|ödenmez|odenmez)/gi,
    /aynı\s+seansta\s+(?:birlikte\s+)?(?:faturalandırılamaz|faturalandirilama|kodlanamaz|ödenmez)/gi,
    /ile\s+birlikte\s+(?:faturalandırılamaz|faturalandirilama|kodlanamaz|ödenmez)/gi,
    /birlikte\s+(?:fatura\s+edilemez|fatura\s+edilmez)/gi,
  ];

  for (const pattern of patterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      // Yakın çevreden işlem kodları çıkar
      const context = lower.substring(
        Math.max(0, match.index - 100),
        Math.min(lower.length, match.index + match[0].length + 100)
      );
      const codeMatches = context.match(/\b(\d{5,7})\b/g) || [];
      const yapilamazKodlari = [...new Set(codeMatches)];

      rules.push({
        type: 'BIRLIKTE_YAPILAMAZ',
        rawText: rawText.trim(),
        params: { yapilamazKodlari }
      });
      return;
    }
  }
}

// ── SIKLIK LİMİT Çıkarma ──
function extractSiklikRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns: { regex: RegExp; periyot: string; limitGroup: number }[] = [
    { regex: /günde\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'gun', limitGroup: 1 },
    { regex: /gunde\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'gun', limitGroup: 1 },
    { regex: /yılda\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'yil', limitGroup: 1 },
    { regex: /yilda\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'yil', limitGroup: 1 },
    { regex: /ayda\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'ay', limitGroup: 1 },
    { regex: /haftada\s+en\s+fazla\s+(\d+)\s+kez/gi, periyot: 'hafta', limitGroup: 1 },
    { regex: /haftada\s+(\d+)\s+kez/gi, periyot: 'hafta', limitGroup: 1 },
    { regex: /(\d+)\s+günde\s+bir/gi, periyot: 'gun', limitGroup: 1 },
    { regex: /(\d+)\s+gunde\s+bir/gi, periyot: 'gun', limitGroup: 1 },
    { regex: /(\d+)\s+ayda\s+bir/gi, periyot: 'ay', limitGroup: 1 },
  ];

  for (const { regex, periyot, limitGroup } of patterns) {
    const r = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const limit = parseInt(match[limitGroup]);
      if (!isNaN(limit) && limit > 0) {
        rules.push({
          type: 'SIKLIK_LIMIT',
          rawText: rawText.trim(),
          params: { periyot, limit }
        });
        return;
      }
    }
  }
}

// ── TANI KOŞULU Çıkarma ──
function extractTaniRules(original: string, rawText: string, rules: ParsedRule[]) {
  // ICD-10 kod formatı: harf + 2 rakam + opsiyonel nokta + rakamlar
  const icdPattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
  const taniBaglam = /(?:tanı|tani|icd|teşhis|teshis)/i;

  if (taniBaglam.test(original)) {
    const kodlar: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = icdPattern.exec(original)) !== null) {
      kodlar.push(m[1]);
    }
    if (kodlar.length > 0) {
      rules.push({
        type: 'TANI_KOSULU',
        rawText: rawText.trim(),
        params: { taniKodlari: [...new Set(kodlar)] }
      });
    }
  }
}

// ── DİŞ TEDAVİ Çıkarma ──
function extractDisRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns = [
    /diş\s+(?:tedavisi|numarası|numarasi|hekimliği|hekimligi)/gi,
    /dis\s+(?:tedavisi|numarasi|hekimligi)/gi,
    /her\s+bir\s+diş\s+için/gi,
    /her\s+bir\s+dis\s+icin/gi,
    /diş\s+başına/gi,
    /dis\s+basina/gi,
  ];

  for (const pattern of patterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    if (r.test(lower)) {
      rules.push({
        type: 'DIS_TEDAVI',
        rawText: rawText.trim(),
        params: { disKurali: rawText.trim() }
      });
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// RULES_MASTER Oluştur
// ═══════════════════════════════════════════════════════════════
export interface BuildRulesMasterResult {
  rulesMaster: Map<string, RuleMasterEntry>;
  stats: {
    ek2b: number;
    ek2c: number;
    ek2cd: number;
    gil: number;
    sut: number;
    total: number;
    withRules: number;
  };
}

/**
 * SUT madde referansı index'i oluştur (maddeNo → SutMaddesi)
 */
function buildSutIndex(sutMaddeleri: SutMaddesi[]): Map<string, SutMaddesi> {
  const index = new Map<string, SutMaddesi>();
  for (const madde of sutMaddeleri) {
    index.set(madde.maddeNo, madde);
    // Nokta olmadan da arama yapılabilmesi için (ör: "2.4.4.D-1" → "2.4.4.D-1")
    // Alt varyasyonlar: "2.4.4.D" gibi üst madde de eşleşmeli
    const parts = madde.maddeNo.split('.');
    // Üst madde referansları da ekle (çakışma yoksa)
    for (let i = 2; i < parts.length; i++) {
      const parentKey = parts.slice(0, i).join('.');
      if (!index.has(parentKey)) {
        index.set(parentKey, madde);
      }
    }
  }
  return index;
}

/**
 * Açıklama metnindeki SUT madde referanslarını bul ve ilgili SUT maddelerini ParsedRule olarak döndür
 * Ör: "SUT'un 2.4.4.D maddesi", "SUT 2.4.4.D-1", "SUT'un ilgili maddeleri" vb.
 */
function extractSutReferences(aciklama: string, sutIndex: Map<string, SutMaddesi>): ParsedRule[] {
  if (!aciklama || sutIndex.size === 0) return [];

  const rules: ParsedRule[] = [];
  const lower = turkishLower(aciklama);

  // SUT madde numarası referansı pattern'leri
  // "SUT'un 2.4.4.D maddesi", "SUT 2.4.4.D-1", "(SUT-2.4.4.D)", "SUT madde 2.4.4" vb.
  const sutRefPatterns = [
    /sut[''`]?\s*(?:un|ün|'un|'ün)?\s*(\d+\.\d+(?:\.\d+)*(?:\.[a-zçğıöşü](?:-\d+)?)?)\s*(?:madde|nolu|numaralı|sayılı|.?nci|.?ncı|.?üncü|.?uncu)?/gi,
    /sut\s*[-–]\s*(\d+\.\d+(?:\.\d+)*(?:\.[a-zçğıöşü](?:-\d+)?)?)/gi,
    /(?:madde|md\.?)\s*(\d+\.\d+(?:\.\d+)*(?:\.[a-zçğıöşü](?:-\d+)?)?)/gi,
    /\(sut\s*(\d+\.\d+(?:\.\d+)*(?:\.[a-zçğıöşü](?:-\d+)?)?)\)/gi,
  ];

  const foundMaddeNos = new Set<string>();

  for (const pattern of sutRefPatterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const refNo = match[1].toUpperCase();

      // Index'te bul (büyük/küçük harf varyasyonları)
      const sutMadde = sutIndex.get(refNo) ||
                       sutIndex.get(refNo.toLowerCase()) ||
                       sutIndex.get(match[1]);

      if (sutMadde && !foundMaddeNos.has(sutMadde.maddeNo)) {
        foundMaddeNos.add(sutMadde.maddeNo);
        rules.push({
          type: 'GENEL_ACIKLAMA',
          rawText: `SUT ${sutMadde.maddeNo} - ${sutMadde.baslik}\n${sutMadde.icerik}`,
          params: {
            metin: sutMadde.icerik,
            sutMaddeNo: sutMadde.maddeNo,
            sutBaslik: sutMadde.baslik,
            kaynak: 'SUT' as RuleKaynak,
          }
        });
      }
    }
  }

  return rules;
}

export function buildRulesMaster(
  ek2bData: ExcelData | null,
  ek2cData: ExcelData | null,
  ek2cdData: ExcelData | null,
  gilData: GilExcelData | null,
  sutMaddeleri: SutMaddesi[] = []
): BuildRulesMasterResult {
  const master = new Map<string, RuleMasterEntry>();
  const stats = { ek2b: 0, ek2c: 0, ek2cd: 0, gil: 0, sut: 0, total: 0, withRules: 0 };

  // SUT index oluştur
  const sutIndex = buildSutIndex(sutMaddeleri);

  // ── EK-2B: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMA, İŞLEM PUANI, İŞLEM FİYATI] ──
  if (ek2bData) {
    for (const row of ek2bData.rows) {
      const kodu = String(row[0] || '').trim();
      if (!kodu) continue;

      const puanStr = String(row[3] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const puan = parseFloat(puanStr) || 0;
      const fiyatStr = String(row[4] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const fiyat = parseFloat(fiyatStr) || (puan * 0.593);
      const aciklama = String(row[2] || '').trim();

      const entry: RuleMasterEntry = {
        islem_kodu: kodu,
        islem_adi: String(row[1] || '').trim(),
        kaynak: 'EK-2B',
        islem_puani: puan,
        islem_fiyati: fiyat,
        aciklama_raw: aciklama,
        parsed_rules: extractRulesFromAciklama(aciklama),
      };

      if (!master.has(kodu)) {
        master.set(kodu, entry);
        stats.ek2b++;
      }
    }
  }

  // ── EK-2C: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMA, İŞLEM GRUBU, İŞLEM PUANI, İŞLEM FİYATI] ──
  if (ek2cData) {
    for (const row of ek2cData.rows) {
      const kodu = String(row[0] || '').trim();
      if (!kodu) continue;

      const puanStr = String(row[4] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const puan = parseFloat(puanStr) || 0;
      const fiyatStr = String(row[5] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const fiyat = parseFloat(fiyatStr) || (puan * 0.593);
      const aciklama = String(row[2] || '').trim();

      const entry: RuleMasterEntry = {
        islem_kodu: kodu,
        islem_adi: String(row[1] || '').trim(),
        kaynak: 'EK-2C',
        islem_puani: puan,
        islem_fiyati: fiyat,
        aciklama_raw: aciklama,
        islem_grubu: String(row[3] || '').trim(),
        parsed_rules: extractRulesFromAciklama(aciklama),
      };

      // EK-2C öncelikli (ameliyat kodları)
      master.set(kodu, entry);
      stats.ek2c++;
    }
  }

  // ── EK-2Ç: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMALAR, İŞLEM PUANI, İŞLEM FİYATI] ──
  if (ek2cdData) {
    for (const row of ek2cdData.rows) {
      const kodu = String(row[0] || '').trim();
      if (!kodu) continue;

      const puanStr = String(row[3] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const puan = parseFloat(puanStr) || 0;
      const fiyatStr = String(row[4] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const fiyat = parseFloat(fiyatStr) || (puan * 0.593);
      const aciklama = String(row[2] || '').trim();

      const entry: RuleMasterEntry = {
        islem_kodu: kodu,
        islem_adi: String(row[1] || '').trim(),
        kaynak: 'EK-2Ç',
        islem_puani: puan,
        islem_fiyati: fiyat,
        aciklama_raw: aciklama,
        parsed_rules: extractRulesFromAciklama(aciklama),
      };

      if (!master.has(kodu)) {
        master.set(kodu, entry);
        stats.ek2cd++;
      }
    }
  }

  // ── GİL: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMA, İŞLEM PUANI, AMELİYAT GRUPLARI] ──
  if (gilData) {
    for (const row of gilData.rows) {
      const kodu = String(row[0] || '').trim();
      if (!kodu) continue;

      const puanStr = String(row[3] || '').replace(',', '.').replace(/\s*TL\s*/i, '');
      const puan = parseFloat(puanStr) || 0;
      const fiyat = puan * 0.593;
      const aciklama = String(row[2] || '').trim();

      const existing = master.get(kodu);
      if (existing) {
        // GİL varsa ameliyat grubunu ve GİL puanını ekle, mevcut kuralları koru
        existing.ameliyat_grubu = String(row[4] || '').trim();
        existing.gil_puani = puan;
        existing.gil_fiyati = fiyat;
        // GİL açıklamasından ek kurallar çıkar
        const gilRules = extractRulesFromAciklama(aciklama);
        for (const r of gilRules) {
          // Aynı tip kural yoksa ekle
          if (!existing.parsed_rules.some(er => er.type === r.type)) {
            existing.parsed_rules.push(r);
          }
        }
      } else {
        const entry: RuleMasterEntry = {
          islem_kodu: kodu,
          islem_adi: String(row[1] || '').trim(),
          kaynak: 'GİL',
          islem_puani: puan,
          islem_fiyati: fiyat,
          aciklama_raw: aciklama,
          ameliyat_grubu: String(row[4] || '').trim(),
          gil_puani: puan,
          gil_fiyati: fiyat,
          parsed_rules: extractRulesFromAciklama(aciklama),
        };
        master.set(kodu, entry);
      }
      stats.gil++;
    }
  }

  // ── SUT Referansları: Mevcut kuralların açıklamalarından SUT madde referanslarını bul ──
  if (sutIndex.size > 0) {
    let sutRefCount = 0;
    for (const entry of master.values()) {
      if (entry.aciklama_raw) {
        const sutRules = extractSutReferences(entry.aciklama_raw, sutIndex);
        if (sutRules.length > 0) {
          entry.parsed_rules.push(...sutRules);
          sutRefCount += sutRules.length;
        }
      }
    }
    stats.sut = sutRefCount;
    console.log(`[RULES_MASTER] SUT referansları: ${sutRefCount} madde eşleştirildi (${sutIndex.size} madde index'te)`);
  }

  stats.total = master.size;
  stats.withRules = Array.from(master.values()).filter(e => e.parsed_rules.length > 0).length;

  console.log(`[RULES_MASTER] Toplam: ${stats.total} kural, Açıklamalı: ${stats.withRules}`, stats);

  return { rulesMaster: master, stats };
}
