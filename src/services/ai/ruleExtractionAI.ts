// ═══════════════════════════════════════════════════════════════
// AI Destekli Kural Çıkarma Servisi
// Claude ile SUT mevzuat metinlerinden yapılandırılmış kural çıkarma
// Sonuçlar Firestore + localStorage'da cache'lenir
// Firestore: tüm kullanıcılar arası paylaşım | localStorage: fallback
// ═══════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ParsedRule, AIParsedRuleCache } from '../../types/complianceTypes';

// ── Sabitler ──
const PROMPT_VERSION = 'v1.0';
const BATCH_SIZE = 10;
const CACHE_COLLECTION = 'ruleParseCache';
const LOCAL_CACHE_KEY = 'aiRuleCache_store';
const RATE_LIMIT_MS = 250;

// ── Hash fonksiyonu (cache key) ──
function hashAciklama(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `acik_${Math.abs(hash).toString(36)}_${text.length}`;
}

// ── Claude System Prompt ──
const RULE_EXTRACTION_SYSTEM_PROMPT = `Sen bir Türkiye sağlık mevzuatı (SUT - Sağlık Uygulama Tebliği) uzmanısın.
Görev: Verilen açıklama metinlerinden yapılandırılmış kurallar çıkar.

KURAL TİPLERİ:

1. BASAMAK_KISITI: İşlemin hangi basamak hastanelerde yapılabileceği.
   - basamaklar: number[] (izin verilen basamaklar: 1, 2, 3)
   - mode: "sadece" (yalnızca bu basamaklarda) veya "ve_uzeri" (bu basamak ve üstü)
   - DİKKAT: "üçüncü basamakta %30 ilave edilir" gibi puan artışı ifadeleri BASAMAK_KISITI DEĞİLDİR.
     Bu tür ifadeleri GENEL_ACIKLAMA olarak işaretle.

2. BRANS_KISITI: İşlemin hangi uzmanlık dallarınca yapılabileceği.
   - branslar: string[] (ilgili branş listesi)
   - mode: "dahil" (SADECE bu branşlar yapabilir) veya "haric" (bu branşlar HARİÇ herkes yapabilir)
   - KRİTİK OLUMSUZLUK KURALLARI:
     * "sadece X uzmanları tarafından" → mode: "dahil", branslar: ["X"]
     * "yalnızca X hekimlerince" → mode: "dahil", branslar: ["X"]
     * "X uzmanı haricindeki hekimlerce" → mode: "haric", branslar: ["X"]
     * "X dışındaki hekimler tarafından" → mode: "haric", branslar: ["X"]
     * "X uzmanları tarafından yapılması halinde faturalandırılır" → mode: "dahil", branslar: ["X"]
     * "X tarafından yapılan ... puanlandırılmaz" → bu X'in YAPAMAYACAĞI anlamına gelebilir, dikkatli analiz et

3. BIRLIKTE_YAPILAMAZ: Aynı seansta birlikte faturalandırılması yasak kodlar.
   - yapilamazKodlari: string[] (işlem kodları, 5-7 haneli sayılar)

4. SIKLIK_LIMIT: İşlemin ne sıklıkta yapılabileceği.
   - periyot: "gun" | "hafta" | "ay" | "yil"
   - limit: number

5. TANI_KOSULU: İşlem için gerekli ICD-10 tanı kodları.
   - taniKodlari: string[] (ICD-10 formatı: harf + 2 rakam + opsiyonel . + rakamlar)

6. DIS_TEDAVI: Diş tedavisiyle ilgili özel kurallar.
   - disKurali: string

7. GENEL_ACIKLAMA: Yukarıdaki kategorilere girmeyen önemli bilgiler, puan artışları vb.
   - metin: string

YANITLAMA KURALLARI:
- Her açıklama için JSON array döndür.
- Boş veya anlamsız açıklamalar için boş array [] döndür.
- Her kural için confidence (0-1) ve kısa explanation ekle.
- Birden fazla kural tipi olabilir (hem BRANS_KISITI hem SIKLIK_LIMIT gibi).
- Branş isimlerini küçük harfle yaz.

ÖRNEKLER:

Girdi: "Sadece radyoloji uzmanları tarafından yapılması halinde faturalandırılır."
Çıktı: [{"type":"BRANS_KISITI","params":{"branslar":["radyoloji"],"mode":"dahil"},"confidence":0.95,"explanation":"Sadece radyoloji uzmanlarına kısıtlı."}]

Girdi: "Radyoloji uzmanı haricindeki hekimlerce muayenenin bir parçası olarak yapılan US/renkli Doppler US puanlandırılır."
Çıktı: [{"type":"BRANS_KISITI","params":{"branslar":["radyoloji"],"mode":"haric"},"confidence":0.90,"explanation":"Radyoloji haricindeki hekimler yapabilir, radyoloji uzmanı yapamaz."}]

Girdi: "Üçüncü basamak sağlık hizmeti sunucularının bünyesindeki Arındırma Merkezlerinde yapılan işlem puanlarına %30 ilave edilir."
Çıktı: [{"type":"GENEL_ACIKLAMA","params":{"metin":"3. basamakta %30 puan ilavesi uygulanır."},"confidence":0.95,"explanation":"Puan artışı bilgisi, basamak kısıtı değil."}]

Girdi: "Üçüncü basamak sağlık hizmeti sunucuları tarafından yapılması halinde faturalandırılır."
Çıktı: [{"type":"BASAMAK_KISITI","params":{"basamaklar":[3],"mode":"sadece"},"confidence":0.90,"explanation":"Yalnızca 3. basamakta faturalandırılabilir."}]

Girdi: "Günde en fazla 3 kez yapılabilir. Sadece nöroloji uzmanlarınca faturalandırılır."
Çıktı: [{"type":"SIKLIK_LIMIT","params":{"periyot":"gun","limit":3},"confidence":0.95,"explanation":"Günde en fazla 3 kez."},{"type":"BRANS_KISITI","params":{"branslar":["nöroloji"],"mode":"dahil"},"confidence":0.95,"explanation":"Sadece nöroloji uzmanlarına kısıtlı."}]`;

