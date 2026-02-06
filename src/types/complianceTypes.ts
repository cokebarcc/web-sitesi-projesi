// ═══════════════════════════════════════════════════════════════
// Uygunluk / Kural Denetimi Analizi — Tip Tanımları
// ═══════════════════════════════════════════════════════════════

// ── Kural Kaynakları ──
export type RuleKaynak = 'EK-2B' | 'EK-2C' | 'EK-2Ç' | 'GİL' | 'SUT';

// ── Kural Tipleri ──
export type ParsedRuleType =
  | 'BASAMAK_KISITI'
  | 'BRANS_KISITI'
  | 'TANI_KOSULU'
  | 'BIRLIKTE_YAPILAMAZ'
  | 'SIKLIK_LIMIT'
  | 'DIS_TEDAVI'
  | 'YAS_KISITI'
  | 'GENEL_ACIKLAMA';

// ── Çıkarılan Kural ──
export interface ParsedRule {
  type: ParsedRuleType;
  rawText: string;
  params: Record<string, any>;
  // BASAMAK_KISITI  → { basamaklar: number[], mode?: 'sadece' | 've_uzeri' }
  // BRANS_KISITI    → { branslar: string[], mode?: 'dahil' | 'haric' }
  //   dahil = SADECE bu branşlar yapabilir (varsayılan)
  //   haric = Bu branşlar HARİÇ herkes yapabilir
  // BIRLIKTE_YAPILAMAZ → { yapilamazKodlari: string[] }
  // SIKLIK_LIMIT    → { periyot: 'gun' | 'yil' | 'ay' | 'hafta' | 'gun_aralik' | 'ay_aralik', limit: number }
  // TANI_KOSULU     → { taniKodlari: string[] }
  // DIS_TEDAVI      → { disKurali: string }
  // YAS_KISITI      → { minYas?: number, maxYas?: number, mode: 'aralik' | 'alti' | 'ustu' }
  // GENEL_ACIKLAMA  → { metin: string }
  kaynak?: RuleKaynak;           // Bu kuralın geldiği kaynak (EK-2B, GİL, vs.)
  fromSectionHeader?: boolean;   // Bölüm başlığından mı geldi?
  confidence?: number;           // 0-1, AI güven skoru
  extractionMethod?: 'regex' | 'ai';  // Hangi yöntemle çıkarıldı
  aiExplanation?: string;        // AI'ın açıklaması (debug/audit)
}

// ── RULES_MASTER Girişi ──
export interface RuleMasterEntry {
  islem_kodu: string;
  islem_adi: string;
  kaynak: RuleKaynak;
  islem_puani: number;
  islem_fiyati: number;
  aciklama_raw: string;
  islem_grubu?: string;      // Sadece EK-2C
  ameliyat_grubu?: string;   // Sadece GİL
  gil_puani?: number;        // GİL'den gelen puan
  gil_fiyati?: number;       // GİL'den gelen fiyat
  gil_aciklama?: string;     // GİL'den gelen açıklama metni
  gil_section_header?: string; // GİL'den gelen bölüm başlığı
  parsed_rules: ParsedRule[];
  section_header?: string;   // Bölüm başlığından miras alınan açıklama
}

// ── Analiz Sonucu ──
export type UygunlukDurumu = 'UYGUN' | 'UYGUNSUZ' | 'MANUEL_INCELEME';
export type EslesmeGuveni = 'Yüksek' | 'Orta' | 'Düşük';

export interface IhlalDetay {
  ihlal_kodu: string;
  ihlal_aciklamasi: string;
  kaynak: RuleKaynak;
  referans_kural_metni: string;
  kural_tipi: ParsedRuleType;
  fromSectionHeader?: boolean;   // Bölüm başlığından mı geldi?
}

export interface ComplianceResult {
  satirIndex: number;
  uygunluk_durumu: UygunlukDurumu;
  eslesme_guveni: EslesmeGuveni;
  ihlaller: IhlalDetay[];
  eslesen_kural?: RuleMasterEntry;
  eslesmeDurumu: 'ESLESTI' | 'ESLESEMEDI';
  puan_farki?: number;
  fiyat_farki?: number;
}

