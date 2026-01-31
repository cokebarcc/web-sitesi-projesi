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
  | 'GENEL_ACIKLAMA';

// ── Çıkarılan Kural ──
export interface ParsedRule {
  type: ParsedRuleType;
  rawText: string;
  params: Record<string, any>;
  // BASAMAK_KISITI  → { basamaklar: number[] }
  // BRANS_KISITI    → { branslar: string[] }
  // BIRLIKTE_YAPILAMAZ → { yapilamazKodlari: string[] }
  // SIKLIK_LIMIT    → { periyot: 'gun' | 'yil' | 'ay' | 'hafta', limit: number }
  // TANI_KOSULU     → { taniKodlari: string[] }
  // DIS_TEDAVI      → { disKurali: string }
  // GENEL_ACIKLAMA  → { metin: string }
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
  phase: 'loading' | 'building-rules' | 'analyzing' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
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
