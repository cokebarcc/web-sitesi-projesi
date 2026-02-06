// ═══════════════════════════════════════════════════════════════
// AI Kural Çıkarma Motoru v2.0
// Tüm mevzuat açıklamalarını Claude AI ile analiz eder,
// çıkarılan kuralları Firebase Storage'a JSON olarak kaydeder.
// Sonraki analizlerde kaydedilmiş JSON kullanılır (AI çağrısı gerekmez).
// ═══════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../../../firebase';
import {
  ExtractedRulesJSON,
  ExtractedProcedureEntry,
  ExtractedRule,
  CrossReferenceEntry,
  ExtractedRulesMetadata,
  RuleKaynak,
  AnalysisProgress,
} from '../../types/complianceTypes';

// ── Sabitler ──
const RULES_VERSION = '2.0';
const BATCH_SIZE = 15;
const RATE_LIMIT_MS = 300;
const MODEL_ID = 'claude-sonnet-4-20250514';
const STORAGE_PATH_PREFIX = 'finansal/kurallar';
const FIRESTORE_DOC_PATH = 'appData/finansal';

// ═══════════════════════════════════════════════════════════════
// BRANŞ STANDARTLAŞTIRMA — AI'a verilecek referans listesi
// ═══════════════════════════════════════════════════════════════
const BRANS_STANDART_LISTESI = [
  'kadın hastalıkları ve doğum (jinekoloji, obstetrik)',
  'çocuk sağlığı ve hastalıkları (pediatri)',
  'genel cerrahi',
  'kulak burun boğaz hastalıkları (kbb)',
  'göz hastalıkları',
  'ortopedi ve travmatoloji',
  'iç hastalıkları (dahiliye)',
  'anesteziyoloji ve reanimasyon',
  'göğüs hastalıkları',
  'göğüs cerrahisi',
  'deri ve zührevi hastalıkları (dermatoloji)',
  'nöroloji',
  'beyin ve sinir cerrahisi (nöroşirürji)',
  'kalp ve damar cerrahisi',
  'kardiyoloji',
  'üroloji',
  'fiziksel tıp ve rehabilitasyon (ftr)',
  'ruh sağlığı ve hastalıkları (psikiyatri)',
  'çocuk ve ergen ruh sağlığı ve hastalıkları (çocuk psikiyatrisi)',
  'plastik, rekonstrüktif ve estetik cerrahi',
  'enfeksiyon hastalıkları ve klinik mikrobiyoloji',
  'acil tıp',
  'aile hekimliği',
  'radyoloji',
  'nükleer tıp',
  'patoloji',
  'endokrinoloji ve metabolizma hastalıkları',
  'gastroenteroloji',
  'nefroloji',
  'hematoloji',
  'tıbbi onkoloji',
  'romatoloji',
  'perinatoloji',
  'jinekolojik onkoloji cerrahisi',
  'çocuk cerrahisi',
  'spor hekimliği',
  'ağız, diş ve çene cerrahisi (diş hekimliği, diş hastalıkları ve tedavisi)',
];

