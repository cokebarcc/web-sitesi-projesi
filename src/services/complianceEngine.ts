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
  hastaKayitId: string;
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
  yasi: number;
  tani: string;
  islemAciklama: string;
  disNumarasi: string;
  [key: string]: string | number; // Dinamik ekstra sütunlar
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
  ['ağız, diş ve çene cerrahisi', 'ağız diş ve çene cerrahisi', 'diş hekimliği', 'diş hekimi', 'diş', 'ağız diş', 'diş hastalıkları ve tedavisi', 'diş hastalıkları', 'diş protez', 'ağız diş ve çene hastalıkları'],
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

  // Kelime sınırı kontrolü: kısa aliasların uzun stringlerin içinde yanlış eşleşmesini engelle
  // Örn: "acil" aliası "çocuk acil yandal uzmanı" içinde bulunmamalı
  function safeIncludes(haystack: string, needle: string): boolean {
    if (!haystack.includes(needle)) return false;
    // Needle çok kısaysa (tek kelime, ≤6 karakter) → kelime sınırı kontrolü yap
    if (needle.length <= 6 || !needle.includes(' ')) {
      const idx = haystack.indexOf(needle);
      const before = idx > 0 ? haystack[idx - 1] : ' ';
      const after = idx + needle.length < haystack.length ? haystack[idx + needle.length] : ' ';
      const isBefore = before === ' ' || before === ',' || before === ';' || before === '(' || before === ')';
      const isAfter = after === ' ' || after === ',' || after === ';' || after === '(' || after === ')';
      // Tek kelime needle ise, tam kelime olarak eşleşmeli (her iki tarafta da sınır olmalı)
      if (!isBefore || !isAfter) return false;
    }
    // Needle, haystack'in önemli bir kısmı olmalı (çok kısa needle, çok uzun haystack → yanlış pozitif)
    // Needle en az haystack uzunluğunun %40'ı olmalı
    if (needle.length < haystack.length * 0.4) return false;
    return true;
  }

  // Ayrıca alias grubundaki herhangi bir elemana includes ile bakalım
  if (hGroup) {
    for (const alias of hGroup) {
      if (safeIncludes(alias, k) || safeIncludes(k, alias)) return true;
    }
  }
  const kGroup = _bransAliasMap.get(k);
  if (kGroup) {
    for (const alias of kGroup) {
      if (safeIncludes(alias, h) || safeIncludes(h, alias)) return true;
    }
  }

  // 3. includes bazlı eşleşme (kelime sınırı korumalı)
  if (safeIncludes(h, k) || safeIncludes(k, h)) return true;

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
  sameSessionRows: IslemSatiriLike[],
  mevcutUzmanliklar: Set<string>
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
        const basamakMode = (rule.params.mode as string) || 'sadece';

        // ── Artırım/fiyat kuralı tespiti ──
        // "üçüncü basamakta %30 ilave" gibi artırım ifadeleri basamak kısıtı değildir
        const basamakRawLower = turkishLower(rule.rawText || '');
        const basamakArtirimPattern = /(?:ilave|art[ıi]r[ıi]m|%\s*\d+|ek\s*puan|fark[ıi]|fazla\s*puan)/;
        if (basamakArtirimPattern.test(basamakRawLower)) break;

        if (allowed) {
          let isViolation = false;
          if (basamakMode === 've_uzeri') {
            // "X. basamak ve üzeri" → kurumBasamak >= min(allowed)
            const minBasamak = Math.min(...allowed);
            isViolation = kurumBasamak < minBasamak;
          } else {
            // "sadece" (varsayılan) → kurumBasamak allowed listesinde olmalı
            isViolation = !allowed.includes(kurumBasamak);
          }

          if (isViolation) {
            ihlaller.push({
              ihlal_kodu: 'BASAMAK_001',
              ihlal_aciklamasi: `Bu işlem yalnızca ${allowed.join('. ve ')}. basamak hastanelerde yapılabilir. Kurum basamağı: ${kurumBasamak}`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'BASAMAK_KISITI',
            });
          }
        }
        break;
      }

      case 'BRANS_KISITI': {
        const _rawBranslar = rule.params.branslar as string[];
        const bransMode = (rule.params.mode as string) || 'dahil';
        // Geçersiz branş adlarını filtrele (stop-words, kısa kelimeler)
        const bransStopWords = new Set([
          'için', 'icin', 'olan', 'olarak', 'ile', 'bir', 'her', 'bu', 'şu', 'de', 'da',
          'den', 'dan', 'dir', 'dır', 'ise', 'gibi', 'kadar', 'sonra', 'önce', 'once',
          'ancak', 'sadece', 'bizzat', 'tarafından', 'tarafindan', 'halinde', 'yapılır',
          'faturalandırılır', 'puanlandırılır', 'uygulanır', 'gerekir', 'gerekmektedir',
        ]);
        // Servis/birim adlarını filtrele (branş değildir)
        const servisAdlari = new Set([
          'palyatif bakım', 'palyatif bakim', 'yoğun bakım', 'yogun bakim',
          'acil servis', 'yataklı servis', 'yatakli servis', 'poliklinik',
          'ameliyathane', 'laboratuvar', 'eczane',
        ]);
        const branslar = _rawBranslar?.filter(b =>
          b.length > 2 && !bransStopWords.has(turkishLower(b)) && !servisAdlari.has(turkishLower(b))
        );

        // ── GENİŞLETİCİ İFADE TESPİTİ ──
        // "X için de puanlandırılır" / "X da yapabilir" gibi ifadeler branş KISITLAMASI değil,
        // ek branş ekleme ifadesidir → BRANS_KISITI olarak değerlendirilmemeli
        const rawTextLower = turkishLower(rule.rawText || '');
        const genisleticiPattern = /\b(i[cç]in\s+de|taraf[ıi]ndan\s+da|uzman[ıi]\s+hekimler\s+i[cç]in\s+de|da\s+yapabilir|da\s+yapılabilir|de\s+puanland[ıi]r[ıi]l[ıi]r|da\s+faturaland[ıi]r[ıi]l[ıi]r|da\s+uygulanabilir)\b/;
        if (bransMode === 'dahil' && genisleticiPattern.test(rawTextLower)) {
          // Genişletici ifade → kısıtlama yok, skip
          break;
        }

        // ── "GİBİ" GENİŞLETİCİ İFADE KONTROLÜ ──
        // "Cerrahi, dahili, palyatif bakım gibi yataklı servislerde" → örnek listesi, kısıt değil
        // Branş adları "gibi" kelimesiyle bağlanıyorsa → genişletici ifade
        if (branslar && branslar.length > 0) {
          const allBransAfterGibi = branslar.every(b => {
            const bLower = turkishLower(b);
            const idx = rawTextLower.indexOf(bLower);
            if (idx === -1) return false;
            const afterBrans = rawTextLower.substring(idx + bLower.length, idx + bLower.length + 20).trim();
            return /^gibi\b/.test(afterBrans);
          });
          if (allBransAfterGibi) {
            break; // Tüm branşlar "gibi" ile bağlanmış → örnek listesi, kısıt değil
          }
        }

        // ── YAŞ KOŞULU KONTROLÜ ──
        // Kural metni yaş koşulu içeriyorsa (ör. "18 yaş altı hastalarda")
        // ve hasta bu koşulu karşılamıyorsa → bu kural bu hasta için geçerli değil
        const yasAltMatch = rawTextLower.match(/(\d+)\s*ya[sş]\s*(alt[ıi]|altında|altındaki)/);
        const yasUstMatch = rawTextLower.match(/(\d+)\s*ya[sş]\s*([uü]st[uü]|üzerinde|üstündeki|ve\s+[uü]zeri)/);
        if (yasAltMatch && row.yasi) {
          const yasLimit = parseInt(yasAltMatch[1], 10);
          if (row.yasi >= yasLimit) {
            // Hasta yaş limitinin üstünde → bu yaş koşullu kural geçerli değil
            break;
          }
        }
        if (yasUstMatch && row.yasi) {
          const yasLimit = parseInt(yasUstMatch[1], 10);
          if (row.yasi < yasLimit) {
            // Hasta yaş limitinin altında → bu yaş koşullu kural geçerli değil
            break;
          }
        }

        if (branslar && branslar.length > 0) {
          const formattedBranslar = branslar.map(b =>
            b.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          );

          if (bransMode === 'haric') {
            // HARİÇ modu: bu branşlar YAPAMAZ, diğer herkes yapabilir
            const isExcluded = branslar.some(b => branslarEslesiyor(row.uzmanlik, b));
            if (isExcluded) {
              ihlaller.push({
                ihlal_kodu: 'BRANS_007',
                ihlal_aciklamasi: `Bu işlem ${formattedBranslar.join(', ')} branşları HARİCİNDEKİ hekimler tarafından yapılabilir. Hekim branşı (${row.uzmanlik}) hariç tutulan listede.`,
                kaynak: rule.kaynak || entry.kaynak,
                referans_kural_metni: rule.rawText,
                fromSectionHeader: rule.fromSectionHeader,
                kural_tipi: 'BRANS_KISITI',
              });
            }
          } else {
            // DAHİL modu (varsayılan): SADECE bu branşlar yapabilir
            const match = branslar.some(b => branslarEslesiyor(row.uzmanlik, b));
            if (!match) {
              // Kural metninde "bulunmadığında/yokluğunda" ifadesi varsa ve hekim İç Hastalıkları ise:
              // Kısıtlı branşların kurumda mevcut olup olmadığını kontrol et
              const rawLower = turkishLower(rule.rawText || '');
              const yoklukKurali = /bulunmadığında|bulunmadiginda|yokluğunda|yoklugunda|olmadığında|olmadiginda|bulunmayan|yoksa/.test(rawLower);

              if (yoklukKurali) {
                // Kısıtlı branşlardan herhangi biri kurumda mevcut mu?
                const kisitliBransKurumda = branslar.some(b => {
                  const bLower = turkishLower(b);
                  for (const uzm of mevcutUzmanliklar) {
                    if (branslarEslesiyor(uzm, bLower)) return true;
                  }
                  return false;
                });

                if (kisitliBransKurumda) {
                  // Kısıtlı branş kurumda mevcut → İhlal (o branş yapmalı)
                  ihlaller.push({
                    ihlal_kodu: 'BRANS_002',
                    ihlal_aciklamasi: `Bu işlem şu branşlara kısıtlıdır: ${formattedBranslar.join(', ')}. Hekim branşı: ${row.uzmanlik}. Kurumda ilgili branş hekimi mevcut.`,
                    kaynak: rule.kaynak || entry.kaynak,
                    referans_kural_metni: rule.rawText,
                    fromSectionHeader: rule.fromSectionHeader,
                    kural_tipi: 'BRANS_KISITI',
                  });
                }
                // Kısıtlı branş kurumda mevcut değil → Muaf (yokluğunda başka hekim yapabilir)
              } else {
                // Normal branş kısıtı (yokluk kuralı yok)
                ihlaller.push({
                  ihlal_kodu: 'BRANS_002',
                  ihlal_aciklamasi: `Bu işlem şu branşlara kısıtlıdır: ${formattedBranslar.join(', ')}. Hekim branşı: ${row.uzmanlik}`,
                  kaynak: rule.kaynak || entry.kaynak,
                  referans_kural_metni: rule.rawText,
                  fromSectionHeader: rule.fromSectionHeader,
                  kural_tipi: 'BRANS_KISITI',
                });
              }
            }
          }
        }
        break;
      }

      case 'BIRLIKTE_YAPILAMAZ': {
        const yasakliKodlar = rule.params.yapilamazKodlari as string[];
        if (yasakliKodlar && yasakliKodlar.length > 0) {
          // ── A2: "Aynı diş" koşulu tespiti ──
          const birlikteRawLower = turkishLower(rule.rawText || '');
          const birlikteAyniDis = /ayn[ıi]\s*di[sş]/i.test(birlikteRawLower);

          const conflicting = sameSessionRows.filter(r => {
            if (r === row) return false;
            if (!yasakliKodlar.includes(r.gilKodu.trim())) return false;
            // "Aynı diş" kuralıysa diş numarası eşleşmeli
            if (birlikteAyniDis) {
              const rowDis = (row.disNumarasi || '').trim();
              const rDis = (r.disNumarasi || '').trim();
              // İkisi de boşsa → eşleşme (diş bilgisi yok, güvenli tarafta kal)
              // Biri boş diğeri doluysa → eşleşme yok
              if (rowDis && rDis) return rowDis === rDis;
              if (!rowDis && !rDis) return true;
              return false;
            }
            return true;
          });
          if (conflicting.length > 0) {
            ihlaller.push({
              ihlal_kodu: 'BIRLIKTE_003',
              ihlal_aciklamasi: `Bu işlem ${birlikteAyniDis ? 'aynı diş için ' : ''}şu kodlarla birlikte faturalandırılamaz: ${conflicting.map(c => c.gilKodu).join(', ')}`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
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
        // Formal tani alanından oku, fallback olarak dinamik sütunları kontrol et
        const taniDegeri = (
          (typeof row.tani === 'string' && row.tani.trim()) ||
          String(row['TANI'] || row['Tani'] || row['Tanı'] || row['tani'] || row['tanı'] || row['TANI KODU'] || row['Tani Kodu'] || row['Tanı Kodu'] || '')
        ).trim();
        const requiredKodlar = (rule.params.taniKodlari as string[] || []);

        if (!taniDegeri) {
          // Tanı bilgisi Excel'de mevcut değil → Manuel inceleme
          if (requiredKodlar.length > 0) {
            ihlaller.push({
              ihlal_kodu: 'TANI_004',
              ihlal_aciklamasi: `Bu işlem belirli tanı kodu gerektirir: ${requiredKodlar.join(', ')}. Tanı bilgisi mevcut değil.`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'TANI_KOSULU',
            });
          }
          // requiredKodlar boşsa (sadece koşul metni var), ihlal üretme
        } else if (requiredKodlar.length > 0) {
          // Tanı bilgisi var ve gerekli kodlar belirtilmiş → Kontrol et
          const taniUpper = taniDegeri.toUpperCase();
          const eslesiyor = requiredKodlar.some(kod => taniUpper.includes(kod.toUpperCase()));
          if (!eslesiyor) {
            ihlaller.push({
              ihlal_kodu: 'TANI_004',
              ihlal_aciklamasi: `Bu işlem belirli tanı kodu gerektirir: ${requiredKodlar.join(', ')}. Mevcut tanı: ${taniDegeri}`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'TANI_KOSULU',
            });
          }
        }
        // Tanı bilgisi var ama gerekli kodlar belirtilmemiş → Kontrol edilemez, ihlal yok
        break;
      }

      case 'DIS_TEDAVI': {
        // Diş tedavi kuralları — bilgilendirme
        if (row.disNumarasi === '' && turkishLower(row.uzmanlik).includes('diş')) {
          ihlaller.push({
            ihlal_kodu: 'DIS_005',
            ihlal_aciklamasi: `Diş tedavi kuralı mevcut ancak diş numarası boş.`,
            kaynak: rule.kaynak || entry.kaynak,
            referans_kural_metni: rule.rawText,
            fromSectionHeader: rule.fromSectionHeader,
            kural_tipi: 'DIS_TEDAVI',
          });
        }
        break;
      }

      case 'YAS_KISITI': {
        const minYas = rule.params.minYas as number | undefined;
        const maxYas = rule.params.maxYas as number | undefined;
        const yasMode = (rule.params.mode as string) || 'aralik';
        const hastaYasi = typeof row.yasi === 'number' ? row.yasi : parseInt(String(row.yasi));

        // ── ARTIRIM/FİYAT KURALI TESPİTİ ──
        // "X yaş altı çocuklarda %100 artırımlı uygulanır" gibi ifadeler
        // yaş KISITLAMASI değil, fiyat artırım kuralıdır → YAS_KISITI olarak değerlendirilmemeli
        const yasRawLower = turkishLower(rule.rawText || '');
        const artirimPattern = /art[ıi]r[ıi]ml[ıi]|ilave|fark[ıi]|ek\s*puan|ek\s*ücret|%\s*\d+\s*art[ıi]r[ıi]m|\bfazla\s+puan/;
        if (artirimPattern.test(yasRawLower)) {
          // Fiyat/artırım kuralı → yaş kısıtlaması değil, skip
          break;
        }

        // ── GENİŞLETİCİ İFADE TESPİTİ ──
        // "X yaş altında da uygulanabilir" / "X yaş üstü için de puanlandırılır"
        // → yaş kısıtlaması değil, genişletici ifade
        const yasGenisleticiPattern = /\b(da\s+uygulan|de\s+puanland|da\s+yap[ıi]l|i[cç]in\s+de\s+puanland)\b/;
        if (yasGenisleticiPattern.test(yasRawLower)) {
          break;
        }

        if (isNaN(hastaYasi) || hastaYasi <= 0) {
          // Yaş bilgisi yok → bilgilendirme
          if (minYas || maxYas) {
            ihlaller.push({
              ihlal_kodu: 'YAS_008',
              ihlal_aciklamasi: `Bu işlem yaş kısıtı içeriyor (${
                yasMode === 'alti' ? `${maxYas} yaş altı` :
                yasMode === 'ustu' ? `${minYas} yaş üstü` :
                `${minYas}-${maxYas} yaş arası`
              }). Yaş bilgisi mevcut değil.`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'YAS_KISITI',
            });
          }
        } else {
          let yasIhlal = false;
          if (yasMode === 'alti' && maxYas && hastaYasi >= maxYas) yasIhlal = true;
          if (yasMode === 'ustu' && minYas && hastaYasi < minYas) yasIhlal = true;
          if (yasMode === 'aralik') {
            if (minYas && hastaYasi < minYas) yasIhlal = true;
            if (maxYas && hastaYasi > maxYas) yasIhlal = true;
          }

          if (yasIhlal) {
            ihlaller.push({
              ihlal_kodu: 'YAS_008',
              ihlal_aciklamasi: `Bu işlem ${
                yasMode === 'alti' ? `${maxYas} yaş altı` :
                yasMode === 'ustu' ? `${minYas} yaş üstü` :
                `${minYas}-${maxYas} yaş arası`
              } hastalar için uygulanabilir. Hasta yaşı: ${hastaYasi}`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'YAS_KISITI',
            });
          }
        }
        break;
      }

      case 'GENEL_ACIKLAMA': {
        // rawText'ten kaçırılmış kuralları kurtarma
        const genelRawLower = turkishLower(rule.rawText || '');

        // Basamak kısıtı kurtarma: "üçüncü basamak tarafından faturalandırılır"
        const hasExistingBasamak = entry.parsed_rules.some(r => r.type === 'BASAMAK_KISITI');
        if (!hasExistingBasamak) {
          const basamakMatch = genelRawLower.match(/(?:yalnızca|sadece|ancak)?\s*(?:üçüncü|3\.?)\s*basamak.*?(?:tarafından|yapılır|sunulur|faturalandır)/);
          if (basamakMatch && !/(?:ilave|artırım|%\d+|ek\s*puan|fark)/i.test(genelRawLower)) {
            if (kurumBasamak < 3) {
              ihlaller.push({
                ihlal_kodu: 'BASAMAK_001',
                ihlal_aciklamasi: `Bu işlem yalnızca 3. basamak hastanelerde yapılabilir. Kurum basamağı: ${kurumBasamak} (açıklamadan tespit)`,
                kaynak: rule.kaynak || entry.kaynak,
                referans_kural_metni: rule.rawText,
                fromSectionHeader: rule.fromSectionHeader,
                kural_tipi: 'BASAMAK_KISITI',
              });
            }
          }
          const basamak2Match = genelRawLower.match(/(?:yalnızca|sadece|ancak)?\s*(?:ikinci|2\.?)\s*basamak.*?(?:tarafından|yapılır|sunulur|faturalandır)/);
          if (basamak2Match && !basamakMatch && !/(?:ilave|artırım|%\d+|ek\s*puan|fark)/i.test(genelRawLower)) {
            if (kurumBasamak < 2) {
              ihlaller.push({
                ihlal_kodu: 'BASAMAK_001',
                ihlal_aciklamasi: `Bu işlem yalnızca 2. basamak ve üzeri hastanelerde yapılabilir. Kurum basamağı: ${kurumBasamak} (açıklamadan tespit)`,
                kaynak: rule.kaynak || entry.kaynak,
                referans_kural_metni: rule.rawText,
                fromSectionHeader: rule.fromSectionHeader,
                kural_tipi: 'BASAMAK_KISITI',
              });
            }
          }
        }
        break;
      }
    }
  }

  // Puan/fiyat farkı
  const puanFarki = entry.islem_puani > 0 ? Math.round((row.puan - entry.islem_puani) * 100) / 100 : undefined;
  const fiyatFarki = entry.islem_fiyati > 0 ? Math.round((row.fiyat - entry.islem_fiyati) * 100) / 100 : undefined;

  // ── B2: Düşük confidence kontrolü ──
  // Düşük güvenli kurallardan (< 0.7) gelen ihlalleri "düşük güven" olarak işaretle
  for (const ihlal of ihlaller) {
    const matchingRule = entry.parsed_rules.find(r => r.type === ihlal.kural_tipi);
    if (matchingRule && typeof matchingRule.confidence === 'number' && matchingRule.confidence < 0.7) {
      ihlal.ihlal_aciklamasi += ' (düşük güven)';
    }
  }

  // Sonuç belirleme
  let uygunluk: UygunlukDurumu;
  if (ihlaller.length === 0) {
    uygunluk = 'UYGUN';
  } else {
    // Tüm ihlaller düşük güvenli kurallardan mı geliyor?
    const tumDusukGuven = ihlaller.every(i => {
      const r = entry.parsed_rules.find(rule => rule.type === i.kural_tipi);
      return r && typeof r.confidence === 'number' && r.confidence < 0.7;
    });
    if (tumDusukGuven) {
      uygunluk = 'MANUEL_INCELEME';
    } else if (ihlaller.some(i => ['BASAMAK_KISITI', 'BIRLIKTE_YAPILAMAZ', 'BRANS_KISITI', 'YAS_KISITI'].includes(i.kural_tipi))) {
      uygunluk = 'UYGUNSUZ';
    } else {
      uygunluk = 'MANUEL_INCELEME';
    }
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
  // Tarih normalizasyonu: "05.12.2025" → "2025-12-05" formatına çevir
  function normalizeDate(tarih: string): string {
    const t = tarih.trim();
    // dd.MM.yyyy veya dd/MM/yyyy
    const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return t; // yyyy-MM-dd zaten uygun
  }

  // Tarihten yıl-ay çıkar: "2025-12-05" → "2025-12"
  function getYearMonth(normalizedDate: string): string {
    return normalizedDate.substring(0, 7);
  }

  // Tarihten yıl çıkar: "2025-12-05" → "2025"
  function getYear(normalizedDate: string): string {
    return normalizedDate.substring(0, 4);
  }

  // ISO hafta numarası: "2025-12-05" → "2025-W49"
  function getYearWeek(normalizedDate: string): string {
    const parts = normalizedDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  // Periyoda göre gruplama anahtarı döndür
  function getPeriyotKey(tarih: string, periyot: string): string {
    const nd = normalizeDate(tarih);
    switch (periyot) {
      case 'gun': return nd;                    // gün bazında
      case 'hafta': return getYearWeek(nd);     // hafta bazında
      case 'ay': return getYearMonth(nd);       // ay bazında
      case 'yil': return getYear(nd);           // yıl bazında
      default: return 'all';                    // genel (tüm dönem)
    }
  }

  // hasta+kod bazında gruplama (önce kural bul, sonra periyoda göre alt-grupla)
  const codeMap = new Map<string, number[]>(); // hastaTC_gilKodu → satır index'leri

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = `${row.hastaTc}_${row.gilKodu.trim()}`;
    if (!codeMap.has(key)) codeMap.set(key, []);
    codeMap.get(key)!.push(i);
  }

  // Sıklık limiti muafiyet listesi (bu kodlar günlük limit kontrolünden muaf)
  const siklikMuafKodlar = new Set(['520020', '520021', '520022', '520023', '520024']);

  for (const [key, indices] of codeMap) {
    if (indices.length <= 1) continue;

    const gilKodu = key.split('_').slice(1).join('_');
    if (siklikMuafKodlar.has(gilKodu)) continue;

    const entry = rulesMaster.get(gilKodu);
    if (!entry) continue;

    const siklikRule = entry.parsed_rules.find(r => r.type === 'SIKLIK_LIMIT');
    if (!siklikRule) continue;

    const limit = siklikRule.params.limit as number;
    let periyot = siklikRule.params.periyot as string;

    // ── A3: rawText'ten gün/ay dönüşüm doğrulama ──
    // AI "180 gün" → ay_aralik: 6 çıkarabiliyor — rawText'teki gün sayısını kullan
    if (periyot === 'ay_aralik' && siklikRule.rawText) {
      const gunMatch = siklikRule.rawText.match(/(\d+)\s*g[uü]n/i);
      if (gunMatch) {
        const gunSayisi = parseInt(gunMatch[1], 10);
        if (gunSayisi > 0) {
          // rawText gün cinsinden yazılmış, AI yanlışlıkla ay_aralik yapmış → düzelt
          periyot = 'gun_aralik';
          (siklikRule.params as any).periyot = 'gun_aralik';
          (siklikRule.params as any).limit = gunSayisi;
        }
      }
    }

    const correctedLimit = siklikRule.params.limit as number;

    // ── A1: "Aynı diş" koşulu tespiti ──
    const rawTextLower = turkishLower(siklikRule.rawText || '');
    const isAyniDis = /ayn[ıi]\s*di[sş]/i.test(rawTextLower);

    // ── "Aynı branşta" koşulu tespiti ──
    // "aynı branşta 10 gün içinde bir kez puanlandırılır" → farklı branşlardaki işlemler ayrı sayılmalı
    const isAyniBrans = /ayn[ıi]\s*bran[sş]/i.test(rawTextLower);

    // Önce "aynı branş" alt-gruplama (branş bazında)
    let bransGroups: number[][];
    if (isAyniBrans) {
      const bransMap = new Map<string, number[]>();
      for (const idx of indices) {
        const brans = turkishLower((rows[idx].uzmanlik || '').trim()) || '__bos__';
        if (!bransMap.has(brans)) bransMap.set(brans, []);
        bransMap.get(brans)!.push(idx);
      }
      bransGroups = [...bransMap.values()];
    } else {
      bransGroups = [indices];
    }

    // Sonra her branş grubu içinde "aynı diş" alt-gruplama
    let indexGroups: number[][] = [];
    for (const bransIndices of bransGroups) {
      if (isAyniDis) {
        const disMap = new Map<string, number[]>();
        for (const idx of bransIndices) {
          const dis = (rows[idx].disNumarasi || '').trim() || '__bos__';
          if (!disMap.has(dis)) disMap.set(dis, []);
          disMap.get(dis)!.push(idx);
        }
        indexGroups.push(...disMap.values());
      } else {
        indexGroups.push(bransIndices);
      }
    }

    for (const subIndices of indexGroups) {
      if (subIndices.length <= 1) continue;

    // Periyoda göre alt-gruplama (gün, hafta, ay, yıl veya genel)
    const periyotGroups = new Map<string, number[]>();
    for (const idx of subIndices) {
      const pk = getPeriyotKey(rows[idx].tarih, periyot);
      if (!periyotGroups.has(pk)) periyotGroups.set(pk, []);
      periyotGroups.get(pk)!.push(idx);
    }

    const periyotLabel = periyot === 'gun' ? 'günde' : periyot === 'ay' ? 'ayda' : periyot === 'yil' ? 'yılda' : periyot === 'hafta' ? 'haftada' : '';

    // gun_aralik ve ay_aralik: minimum aralık kontrolü (sliding window)
    if (periyot === 'gun_aralik' || periyot === 'ay_aralik') {
      // limit = aralık değeri (ör: 10 gün, 3 ay), 1 kez yapılabilir her aralıkta
      const aralikGun = periyot === 'ay_aralik' ? correctedLimit * 30 : correctedLimit;
      // Tarihe göre sırala
      const sorted = [...subIndices].sort((a, b) => {
        const da = normalizeDate(rows[a].tarih);
        const db = normalizeDate(rows[b].tarih);
        return da.localeCompare(db);
      });
      // Her ardışık çift arasında aralık kontrolü
      for (let j = 1; j < sorted.length; j++) {
        const prevDate = new Date(normalizeDate(rows[sorted[j - 1]].tarih));
        const currDate = new Date(normalizeDate(rows[sorted[j]].tarih));
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < aralikGun) {
          const result = results[sorted[j]];
          if (result) {
            result.ihlaller.push({
              ihlal_kodu: 'SIKLIK_006',
              ihlal_aciklamasi: `Bu işlem ${isAyniBrans ? 'aynı branşta ' : ''}${isAyniDis ? 'aynı diş için ' : ''}en az ${correctedLimit} ${periyot === 'ay_aralik' ? 'ay' : 'gün'} arayla yapılabilir. Önceki işlemden ${diffDays} gün sonra yapılmış.`,
              kaynak: siklikRule.kaynak || result.eslesen_kural?.kaynak || 'GİL',
              referans_kural_metni: siklikRule.rawText,
              fromSectionHeader: siklikRule.fromSectionHeader,
              kural_tipi: 'SIKLIK_LIMIT',
            });
            if (result.uygunluk_durumu === 'UYGUN') {
              result.uygunluk_durumu = 'UYGUNSUZ';
            }
          }
        }
      }
      continue;
    }

    for (const [, groupIndices] of periyotGroups) {
      if (groupIndices.length > correctedLimit) {
        // limit aşan satırları işaretle
        for (let j = correctedLimit; j < groupIndices.length; j++) {
          const result = results[groupIndices[j]];
          if (result) {
            result.ihlaller.push({
              ihlal_kodu: 'SIKLIK_006',
              ihlal_aciklamasi: `Bu işlem ${isAyniBrans ? 'aynı branşta ' : ''}${isAyniDis ? 'aynı diş için ' : ''}${periyotLabel ? periyotLabel + ' ' : ''}en fazla ${correctedLimit} kez yapılabilir. Toplam: ${groupIndices.length}`,
              kaynak: siklikRule.kaynak || result.eslesen_kural?.kaynak || 'GİL',
              referans_kural_metni: siklikRule.rawText,
              fromSectionHeader: siklikRule.fromSectionHeader,
              kural_tipi: 'SIKLIK_LIMIT',
            });
            if (result.uygunluk_durumu === 'UYGUN') {
              result.uygunluk_durumu = 'UYGUNSUZ';
            }
          }
        }
      }
    }
    } // end for subIndices
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

  // Kurumdaki mevcut uzmanlıkları ön-hesapla (branş muafiyet kontrolleri için)
  const mevcutUzmanliklar = new Set<string>();
  for (const row of rows) {
    if (row.uzmanlik) mevcutUzmanliklar.add(turkishLower(row.uzmanlik).trim());
  }

  // Batch processing
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, rows.length);

    for (let j = i; j < batchEnd; j++) {
      const row = rows[j];
      const sessionKey = `${row.hastaTc}_${row.tarih}`;
      const sameSessionRows = sessionMap.get(sessionKey) || [];
      results.push(analyzeRow(row, j, rulesMaster, kurumBasamak, sameSessionRows, mevcutUzmanliklar));
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
    YAS_KISITI: 0,
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
  results: ComplianceResult[],
  extraColumnKeys?: string[]
): ArrayBuffer {
  const exportData: any[][] = [];
  const extras = extraColumnKeys || [];

  // Header
  exportData.push([
    'Tarih', 'Saat', 'Uzmanlık', 'Doktor', 'Dr.Tipi',
    'GİL Kodu', 'GİL Adı', 'Miktar', 'Puan', 'Toplam Puan',
    'Fiyat', 'Tutar', 'Hasta TC', 'Adı Soyadı', 'İşlem No', 'Diş No',
    ...extras,
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
    const extraValues = extras.map(key => row[key] ?? '');

    exportData.push([
      row.tarih, row.saat, row.uzmanlik, row.doktor, row.drTipi,
      row.gilKodu, row.gilAdi, row.miktar, row.puan, row.toplamPuan,
      row.fiyat, row.tutar, row.hastaTc, row.adiSoyadi, row.islemNo, row.disNumarasi,
      ...extraValues,
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
