/**
 * GÖREN Performans Hesaplama Modülü - TypeScript Tip Tanımları
 *
 * Bu dosya tüm gösterge, parametre, hesaplama sonucu ve depolama
 * yapıları için tip tanımlarını içerir.
 */

// ========== KURUM TÜRLERİ ==========

export type InstitutionType = 'ILSM' | 'ILCESM' | 'BH' | 'ADSH' | 'ASH';

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  ILSM: 'İl Sağlık Müdürlüğü',
  ILCESM: 'İlçe Sağlık Müdürlüğü',
  BH: 'Başhekimlik',
  ADSH: 'Ağız ve Diş Sağlığı Hastanesi',
  ASH: 'Acil Sağlık Hizmetleri'
};

// ========== PARAMETRE TANIMLARI ==========

/**
 * Gösterge parametresi tanımı
 * Örnek: A (pay), B (payda), GO (hedef oran), HD (hedef değer)
 */
export interface IndicatorParameter {
  /** Parametre anahtarı: A, B, C, GO, HD, ÖD vb. */
  key: string;
  /** Parametre açıklaması */
  label: string;
  /** Parametre tipi */
  type: 'number' | 'percentage' | 'text';
  /** Zorunlu mu? */
  required: boolean;
  /** Varsayılan değer (opsiyonel) */
  defaultValue?: number;
  /** Ek açıklama */
  description?: string;
}

// ========== PUANLAMA KURALLARI ==========

/**
 * Karşılaştırma operatörü
 */
export type ComparisonOperator =
  | 'gte'      // >= (büyük eşit)
  | 'gt'       // > (büyük)
  | 'lte'      // <= (küçük eşit)
  | 'lt'       // < (küçük)
  | 'between'  // aralık (min <= x < max)
  | 'eq'       // == (eşit)
  | 'formula'; // GO parametreli dinamik eşik

/**
 * Puanlama kuralı: koşul → puan
 */
export interface ScoringRule {
  /** Koşul açıklaması (görüntüleme için): ">=75", "70<=x<75", "<=GO" */
  condition: string;
  /** Alt sınır (dahil) */
  minValue?: number;
  /** Üst sınır (hariç, between için) */
  maxValue?: number;
  /** Karşılaştırma operatörü */
  operator: ComparisonOperator;
  /** Kazanılan puan */
  points: number;
  /** GO/HD parametreli dinamik eşik formülü (opsiyonel) */
  formula?: string;
  /** Çarpan (GO*1.15 gibi durumlar için) */
  multiplier?: number;
}

// ========== GÖSTERGE TANIMI ==========

/**
 * Birim türleri
 */
export type UnitType = 'percentage' | 'count' | 'ratio' | 'days' | 'person' | 'score' | 'custom';

/**
 * Veri kaynağı türleri
 */
export type DataSource =
  | 'SGGM'
  | 'SGGM (SABİM)'
  | 'MHRS'
  | 'MHRS, e-Nabız'
  | 'GÖREN'
  | 'DEN-İZ'
  | 'e-Nabız'
  | 'e-Nabız, MHRS'
  | 'e-Rapor'
  | 'ÇKYS'
  | 'EKİP'
  | 'TÜİK'
  | 'HBYS'
  | 'HYP'
  | 'ASOS'
  | 'DHSDS Yazılımı'
  | 'Manuel';

/**
 * Tam gösterge tanımı
 */
export interface IndicatorDefinition {
  /** Gösterge kodu: SYPG-İLSM-1 */
  code: string;
  /** Gösterge adı */
  name: string;
  /** Kurum türü */
  category: InstitutionType;
  /** Birim */
  unit: UnitType;
  /** Birim etiketi (görüntüleme için) */
  unitLabel?: string;
  /** Maksimum alınabilecek puan */
  maxPoints: number;

  /** Parametre tanımları */
  parameters: IndicatorParameter[];

  /**
   * GD (Gösterge Değeri) hesaplama formülü
   * Format: string ifade, örn: "(A / B) * 100" veya "A * HD / GO"
   */
  gdFormula: string;

  /**
   * GP (Gösterge Puanı) hesaplama kuralları
   * Sıralı liste - ilk eşleşen kural uygulanır
   */
  gpRules: ScoringRule[];

  /**
   * Doğrudan GP formülü (eşik yerine formül kullanan göstergeler için)
   * Örn: "GD * 0.25" (İLSM-3, İLSM-4)
   */
  gpFormula?: string;

  /** Kılavuzdaki notlar */
  notes?: string;
  /** Veri kaynağı */
  source?: DataSource;
  /** HBYS hesaplayabilir mi? */
  hbysCalculable?: boolean;
  /** Hesaplama periyodu */
  frequency?: 'monthly' | 'quarterly' | 'annually';
}

// ========== VERİ GİRİŞİ ==========

/**
 * Parametre değerleri (kullanıcı girişi veya Excel'den)
 */
export interface ParameterValues {
  [paramKey: string]: number | null;
}

/**
 * Tüm göstergeler için parametre değerleri
 */
export type AllParameterValues = Record<string, ParameterValues>;

// ========== HESAPLAMA SONUÇLARI ==========

/**
 * Gösterge hesaplama durumu
 */
export type CalculationStatus =
  | 'success'           // Başarılı hesaplama
  | 'insufficient_data' // Eksik veri
  | 'error'             // Hesaplama hatası
  | 'pending';          // Henüz hesaplanmadı

/**
 * Durum göstergesi (UI için)
 */