// ── Batch user prompt oluştur ──
function buildBatchUserPrompt(aciklamaTexts: string[]): string {
  const items = aciklamaTexts.map((text, i) => `[${i}] "${text}"`).join('\n');
  return `Aşağıdaki ${aciklamaTexts.length} açıklama metnini analiz et ve her biri için kural JSON dizisi döndür.

${items}

YANIT: Strict JSON objesi döndür, key olarak index numaraları kullan:
{"0": [...kurallar...], "1": [...kurallar...], ...}
Eğer bir metin için kural yoksa boş dizi kullan: "2": []`;
}

// ═══════════════════════════════════════════════════════════════
// İKİ KATMANLI CACHE: Firestore (paylaşımlı) + localStorage (fallback)
// ═══════════════════════════════════════════════════════════════

let firestoreAvailable = true; // Firestore erişimi var mı?

// ── localStorage cache yardımcıları ──
interface LocalCacheStore {
  promptVersion: string;
  entries: Record<string, ParsedRule[]>;
}

function loadLocalCache(): LocalCacheStore {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw) as LocalCacheStore;
      if (store.promptVersion === PROMPT_VERSION) return store;
      console.log(`[CACHE] Prompt version değişti → localStorage temizleniyor.`);
    }
  } catch { /* parse hatası */ }
  return { promptVersion: PROMPT_VERSION, entries: {} };
}

function saveLocalCache(store: LocalCacheStore): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(store));
  } catch {
    console.warn('[CACHE] localStorage dolu, cache temizleniyor.');
    try { localStorage.removeItem(LOCAL_CACHE_KEY); } catch { /* ignore */ }
  }
}

