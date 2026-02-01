// ═══════════════════════════════════════════════════════════════
// Kural Çıkarma ve RULES_MASTER Oluşturma Servisi
// ═══════════════════════════════════════════════════════════════

import {
  ParsedRule,
  ParsedRuleType,
  RuleMasterEntry,
  RuleKaynak,
  SutMaddesi,
  AnalysisProgress,
} from '../types/complianceTypes';
import { ExcelData } from '../../components/EkListeTanimlama';
import { GilExcelData } from '../../components/GilModule';
import { extractRulesWithAI, needsAIExtraction } from './ai/ruleExtractionAI';

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
// NOT: "basamak" kelimesi geçen her ifade kısıt değildir.
// Örnek (KISIT):     "Üçüncü basamak sağlık hizmeti sunucuları tarafından yapılması halinde faturalandırılır."
//                    → 3. basamak gerekli, 2. basamak hastane bunu fatura edemez = BASAMAK_KISITI
// Örnek (KISIT):     "Sadece üçüncü basamak sağlık hizmeti sunucularınca yapılması halinde faturalandırılır."
//                    → Aynı şekilde BASAMAK_KISITI
// Örnek (KISIT DEĞİL): "Üçüncü basamak ... %30 ilave edilir" → puan artışı bilgisi, kısıt değil
function extractBasamakRules(lower: string, rawText: string, rules: ParsedRule[]) {
  // Birden fazla basamak personel/uygulama koşulu anlatılıyorsa → kısıt değil
  // Örn: "ikinci basamak ... Anestezi uzmanı tarafından, üçüncü basamak ... Anestezi uzmanı tarafından"
  // Bu tür metinler her iki basamakta da yapılabileceğini söylüyor, sadece personel şartını belirtiyor
  const multiTierPattern = /(?:ikinci|2\.)\s*basamak.{5,120}(?:üçüncü|3\.)\s*basamak|(?:üçüncü|3\.)\s*basamak.{5,120}(?:ikinci|2\.)\s*basamak/i;
  if (multiTierPattern.test(lower)) {
    // "sadece" / "yalnızca" gibi kesin kısıt belirteci yoksa, bu bir personel şartıdır
    if (!/(?:yalnızca|yalnizca|sadece|yalnız)\s/.test(lower)) {
      return; // Basamak kısıtı oluşturma
    }
  }

  // Önce kısıtlama DEĞİL olan ifadeleri tespit et (puan artışı, ilave vb.)
  // Bu ifadeler varsa ve kısıtlama bağlamı yoksa, basamak kısıtı oluşturma
  const nonRestrictionPatterns = [
    /ilave\s+edilir/gi,
    /puan[ıi]?\s*(?:na|ına|larına)?\s*%\s*\d+/gi,
    /%\s*\d+\s*(?:ilave|artır|arttır)/gi,
    /puan\s*(?:artır|arttır)/gi,
  ];

  // "sadece" / "yalnızca" gibi mod belirleyicileri kontrol et
  function detectMode(matchText: string, ctx: string): string | undefined {
    if (/(?:yalnızca|yalnizca|sadece|yalnız)/.test(ctx)) return 'sadece';
    return undefined;
  }

  const patterns: { regex: RegExp; extractor: (m: RegExpMatchArray) => number[] }[] = [
    // "yalnızca 3. basamak" / "sadece 3. basamak" — kesin kısıt
    {
      regex: /(?:yalnızca|yalnizca|sadece)\s+(\d)\.\s*basamak/gi,
      extractor: (m) => [parseInt(m[1])]
    },
    // "yalnızca/sadece ikinci/üçüncü basamak" — kesin kısıt
    {
      regex: /(?:yalnızca|yalnizca|sadece)\s+(?:ikinci|üçüncü|ucuncu|birinci)/gi,
      extractor: (m) => {
        const txt = turkishLower(m[0]);
        if (txt.includes('birinci')) return [1];
        if (txt.includes('ikinci')) return [2];
        return [3];
      }
    },
    // "2. ve 3. basamak" — çoklu basamak
    {
      regex: /(\d)\.\s*ve\s+(\d)\.\s*basamak/gi,
      extractor: (m) => [parseInt(m[1]), parseInt(m[2])]
    },
    // "X. basamak sağlık hizmeti sunucularında/tarafından yapılır/faturalandırılır"
    // Relaxed: also matches "kuruluş", "kurum", "sunucu" without suffix requirement
    {
      regex: /(\d)\.\s*basamak\s+(?:sağlık|saglik).{0,60}(?:yapılır|yapilir|faturalandırılır|faturalandirilir|faturalandırılmaz|sunucularında|sunucularınca|sunucularinca|kuruluş|kurulus|kurum|sunucu|tarafından|tarafindan)/gi,
      extractor: (m) => [parseInt(m[1])]
    },
    // "üçüncü/ikinci basamak sağlık hizmeti sunucularında faturalandırılır"
    // Relaxed: also matches "kuruluş", "kurum", "sunucu"
    {
      regex: /(?:birinci|ikinci|üçüncü|ucuncu)\s+basamak\s+(?:sağlık|saglik).{0,60}(?:yapılır|yapilir|faturalandırılır|faturalandirilir|faturalandırılmaz|sunucularında|sunucularınca|sunucularinca|kuruluş|kurulus|kurum|sunucu|tarafından|tarafindan)/gi,
      extractor: (m) => {
        const txt = turkishLower(m[0]);
        if (txt.includes('birinci')) return [1];
        if (txt.includes('ikinci')) return [2];
        return [3];
      }
    },
    // "X. basamak ... kuruluşlarında" without "sağlık" in between
    {
      regex: /(\d)\.\s*basamak\s+.{0,40}(?:kuruluşlarında|kuruluslarinda|kurumlarında|kurumlarinda|sunucularında|sunucularinda)/gi,
      extractor: (m) => [parseInt(m[1])]
    },
    // "birinci/ikinci/üçüncü basamak ... kuruluşlarında" without "sağlık"
    {
      regex: /(?:birinci|ikinci|üçüncü|ucuncu)\s+basamak\s+.{0,40}(?:kuruluşlarında|kuruluslarinda|kurumlarında|kurumlarinda|sunucularında|sunucularinda)/gi,
      extractor: (m) => {
        const txt = turkishLower(m[0]);
        if (txt.includes('birinci')) return [1];
        if (txt.includes('ikinci')) return [2];
        return [3];
      }
    },
    // "üçüncü basamak ... uzmanı tarafından" — combined basamak+branş
    {
      regex: /(?:birinci|ikinci|üçüncü|ucuncu)\s+basamak\s+.{0,60}(?:uzmanı|uzmani|uzmanları|uzmanlari|hekimi|hekimleri)\s+(?:tarafından|tarafindan)/gi,
      extractor: (m) => {
        const txt = turkishLower(m[0]);
        if (txt.includes('birinci')) return [1];
        if (txt.includes('ikinci')) return [2];
        return [3];
      }
    },
    // "X. basamak ... uzmanı tarafından"
    {
      regex: /(\d)\.\s*basamak\s+.{0,60}(?:uzmanı|uzmani|uzmanları|uzmanlari|hekimi|hekimleri)\s+(?:tarafından|tarafindan)/gi,
      extractor: (m) => [parseInt(m[1])]
    },
  ];

  for (const { regex, extractor } of patterns) {
    const r = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const basamaklar = extractor(match);
      if (basamaklar.length > 0) {
        // Match çevresinde puan artışı/ilave ifadesi var mı kontrol et
        const contextStart = Math.max(0, match.index - 30);
        const contextEnd = Math.min(lower.length, match.index + match[0].length + 80);
        const context = lower.substring(contextStart, contextEnd);

        const isNonRestriction = nonRestrictionPatterns.some(p =>
          new RegExp(p.source, p.flags).test(context)
        );

        // Eğer bağlam puan artışı/ilave ise, bu bir kısıt değil — atla
        if (isNonRestriction) continue;

        const mode = detectMode(match[0], context);
        const params: Record<string, any> = { basamaklar };
        if (mode) params.mode = mode;

        rules.push({
          type: 'BASAMAK_KISITI',
          rawText: rawText.trim(),
          params
        });
        return; // Bir basamak kuralı yeterli
      }
    }
  }
}