// ═══════════════════════════════════════════════════════════════
// AI SYSTEM PROMPT — Kapsamlı kural çıkarma
// ═══════════════════════════════════════════════════════════════
const RULE_EXTRACTION_SYSTEM_PROMPT = `Sen bir Türkiye sağlık mevzuatı uzmanısın (SUT, EK-2B, EK-2C, EK-2Ç, GİL).
Görev: Verilen açıklama metinlerinden yapılandırılmış kurallar çıkar.

KURAL TİPLERİ:

1. BASAMAK_KISITI: İşlemin hangi basamak hastanelerde yapılabileceği.
   params: { basamaklar: number[], mode: "sadece" | "ve_uzeri" }
   - "yalnızca/sadece X. basamak" → mode: "sadece"
   - "X. basamak ve üzeri" → mode: "ve_uzeri"
   - DİKKAT: "üçüncü basamakta %30 ilave" → BASAMAK_KISITI DEĞİLDİR → GENEL_ACIKLAMA

2. BRANS_KISITI: İşlemin YALNIZCA belirli uzmanlık dallarınca yapılabileceği kısıtlama.
   params: { branslar: string[], mode: "dahil" | "haric" }
   - "sadece X uzmanları" / "yalnızca X tarafından" / "X uzmanlarınca yapılır" → mode: "dahil"
   - "X haricindeki hekimler" → mode: "haric"

   ÇOK ÖNEMLİ - GENİŞLETİCİ İFADELER BRANS_KISITI DEĞİLDİR:
   - "X uzmanları da yapabilir" / "X için de puanlandırılır" / "X tarafından da faturalandırılır"
     → Bu ifadeler EK branş ekler, kısıtlama getirmez! BRANS_KISITI OLARAK ÇIKARMA!
     → Bunları GENEL_ACIKLAMA olarak çıkar.
   - "de/da" edatı = genişletici ifade → kısıtlama DEĞİL
   - Örnek: "18 yaş altı hastalarda Gelişimsel Pediatri uzmanı hekimler için de puanlandırılır"
     → Bu, işlemi SADECE Gelişimsel Pediatri'ye kısıtlamıyor!
     → İşlem zaten ilgili branş tarafından yapılabilir, Gelişimsel Pediatri EK olarak ekleniyor.
     → BRANS_KISITI çıkarılMAMALI, GENEL_ACIKLAMA olarak çıkarılmalı.
   - BRANS_KISITI sadece açıkça "SADECE/YALNIZCA X branşı yapabilir" diyen metinlerde çıkarılmalı.

   - BRANŞ İSİMLERİNİ STANDARTLAŞTIR! Aşağıdaki referans listesini kullan:
${BRANS_STANDART_LISTESI.map(b => `     • ${b}`).join('\n')}
   - "diş hekimliği" = "ağız, diş ve çene cerrahisi" = "diş hastalıkları ve tedavisi" → hepsi "ağız, diş ve çene cerrahisi"
   - "kadın doğum" → "kadın hastalıkları ve doğum"
   - Listede yoksa orijinal ismi koru.

3. BIRLIKTE_YAPILAMAZ: Aynı seansta birlikte faturalandırılması yasak kodlar.
   params: { yapilamazKodlari: string[], scope: "genel" | "ayni_dis" | "ayni_seans" }
   - Kodlar 5-7 haneli sayılardır (ör: 520001, 700130)
   - scope: "genel" (varsayılan) → aynı gün herhangi bir durumda birlikte faturalandırılamaz
   - scope: "ayni_dis" → SADECE aynı diş için birlikte faturalandırılamaz (farklı dişlerde sorun yok)
     - "aynı diş için", "aynı dişe", "aynı günde aynı diş" gibi ifadeler → scope: "ayni_dis"
   - scope: "ayni_seans" → aynı seansta birlikte faturalandırılamaz

4. SIKLIK_LIMIT: İşlemin ne sıklıkta yapılabileceği.
   params: { periyot: "gun" | "hafta" | "ay" | "yil" | "gun_aralik" | "ay_aralik" | "genel", limit: number, scope: "islem" | "ayni_dis" }
   - "günde en fazla 3 kez" → periyot: "gun", limit: 3, scope: "islem"
   - "ayda 1 kez" → periyot: "ay", limit: 1, scope: "islem"
   - "10 gün içinde 1 kez" → periyot: "gun_aralik", limit: 10, scope: "islem"
   - "3 ay arayla" → periyot: "ay_aralik", limit: 3, scope: "islem"
   - "ömürde/yaşamda bir kez" → periyot: "genel", limit: 1, scope: "islem"
   - "aynı diş için 180 gün" → periyot: "gun_aralik", limit: 180, scope: "ayni_dis"
   - DİKKAT: "180 gün" → periyot: "gun_aralik", limit: 180. "6 ay" → periyot: "ay_aralik", limit: 6. Bunlar AYNI DEĞİL!
   - scope: "ayni_dis" → sıklık kontrolü sadece aynı diş numarasına sahip işlemler arasında yapılır

5. TANI_KOSULU: İşlem için gerekli ICD-10 tanı kodları.
   params: { taniKodlari: string[] }
   - ICD-10 formatı: harf + 2 rakam + opsiyonel nokta + rakamlar (ör: D50.9, Z01, M54.5)

6. YAS_KISITI: Yaş sınırlaması olan işlemler.
   params: { minYas?: number, maxYas?: number, mode: "aralik" | "alti" | "ustu" }
   - "18 yaş altı" → maxYas: 18, mode: "alti"
   - "65 yaş üstü" → minYas: 65, mode: "ustu"
   - "6-18 yaş arası" → minYas: 6, maxYas: 18, mode: "aralik"

7. DIS_TEDAVI: Diş tedavisiyle ilgili özel kurallar.
   params: { disKurali: string }

8. GENEL_ACIKLAMA: Yukarıdaki kategorilere girmeyen önemli bilgiler.
   params: { metin: string }

CROSS-REFERENCE TESPİTİ:
Eğer açıklama başka bir kaynağa referans veriyorsa (ör: "bkz. EK-2C", "SUT 2.4.4.D maddesine göre"), bunu crossRef alanında belirt.
Format: "EK-2B:520001" veya "SUT:2.4.4.D" veya "EK-2C:700130"

YANITLAMA KURALLARI:
- Her açıklama için JSON array döndür.
- Boş/anlamsız açıklamalar için boş array [] döndür.
- Her kural için confidence (0-1) ve kısa explanation (Türkçe) ekle.
- Birden fazla kural tipi olabilir.
- crossRef varsa belirt.

YANIT FORMATI (strict JSON):
{
  "0": { "rules": [...], "crossRefs": ["SUT:2.4.4.D"], "explanation": "..." },
  "1": { "rules": [], "crossRefs": [], "explanation": "Kural yok" },
  ...
}

Her rule objesi:
{ "type": "...", "params": {...}, "confidence": 0.95, "explanation": "..." }`;

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

function getApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_CLAUDE_API_KEY;
  if (envKey) return envKey;
  const storedKey = localStorage.getItem('claude_api_key');
  if (storedKey) return storedKey;
  throw new Error('Claude API key bulunamadı.');
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ═══════════════════════════════════════════════════════════════
// BATCH AI ÇAĞRISI
// ═══════════════════════════════════════════════════════════════

interface BatchResult {
  rules: Array<{
    type: string;
    params: Record<string, any>;
    confidence: number;
    explanation: string;
  }>;
  crossRefs: string[];
  explanation: string;
}

async function callClaudeForBatch(
  client: Anthropic,
  batch: Array<{ index: number; kodu: string; kaynak: RuleKaynak; aciklama: string }>,
): Promise<Map<number, BatchResult>> {
  const result = new Map<number, BatchResult>();

  const items = batch.map((item, i) =>
    `[${i}] Kaynak: ${item.kaynak} | Kod: ${item.kodu}\n"${item.aciklama}"`
  ).join('\n\n');

  const userPrompt = `Aşağıdaki ${batch.length} açıklama metnini analiz et:

${items}

YANIT: Strict JSON objesi döndür (key: index numarası):`;

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      temperature: 0,
      system: RULE_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.warn('[AI EXTRACT] Claude boş yanıt döndü');
      for (const item of batch) {
        result.set(item.index, { rules: [], crossRefs: [], explanation: 'Boş yanıt' });
      }
      return result;
    }

    let jsonStr = textContent.text;
    console.log(`[AI EXTRACT] Ham yanıt (ilk 300 char): ${jsonStr.substring(0, 300)}`);

    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch (parseErr) {
      console.error('[AI EXTRACT] JSON parse hatası:', parseErr, '\nYanıt:', jsonStr.substring(0, 500));
      for (const item of batch) {
        result.set(item.index, { rules: [], crossRefs: [], explanation: 'JSON parse hatası' });
      }
      return result;
    }

    let batchRuleCount = 0;
    for (let i = 0; i < batch.length; i++) {
      const entry = parsed[String(i)];
      if (entry) {
        const ruleCount = (entry.rules || []).length;
        batchRuleCount += ruleCount;
        result.set(batch[i].index, {
          rules: entry.rules || [],
          crossRefs: entry.crossRefs || [],
          explanation: entry.explanation || '',
        });
      } else {
        result.set(batch[i].index, { rules: [], crossRefs: [], explanation: 'Parse edilemedi' });
      }
    }

    if (response.usage) {
      console.log(`[AI EXTRACT] Batch ${batch.length} açıklama → ${batchRuleCount} kural, Tokens: ${response.usage.input_tokens}/${response.usage.output_tokens}`);
    }

    return result;
  } catch (err: any) {
    console.error('[AI EXTRACT] Claude API hatası:', err);
    // AuthenticationError → durdurucu hata, yukarı fırlat
    if (err?.status === 401 || err?.message?.includes('authentication') || err?.message?.includes('x-api-key')) {
      throw new Error('API_KEY_INVALID: Claude API Key geçersiz veya süresi dolmuş. Lütfen geçerli bir API Key girin.');
    }
    // Diğer hatalar → bu batch için boş sonuç döndür
    for (const item of batch) {
      result.set(item.index, { rules: [], crossRefs: [], explanation: `Hata: ${err}` });
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON: Tüm mevzuat verilerinden kural çıkar ve kaydet
// ═══════════════════════════════════════════════════════════════

export interface RegulationSourceData {
  kaynak: RuleKaynak;
  entries: Array<{
    kodu: string;
    adi: string;
    aciklama: string;
    puani: number;
    fiyati: number;
    islemGrubu?: string;
    ameliyatGrubu?: string;
    sectionHeader?: string;
  }>;
  fileName?: string;
  uploadedAt?: number;
}

export async function extractAndSaveRules(
  sources: RegulationSourceData[],
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<ExtractedRulesJSON> {
  const apiKey = getApiKey();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // 1. Tüm entry'leri topla (açıklamalı + açıklamasız)
  // Açıklaması olanlar AI'a gönderilecek, olmayanlar sadece eşleşme için kaydedilecek
  interface SourceItem {
    index: number;
    kodu: string;
    kaynak: RuleKaynak;
    aciklama: string;
    adi: string;
    puani: number;
    fiyati: number;
    islemGrubu?: string;
    ameliyatGrubu?: string;
    sectionHeader?: string;
    needsAI: boolean;
  }

  const allItems: SourceItem[] = [];
  const itemsForAI: SourceItem[] = [];

  for (const source of sources) {
    console.log(`[AI EXTRACT] Kaynak: ${source.kaynak}, ${source.entries.length} entry`);
    let withAciklama = 0;
    let withoutAciklama = 0;

    for (const entry of source.entries) {
      const hasAciklama = !!entry.aciklama && entry.aciklama.trim().length >= 3;
      const item: SourceItem = {
        index: allItems.length,
        kodu: entry.kodu,
        kaynak: source.kaynak,
        aciklama: (entry.aciklama || '').trim(),
        adi: entry.adi,
        puani: entry.puani,
        fiyati: entry.fiyati,
        islemGrubu: entry.islemGrubu,
        ameliyatGrubu: entry.ameliyatGrubu,
        sectionHeader: entry.sectionHeader,
        needsAI: hasAciklama,
      };
      allItems.push(item);
      if (hasAciklama) {
        itemsForAI.push(item);
        withAciklama++;
      } else {
        withoutAciklama++;
      }
    }

    console.log(`[AI EXTRACT]   → Açıklamalı: ${withAciklama}, Açıklamasız: ${withoutAciklama}`);
  }

  console.log(`[AI EXTRACT] Toplam: ${allItems.length} entry, ${itemsForAI.length} açıklama AI'a gönderilecek`);

  // 2. AI Batch işleme (sadece açıklaması olanlar)
  const aiResults = new Map<number, BatchResult>();
  let totalTokens = 0;

  if (itemsForAI.length > 0) {
    onProgress?.({
      phase: 'ai-extraction',
      current: 0,
      total: itemsForAI.length,
      message: `${itemsForAI.length} açıklama analiz ediliyor...`,
    });

    let successBatches = 0;
    let errorBatches = 0;

    for (let i = 0; i < itemsForAI.length; i += BATCH_SIZE) {
      const batch = itemsForAI.slice(i, i + BATCH_SIZE);
      const batchResult = await callClaudeForBatch(client, batch);

      let batchRuleCount = 0;
      for (const [idx, result] of batchResult) {
        aiResults.set(idx, result);
        batchRuleCount += result.rules.length;
      }

      if (batchRuleCount > 0) successBatches++;
      else errorBatches++;

      console.log(`[AI EXTRACT] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} açıklama → ${batchRuleCount} kural`);

      onProgress?.({
        phase: 'ai-extraction',
        current: Math.min(i + BATCH_SIZE, itemsForAI.length),
        total: itemsForAI.length,
        message: `${Math.min(i + BATCH_SIZE, itemsForAI.length)}/${itemsForAI.length} açıklama tamamlandı (${successBatches} başarılı, ${errorBatches} boş batch)...`,
      });

      // Rate limiting
      if (i + BATCH_SIZE < itemsForAI.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }

    console.log(`[AI EXTRACT] AI tamamlandı: ${successBatches} başarılı batch, ${errorBatches} boş batch, toplam ${aiResults.size} sonuç`);
  } else {
    console.warn('[AI EXTRACT] Hiçbir açıklama AI\'a gönderilecek durumda değil!');
    onProgress?.({
      phase: 'ai-extraction',
      current: 0,
      total: 0,
      message: 'Açıklama içeren kayıt bulunamadı. Mevzuat verilerini kontrol edin.',
    });
  }

  // 3. Sonuçları ExtractedRulesJSON formatına dönüştür
  // TÜM entry'leri dahil et (açıklaması olsun olmasın) — eşleşme için gerekli
  const rules: Record<string, ExtractedProcedureEntry> = {};
  const crossReferences: CrossReferenceEntry[] = [];
  let totalRulesExtracted = 0;

  for (const item of allItems) {
    const aiResult = item.needsAI ? aiResults.get(item.index) : null;
    const existingEntry = rules[item.kodu];

    // AI kurallarını dönüştür (varsa)
    const extractedRules: ExtractedRule[] = (aiResult?.rules || []).map(r => ({
      type: r.type as any,
      params: r.params,
      kaynak: item.kaynak,
      rawText: item.aciklama,
      confidence: r.confidence || 0.8,
      explanation: r.explanation || '',
      fromSectionHeader: false,
    }));

    totalRulesExtracted += extractedRules.length;

    // Cross-reference'ları kaydet
    if (aiResult) {
      for (const xref of aiResult.crossRefs) {
        const [targetKaynak] = xref.includes(':') ? xref.split(':') : [xref, ''];
        crossReferences.push({
          sourceKodu: item.kodu,
          sourceKaynak: item.kaynak,
          targetRef: xref,
          targetKaynak: (targetKaynak as RuleKaynak) || 'SUT',
          resolved: false,
        });
      }
    }

    if (existingEntry) {
      // Mevcut girişe ekle (birden fazla kaynaktan gelebilir)
      if (!existingEntry.kaynaklar.includes(item.kaynak)) {
        existingEntry.kaynaklar.push(item.kaynak);
      }
      if (item.aciklama) existingEntry.aciklamaRaw[item.kaynak] = item.aciklama;
      existingEntry.kurallar.push(...extractedRules);
      if (aiResult) existingEntry.crossRefs.push(...aiResult.crossRefs);
      // Puan/fiyat: EK-2C > EK-2B > GİL > EK-2Ç
      if (item.kaynak === 'EK-2C' || (!existingEntry.islemPuani && item.puani)) {
        existingEntry.islemPuani = item.puani;
        existingEntry.islemFiyati = item.fiyati;
      }
      if (item.islemGrubu) existingEntry.islemGrubu = item.islemGrubu;
      if (item.ameliyatGrubu) existingEntry.ameliyatGrubu = item.ameliyatGrubu;
    } else {
      // Yeni giriş
      rules[item.kodu] = {
        islemKodu: item.kodu,
        islemAdi: item.adi,
        kaynaklar: [item.kaynak],
        islemPuani: item.puani,
        islemFiyati: item.fiyati,
        islemGrubu: item.islemGrubu,
        ameliyatGrubu: item.ameliyatGrubu,
        aciklamaRaw: item.aciklama ? { [item.kaynak]: item.aciklama } : {},
        kurallar: extractedRules,
        crossRefs: aiResult?.crossRefs || [],
        sectionHeader: item.sectionHeader,
        aiValidation: {
          confidence: extractedRules.length > 0
            ? extractedRules.reduce((sum, r) => sum + r.confidence, 0) / extractedRules.length
            : 1,
          explanation: aiResult?.explanation || 'Açıklama yok veya kural bulunamadı',
          extractedAt: Date.now(),
        },
      };
    }
  }

  // 4. Cross-reference resolution
  let crossRefsResolved = 0;
  for (const crossRef of crossReferences) {
    // Hedef kodun kurallarını bul
    const targetParts = crossRef.targetRef.split(':');
    if (targetParts.length === 2) {
      const targetKodu = targetParts[1];
      const targetEntry = rules[targetKodu];
      if (targetEntry) {
        crossRef.resolved = true;
        crossRef.resolvedRules = targetEntry.kurallar;
        crossRefsResolved++;
      }
    }
  }

  // 5. Kaynak bilgilerini oluştur
  const sourcesInfo: ExtractedRulesJSON['sources'] = {
    ek2b: null, ek2c: null, ek2cd: null, gil: null, sut: null,
  };
  for (const source of sources) {
    const key = source.kaynak === 'EK-2B' ? 'ek2b' :
                source.kaynak === 'EK-2C' ? 'ek2c' :
                source.kaynak === 'EK-2Ç' ? 'ek2cd' :
                source.kaynak === 'GİL' ? 'gil' : 'sut';
    (sourcesInfo as any)[key] = {
      fileName: source.fileName || '',
      rowCount: source.entries.length,
      ...(key === 'sut' ? { maddeCount: source.entries.length } : {}),
      uploadedAt: source.uploadedAt || Date.now(),
    };
  }

  const extractedRulesJSON: ExtractedRulesJSON = {
    version: RULES_VERSION,
    createdAt: Date.now(),
    modelVersion: MODEL_ID,
    sources: sourcesInfo,
    rules,
    crossReferences,
    stats: {
      totalProcedures: Object.keys(rules).length,
      rulesExtracted: totalRulesExtracted,
      crossRefsResolved,
      aiTokensUsed: totalTokens,
    },
  };

  // 6. Boş sonuç kontrolü — kural çıkarılmadıysa kaydetme
  if (totalRulesExtracted === 0 && itemsForAI.length > 0) {
    console.warn(`[AI EXTRACT] UYARI: ${itemsForAI.length} açıklama gönderildi ama 0 kural çıkarıldı! Firebase'e kaydedilmeyecek.`);
    onProgress?.({
      phase: 'error',
      current: 0,
      total: 0,
      message: `Hata: ${itemsForAI.length} açıklama analiz edildi ama hiçbir kural çıkarılamadı. API Key geçerliliğini kontrol edin.`,
    });
    // Yine de mevcut verileri döndür (eşleşme için kullanılabilir, kural olmasa bile)
    return extractedRulesJSON;
  }

  // 7. Firebase Storage'a kaydet
  onProgress?.({
    phase: 'building-rules',
    current: 0,
    total: 1,
    message: 'Kurallar Firebase\'e kaydediliyor...',
  });

  await saveExtractedRulesToFirebase(extractedRulesJSON);

  onProgress?.({
    phase: 'complete',
    current: 1,
    total: 1,
    message: `${Object.keys(rules).length} işlem kodu, ${totalRulesExtracted} kural çıkarıldı ve kaydedildi.`,
  });

  console.log(`[AI EXTRACT] Tamamlandı: ${Object.keys(rules).length} işlem, ${totalRulesExtracted} kural, ${crossRefsResolved} cross-ref çözümlendi`);

  return extractedRulesJSON;
}

// ═══════════════════════════════════════════════════════════════
// FIREBASE STORAGE KAYIT/YÜKLEME
// ═══════════════════════════════════════════════════════════════

async function saveExtractedRulesToFirebase(rulesJSON: ExtractedRulesJSON): Promise<void> {
  const timestamp = Date.now();
  const storagePath = `${STORAGE_PATH_PREFIX}/extracted_rules_${timestamp}.json`;

  try {
    // JSON'u Blob'a dönüştür ve Storage'a yükle
    const jsonBlob = new Blob([JSON.stringify(rulesJSON, null, 2)], { type: 'application/json' });
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, jsonBlob);
    const fileUrl = await getDownloadURL(storageRef);

    // Metadata'yı Firestore'a kaydet
    const metadata: ExtractedRulesMetadata = {
      version: rulesJSON.version,
      createdAt: rulesJSON.createdAt,
      modelVersion: rulesJSON.modelVersion,
      storagePath,
      fileUrl,
      stats: rulesJSON.stats,
      sourceHashes: {},
    };

    // Her kaynak için hash oluştur (değişiklik tespiti)
    for (const [key, sourceInfo] of Object.entries(rulesJSON.sources)) {
      if (sourceInfo) {
        metadata.sourceHashes[key] = hashText(JSON.stringify(sourceInfo));
      }
    }

    const docRef = doc(db, FIRESTORE_DOC_PATH);
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    await setDoc(docRef, {
      ...existingData,
      kurallar: { extracted: metadata },
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    console.log(`[AI EXTRACT] Kurallar kaydedildi: ${storagePath} (${Object.keys(rulesJSON.rules).length} işlem)`);
  } catch (error) {
    console.error('[AI EXTRACT] Firebase kayıt hatası:', error);
    throw error;
  }
}

export async function loadExtractedRulesFromFirebase(): Promise<ExtractedRulesJSON | null> {
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    const metadata = data?.kurallar?.extracted as ExtractedRulesMetadata | undefined;

    if (!metadata || !metadata.fileUrl) {
      console.log('[AI EXTRACT] Kayıtlı kural bulunamadı');
      return null;
    }

    console.log(`[AI EXTRACT] Kayıtlı kurallar yükleniyor: ${metadata.storagePath}`);

    // Firebase Storage'dan JSON'u indir
    const storageRef = ref(storage, metadata.storagePath);
    const blob = await getBlob(storageRef);
    const text = await blob.text();
    const rulesJSON = JSON.parse(text) as ExtractedRulesJSON;

    console.log(`[AI EXTRACT] ${Object.keys(rulesJSON.rules).length} işlem kodu yüklendi (v${rulesJSON.version})`);

    return rulesJSON;
  } catch (error) {
    console.error('[AI EXTRACT] Kural yükleme hatası:', error);
    return null;
  }
}

export async function getExtractedRulesMetadata(): Promise<ExtractedRulesMetadata | null> {
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return (data?.kurallar?.extracted as ExtractedRulesMetadata) || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// API KEY YÖNETİMİ
// ═══════════════════════════════════════════════════════════════

export function hasApiKeyConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

export function setApiKeyForExtraction(apiKey: string): void {
  localStorage.setItem('claude_api_key', apiKey);
}