// ── Özet İstatistikler ──
export interface ComplianceAnalysisSummary {
  toplamAnaliz: number;
  uygunSayisi: number;
  uygunsuzSayisi: number;
  manuelIncelemeSayisi: number;
  eslesenSayisi: number;
  eslesemeyenSayisi: number;
  toplamIhlalSayisi: number;
  ihlalDagilimi: Record<ParsedRuleType, number>;
  analizSuresiMs: number;
}

// ── İlerleme Takibi ──
export interface AnalysisProgress {
  phase: 'loading' | 'building-rules' | 'ai-extraction' | 'analyzing' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

// ── AI Kural Cache (Firestore) ──
export interface AIParsedRuleCache {
  aciklamaHash: string;
  aciklamaText: string;
  parsedRules: ParsedRule[];
  modelVersion: string;
  promptVersion: string;
  createdAt: number;
  tokenUsage?: { input: number; output: number };
}

// ── Filtre State ──
export interface ComplianceFilterState {
  uygunlukDurumu: UygunlukDurumu | 'TUMU';
  eslesmeDurumu: 'TUMU' | 'ESLESTI' | 'ESLESEMEDI';
  kuralTipi: ParsedRuleType | 'TUMU';
  searchTerm: string;
}

// ── Kural Yükleme Durumu ──
export interface RuleLoadStatus {
  ek2b: { loaded: boolean; count: number };
  ek2c: { loaded: boolean; count: number };
  ek2cd: { loaded: boolean; count: number };
  gil: { loaded: boolean; count: number };
  sut: { loaded: boolean; count: number };
  totalRules: number;
}

// ── SUT Maddesi ──
export interface SutMaddesi {
  maddeNo: string;       // "2.4.4.D-1", "4.2.1" vb.
  baslik: string;        // Madde başlığı
  icerik: string;        // Madde tam metni
  altMaddeler?: string[]; // Alt madde listesi
}

// ═══════════════════════════════════════════════════════════════
// AI Çıkarılmış Kural JSON Formatı (Firebase Storage)
// ═══════════════════════════════════════════════════════════════

export interface ExtractedRulesJSON {
  version: string;                    // "2.0"
  createdAt: number;
  modelVersion: string;
  sources: {
    ek2b: { fileName: string; rowCount: number; uploadedAt: number } | null;
    ek2c: { fileName: string; rowCount: number; uploadedAt: number } | null;
    ek2cd: { fileName: string; rowCount: number; uploadedAt: number } | null;
    gil: { fileName: string; rowCount: number; uploadedAt: number } | null;
    sut: { fileName: string; maddeCount: number; uploadedAt: number } | null;
  };
  rules: Record<string, ExtractedProcedureEntry>;  // gilKodu → entry
  crossReferences: CrossReferenceEntry[];
  stats: {
    totalProcedures: number;
    rulesExtracted: number;
    crossRefsResolved: number;
    aiTokensUsed: number;
  };
}

export interface ExtractedProcedureEntry {
  islemKodu: string;
  islemAdi: string;
  kaynaklar: RuleKaynak[];
  islemPuani: number;
  islemFiyati: number;
  islemGrubu?: string;
  ameliyatGrubu?: string;
  aciklamaRaw: Partial<Record<RuleKaynak, string>>;
  kurallar: ExtractedRule[];
  crossRefs: string[];
  sectionHeader?: string;
  aiValidation: {
    confidence: number;
    explanation: string;
    extractedAt: number;
  };
}

export interface ExtractedRule {
  type: ParsedRuleType;
  params: Record<string, any>;
  kaynak: RuleKaynak;
  rawText: string;
  confidence: number;
  explanation: string;
  fromSectionHeader?: boolean;
}

export interface CrossReferenceEntry {
  sourceKodu: string;
  sourceKaynak: RuleKaynak;
  targetRef: string;
  targetKaynak: RuleKaynak;
  resolved: boolean;
  resolvedRules?: ExtractedRule[];
}

// ── Çıkarılmış Kural Metadata (Firestore) ──
export interface ExtractedRulesMetadata {
  version: string;
  createdAt: number;
  modelVersion: string;
  storagePath: string;
  fileUrl: string;
  stats: ExtractedRulesJSON['stats'];
  sourceHashes: Record<string, string>;  // kaynak → hash (değişiklik tespiti için)
}