// ── BRANŞ KISITI Çıkarma ──
function extractBransRules(lower: string, rawText: string, rules: ParsedRule[]) {
  // Mode tespiti: dahil mi haric mi?
  function detectBransMode(ctx: string): string | undefined {
    if (/(?:yalnızca|yalnizca|sadece|yalnız)\s/.test(ctx)) return 'sadece';
    if (/(?:hariç|haric|dışında|disinda)/.test(ctx)) return 'haric';
    if (/(?:dahil|de\s+uygulan)/.test(ctx)) return 'dahil';
    return undefined;
  }

  // Daha geniş yakalama pattern'leri
  const patterns = [
    // "sadece/yalnızca ... uzmanları/hekimleri/tarafından"
    /(?:yalnızca|yalnizca|sadece)\s+(.+?)\s+(?:uzmanları|uzmanlari|uzmanlarınca|uzmanlarinca|hekimleri|hekimlerince|tarafından|tarafindan|branşı|bransi)/gi,
    // "... uzmanı olmak üzere ..."
    /(?:uzmanı|uzmani)\s+olmak\s+üzere\s+(.+?)(?:\s+uzmanları|\s+uzmanlari|\s+hekimleri|\s+tarafından|\s+tarafindan|\.)/gi,
    // "branş kısıtlaması: ..."
    /branş\s*kısıtlaması\s*[:;]\s*(.+?)(?:\.|$)/gi,
    // "... cerrahisi ve/veya ... tarafından yapılır/faturalandırılır"
    /(.+?(?:cerrahisi|cerrahı|uzmanı|uzmani|hekimi|hekimliği)(?:\s+(?:ve\/veya|ve|veya)\s+.+?)*)\s+(?:tarafından|tarafindan)\s+(?:yapılır|yapilir|faturalandırılır|faturalandirilir|faturalandırılmaz)/gi,
    // "X uzman hekimlerince de uygulandığında faturalandırılır"
    /(.+?)\s+(?:uzman\s+)?(?:hekimlerince|hekimleri|uzmanlarınca|uzmanlarinca)\s+(?:de\s+)?(?:uygulandığında|uygulandiginda|yapıldığında|yapildiginda)\s+(?:faturalandırılır|faturalandirilir)/gi,
    // "X uzman hekimi tarafından yapılması halinde faturalandırılır"
    /(.+?)\s+(?:uzman\s+)?(?:hekimi|uzmanı|uzmani)\s+(?:tarafından|tarafindan)\s+(?:yapılması|yapilmasi)\s+(?:halinde|durumunda)\s+(?:faturalandırılır|faturalandirilir)/gi,
    // "X hekimlerince de uygulandığında" — shorter form
    /(.+?)\s+hekimlerince\s+de\s+uygulandığında/gi,
    // "X uzmanlarınca yapılır/faturalandırılır" — without "tarafından"
    /(.+?)\s+(?:uzmanlarınca|uzmanlarinca|hekimlerince)\s+(?:yapılır|yapilir|faturalandırılır|faturalandirilir|faturalandırılmaz)/gi,
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
          .filter(b => b.length > 2)
          // Türkçe stop-words ve anlamsız kelimeler branş adı olamaz
          .filter(b => {
            const stopWords = new Set([
              'için', 'icin', 'olan', 'olarak', 'ile', 'bir', 'her', 'bu', 'şu', 'de', 'da',
              'den', 'dan', 'dir', 'dır', 'ise', 'gibi', 'kadar', 'sonra', 'önce', 'once',
              'ancak', 'ama', 'fakat', 'sadece', 'yalnızca', 'yalnizca', 'bizzat', 'ayrıca',
              'ayrica', 'dışında', 'disinda', 'hariç', 'haric', 'dahil', 'tüm', 'tum',
              'tarafından', 'tarafindan', 'halinde', 'durumunda', 'yapılır', 'yapilir',
              'faturalandırılır', 'faturalandirilir', 'puanlandırılır', 'puanlandirilir',
              'uygulanır', 'uygulanir', 'kullanılır', 'kullanilir', 'gerekir', 'gerekmektedir',
              'yapılması', 'yapilmasi', 'bulunmadığında', 'bulunmadiginda',
              'tanımlı', 'tanimli', 'günlük', 'gunluk', 'hasta', 'başı', 'basi',
            ]);
            return !stopWords.has(turkishLower(b));
          });

        if (branslar.length > 0) {
          const contextStart = Math.max(0, match.index - 40);
          const contextEnd = Math.min(lower.length, match.index + match[0].length + 40);
          const ctx = lower.substring(contextStart, contextEnd);
          const mode = detectBransMode(ctx);
          const params: Record<string, any> = { branslar };
          if (mode) params.mode = mode;

          rules.push({
            type: 'BRANS_KISITI',
            rawText: rawText.trim(),
            params
          });
          return;
        }
      }
    }
  }

  // Fallback: Metin içinde bilinen branş isimlerini doğrudan ara
  // (Eğer yukarıdaki pattern'ler yakalamazsa)
  if (lower.includes('branş') || lower.includes('uzman') || lower.includes('hekim')
      || lower.includes('hekimlerince') || lower.includes('cerrah')) {
    const bilinen = [
      'çocuk cerrahisi', 'çocuk üroloji', 'kadın doğum', 'kadın hastalıkları',
      'plastik cerrahi', 'çocuk endokrinoloji', 'genel cerrahi', 'ortopedi',
      'göz hastalıkları', 'kulak burun boğaz', 'nöroloji', 'beyin cerrahisi',
      'üroloji', 'kalp damar cerrahisi', 'göğüs cerrahisi', 'gastroenteroloji',
      'kardiyoloji', 'dermatoloji', 'fizik tedavi', 'anesteziyoloji',
      'enfeksiyon hastalıkları', 'endokrinoloji', 'nefroloji', 'hematoloji',
      'romatoloji', 'onkoloji', 'radyoloji', 'nükleer tıp', 'acil tıp',
      'perinatoloji', 'jinekolojik onkoloji', 'ağız diş',
      // Yeni eklenen branşlar (AI audit bulguları)
      'spor hekimliği', 'tıbbi ekoloji', 'hidroklimatoloji', 'geriatri',
      'allerji', 'immünoloji', 'ruh sağlığı', 'çocuk nöroloji', 'çocuk acil',
      'anestezi', 'algoloji', 'yoğun bakım', 'palyatif bakım',
      'tıbbi genetik', 'çocuk hematoloji', 'çocuk onkoloji',
      'çocuk gastroenteroloji', 'çocuk nefroloji', 'çocuk kardiyoloji',
      'çocuk endokrin', 'çocuk enfeksiyon', 'çocuk romatoloji',
      'çocuk göğüs', 'çocuk allerji', 'çocuk immünoloji',
    ];

    const bulunan: string[] = [];
    for (const brans of bilinen) {
      if (lower.includes(brans)) {
        bulunan.push(brans);
      }
    }

    if (bulunan.length > 0) {
      const mode = detectBransMode(lower);
      const params: Record<string, any> = { branslar: bulunan };
      if (mode) params.mode = mode;

      rules.push({
        type: 'BRANS_KISITI',
        rawText: rawText.trim(),
        params
      });
    }
  }
}

