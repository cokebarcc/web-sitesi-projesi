// ═══════════════════════════════════════════════════════════════
// Compliance Analysis — Uygunluk Analiz Fonksiyonları
// complianceEngine.ts'den ayrılmış saf hesaplama fonksiyonları.
// XLSX bağımlılığı yoktur — hem ana thread hem Worker kullanabilir.
// ═══════════════════════════════════════════════════════════════

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
export function turkishLower(str: string): string {
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
// GİL KODU NORMALİZASYON — Prefix temizleme (P/S harfi)
// ═══════════════════════════════════════════════════════════════

export function normalizeGilKodu(kodu: string): string {
  const trimmed = kodu.trim();
  // Nokta/tire gibi ayırıcıları temizle (700.600 → 700600, R100.040 → R100040)
  // Prefix harfi (R/P/L/S) korunur — rulesMaster'da key olarak kullanılır
  return trimmed.replace(/[.\-]/g, '');
}

// ═══════════════════════════════════════════════════════════════
// BRANŞ EŞLEŞTİRME SİSTEMİ — Akıllı alias + fuzzy matching
// ═══════════════════════════════════════════════════════════════

const BRANS_ALIAS_GROUPS: string[][] = [
  ['kadın hastalıkları ve doğum', 'kadın doğum', 'kadın hastalıkları doğum', 'jinekoloji', 'jinekoloji ve obstetrik', 'obstetrik'],
  ['çocuk sağlığı ve hastalıkları', 'çocuk hastalıkları', 'pediatri', 'çocuk'],
  ['genel cerrahi', 'cerrahi'],
  ['kulak burun boğaz hastalıkları', 'kulak burun boğaz', 'kbb'],
  ['göz hastalıkları', 'göz'],
  ['ortopedi ve travmatoloji', 'ortopedi', 'travmatoloji'],
  ['iç hastalıkları', 'dahiliye'],
  ['anesteziyoloji ve reanimasyon', 'anesteziyoloji', 'anestezi', 'reanimasyon'],
  ['göğüs hastalıkları', 'göğüs'],
  ['göğüs cerrahisi'],
  ['deri ve zührevi hastalıkları', 'deri hastalıkları', 'dermatoloji', 'cildiye'],
  ['nöroloji', 'sinir hastalıkları'],
  ['beyin ve sinir cerrahisi', 'beyin cerrahisi', 'nöroşirürji'],
  ['kalp ve damar cerrahisi', 'kalp damar cerrahisi', 'kardiyovasküler cerrahi'],
  ['kardiyoloji', 'kalp hastalıkları'],
  ['üroloji', 'çocuk ürolojisi'],
  ['fiziksel tıp ve rehabilitasyon', 'fizik tedavi ve rehabilitasyon', 'fizik tedavi', 'ftr', 'rehabilitasyon'],
  ['ruh sağlığı ve hastalıkları', 'psikiyatri', 'ruh sağlığı'],
  ['çocuk ve ergen ruh sağlığı ve hastalıkları', 'çocuk psikiyatrisi', 'çocuk ruh sağlığı'],
  ['plastik, rekonstrüktif ve estetik cerrahi', 'plastik cerrahi', 'plastik rekonstrüktif cerrahi', 'estetik cerrahi'],
  ['enfeksiyon hastalıkları ve klinik mikrobiyoloji', 'enfeksiyon hastalıkları', 'enfeksiyon'],
  ['acil tıp', 'acil'],
  ['aile hekimliği', 'aile hekimi', 'pratisyen'],
  ['radyoloji', 'tıbbi görüntüleme'],
  ['nükleer tıp'],
  ['patoloji', 'tıbbi patoloji'],
  ['endokrinoloji ve metabolizma hastalıkları', 'endokrinoloji', 'metabolizma'],
  ['gastroenteroloji', 'gastroenteroloji cerrahisi'],
  ['nefroloji', 'böbrek hastalıkları'],
  ['hematoloji', 'kan hastalıkları'],
  ['tıbbi onkoloji', 'onkoloji'],
  ['romatoloji'],
  ['perinatoloji', 'yüksek riskli gebelik'],
  ['jinekolojik onkoloji cerrahisi', 'jinekolojik onkoloji'],
  ['çocuk cerrahisi'],
  ['spor hekimliği'],
  ['ağız, diş ve çene cerrahisi', 'ağız diş ve çene cerrahisi', 'diş hekimliği', 'diş hekimi', 'diş', 'ağız diş', 'diş hastalıkları ve tedavisi', 'diş hastalıkları', 'diş protez', 'ağız diş ve çene hastalıkları'],
];

const _bransAliasMap = new Map<string, Set<string>>();
for (const group of BRANS_ALIAS_GROUPS) {
  const normalized = group.map(g => turkishLower(g.trim()));
  const aliasSet = new Set(normalized);
  for (const alias of normalized) {
    _bransAliasMap.set(alias, aliasSet);
  }
}

export function branslarEslesiyor(hekim: string, kural: string): boolean {
  const h = turkishLower(hekim.trim());
  const k = turkishLower(kural.trim());

  if (h === k) return true;

  const hGroup = _bransAliasMap.get(h);
  if (hGroup && hGroup.has(k)) return true;

  function safeIncludes(haystack: string, needle: string): boolean {
    if (!haystack.includes(needle)) return false;
    if (needle.length <= 6 || !needle.includes(' ')) {
      const idx = haystack.indexOf(needle);
      const before = idx > 0 ? haystack[idx - 1] : ' ';
      const after = idx + needle.length < haystack.length ? haystack[idx + needle.length] : ' ';
      const isBefore = before === ' ' || before === ',' || before === ';' || before === '(' || before === ')';
      const isAfter = after === ' ' || after === ',' || after === ';' || after === '(' || after === ')';
      if (!isBefore || !isAfter) return false;
    }
    if (needle.length < haystack.length * 0.4) return false;
    return true;
  }

  if (hGroup) {
    for (const alias of hGroup) {
      if (!alias.includes(' ') && k.includes(' ')) {
        if (safeIncludes(alias, k)) return true;
      } else {
        if (safeIncludes(alias, k) || safeIncludes(k, alias)) return true;
      }
    }
  }
  const kGroup = _bransAliasMap.get(k);
  if (kGroup) {
    for (const alias of kGroup) {
      if (!alias.includes(' ') && h.includes(' ')) {
        if (safeIncludes(alias, h)) return true;
      } else {
        if (safeIncludes(alias, h) || safeIncludes(h, alias)) return true;
      }
    }
  }

  if (safeIncludes(h, k) || safeIncludes(k, h)) return true;

  const stopWords = new Set(['ve', 'ile', 'veya', 'için', 'olan', 'bir']);
  const hTokens = h.split(/[\s,;()]+/).filter(t => t.length > 1 && !stopWords.has(t));
  const kTokens = k.split(/[\s,;()]+/).filter(t => t.length > 1 && !stopWords.has(t));

  if (hTokens.length === 0 || kTokens.length === 0) return false;

  const matchCount = kTokens.filter(kt => hTokens.some(ht => ht.includes(kt) || kt.includes(ht))).length;
  const matchRatio = matchCount / kTokens.length;

  if (matchRatio >= 0.6) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════
// TEK SATIR ANALİZİ
// ═══════════════════════════════════════════════════════════════
export function analyzeRow(
  row: IslemSatiriLike,
  rowIndex: number,
  rulesMaster: Map<string, RuleMasterEntry>,
  kurumBasamak: number,
  sameSessionRows: IslemSatiriLike[],
  mevcutUzmanliklar: Set<string>
): ComplianceResult {
  const normalizedKodu = normalizeGilKodu(row.gilKodu);
  const entry = rulesMaster.get(normalizedKodu);

  if (!entry) {
    return {
      satirIndex: rowIndex,
      uygunluk_durumu: 'ESLESEMEDI',
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

        const basamakRawLower = turkishLower(rule.rawText || '');
        const basamakArtirimPattern = /(?:ilave|art[ıi]r[ıi]m|%\s*\d+|ek\s*puan|fark[ıi]|fazla\s*puan)/;
        if (basamakArtirimPattern.test(basamakRawLower)) break;

        if (allowed) {
          let isViolation = false;
          if (basamakMode === 've_uzeri') {
            const minBasamak = Math.min(...allowed);
            isViolation = kurumBasamak < minBasamak;
          } else {
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
        const bransStopWords = new Set([
          'için', 'icin', 'olan', 'olarak', 'ile', 'bir', 'her', 'bu', 'şu', 'de', 'da',
          'den', 'dan', 'dir', 'dır', 'ise', 'gibi', 'kadar', 'sonra', 'önce', 'once',
          'ancak', 'sadece', 'bizzat', 'tarafından', 'tarafindan', 'halinde', 'yapılır',
          'faturalandırılır', 'puanlandırılır', 'uygulanır', 'gerekir', 'gerekmektedir',
        ]);
        const servisAdlari = new Set([
          'palyatif bakım', 'palyatif bakim', 'yoğun bakım', 'yogun bakim',
          'acil servis', 'yataklı servis', 'yatakli servis', 'poliklinik',
          'ameliyathane', 'laboratuvar', 'eczane',
        ]);
        const rawTextLower = turkishLower(rule.rawText || '');

        const branslar = _rawBranslar?.filter(b => {
          const bLower = turkishLower(b);
          if (b.length <= 2) return false;
          if (bransStopWords.has(bLower)) return false;
          if (servisAdlari.has(bLower)) return false;
          if (/^['"]?[a-z]\d+\.\d/i.test(b.trim())) return false;
          if (/^(di[gğ]er|tan[ıi]mlanmam[ıi][sş])$/i.test(b.trim())) return false;
          if (b.trim().length <= 4 && b.trim().split(/\s+/).length === 1) return false;
          if (bLower === 'anestezi') {
            let allMethod = true;
            let searchIdx = 0;
            while (searchIdx < rawTextLower.length) {
              const idx = rawTextLower.indexOf('anestezi', searchIdx);
              if (idx === -1) break;
              const before = rawTextLower.substring(Math.max(0, idx - 20), idx).trim();
              const after = rawTextLower.substring(idx + 8, idx + 25).trim();
              const isMethodBefore = /(?:genel|lokal|rejyonel|spinal|epidural|sedasyon)\s*$/.test(before);
              const isMethodAfter = /^(?:alt[ıi]nda|ile\b|uygulan)/.test(after);
              if (!isMethodBefore && !isMethodAfter) {
                allMethod = false;
                break;
              }
              searchIdx = idx + 8;
            }
            if (allMethod) return false;
          }
          return true;
        });

        const genisleticiPattern = /\b(i[cç]in\s+de|taraf[ıi]ndan\s+da|uzman[ıi]\s+hekimler\s+i[cç]in\s+de|da\s+yapabilir|da\s+yapılabilir|de\s+puanland[ıi]r[ıi]l[ıi]r|da\s+faturaland[ıi]r[ıi]l[ıi]r|da\s+uygulanabilir|durumunda\s+da\s+puanland[ıi]r[ıi]l[ıi]r|durumunda\s+da\s+faturaland[ıi]r[ıi]l[ıi]r)\b/;
        if (bransMode === 'dahil' && genisleticiPattern.test(rawTextLower)) {
          break;
        }

        if (branslar && branslar.length > 0) {
          const allBransAfterGibi = branslar.every(b => {
            const bLower = turkishLower(b);
            const idx = rawTextLower.indexOf(bLower);
            if (idx === -1) return false;
            const afterBrans = rawTextLower.substring(idx + bLower.length, idx + bLower.length + 20).trim();
            return /^gibi\b/.test(afterBrans);
          });
          if (allBransAfterGibi) {
            break;
          }
        }

        const yasAltMatch = rawTextLower.match(/(\d+)\s*ya[sş]\s*(alt[ıi]|altında|altındaki)/);
        const yasUstMatch = rawTextLower.match(/(\d+)\s*ya[sş]\s*([uü]st[uü]|üzerinde|üstündeki|ve\s+[uü]zeri)/);
        if (yasAltMatch && row.yasi) {
          const yasLimit = parseInt(yasAltMatch[1], 10);
          if (row.yasi >= yasLimit) {
            break;
          }
        }
        if (yasUstMatch && row.yasi) {
          const yasLimit = parseInt(yasUstMatch[1], 10);
          if (row.yasi < yasLimit) {
            break;
          }
        }

        if (branslar && branslar.length > 0 && rawTextLower) {
          const bilinenBranslar = [
            'kadın doğum', 'kadın hastalıkları', 'çocuk cerrahisi', 'çocuk üroloji',
            'plastik cerrahi', 'çocuk endokrinoloji', 'genel cerrahi', 'ortopedi',
            'üroloji', 'göz hastalıkları', 'kulak burun boğaz', 'nöroloji',
            'beyin cerrahisi', 'kalp damar cerrahisi', 'göğüs cerrahisi',
            'kardiyoloji', 'gastroenteroloji', 'dermatoloji', 'endokrinoloji',
            'nefroloji', 'hematoloji', 'onkoloji', 'perinatoloji',
          ];
          const branslarLower = new Set(branslar.map(b => turkishLower(b)));
          for (const bb of bilinenBranslar) {
            if (rawTextLower.includes(bb) && !branslarLower.has(bb)) {
              branslar.push(bb);
              branslarLower.add(bb);
            }
          }
        }

        if (branslar && branslar.length > 0) {
          const formattedBranslar = branslar.map(b =>
            b.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          );

          if (bransMode === 'haric') {
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
            const match = branslar.some(b => branslarEslesiyor(row.uzmanlik, b));
            if (!match) {
              const rawLower = turkishLower(rule.rawText || '');
              const yoklukKurali = /bulunmadığında|bulunmadiginda|yokluğunda|yoklugunda|olmadığında|olmadiginda|bulunmayan|yoksa/.test(rawLower);

              if (yoklukKurali) {
                const kisitliBransKurumda = branslar.some(b => {
                  const bLower = turkishLower(b);
                  for (const uzm of mevcutUzmanliklar) {
                    if (branslarEslesiyor(uzm, bLower)) return true;
                  }
                  return false;
                });

                if (kisitliBransKurumda) {
                  ihlaller.push({
                    ihlal_kodu: 'BRANS_002',
                    ihlal_aciklamasi: `Bu işlem şu branşlara kısıtlıdır: ${formattedBranslar.join(', ')}. Hekim branşı: ${row.uzmanlik}. Kurumda ilgili branş hekimi mevcut.`,
                    kaynak: rule.kaynak || entry.kaynak,
                    referans_kural_metni: rule.rawText,
                    fromSectionHeader: rule.fromSectionHeader,
                    kural_tipi: 'BRANS_KISITI',
                  });
                }
              } else {
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
        const birlikteYapilamazMuafKodlar = new Set(['520020', '520021']);
        if (birlikteYapilamazMuafKodlar.has(normalizedKodu)) break;

        const yasakliKodlar = rule.params.yapilamazKodlari as string[];
        const birlikteRawLower = turkishLower(rule.rawText || '');

        const tumIslemlerYasak = (!yasakliKodlar || yasakliKodlar.length === 0)
          && /(?:ba[sş]ka\s+(?:bir\s+)?i[sş]lem|di[gğ]er\s+i[sş]lem|tek\s+ba[sş][ıi]na)/i.test(birlikteRawLower);

        if (tumIslemlerYasak) {
          const conflicting = sameSessionRows.filter(r => {
            if (r === row) return false;
            return normalizeGilKodu(r.gilKodu) !== normalizedKodu;
          });
          if (conflicting.length > 0) {
            const conflictKodlar = [...new Set(conflicting.map(c => c.gilKodu))].slice(0, 5);
            const fazlasi = conflicting.length > 5 ? ` ve ${conflicting.length - 5} diğer işlem` : '';
            ihlaller.push({
              ihlal_kodu: 'BIRLIKTE_003',
              ihlal_aciklamasi: `Bu işlem başka işlemlerle birlikte faturalandırılamaz. Çakışan: ${conflictKodlar.join(', ')}${fazlasi}`,
              kaynak: rule.kaynak || entry.kaynak,
              referans_kural_metni: rule.rawText,
              fromSectionHeader: rule.fromSectionHeader,
              kural_tipi: 'BIRLIKTE_YAPILAMAZ',
            });
          }
        } else if (yasakliKodlar && yasakliKodlar.length > 0) {
          const yasakliNormalized = yasakliKodlar.map(k => k.replace(/\./g, ''));
          const birlikteAyniDis = /ayn[ıi]\s*di[sş]/i.test(birlikteRawLower);

          const conflicting = sameSessionRows.filter(r => {
            if (r === row) return false;
            if (!yasakliNormalized.includes(normalizeGilKodu(r.gilKodu))) return false;
            if (birlikteAyniDis) {
              const rowDis = (row.disNumarasi || '').trim();
              const rDis = (r.disNumarasi || '').trim();
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
        break;
      }

      case 'TANI_KOSULU': {
        const taniRawLower = turkishLower(rule.rawText || '');
        const hasTaniSiklikIstisna = /tan[ıi]lar[ıi]nda.{0,80}(?:en fazla|adet|kez|kere)\s*(?:faturaland|puan)/i.test(taniRawLower);
        const hasGenelSiklik = /\d+\s*(?:günde|g[uü]nde|haftada|ayda|y[ıi]lda)\s+(?:bir|1|en fazla)\s+(?:adet|kez|kere)/i.test(taniRawLower);
        if (hasTaniSiklikIstisna && hasGenelSiklik) {
          break;
        }

        const taniDegeri = (
          (typeof row.tani === 'string' && row.tani.trim()) ||
          String(row['TANI'] || row['Tani'] || row['Tanı'] || row['tani'] || row['tanı'] || row['TANI KODU'] || row['Tani Kodu'] || row['Tanı Kodu'] || '')
        ).trim();
        const requiredKodlar = (rule.params.taniKodlari as string[] || []);

        if (!taniDegeri) {
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
        } else if (requiredKodlar.length > 0) {
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
        break;
      }

      case 'DIS_TEDAVI': {
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

        const yasRawLower = turkishLower(rule.rawText || '');
        const artirimPattern = /art[ıi]r[ıi]ml[ıi]|ilave|fark[ıi]|ek\s*puan|ek\s*ücret|%\s*\d+\s*art[ıi]r[ıi]m|\bfazla\s+puan/;
        if (artirimPattern.test(yasRawLower)) {
          break;
        }

        const yasGenisleticiPattern = /\b(da\s+uygulan|de\s+puanland|da\s+yap[ıi]l|i[cç]in\s+de\s+puanland)\b/;
        if (yasGenisleticiPattern.test(yasRawLower)) {
          break;
        }

        if (isNaN(hastaYasi) || hastaYasi <= 0) {
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
        const genelRawLower = turkishLower(rule.rawText || '');

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

  const puanFarki = entry.islem_puani > 0 ? Math.round((row.puan - entry.islem_puani) * 100) / 100 : undefined;
  const fiyatFarki = entry.islem_fiyati > 0 ? Math.round((row.fiyat - entry.islem_fiyati) * 100) / 100 : undefined;

  for (const ihlal of ihlaller) {
    const matchingRule = entry.parsed_rules.find(r => r.type === ihlal.kural_tipi);
    if (matchingRule && typeof matchingRule.confidence === 'number' && matchingRule.confidence < 0.7) {
      ihlal.ihlal_aciklamasi += ' (düşük güven)';
    }
  }

  let uygunluk: UygunlukDurumu;
  if (ihlaller.length === 0) {
    uygunluk = 'UYGUN';
  } else {
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
export function applySiklikLimitChecks(
  rows: IslemSatiriLike[],
  results: ComplianceResult[],
  rulesMaster: Map<string, RuleMasterEntry>
) {
  function normalizeDate(tarih: string): string {
    const t = tarih.trim();
    const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return t;
  }

  function getYearMonth(normalizedDate: string): string {
    return normalizedDate.substring(0, 7);
  }

  function getYear(normalizedDate: string): string {
    return normalizedDate.substring(0, 4);
  }

  function getYearWeek(normalizedDate: string): string {
    const parts = normalizedDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  function getPeriyotKey(tarih: string, periyot: string): string {
    const nd = normalizeDate(tarih);
    switch (periyot) {
      case 'gun': return nd;
      case 'hafta': return getYearWeek(nd);
      case 'ay': return getYearMonth(nd);
      case 'yil': return getYear(nd);
      default: return 'all';
    }
  }

  const codeMap = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = `${row.hastaTc}_${normalizeGilKodu(row.gilKodu)}`;
    if (!codeMap.has(key)) codeMap.set(key, []);
    codeMap.get(key)!.push(i);
  }

  const siklikMuafKodlar = new Set(['520020', '520021', '520022', '520023', '520024']);

  // 520046 özel kuralı
  {
    const islemNoMap520046 = new Map<string, number[]>();
    for (let i = 0; i < rows.length; i++) {
      if (normalizeGilKodu(rows[i].gilKodu) !== '520046') continue;
      const mapKey = `${rows[i].hastaTc}_${(rows[i].islemNo || '').trim()}`;
      if (!islemNoMap520046.has(mapKey)) islemNoMap520046.set(mapKey, []);
      islemNoMap520046.get(mapKey)!.push(i);
    }

    for (const [, idxList] of islemNoMap520046) {
      if (idxList.length <= 1) continue;

      const sorted = [...idxList].sort((a, b) => {
        const da = normalizeDate(rows[a].tarih);
        const db = normalizeDate(rows[b].tarih);
        return da.localeCompare(db) || a - b;
      });

      for (let j = 1; j < sorted.length; j++) {
        const result = results[sorted[j]];
        if (result) {
          const firstRow = rows[sorted[0]];
          const islemNo = (rows[sorted[j]].islemNo || '').trim();
          const firstDetay = firstRow
            ? ` (İlk giriş: ${firstRow.tarih} tarihinde ${firstRow.doktor || ''} tarafından girilmiş)`
            : '';
          result.ihlaller.push({
            ihlal_kodu: 'SIKLIK_006',
            ihlal_aciklamasi: `Bu işlem (520046 - Yatan hasta taburculuk değerlendirmesi) aynı işlem numarası (${islemNo}) ile birden fazla faturalandırılamaz. Bu işlem numarasında ${sorted.length} adet bulundu.${firstDetay}`,
            kaynak: result.eslesen_kural?.kaynak || 'GİL',
            referans_kural_metni: 'Aynı işlem numarası ile birden fazla 520046 faturalandırılamaz (özel kural).',
            fromSectionHeader: true,
            kural_tipi: 'SIKLIK_LIMIT',
          });
          if (result.uygunluk_durumu === 'UYGUN') {
            result.uygunluk_durumu = 'UYGUNSUZ';
          }
        }
      }
    }
  }

  for (const [key, indices] of codeMap) {
    if (indices.length <= 1) continue;

    const gilKodu = key.split('_').slice(1).join('_');
    if (gilKodu === '520046') continue;
    if (siklikMuafKodlar.has(gilKodu)) continue;

    const entry = rulesMaster.get(gilKodu);
    if (!entry) continue;

    const siklikRule = entry.parsed_rules.find(r => r.type === 'SIKLIK_LIMIT');
    if (!siklikRule) continue;

    const limit = siklikRule.params.limit as number;
    let periyot = siklikRule.params.periyot as string;

    if (periyot === 'ay_aralik' && siklikRule.rawText) {
      const gunMatch = siklikRule.rawText.match(/(\d+)\s*g[uü]n/i);
      if (gunMatch) {
        const gunSayisi = parseInt(gunMatch[1], 10);
        if (gunSayisi > 0) {
          periyot = 'gun_aralik';
          (siklikRule.params as any).periyot = 'gun_aralik';
          (siklikRule.params as any).limit = gunSayisi;
        }
      }
    }

    const correctedLimit = siklikRule.params.limit as number;

    const rawTextLower = turkishLower(siklikRule.rawText || '');
    const isAyniDis = /ayn[ıi]\s*di[sş]/i.test(rawTextLower);
    const isAyniBrans = /ayn[ıi]\s*bran[sş]/i.test(rawTextLower);

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

    const periyotGroups = new Map<string, number[]>();
    for (const idx of subIndices) {
      const pk = getPeriyotKey(rows[idx].tarih, periyot);
      if (!periyotGroups.has(pk)) periyotGroups.set(pk, []);
      periyotGroups.get(pk)!.push(idx);
    }

    const periyotLabel = periyot === 'gun' ? 'günde' : periyot === 'ay' ? 'ayda' : periyot === 'yil' ? 'yılda' : periyot === 'hafta' ? 'haftada' : '';

    if (periyot === 'gun_aralik' || periyot === 'ay_aralik') {
      const aralikGun = periyot === 'ay_aralik' ? correctedLimit * 30 : correctedLimit;
      const sorted = [...subIndices].sort((a, b) => {
        const da = normalizeDate(rows[a].tarih);
        const db = normalizeDate(rows[b].tarih);
        return da.localeCompare(db);
      });
      for (let j = 1; j < sorted.length; j++) {
        const prevDate = new Date(normalizeDate(rows[sorted[j - 1]].tarih));
        const currDate = new Date(normalizeDate(rows[sorted[j]].tarih));
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < aralikGun) {
          const result = results[sorted[j]];
          if (result) {
            const prevRow = rows[sorted[j - 1]];
            const prevDetay = prevRow
              ? ` (Önceki: ${prevRow.tarih} tarihinde ${prevRow.doktor || ''} tarafından ${prevRow.gilKodu} ${(prevRow.gilAdi || '').substring(0, 40)} olarak girilmiş)`
              : '';
            result.ihlaller.push({
              ihlal_kodu: 'SIKLIK_006',
              ihlal_aciklamasi: `Bu işlem ${isAyniBrans ? 'aynı branşta ' : ''}${isAyniDis ? 'aynı diş için ' : ''}en az ${correctedLimit} ${periyot === 'ay_aralik' ? 'ay' : 'gün'} arayla yapılabilir. Önceki işlemden ${diffDays} gün sonra yapılmış.${prevDetay}`,
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
        const refRows = groupIndices.slice(0, correctedLimit).map(idx => {
          const r = rows[idx];
          return r ? `${r.tarih} ${r.doktor || ''} ${r.gilKodu}` : '';
        }).filter(Boolean);
        const refDetay = refRows.length > 0
          ? ` (İlk giriş: ${refRows[0]}${refRows.length > 1 ? ` ve ${refRows.length - 1} diğer` : ''})`
          : '';

        for (let j = correctedLimit; j < groupIndices.length; j++) {
          const result = results[groupIndices[j]];
          if (result) {
            result.ihlaller.push({
              ihlal_kodu: 'SIKLIK_006',
              ihlal_aciklamasi: `Bu işlem ${isAyniBrans ? 'aynı branşta ' : ''}${isAyniDis ? 'aynı diş için ' : ''}${periyotLabel ? periyotLabel + ' ' : ''}en fazla ${correctedLimit} kez yapılabilir. Toplam: ${groupIndices.length}${refDetay}`,
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

  const sessionMap = new Map<string, IslemSatiriLike[]>();
  for (const row of rows) {
    const key = `${row.hastaTc}_${row.tarih}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(row);
  }

  const mevcutUzmanliklar = new Set<string>();
  for (const row of rows) {
    if (row.uzmanlik) mevcutUzmanliklar.add(turkishLower(row.uzmanlik).trim());
  }

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

    await new Promise(resolve => setTimeout(resolve, 0));
  }

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
    else if (r.uygunluk_durumu === 'ESLESEMEDI') eslesmeyen++;
    else manuel++;

    if (r.eslesmeDurumu === 'ESLESTI') eslesen++;

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