export type StatusIndicator = 'excellent' | 'good' | 'average' | 'poor' | 'critical' | 'unknown';

/**
 * Tek bir gösterge için hesaplama sonucu
 */
export interface IndicatorResult {
  /** Gösterge kodu */
  code: string;
  /** Gösterge adı */
  name: string;
  /** Girilen parametre değerleri */
  parameterValues: ParameterValues;
  /** Hesaplanan Gösterge Değeri (GD) */
  gd: number | null;
  /** Formatlanmış GD (görüntüleme için) */
  gdFormatted: string;
  /** Hesaplanan Gösterge Puanı (GP) */
  gp: number;
  /** Maksimum puan */
  maxPoints: number;
  /** Hesaplama durumu */
  status: CalculationStatus;
  /** Durum mesajı (hata veya bilgi) */
  statusMessage?: string;
  /** Eşleşen puanlama kuralı */
  matchedRule?: ScoringRule;
  /** UI durum göstergesi */
  statusIndicator: StatusIndicator;
  /** Başarı yüzdesi (GP/maxPoints * 100) */
  achievementPercent: number;
}

/**
 * Kurum için toplam hesaplama özeti
 */
export interface CalculationSummary {
  /** Toplam kazanılan puan */
  totalGP: number;
  /** Maksimum alınabilecek puan */
  maxPossibleGP: number;
  /** Genel başarı oranı (%) */
  achievementRate: number;
  /** Hesaplanan gösterge sayısı */
  completedIndicators: number;
  /** Toplam gösterge sayısı */
  totalIndicators: number;
  /** Eksik veri olan gösterge sayısı */
  incompleteIndicators: number;
  /** En yüksek 5 gösterge */
  topIndicators: IndicatorResult[];
  /** En düşük 5 gösterge */
  bottomIndicators: IndicatorResult[];
}

/**
 * Kurum için tam hesaplama sonucu
 */
export interface InstitutionResult {
  /** Kurum ID */
  institutionId: string;
  /** Kurum adı */
  institutionName: string;
  /** Kurum türü */
  institutionType: InstitutionType;
  /** Dönem bilgisi */
  period: {
    year: number;
    month: number;
  };
  /** Tüm gösterge sonuçları */
  indicators: IndicatorResult[];
  /** Özet istatistikler */
  summary: CalculationSummary;
  /** Hesaplama zamanı (timestamp) */
  calculatedAt: number;
  /** Hesaplamayı yapan kullanıcı */
  calculatedBy: string;
}

// ========== DEPOLAMA TİPLERİ ==========

/**
 * Yüklenen veri dosyası metadata
 */
export interface GorenDataFile {
  /** Dosya ID */
  id: string;
  /** Kurum ID */
  institutionId: string;
  /** Kurum adı */
  institutionName: string;
  /** Kurum türü */
  institutionType: InstitutionType;
  /** Yıl */
  year: number;
  /** Ay */
  month: number;
  /** Dosya adı */
  fileName: string;
  /** Firebase Storage URL */
  fileUrl: string;
  /** Yükleme zamanı */
  uploadedAt: number;
  /** Yükleyen kullanıcı */
  uploadedBy: string;
  /** Dosyadaki gösterge sayısı */
  indicatorCount: number;
}

/**
 * Kaydedilen hesaplama kaydı
 */
export interface GorenCalculationRecord {
  /** Kayıt ID */
  id: string;
  /** Hesaplama sonucu */
  institutionResult: InstitutionResult;
  /** Kayıt zamanı */
  savedAt: number;
  /** Kaydeden kullanıcı */
  savedBy: string;
}

// ========== FİLTRE VE SEÇİM ==========

/**
 * GÖREN modülü filtre durumu
 */
export interface GorenFilterState {
  /** Seçili kurum türü */
  institutionType: InstitutionType;
  /** Seçili kurum ID */
  institutionId: string;
  /** Seçili kurum adı */
  institutionName: string;
  /** Seçili yıl */
  year: number;
  /** Seçili ay */
  month: number;
}

/**
 * Kurum listesi öğesi
 */
export interface InstitutionOption {
  id: string;
  name: string;
  type: InstitutionType;
}

// ========== EXCEL ŞABLON ==========

/**
 * Excel şablon satırı
 */
export interface TemplateRow {
  'Gösterge Kodu': string;
  'Gösterge Adı': string;
  [paramKey: string]: string | number;
}

// ========== AUDIT LOG ==========

/**
 * Kullanıcı işlem logu
 */
export interface GorenAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: 'upload' | 'calculate' | 'export' | 'save' | 'delete';
  institutionType: InstitutionType;
  institutionId: string;
  period: { year: number; month: number };
  details?: string;
  timestamp: number;
}

// ========== KARŞILAŞTIRMA ==========

/**
 * Dönem karşılaştırma verisi
 */
export interface PeriodComparison {
  currentPeriod: { year: number; month: number };
  previousPeriod: { year: number; month: number };
  currentResult: InstitutionResult;
  previousResult: InstitutionResult | null;
  /** Değişim yüzdesi */
  changePercent: number | null;
  /** Trend yönü */
  trend: 'up' | 'down' | 'stable' | 'unknown';
}

/**
 * Gösterge trend verisi (son 6 ay)
 */
export interface IndicatorTrend {
  code: string;
  name: string;
  dataPoints: Array<{
    year: number;
    month: number;
    gd: number | null;
    gp: number;
  }>;
}