// ── Birleşik cache okuma: Firestore → localStorage fallback ──
async function getCachedRules(aciklamaTexts: string[]): Promise<Map<string, ParsedRule[]>> {
  const cache = new Map<string, ParsedRule[]>();
  const localStore = loadLocalCache();
  let localHits = 0;

  // 1. Önce localStorage'dan oku (hızlı, her zaman çalışır)
  for (const text of aciklamaTexts) {
    const hash = hashAciklama(text);
    if (localStore.entries[hash]) {
      cache.set(text, localStore.entries[hash]);
      localHits++;
    }
  }

  // Tümü localStorage'da bulunduysa Firestore'a gitmeye gerek yok
  if (localHits === aciklamaTexts.length) {
    console.log(`[CACHE] localStorage: ${localHits}/${aciklamaTexts.length} — tümü cache'te.`);
    return cache;
  }

  // 2. Firestore'da olup localStorage'da olmayan entry'leri ara
  if (firestoreAvailable) {
    const missing = aciklamaTexts.filter(t => !cache.has(t));
    let firestoreHits = 0;
    let firestoreErrors = 0;

    // İlk birkaç entry'yi test et — permission varsa devam et
    const testBatch = missing.slice(0, Math.min(3, missing.length));
    for (const text of testBatch) {
      const hash = hashAciklama(text);
      try {
        const docRef = doc(db, CACHE_COLLECTION, hash);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AIParsedRuleCache;
          if (data.promptVersion === PROMPT_VERSION) {
            cache.set(text, data.parsedRules);
            localStore.entries[hash] = data.parsedRules; // localStorage'a da yaz
            firestoreHits++;
          }
        }
      } catch (err: any) {
        firestoreErrors++;
        if (firestoreErrors >= 2) {
          firestoreAvailable = false;
          console.warn(`[CACHE] Firestore erişim hatası — bu oturum için devre dışı. localStorage kullanılacak.`, err?.message || '');
          break;
        }
      }
    }

    // Firestore çalışıyorsa geri kalanları da kontrol et
    if (firestoreAvailable && testBatch.length < missing.length) {
      const remaining = missing.slice(testBatch.length);
      const batchChecks = remaining.map(async (text) => {
        const hash = hashAciklama(text);
        try {
          const docRef = doc(db, CACHE_COLLECTION, hash);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as AIParsedRuleCache;
            if (data.promptVersion === PROMPT_VERSION) {
              cache.set(text, data.parsedRules);
              localStore.entries[hash] = data.parsedRules;
              firestoreHits++;
            }
          }
        } catch { /* sessiz */ }
      });
      await Promise.all(batchChecks);
    }

    // Firestore'dan alınan entry'leri localStorage'a kaydet
    if (firestoreHits > 0) {
      saveLocalCache(localStore);
      console.log(`[CACHE] Firestore: ${firestoreHits} yeni entry localStorage'a aktarıldı.`);
    }
  }

  console.log(`[CACHE] Toplam: ${cache.size}/${aciklamaTexts.length} cache hit (localStorage: ${localHits}, Firestore: ${cache.size - localHits})`);
  return cache;
}

// ── Birleşik cache yazma: Firestore + localStorage ──
async function cacheBatchRules(results: Map<string, ParsedRule[]>): Promise<void> {
  if (results.size === 0) return;

  const localStore = loadLocalCache();

  // 1. Tüm sonuçları localStorage'a yaz (her zaman)
  for (const [text, rules] of results) {
    const hash = hashAciklama(text);
    localStore.entries[hash] = rules;
  }
  saveLocalCache(localStore);

  // 2. Firestore'a da yaz (erişim varsa)
  if (firestoreAvailable) {
    const writes = Array.from(results.entries()).map(async ([text, rules]) => {
      const hash = hashAciklama(text);
      const cacheEntry: AIParsedRuleCache = {
        aciklamaHash: hash,
        aciklamaText: text,
        parsedRules: rules,
        modelVersion: 'claude-sonnet-4-20250514',
        promptVersion: PROMPT_VERSION,
        createdAt: Date.now(),
      };
      try {
        await setDoc(doc(db, CACHE_COLLECTION, hash), cacheEntry);
      } catch (err: any) {
        // Yazma hatası — Firestore'u devre dışı bırak ama localStorage çalışmaya devam eder
        if (firestoreAvailable) {
          firestoreAvailable = false;
          console.warn(`[CACHE] Firestore yazma hatası — devre dışı bırakıldı. localStorage aktif.`, err?.message || '');
        }
      }
    });
    await Promise.all(writes);
    if (firestoreAvailable) {
      console.log(`[CACHE] ${results.size} entry Firestore + localStorage'a kaydedildi.`);
    }
  } else {
    console.log(`[CACHE] ${results.size} entry localStorage'a kaydedildi (Firestore devre dışı).`);
  }
}