// ── BİRLİKTE YAPILAMAZ Çıkarma ──
function extractBirlikteYapilamazRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns = [
    // Orijinal pattern'ler (ılamaz formu)
    /birlikte\s+(?:faturalandırılamaz|faturalandirilama[z]?|kodlanamaz|ödenmez|odenmez)/gi,
    /aynı\s+seansta\s+(?:birlikte\s+)?(?:faturalandırılamaz|faturalandirilama[z]?|faturalandırılmaz|faturalandirilmaz|kodlanamaz|ödenmez)/gi,
    /ile\s+birlikte\s+(?:faturalandırılamaz|faturalandirilama[z]?|faturalandırılmaz|faturalandirilmaz|kodlanamaz|ödenmez)/gi,
    /birlikte\s+(?:fatura\s+edilemez|fatura\s+edilmez)/gi,

    // === YENİ: "birlikte faturalandırılmaz" — #1 miss (1069 cases) ===
    /birlikte\s+faturalandırılmaz/gi,
    /birlikte\s+faturalandirilmaz/gi,

    // === YENİ: "ile faturalandırılmaz" without "birlikte" ===
    /ile\s+faturalandırılmaz/gi,
    /ile\s+faturalandirilmaz/gi,
    /ile\s+faturalandırılamaz/gi,

    // === YENİ: "beraber faturalandırılmaz/faturalandırılamaz" ===
    /beraber\s+(?:faturalandırılmaz|faturalandirilmaz|faturalandırılamaz|faturalandirilama[z]?|kodlanamaz|ödenmez)/gi,

    // === YENİ: "birlikte puanlandırılmaz/puanlandırılamaz" ===
    /birlikte\s+(?:puanlandırılmaz|puanlandirilmaz|puanlandırılamaz|puanlandirilama[z]?)/gi,

    // === YENİ: "beraber puanlandırılmaz" ===
    /beraber\s+(?:puanlandırılmaz|puanlandirilmaz|puanlandırılamaz|puanlandirilama[z]?)/gi,

    // "aynı seansta ... faturalandırılmaz" (broader)
    /aynı\s+seansta\s+.{0,30}(?:faturalandırılmaz|faturalandirilmaz)/gi,

    // "birlikte ödenmez/kodlanmaz"
    /birlikte\s+(?:kodlanmaz|ödenmez|odenmez)/gi,
  ];

  for (const pattern of patterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      // Yakın çevreden işlem kodları çıkar — genişletilmiş arama alanı
      const context = lower.substring(
        Math.max(0, match.index - 200),
        Math.min(lower.length, match.index + match[0].length + 200)
      );
      // Genişletilmiş kod pattern'leri: standart 5-7 haneli kodlar + R/L prefix + noktalı kodlar
      const codeMatches = context.match(/\b(?:[rl]?\d{5,7}|\d{3}\.\d{3})\b/gi) || [];
      const yapilamazKodlari = [...new Set(
        codeMatches.map(c => c.toUpperCase())
      )];

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

/** Türkçe sayı kelimesini sayıya çevirir */
function turkishWordToNumber(word: string): number | null {
  const lower = turkishLower(word.trim());
  const map: Record<string, number> = {
    'bir': 1, 'iki': 2, 'üç': 3, 'uc': 3, 'dört': 4, 'dort': 4,
    'beş': 5, 'bes': 5, 'altı': 6, 'alti': 6, 'yedi': 7,
    'sekiz': 8, 'dokuz': 9, 'on': 10, 'yirmi': 20, 'otuz': 30, 'kırk': 40, 'kirk': 40, 'elli': 50,
  };
  return map[lower] ?? null;
}

/** Sayı veya Türkçe sayı kelimesi yakalayıp sayıya çevirir */
function parseNumberOrWord(str: string): number | null {
  const trimmed = str.trim();
  const num = parseInt(trimmed);
  if (!isNaN(num) && num > 0) return num;
  return turkishWordToNumber(trimmed);
}

// Sayı veya Türkçe sayı kelimesi regex parçası
const NUM_OR_WORD = '(?:\\d+|bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|kirk|elli)';

function extractSiklikRules(lower: string, rawText: string, rules: ParsedRule[]) {
  // "kez", "adet", "defa" hepsi sayılır
  const COUNT_UNIT = '(?:kez|adet|defa|kere|sefer)';

  const patterns: { regex: RegExp; periyot: string; limitGroup: number }[] = [
    // === GÜNDE / GÜNLÜK ===
    // "günde en fazla X kez/adet/defa"
    { regex: new RegExp(`günde\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`gunde\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'gun', limitGroup: 1 },
    // "günde X adet/kez/defa faturalandırılır"
    { regex: new RegExp(`günde\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir|faturalandırılmaz)`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`gunde\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir)`, 'gi'), periyot: 'gun', limitGroup: 1 },
    // "günde X kez/adet/defa" (without suffix)
    { regex: new RegExp(`günde\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'gun', limitGroup: 1 },
    // "günlük X kez/adet" — "günlük bir kez işlem puanı verilir" gibi kalıplar
    { regex: new RegExp(`günlük\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`gunluk\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'gun', limitGroup: 1 },

    // === YILDA / YILLIK ===
    // "yılda en fazla X kez/adet/defa"
    { regex: new RegExp(`yılda\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'yil', limitGroup: 1 },
    { regex: new RegExp(`yilda\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'yil', limitGroup: 1 },
    // "yılda X adet/kez/defa faturalandırılır"
    { regex: new RegExp(`yılda\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir|faturalandırılmaz)`, 'gi'), periyot: 'yil', limitGroup: 1 },
    { regex: new RegExp(`yilda\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir)`, 'gi'), periyot: 'yil', limitGroup: 1 },
    // "yılda X kez/adet/defa" (without suffix)
    { regex: new RegExp(`yılda\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'yil', limitGroup: 1 },
    // "yıllık X kez/adet"
    { regex: new RegExp(`yıllık\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'yil', limitGroup: 1 },
    { regex: new RegExp(`yillik\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'yil', limitGroup: 1 },

    // === AYDA / AYLIK ===
    // "ayda en fazla X kez/adet/defa"
    { regex: new RegExp(`ayda\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'ay', limitGroup: 1 },
    // "ayda X adet/kez/defa faturalandırılır"
    { regex: new RegExp(`ayda\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir|faturalandırılmaz)`, 'gi'), periyot: 'ay', limitGroup: 1 },
    // "ayda X adet/kez/defa" (without suffix) — 186 cases!
    { regex: new RegExp(`ayda\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'ay', limitGroup: 1 },
    // "aylık X kez/adet"
    { regex: new RegExp(`aylık\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'ay', limitGroup: 1 },
    { regex: new RegExp(`aylik\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'ay', limitGroup: 1 },

    // === HAFTADA / HAFTALIK ===
    // "haftada en fazla X kez/adet/defa"
    { regex: new RegExp(`haftada\\s+en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'hafta', limitGroup: 1 },
    // "haftada X kez/adet/defa"
    { regex: new RegExp(`haftada\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'hafta', limitGroup: 1 },
    // "haftalık X kez/adet"
    { regex: new RegExp(`haftalık\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'hafta', limitGroup: 1 },
    { regex: new RegExp(`haftalik\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'hafta', limitGroup: 1 },

    // === X GÜNDE/AYDA BİR ===
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+günde\\s+bir`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+gunde\\s+bir`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+ayda\\s+bir`, 'gi'), periyot: 'ay', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+yılda\\s+bir`, 'gi'), periyot: 'yil', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+haftada\\s+bir`, 'gi'), periyot: 'hafta', limitGroup: 1 },

    // === EN FAZLA X ADET/DEFA (without period prefix) — 193 cases! ===
    { regex: new RegExp(`en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir|faturalandırılmaz)`, 'gi'), periyot: 'genel', limitGroup: 1 },
    { regex: new RegExp(`en\\s+fazla\\s+(${NUM_OR_WORD})\\s+${COUNT_UNIT}`, 'gi'), periyot: 'genel', limitGroup: 1 },

    // === X ADET FATURALANDIRILIR (without period prefix) — 193 cases! ===
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+faturalandırılır`, 'gi'), periyot: 'genel', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+${COUNT_UNIT}\\s+faturalandirilir`, 'gi'), periyot: 'genel', limitGroup: 1 },

    // === "bir defa/kez faturalandırılır" — 6 cases ===
    { regex: new RegExp(`(bir)\\s+${COUNT_UNIT}\\s+(?:faturalandırılır|faturalandirilir)`, 'gi'), periyot: 'genel', limitGroup: 1 },

    // === "X günden önce faturalandırılmaz" — min X days between ===
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+günden\\s+önce\\s+(?:faturalandırılmaz|faturalandirilmaz|faturalandırılamaz)`, 'gi'), periyot: 'gun_aralik', limitGroup: 1 },
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+gunden\\s+once\\s+(?:faturalandırılmaz|faturalandirilmaz)`, 'gi'), periyot: 'gun_aralik', limitGroup: 1 },

    // === "X aydan önce faturalandırılmaz" ===
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+aydan\\s+önce\\s+(?:faturalandırılmaz|faturalandirilmaz|faturalandırılamaz)`, 'gi'), periyot: 'ay_aralik', limitGroup: 1 },

    // === "X gün ara ile" / "X gün arayla" ===
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+gün\\s+(?:ara\\s+ile|arayla|aralar?la)`, 'gi'), periyot: 'gun_aralik', limitGroup: 1 },

    // === ÖMÜRDE BİR KEZ / ÖMÜR BOYUNCA ===
    // "ömürde bir kez puanlandırılır" — ortodontik işlemler (limit=1, tüm dönem)
    { regex: /ömürde\s+(bir)\s+kez\s+puanlandırılır/gi, periyot: 'genel', limitGroup: 1 },
    { regex: /omurde\s+(bir)\s+kez\s+puanlandirilir/gi, periyot: 'genel', limitGroup: 1 },
    // "ömür boyunca X defadan fazla" — (limit=X, tüm dönem)
    { regex: new RegExp(`ömür\\s+boyunca\\s+(${NUM_OR_WORD})\\s+defadan\\s+fazla`, 'gi'), periyot: 'genel', limitGroup: 1 },
    { regex: new RegExp(`omur\\s+boyunca\\s+(${NUM_OR_WORD})\\s+defadan\\s+fazla`, 'gi'), periyot: 'genel', limitGroup: 1 },

    // === X DEFADAN FAZLA FATURALANDIRILMAZ ===
    // "aynı başvuruda bir defadan fazla faturalandırılmaz" → günlük limit
    { regex: new RegExp(`aynı\\s+başvuruda\\s+(${NUM_OR_WORD})\\s+defadan\\s+fazla\\s+(?:faturalandırılmaz|faturalandirilmaz)`, 'gi'), periyot: 'gun', limitGroup: 1 },
    { regex: new RegExp(`ayni\\s+basvuruda\\s+(${NUM_OR_WORD})\\s+defadan\\s+fazla\\s+(?:faturalandırılmaz|faturalandirilmaz)`, 'gi'), periyot: 'gun', limitGroup: 1 },
    // "X defadan fazla faturalandırılmaz/yapılması" (without period prefix)
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+defadan\\s+fazla\\s+(?:faturalandırılmaz|faturalandirilmaz|yapılması)`, 'gi'), periyot: 'genel', limitGroup: 1 },

    // === BİR KEZ PUANLANDIRILIR (without ömürde prefix) ===
    // "bir kez puanlandırılır" — genel sıklık limiti
    { regex: /(bir)\s+kez\s+(?:puanlandırılır|puanlandirilir)/gi, periyot: 'genel', limitGroup: 1 },

    // === X AY BOYUNCA ... FATURA EDİLEMEZ ===
    // "1 ay boyunca ... fatura edilemez" → aylık limit
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+ay\\s+boyunca[^.]*fatura\\s+edilemez`, 'gi'), periyot: 'ay', limitGroup: 1 },

    // === BİR YIL İÇERİSİNDE X GÜNDEN ===
    // "bir yıl içerisinde X günden daha uzun" → yıllık limit (gün sayısı)
    { regex: new RegExp(`bir\\s+yıl\\s+içerisinde\\s+(${NUM_OR_WORD})\\s+günden`, 'gi'), periyot: 'yil', limitGroup: 1 },
    { regex: new RegExp(`bir\\s+yil\\s+icerisinde\\s+(${NUM_OR_WORD})\\s+günden`, 'gi'), periyot: 'yil', limitGroup: 1 },

    // === SADECE BİR KEZ ===
    // "sadece bir kez" → genel limit 1
    { regex: /sadece\s+(bir)\s+kez/gi, periyot: 'genel', limitGroup: 1 },

    // === X SAATTE BİR ===
    // "dört saatte bir" → günlük limit (24/X)
    { regex: new RegExp(`(${NUM_OR_WORD})\\s+saatte\\s+bir`, 'gi'), periyot: 'gun_saat', limitGroup: 1 },
  ];

  for (const { regex, periyot, limitGroup } of patterns) {
    const r = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      const limit = parseNumberOrWord(match[limitGroup]);
      if (limit !== null && limit > 0) {
        // "X saatte bir" → günlük limite çevir: 24/X
        if (periyot === 'gun_saat') {
          const dailyLimit = Math.floor(24 / limit);
          rules.push({
            type: 'SIKLIK_LIMIT',
            rawText: rawText.trim(),
            params: { periyot: 'gun', limit: dailyLimit > 0 ? dailyLimit : 1 }
          });
        } else {
          rules.push({
            type: 'SIKLIK_LIMIT',
            rawText: rawText.trim(),
            params: { periyot, limit }
          });
        }
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

  // Path 1: ICD kodları ile tanı koşulu (orijinal yol)
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
      return;
    }
  }

  // Path 2: Koşul bazlı tanı kuralları (ICD kodu olmadan)
  // Tıbbi bağlam göstergeleri + faturalandırma/uygulama ifadesi
  const lower = turkishLower(original);

  // Tıbbi koşul pattern'leri
  const medicalConditionPatterns = [
    // "X amaçlı yapılan işlemler için faturalandırılır"
    /(.{10,80})\s+amaçlı\s+(?:yapılan|yapilan)?\s*(?:işlemler?\s+)?(?:için\s+)?(?:faturalandırılır|faturalandirilir|uygulanır|uygulanir)/gi,
    // "X amaçlı ... faturalandırılır" (broader)
    /(.{10,80})\s+amaçlı\s+.{0,40}(?:faturalandırılır|faturalandirilir)/gi,
    // "X tedavisinde faturalandırılır/uygulanır"
    /(.{10,80})\s+tedavisinde\s+(?:faturalandırılır|faturalandirilir|uygulanır|uygulanir|kullanılır|kullanilir)/gi,
    // "X hastalığında/durumunda faturalandırılır"
    /(.{10,80})\s+(?:hastalığında|hastaliginda|durumunda)\s+(?:faturalandırılır|faturalandirilir|uygulanır|uygulanir)/gi,
    // "X halinde faturalandırılır" (hekim/uzman koşulları loop içinde filtrelenir)
    /(.{10,80})\s+halinde\s+(?:faturalandırılır|faturalandirilir|uygulanır|uygulanir)/gi,
    // "X tedavisinde" standalone (treatment context)
    /(?:transplantasyon|kemoterapi|radyoterapi|diyaliz|hemodiyaliz|immünoterapi|nöropatik|onkoloji|hematoloji|romatoloji)[\w]*\s+(?:amaçlı|tedavisinde|hastalığında|durumunda)/gi,
  ];

  for (const pattern of medicalConditionPatterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(lower)) !== null) {
      // Yakalanan tıbbi koşul metnini al
      const conditionText = (match[1] || match[0]).trim();

      // Çok kısa veya çok genel ise atla
      if (conditionText.length < 10) continue;

      // Hekim/uzmanlık/yapılma koşullarını tanı koşulu olarak kabul etme
      if (/(?:tarafından|tarafindan|yapılması|yapilmasi|hekimi|uzman\s+hekim)/i.test(conditionText)) continue;

      // ICD kodları da olabilir metinde - yine çıkar
      const kodlar: string[] = [];
      const icdR = new RegExp(icdPattern.source, icdPattern.flags);
      let icdM: RegExpExecArray | null;
      while ((icdM = icdR.exec(original)) !== null) {
        kodlar.push(icdM[1]);
      }

      rules.push({
        type: 'TANI_KOSULU',
        rawText: rawText.trim(),
        params: {
          taniKodlari: [...new Set(kodlar)],
          kosul: conditionText,
        }
      });
      return;
    }
  }

  // Path 3: ICD kodları tanı bağlamı olmadan ama belirli tıbbi terimlerle
  // "... tanısı konulmuş", "... tanılı hastalar"
  const taniContextPatterns = [
    /tanısı\s+(?:konulmuş|konulmus|konulan|alan)/i,
    /tanılı\s+(?:hastalar|olgular)/i,
    /endikasyonunda/i,
  ];

  if (taniContextPatterns.some(p => p.test(lower))) {
    const kodlar: string[] = [];
    let m: RegExpExecArray | null;
    const icdR2 = new RegExp(icdPattern.source, icdPattern.flags);
    while ((m = icdR2.exec(original)) !== null) {
      kodlar.push(m[1]);
    }
    // ICD kodu yoksa bile tanı koşulu olarak ekle
    rules.push({
      type: 'TANI_KOSULU',
      rawText: rawText.trim(),
      params: {
        taniKodlari: [...new Set(kodlar)],
        kosul: rawText.trim().substring(0, 200),
      }
    });
  }
}

// ── DİŞ TEDAVİ Çıkarma ──
function extractDisRules(lower: string, rawText: string, rules: ParsedRule[]) {
  const patterns = [
    // Orijinal pattern'ler
    /diş\s+(?:tedavisi|numarası|numarasi|hekimliği|hekimligi)/gi,
    /dis\s+(?:tedavisi|numarasi|hekimligi)/gi,
    /her\s+bir\s+diş\s+için/gi,
    /her\s+bir\s+dis\s+icin/gi,
    /diş\s+başına/gi,
    /dis\s+basina/gi,

    // === YENİ: "aynı diş" kalıpları ===
    // "aynı diş için X günden önce faturalandırılmaz" — dental frequency rule
    /aynı\s+diş\s+için\s+\d+\s+günden\s+önce\s+(?:faturalandırılmaz|faturalandirilmaz|faturalandırılamaz)/gi,
    /ayni\s+dis\s+icin\s+\d+\s+gunden\s+once\s+(?:faturalandirilmaz)/gi,
    // "aynı günde aynı diş için" — same-day same-tooth
    /aynı\s+günde\s+aynı\s+diş\s+için/gi,
    /ayni\s+gunde\s+ayni\s+dis\s+icin/gi,
    // "aynı diş için" genel
    /aynı\s+diş\s+için/gi,
    /ayni\s+dis\s+icin/gi,
    // "aynı diş" (broader)
    /aynı\s+diş(?:\s|,|\.)/gi,
    /ayni\s+dis(?:\s|,|\.)/gi,

    // === YENİ: lokal anestezi diş bağlamı ===
    /lokal\s+anestezi\s+ücreti\s+(?:dahildir|dahil)/gi,
    /lokal\s+anestezi\s+ucreti\s+(?:dahildir|dahil)/gi,

    // === YENİ: diş numarası bazlı ===
    /diş\s+(?:no|numarası|numarasi)\s+(?:belirtilmek|belirtilmelidir|yazılmalıdır|yazilmalidir)/gi,
    /dis\s+(?:no|numarasi)\s+(?:belirtilmek|belirtilmelidir|yazilmalidir)/gi,

    // "her diş için" (without "bir")
    /her\s+diş\s+için/gi,
    /her\s+dis\s+icin/gi,

    // "diş başına" alternatif yazımlar
    /dişe\s+(?:özel|ozel)/gi,
    /dise\s+(?:ozel)/gi,
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
// Başlık Satırı Yardımcıları (Bölüm Kuralı Mirası)
// ═══════════════════════════════════════════════════════════════

interface EkSourceConfig {
  codeIdx: number;
  puanIdx: number;
  adiIdx: number;
  aciklamaIdx: number;
}

/** Başlık satırı mı? (kod boş + puan boş + metin var) */
function isHeaderRow(row: any[], config: EkSourceConfig): boolean {
  const code = String(row[config.codeIdx] || '').trim();
  const puan = String(row[config.puanIdx] || '').trim();
  if (code !== '' || puan !== '') return false;
  const adi = String(row[config.adiIdx] || '').trim();
  const aciklama = String(row[config.aciklamaIdx] || '').trim();
  return adi !== '' || aciklama !== '';
}

/** Başlık satırındaki açıklama metnini birleştir */
function getHeaderText(row: any[], config: EkSourceConfig): string {
  const adi = String(row[config.adiIdx] || '').trim();
  const aciklama = String(row[config.aciklamaIdx] || '').trim();
  return [adi, aciklama].filter(Boolean).join(' - ');
}

/**
 * Bölüm kuralları ile satır kurallarını birleştir.
 * Satır kuralları öncelikli: aynı tip kural zaten varsa bölüm kuralı eklenmez.
 */
function mergeRules(rowRules: ParsedRule[], sectionRules: ParsedRule[]): ParsedRule[] {
  // Section kurallarını bölüm başlığından geldi olarak işaretle
  for (const sr of sectionRules) {
    sr.fromSectionHeader = true;
  }
  if (sectionRules.length === 0) return rowRules;
  if (rowRules.length === 0) return [...sectionRules];
  const rowRuleTypes = new Set(rowRules.map(r => r.type));
  const additional = sectionRules.filter(sr => !rowRuleTypes.has(sr.type));
  return [...rowRules, ...additional];
}

/** Her ParsedRule'a kaynak damgası bas */
function stampKaynak(rules: ParsedRule[], kaynak: RuleKaynak): ParsedRule[] {
  for (const r of rules) {
    if (!r.kaynak) r.kaynak = kaynak;
  }
  return rules;
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
    const ek2bCfg: EkSourceConfig = { codeIdx: 0, puanIdx: 3, adiIdx: 1, aciklamaIdx: 2 };
    let sectionHeader = '';
    let sectionRules: ParsedRule[] = [];

    for (const row of ek2bData.rows) {
      if (isHeaderRow(row, ek2bCfg)) {
        sectionHeader = getHeaderText(row, ek2bCfg);
        sectionRules = extractRulesFromAciklama(sectionHeader);
        continue;
      }

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
        parsed_rules: stampKaynak(mergeRules(extractRulesFromAciklama(aciklama), sectionRules), 'EK-2B'),
        section_header: sectionHeader || undefined,
      };

      if (!master.has(kodu)) {
        master.set(kodu, entry);
        stats.ek2b++;
      }
    }
  }

  // ── EK-2C: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMA, İŞLEM GRUBU, İŞLEM PUANI, İŞLEM FİYATI] ──
  if (ek2cData) {
    const ek2cCfg: EkSourceConfig = { codeIdx: 0, puanIdx: 4, adiIdx: 1, aciklamaIdx: 2 };
    let sectionHeader = '';
    let sectionRules: ParsedRule[] = [];

    for (const row of ek2cData.rows) {
      if (isHeaderRow(row, ek2cCfg)) {
        sectionHeader = getHeaderText(row, ek2cCfg);
        sectionRules = extractRulesFromAciklama(sectionHeader);
        continue;
      }

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
        parsed_rules: stampKaynak(mergeRules(extractRulesFromAciklama(aciklama), sectionRules), 'EK-2C'),
        section_header: sectionHeader || undefined,
      };

      // EK-2C öncelikli (ameliyat kodları)
      master.set(kodu, entry);
      stats.ek2c++;
    }
  }

  // ── EK-2Ç: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMALAR, İŞLEM PUANI, İŞLEM FİYATI] ──
  if (ek2cdData) {
    const ek2cdCfg: EkSourceConfig = { codeIdx: 0, puanIdx: 3, adiIdx: 1, aciklamaIdx: 2 };
    let sectionHeader = '';
    let sectionRules: ParsedRule[] = [];

    for (const row of ek2cdData.rows) {
      if (isHeaderRow(row, ek2cdCfg)) {
        sectionHeader = getHeaderText(row, ek2cdCfg);
        sectionRules = extractRulesFromAciklama(sectionHeader);
        continue;
      }

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
        parsed_rules: stampKaynak(mergeRules(extractRulesFromAciklama(aciklama), sectionRules), 'EK-2Ç'),
        section_header: sectionHeader || undefined,
      };

      if (!master.has(kodu)) {
        master.set(kodu, entry);
        stats.ek2cd++;
      }
    }
  }

  // ── GİL: [İŞLEM KODU, İŞLEM ADI, AÇIKLAMA, İŞLEM PUANI, AMELİYAT GRUPLARI] ──
  if (gilData) {
    const gilCfg: EkSourceConfig = { codeIdx: 0, puanIdx: 3, adiIdx: 1, aciklamaIdx: 2 };
    let sectionHeader = '';
    let sectionRules: ParsedRule[] = [];

    for (const row of gilData.rows) {
      if (isHeaderRow(row, gilCfg)) {
        sectionHeader = getHeaderText(row, gilCfg);
        sectionRules = extractRulesFromAciklama(sectionHeader);
        continue;
      }

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
        existing.gil_aciklama = aciklama || undefined;
        existing.gil_section_header = sectionHeader || undefined;
        if (!existing.section_header && sectionHeader) {
          existing.section_header = sectionHeader;
        }
        // GİL açıklamasından + bölüm başlığından ek kurallar çıkar
        const gilRules = stampKaynak(mergeRules(extractRulesFromAciklama(aciklama), sectionRules), 'GİL');
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
          parsed_rules: stampKaynak(mergeRules(extractRulesFromAciklama(aciklama), sectionRules), 'GİL'),
          section_header: sectionHeader || undefined,
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

// ═══════════════════════════════════════════════════════════════
// REGEX-ONLY DECORATİSTİK ÇIKARMA (AI hibrit mod için)
// Sadece deterministik kuralları çıkarır: SIKLIK, TANI, DIS, BIRLIKTE
// Semantik kurallar (BRANS, BASAMAK) AI'ya bırakılır
// ═══════════════════════════════════════════════════════════════
export function extractRulesFromAciklamaDeterministic(aciklama: string): ParsedRule[] {
  if (!aciklama || aciklama.trim().length === 0) return [];

  const rules: ParsedRule[] = [];
  const text = aciklama;
  const lower = turkishLower(aciklama);

  // Deterministik: regex ile güvenilir çıkarma
  extractBirlikteYapilamazRules(lower, text, rules);
  extractSiklikRules(lower, text, rules);
  extractTaniRules(aciklama, text, rules);
  extractDisRules(lower, text, rules);

  return rules;
}

// ═══════════════════════════════════════════════════════════════
// HİBRİT RULES_MASTER: Regex + AI
// ═══════════════════════════════════════════════════════════════
export async function buildRulesMasterHybrid(
  ek2bData: ExcelData | null,
  ek2cData: ExcelData | null,
  ek2cdData: ExcelData | null,
  gilData: GilExcelData | null,
  sutMaddeleri: SutMaddesi[] = [],
  useAI: boolean = true,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<BuildRulesMasterResult> {
  // Adım 1: Regex-only buildRulesMaster ile başla
  onProgress?.({ phase: 'building-rules', current: 0, total: 1, message: 'Regex kuralları çıkarılıyor...' });
  const regexResult = buildRulesMaster(ek2bData, ek2cData, ek2cdData, gilData, sutMaddeleri);
  const master = regexResult.rulesMaster;

  if (!useAI) {
    return regexResult;
  }

  // Adım 2: AI gerektiren açıklamaları topla
  const textsNeedingAI: string[] = [];
  const entryAciklamaMap = new Map<string, RuleMasterEntry[]>(); // açıklama → entry'ler

  for (const entry of master.values()) {
    const combinedText = [entry.aciklama_raw, entry.section_header].filter(Boolean).join(' ');
    if (!combinedText.trim()) continue;

    const lower = turkishLower(combinedText);
    if (needsAIExtraction(lower)) {
      // Açıklamayı AI listesine ekle
      const aciklama = entry.aciklama_raw || entry.section_header || '';
      if (aciklama.trim()) {
        textsNeedingAI.push(aciklama);
        if (!entryAciklamaMap.has(aciklama)) entryAciklamaMap.set(aciklama, []);
        entryAciklamaMap.get(aciklama)!.push(entry);
      }

      // Section header ayrıca AI'a gönder
      if (entry.section_header && entry.section_header !== entry.aciklama_raw) {
        textsNeedingAI.push(entry.section_header);
        if (!entryAciklamaMap.has(entry.section_header)) entryAciklamaMap.set(entry.section_header, []);
        entryAciklamaMap.get(entry.section_header)!.push(entry);
      }
    }
  }

  const uniqueTexts = [...new Set(textsNeedingAI.filter(t => t.trim().length > 0))];
  console.log(`[HYBRID] ${master.size} toplam entry, ${uniqueTexts.length} benzersiz açıklama AI gerektiriyor`);

  if (uniqueTexts.length === 0) {
    return regexResult;
  }

  // Adım 3: AI ile kural çıkarma
  onProgress?.({
    phase: 'ai-extraction',
    current: 0,
    total: uniqueTexts.length,
    message: `AI ile ${uniqueTexts.length} açıklama analiz ediliyor...`
  });

  const aiResults = await extractRulesWithAI(uniqueTexts, (current, total) => {
    onProgress?.({
      phase: 'ai-extraction',
      current,
      total,
      message: `AI kural çıkarma: ${current}/${total}...`
    });
  });

  // Adım 4: AI sonuçlarını master'a merge et
  let aiMergeCount = 0;
  for (const entry of master.values()) {
    const aciklama = entry.aciklama_raw || '';
    const sectionHeader = entry.section_header || '';
    const aiRulesAciklama = aiResults.get(aciklama) || [];
    const aiRulesHeader = sectionHeader !== aciklama ? (aiResults.get(sectionHeader) || []) : [];

    // Aciklama kurallarına kaynak damgası: aciklama_raw entry'nin orijinal kaynağından gelir
    stampKaynak(aiRulesAciklama, entry.kaynak);
    // Header kurallarına kaynak + fromSectionHeader damgası
    for (const r of aiRulesHeader) {
      r.fromSectionHeader = true;
    }
    if (entry.gil_section_header && sectionHeader === entry.gil_section_header) {
      stampKaynak(aiRulesHeader, 'GİL');
    } else if (entry.gil_section_header && entry.aciklama_raw !== sectionHeader) {
      // section_header entry'nin kendi açıklaması değilse ve GİL section_header mevcutsa
      // metin muhtemelen GİL bölüm başlığından gelmiştir
      stampKaynak(aiRulesHeader, 'GİL');
    } else {
      stampKaynak(aiRulesHeader, entry.kaynak);
    }

    const allAIRules = [...aiRulesAciklama, ...aiRulesHeader];

    if (allAIRules.length === 0) continue;

    // AI semantik kuralları (BRANS_KISITI, BASAMAK_KISITI) regex sonuçlarının yerine geçer
    // Deterministik kuralları (SIKLIK, BIRLIKTE, TANI, DIS) regex'ten koru
    const semanticTypes: Set<string> = new Set(['BRANS_KISITI', 'BASAMAK_KISITI', 'GENEL_ACIKLAMA']);
    const deterministicRules = entry.parsed_rules.filter(r => !semanticTypes.has(r.type));
    const aiSemanticRules = allAIRules.filter(r => semanticTypes.has(r.type));

    // AI'dan gelen deterministik kuralları da ekle (regex kaçırmışsa)
    const aiDeterministicRules = allAIRules.filter(r => !semanticTypes.has(r.type));
    const existingTypes = new Set(deterministicRules.map(r => r.type));
    const additionalAIDeterministic = aiDeterministicRules.filter(r => !existingTypes.has(r.type));

    // AI kurallarına ek kaynak kontrolü (yukarıda stampKaynak ile basılmışsa dokunma)
    // GİL açıklamasından gelen kuralları da kontrol et
    for (const r of [...aiSemanticRules, ...additionalAIDeterministic]) {
      if (!r.kaynak) {
        if (entry.gil_aciklama && r.rawText === entry.gil_aciklama) {
          r.kaynak = 'GİL';
        } else {
          r.kaynak = entry.kaynak;
        }
      }
    }

    // Birleştir: regex deterministik + AI semantik + AI ek deterministik
    const mergedRules = [...deterministicRules, ...aiSemanticRules, ...additionalAIDeterministic];

    // Deduplicate: aynı tipte birden fazla varsa, en yüksek confidence'lı olanı tut
    const typeMap = new Map<string, ParsedRule>();
    for (const rule of mergedRules) {
      const existing = typeMap.get(rule.type);
      if (!existing || (rule.confidence || 0) > (existing.confidence || 0)) {
        typeMap.set(rule.type, rule);
      }
    }

    entry.parsed_rules = Array.from(typeMap.values());
    aiMergeCount++;
  }

  console.log(`[HYBRID] AI merge: ${aiMergeCount} entry güncellendi`);

  // Stats güncelle
  regexResult.stats.withRules = Array.from(master.values()).filter(e => e.parsed_rules.length > 0).length;

  onProgress?.({
    phase: 'complete',
    current: uniqueTexts.length,
    total: uniqueTexts.length,
    message: `Hibrit kural çıkarma tamamlandı. AI: ${aiMergeCount} entry güncellendi.`
  });

  return regexResult;
}

// ═══════════════════════════════════════════════════════════════
// FULL AUDIT: Tüm açıklamaları AI'a gönderip regex ile karşılaştır
// Tek seferlik çalıştırılır, sonuçlar JSON olarak export edilir
// ═══════════════════════════════════════════════════════════════

export interface AuditDiffEntry {
  islem_kodu: string;
  islem_adi: string;
  kaynak: RuleKaynak;
  aciklama_raw: string;
  section_header?: string;
  regex_rules: ParsedRule[];
  ai_rules: ParsedRule[];
  diffs: AuditDiff[];
  status: 'match' | 'regex_only' | 'ai_only' | 'conflict' | 'both_empty';
}

export interface AuditDiff {
  type: ParsedRuleType;
  source: 'regex_only' | 'ai_only' | 'conflict' | 'match';
  regex_rule?: ParsedRule;
  ai_rule?: ParsedRule;
  description: string;
}

export interface FullAuditResult {
  totalEntries: number;
  totalWithAciklama: number;
  uniqueTextsAnalyzed: number;
  matchCount: number;
  regexOnlyCount: number;
  aiOnlyCount: number;
  conflictCount: number;
  bothEmptyCount: number;
  entries: AuditDiffEntry[];
  regexMissedPatterns: { pattern: string; count: number; examples: string[] }[];
  timestamp: string;
}

function compareRuleSets(regexRules: ParsedRule[], aiRules: ParsedRule[]): AuditDiff[] {
  const diffs: AuditDiff[] = [];
  const regexByType = new Map<string, ParsedRule>();
  const aiByType = new Map<string, ParsedRule>();

  for (const r of regexRules) regexByType.set(r.type, r);
  for (const r of aiRules) aiByType.set(r.type, r);

  const allTypes = new Set([...regexByType.keys(), ...aiByType.keys()]);

  for (const type of allTypes) {
    const regexRule = regexByType.get(type);
    const aiRule = aiByType.get(type);

    if (regexRule && aiRule) {
      // İkisi de var — aynı mı kontrol et
      const regexParams = JSON.stringify(regexRule.params);
      const aiParams = JSON.stringify(aiRule.params);
      if (regexParams === aiParams) {
        diffs.push({
          type: type as ParsedRuleType,
          source: 'match',
          regex_rule: regexRule,
          ai_rule: aiRule,
          description: `${type}: eşleşiyor`,
        });
      } else {
        diffs.push({
          type: type as ParsedRuleType,
          source: 'conflict',
          regex_rule: regexRule,
          ai_rule: aiRule,
          description: `${type}: FARKLI — Regex: ${regexParams} vs AI: ${aiParams}`,
        });
      }
    } else if (regexRule && !aiRule) {
      diffs.push({
        type: type as ParsedRuleType,
        source: 'regex_only',
        regex_rule: regexRule,
        description: `${type}: SADECE REGEX — ${JSON.stringify(regexRule.params)}`,
      });
    } else if (!regexRule && aiRule) {
      diffs.push({
        type: type as ParsedRuleType,
        source: 'ai_only',
        ai_rule: aiRule,
        description: `${type}: SADECE AI — ${JSON.stringify(aiRule.params)}`,
      });
    }
  }

  return diffs;
}

export async function buildRulesMasterFullAudit(
  ek2bData: ExcelData | null,
  ek2cData: ExcelData | null,
  ek2cdData: ExcelData | null,
  gilData: GilExcelData | null,
  sutMaddeleri: SutMaddesi[] = [],
  onProgress?: (progress: AnalysisProgress) => void
): Promise<FullAuditResult> {
  // Adım 1: Regex-only buildRulesMaster
  onProgress?.({ phase: 'building-rules', current: 0, total: 1, message: 'Regex kuralları çıkarılıyor...' });
  const regexResult = buildRulesMaster(ek2bData, ek2cData, ek2cdData, gilData, sutMaddeleri);
  const master = regexResult.rulesMaster;

  // Adım 2: TÜM açıklamaları topla (needsAIExtraction filtresi YOK)
  const allTexts: string[] = [];
  const entryAciklamaMap = new Map<string, RuleMasterEntry[]>();

  for (const entry of master.values()) {
    const aciklama = entry.aciklama_raw || '';
    if (aciklama.trim()) {
      allTexts.push(aciklama);
      if (!entryAciklamaMap.has(aciklama)) entryAciklamaMap.set(aciklama, []);
      entryAciklamaMap.get(aciklama)!.push(entry);
    }

    if (entry.section_header && entry.section_header.trim() && entry.section_header !== aciklama) {
      allTexts.push(entry.section_header);
      if (!entryAciklamaMap.has(entry.section_header)) entryAciklamaMap.set(entry.section_header, []);
      entryAciklamaMap.get(entry.section_header)!.push(entry);
    }
  }

  const uniqueTexts = [...new Set(allTexts.filter(t => t.trim().length > 0))];

  onProgress?.({
    phase: 'ai-extraction',
    current: 0,
    total: uniqueTexts.length,
    message: `FULL AUDIT: ${master.size} entry, ${uniqueTexts.length} benzersiz açıklama AI'a gönderiliyor...`
  });

  // Adım 3: TÜM açıklamaları AI'a gönder
  const aiResults = await extractRulesWithAI(uniqueTexts, (current, total) => {
    onProgress?.({
      phase: 'ai-extraction',
      current,
      total,
      message: `AI analiz: ${current}/${total} açıklama...`
    });
  });

  // Adım 4: Karşılaştırma — her entry için regex vs AI
  onProgress?.({ phase: 'analyzing', current: 0, total: master.size, message: 'Regex vs AI karşılaştırması yapılıyor...' });

  const auditEntries: AuditDiffEntry[] = [];
  let matchCount = 0, regexOnlyCount = 0, aiOnlyCount = 0, conflictCount = 0, bothEmptyCount = 0;
  let totalWithAciklama = 0;

  // AI'ın bulduğu ama regex'in kaçırdığı pattern'ler
  const missedPatternMap = new Map<string, { count: number; examples: string[] }>();

  let idx = 0;
  for (const entry of master.values()) {
    idx++;
    if (idx % 500 === 0) {
      onProgress?.({ phase: 'analyzing', current: idx, total: master.size, message: `Karşılaştırma: ${idx}/${master.size}...` });
    }

    const aciklama = entry.aciklama_raw || '';
    if (!aciklama.trim()) continue;
    totalWithAciklama++;

    // Regex sonuçları: entry.parsed_rules'dan GENEL_ACIKLAMA hariç
    const regexRules = entry.parsed_rules.filter(r => r.type !== 'GENEL_ACIKLAMA');

    // AI sonuçları: açıklama + section_header'dan
    const aiRulesAciklama = aiResults.get(aciklama) || [];
    const aiRulesHeader = entry.section_header && entry.section_header !== aciklama
      ? (aiResults.get(entry.section_header) || [])
      : [];
    const aiRules = [...aiRulesAciklama, ...aiRulesHeader].filter(r => r.type !== 'GENEL_ACIKLAMA');

    // Karşılaştır
    const diffs = compareRuleSets(regexRules, aiRules);

    let status: AuditDiffEntry['status'] = 'match';
    if (regexRules.length === 0 && aiRules.length === 0) {
      status = 'both_empty';
      bothEmptyCount++;
    } else if (diffs.some(d => d.source === 'conflict')) {
      status = 'conflict';
      conflictCount++;
    } else if (diffs.some(d => d.source === 'ai_only')) {
      status = 'ai_only';
      aiOnlyCount++;
    } else if (diffs.some(d => d.source === 'regex_only')) {
      status = 'regex_only';
      regexOnlyCount++;
    } else {
      matchCount++;
    }

    // AI'ın bulup regex'in kaçırdığı pattern'leri topla
    for (const diff of diffs) {
      if (diff.source === 'ai_only' && diff.ai_rule) {
        const key = `${diff.type}:${diff.ai_rule.params?.mode || 'default'}`;
        const existing = missedPatternMap.get(key) || { count: 0, examples: [] };
        existing.count++;
        if (existing.examples.length < 5) {
          existing.examples.push(`[${entry.islem_kodu}] ${aciklama.substring(0, 120)}`);
        }
        missedPatternMap.set(key, existing);
      }
    }

    // Sadece fark olan entry'leri (+ bir miktar eşleşen) kaydet
    if (status !== 'both_empty') {
      auditEntries.push({
        islem_kodu: entry.islem_kodu,
        islem_adi: entry.islem_adi,
        kaynak: entry.kaynak,
        aciklama_raw: aciklama,
        section_header: entry.section_header,
        regex_rules: regexRules,
        ai_rules: aiRules,
        diffs,
        status,
      });
    }
  }

  const regexMissedPatterns = Array.from(missedPatternMap.entries())
    .map(([pattern, data]) => ({ pattern, count: data.count, examples: data.examples }))
    .sort((a, b) => b.count - a.count);

  const result: FullAuditResult = {
    totalEntries: master.size,
    totalWithAciklama,
    uniqueTextsAnalyzed: uniqueTexts.length,
    matchCount,
    regexOnlyCount,
    aiOnlyCount,
    conflictCount,
    bothEmptyCount,
    entries: auditEntries,
    regexMissedPatterns,
    timestamp: new Date().toISOString(),
  };

  onProgress?.({
    phase: 'complete',
    current: master.size,
    total: master.size,
    message: `FULL AUDIT tamamlandı. Eşleşen: ${matchCount}, AI fazladan buldu: ${aiOnlyCount}, Çelişki: ${conflictCount}, Regex fazladan: ${regexOnlyCount}`
  });

  return result;
}