// ── Claude API çağrısı (tek batch) ──
async function callClaudeForBatch(
  client: Anthropic,
  batch: string[]
): Promise<Map<string, ParsedRule[]>> {
  const result = new Map<string, ParsedRule[]>();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: RULE_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildBatchUserPrompt(batch) }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.warn('[AI RULE EXTRACT] Claude boş yanıt döndü');
      for (const text of batch) result.set(text, []);
      return result;
    }

    // JSON parse (markdown code block desteği)
    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const parsed = JSON.parse(jsonStr.trim());

    for (let i = 0; i < batch.length; i++) {
      const rules = parsed[String(i)] || [];
      const typedRules: ParsedRule[] = rules.map((r: any) => ({
        type: r.type,
        rawText: batch[i],
        params: r.params || {},
        confidence: r.confidence || 0.8,
        extractionMethod: 'ai' as const,
        aiExplanation: r.explanation,
      }));
      result.set(batch[i], typedRules);
    }

    // Token kullanımını logla
    if (response.usage) {
      console.log(`[AI RULE EXTRACT] Batch: ${batch.length} açıklama, Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
    }
  } catch (err) {
    console.error('[AI RULE EXTRACT] Claude API hatası:', err);
    // Hata durumunda boş sonuç
    for (const text of batch) result.set(text, []);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON: AI ile kural çıkarma
// ═══════════════════════════════════════════════════════════════
export async function extractRulesWithAI(
  aciklamaTexts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ParsedRule[]>> {
  // 1. Deduplicate + boşları filtrele
  const uniqueTexts = [...new Set(aciklamaTexts.filter(t => t.trim().length > 0))];
  if (uniqueTexts.length === 0) return new Map();

  // 2. İki katmanlı cache kontrol (localStorage → Firestore)
  console.log(`[AI RULE EXTRACT] ${uniqueTexts.length} benzersiz açıklama, cache kontrol ediliyor...`);
  const cached = await getCachedRules(uniqueTexts);
  const uncached = uniqueTexts.filter(t => !cached.has(t));

  console.log(`[AI RULE EXTRACT] Cache: ${cached.size} bulundu, ${uncached.length} AI gerekiyor`);
  onProgress?.(cached.size, uniqueTexts.length);

  // 3. API key kontrol
  if (uncached.length > 0) {
    const apiKey = (import.meta as any).env?.VITE_CLAUDE_API_KEY || localStorage.getItem('claude_api_key') || '';
    if (!apiKey) {
      console.warn('[AI RULE EXTRACT] Claude API key bulunamadı! Regex fallback kullanılacak.');
      return cached;
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // 4. Batch işleme
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const batchResults = await callClaudeForBatch(client, batch);

      // Sonuçları ana map'e ekle
      for (const [text, rules] of batchResults) {
        cached.set(text, rules);
      }

      // İki katmanlı cache'e yaz (Firestore + localStorage)
      await cacheBatchRules(batchResults);

      onProgress?.(cached.size, uniqueTexts.length);

      // Rate limiting
      if (i + BATCH_SIZE < uncached.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }
  }

  console.log(`[AI RULE EXTRACT] Tamamlandı. ${cached.size} kural çıkarıldı.`);
  return cached;
}

// ═══════════════════════════════════════════════════════════════
// AI gerekli mi? Semantik analiz gerektiren keyword'ler
// ═══════════════════════════════════════════════════════════════
export function needsAIExtraction(aciklamaLower: string): boolean {
  // Branş keyword'leri
  const hasBrans = aciklamaLower.includes('branş') || aciklamaLower.includes('uzman') ||
                   aciklamaLower.includes('hekim') || aciklamaLower.includes('tarafından') ||
                   aciklamaLower.includes('tarafindan');

  // Basamak keyword'leri
  const hasBasamak = aciklamaLower.includes('basamak');

  // Olumsuzluk ifadeleri (EN KRİTİK)
  const hasNegation = aciklamaLower.includes('hariç') || aciklamaLower.includes('haricinde') ||
                      aciklamaLower.includes('haricindeki') || aciklamaLower.includes('dışında') ||
                      aciklamaLower.includes('disinda') || aciklamaLower.includes('dışındaki');

  // Koşullu ifadeler
  const hasConditional = aciklamaLower.includes('halinde') || aciklamaLower.includes('koşuluyla') ||
                         aciklamaLower.includes('şartıyla');

  return hasBrans || hasBasamak || hasNegation || hasConditional;
}
