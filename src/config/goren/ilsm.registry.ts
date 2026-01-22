/**
 * GÖREN - İl Sağlık Müdürlüğü (İLSM) Gösterge Registry
 *
 * 9 gösterge: SYPG-İLSM-1 ... SYPG-İLSM-9
 * Kaynak: GÖREN Kılavuzu
 */

import { IndicatorDefinition } from '../../../components/goren/types/goren.types';

export const ILSM_INDICATORS: IndicatorDefinition[] = [
  // -----------------------------------------------------------------------
  // SYPG-İLSM-1 — Çalışan Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-1',
    name: 'Çalışan Memnuniyet Oranı (%)',
    category: 'ILSM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'SGGM',
    hbysCalculable: false,
    frequency: 'annually',
    parameters: [
      {
        key: 'A',
        label: 'Çalışan memnuniyeti anketlerinden elde edilen toplam puan',
        type: 'number',
        required: true,
        description: 'Anket sonuçlarından elde edilen toplam puan'
      },
      {
        key: 'B',
        label: 'Cevaplanan soru sayısı',
        type: 'number',
        required: true,
        description: 'Ankette cevaplanan toplam soru adedi'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≥ %75', operator: 'gte', minValue: 75, points: 5 },
      { condition: '%70 ≤ GD < %75', operator: 'between', minValue: 70, maxValue: 75, points: 4 },
      { condition: '%65 ≤ GD < %70', operator: 'between', minValue: 65, maxValue: 70, points: 3 },
      { condition: '%60 ≤ GD < %65', operator: 'between', minValue: 60, maxValue: 65, points: 2 },
      { condition: '%50 ≤ GD < %60', operator: 'between', minValue: 50, maxValue: 60, points: 1 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'Çalışan memnuniyet anketi yılda en az 1 kez uygulanmalıdır. Kaynak: SABİM. A ve B değerleri yüzde cinsinden girilmeli.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-2 — Hasta Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-2',
    name: 'Hasta Memnuniyet Oranı (%)',
    category: 'ILSM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'MHRS',
    hbysCalculable: false,
    frequency: 'quarterly',
    parameters: [
      {
        key: 'A',
        label: 'Hasta memnuniyeti anketlerinden elde edilen toplam puan',
        type: 'number',
        required: true,
        description: 'Hasta memnuniyet anketi toplam puanı'
      },
      {
        key: 'B',
        label: 'Cevaplanan soru sayısı',
        type: 'number',
        required: true,
        description: 'Ankette cevaplanan toplam soru adedi'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≥ %80', operator: 'gte', minValue: 80, points: 5 },
      { condition: '%70 ≤ GD < %80', operator: 'between', minValue: 70, maxValue: 80, points: 4 },
      { condition: '%60 ≤ GD < %70', operator: 'between', minValue: 60, maxValue: 70, points: 3 },
      { condition: '%55 ≤ GD < %60', operator: 'between', minValue: 55, maxValue: 60, points: 2 },
      { condition: '%50 ≤ GD < %55', operator: 'between', minValue: 50, maxValue: 55, points: 1 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'MHRS üzerinden toplanan hasta memnuniyet anket verileri kullanılır. A ve B değerleri yüzde cinsinden girilmeli.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-3 — İlçe Sağlık Müdürlükleri Ortalama Performans Puanı
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-3',
    name: 'İlçe Sağlık Müdürlükleri Ortalama Performans Puanı',
    category: 'ILSM',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 25,
    source: 'GÖREN',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İlçe Sağlık Müdürlükleri ve TSM\'lerin performans puanlarının ağırlıklı toplamı',
        type: 'number',
        required: true,
        description: 'Tüm İlçe SM ve TSM performans puanlarının ağırlıklı toplamı'
      },
      {
        key: 'B',
        label: 'İlçe Sağlık Müdürlüğü ve TSM sayısı',
        type: 'number',
        required: true,
        description: 'Değerlendirmeye alınan toplam kurum sayısı'
      }
    ],
    gdFormula: 'A / B',
    gpFormula: 'GD * 0.25',
    gpRules: [], // Eşik yok, doğrudan formül
    notes: 'GP = GD × 0,25 formülü ile hesaplanır. Eşik tabanlı değil, formül tabanlı puanlama.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-4 — Başhekimlik Ortalama Performans Puanı
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-4',
    name: 'Başhekimlik Ortalama Performans Puanı',
    category: 'ILSM',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 25,
    source: 'GÖREN',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İl genelindeki tüm başhekimliklerin performans puanlarının ağırlıklı toplamı',
        type: 'number',
        required: true,
        description: 'Tüm başhekimliklerin performans puanlarının ağırlıklı toplamı'
      },
      {
        key: 'B',
        label: 'Başhekimlik sayısı',
        type: 'number',
        required: true,
        description: 'Değerlendirmeye alınan toplam başhekimlik sayısı'
      }
    ],
    gdFormula: 'A / B',
    gpFormula: 'GD * 0.25',
    gpRules: [], // Eşik yok, doğrudan formül
    notes: 'GP = GD × 0,25 formülü ile hesaplanır. Eşik tabanlı değil, formül tabanlı puanlama.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-5 — DEN-İZ Sistemi Üzerinden Denetim Tamamlanma Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-5',
    name: 'DEN-İZ Sistemi Üzerinden Denetim Tamamlanma Oranı (%)',
    category: 'ILSM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 10,
    source: 'DEN-İZ',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Tamamlanan denetim sayısı',
        type: 'number',
        required: true,
        description: 'DEN-İZ sistemi üzerinden tamamlanan denetim sayısı'
      },
      {
        key: 'B',
        label: 'Planlanan denetim sayısı',
        type: 'number',
        required: true,
        description: 'DEN-İZ sistemi üzerinden planlanan toplam denetim sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %90', operator: 'gte', minValue: 90, points: 10 },
      { condition: '%80 ≤ GD < %90', operator: 'between', minValue: 80, maxValue: 90, points: 7 },
      { condition: 'GD < %80', operator: 'lt', maxValue: 80, points: 0 }
    ],
    notes: 'DEN-İZ sistemi üzerinden planlanan ve gerçekleştirilen denetimlerin oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-6 — Nüfusa Göre Evde Ziyaret Sayısı
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-6',
    name: 'Nüfusa Göre Evde Ziyaret Sayısı',
    category: 'ILSM',
    unit: 'ratio',
    unitLabel: '100 kişi başına',
    maxPoints: 10,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Gerçekleşen toplam evde ziyaret sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içinde gerçekleştirilen toplam evde sağlık ziyareti sayısı'
      },
      {
        key: 'B',
        label: 'İl nüfusu (TÜİK)',
        type: 'number',
        required: true,
        description: 'TÜİK verilerine göre il nüfusu'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpFormula: 'GD * 10',
    gpRules: [], // Eşik yok, doğrudan formül
    notes: 'GP = GD × 10 formülü ile hesaplanır. 100 kişi başına düşen evde ziyaret sayısı üzerinden puanlama.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-7 — Primer Sezaryen Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-7',
    name: 'Primer Sezaryen Oranı (%)',
    category: 'ILSM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 10,
    source: 'e-Rapor',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Primer sezaryen sayısı',
        type: 'number',
        required: true,
        description: 'İlk kez sezaryen olan doğum sayısı'
      },
      {
        key: 'B',
        label: 'Toplam canlı doğum sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içindeki toplam canlı doğum sayısı'
      },
      {
        key: 'GO',
        label: 'Hedef Oran (GO)',
        type: 'percentage',
        required: true,
        description: 'Belirlenen hedef primer sezaryen oranı (%)'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      {
        condition: 'GD ≤ GO',
        operator: 'formula',
        formula: 'GD <= GO',
        points: 10
      },
      {
        condition: 'GO < GD ≤ GO×1.15',
        operator: 'formula',
        formula: 'GD > GO && GD <= GO * 1.15',
        multiplier: 1.15,
        points: 8
      },
      {
        condition: 'GO×1.15 < GD ≤ GO×1.30',
        operator: 'formula',
        formula: 'GD > GO * 1.15 && GD <= GO * 1.30',
        multiplier: 1.30,
        points: 5
      },
      {
        condition: 'GD > GO×1.30',
        operator: 'formula',
        formula: 'GD > GO * 1.30',
        points: 0
      }
    ],
    notes: 'GO (Hedef Oran) parametresi kullanıcı tarafından girilmelidir. Düşük sezaryen oranı daha yüksek puan alır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-8 — Aile Hekimliği Birimi (AHB) Başına Düşen Nüfus
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-8',
    name: 'Aile Hekimliği Birimi (AHB) Başına Düşen Nüfus',
    category: 'ILSM',
    unit: 'person',
    unitLabel: 'Kişi',
    maxPoints: 5,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'AHB\'ye kayıtlı kişi sayısı',
        type: 'number',
        required: true,
        description: 'Aile Hekimliği Birimlerine kayıtlı toplam kişi sayısı'
      },
      {
        key: 'B',
        label: 'AHB sayısı',
        type: 'number',
        required: true,
        description: 'İldeki toplam Aile Hekimliği Birimi sayısı'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≤ 3000', operator: 'lte', maxValue: 3000, points: 5 },
      { condition: '3000 < GD ≤ 3500', operator: 'between', minValue: 3000, maxValue: 3500, points: 2 },
      { condition: 'GD > 3500', operator: 'gt', minValue: 3500, points: 0 }
    ],
    notes: 'AHB başına düşen nüfusun düşük olması daha iyi performansı gösterir. Kaynak: e-Nabız, ÇKYS.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLSM-9 — Kadro Görev Yeri Harici Geçici Görevle Çalışan Personel Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLSM-9',
    name: 'Kadro Görev Yeri Harici Geçici Görevle Çalışan Personel Oranı (%)',
    category: 'ILSM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'ÇKYS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Geçici görevle çalışan personelin adam-gün toplamı',
        type: 'number',
        required: true,
        description: 'Kadro dışı geçici görevle çalışan personelin toplam adam-gün sayısı'
      },
      {
        key: 'B',
        label: 'Toplam personel adam-gün sayısı',
        type: 'number',
        required: true,
        description: 'Tüm personelin toplam adam-gün sayısı'
      },
      {
        key: 'GO',
        label: 'Hedef Oran (GO)',
        type: 'percentage',
        required: true,
        description: 'Belirlenen maksimum kabul edilebilir geçici görev oranı (%)'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      {
        condition: 'GD ≤ GO',
        operator: 'formula',
        formula: 'GD <= GO',
        points: 5
      },
      {
        condition: 'GD > GO',
        operator: 'formula',
        formula: 'GD > GO',
        points: 0
      }
    ],
    notes: 'GO (Hedef Oran) parametresi kullanıcı tarafından girilmelidir. Düşük geçici görev oranı tam puan alır. Kaynak: ÇKYS/EKİP.'
  }
];

/**
 * İLSM gösterge sayısı
 */
export const ILSM_INDICATOR_COUNT = ILSM_INDICATORS.length;

/**
 * İLSM maksimum toplam puan
 */
export const ILSM_MAX_TOTAL_POINTS = ILSM_INDICATORS.reduce(
  (sum, ind) => sum + ind.maxPoints,
  0
);

/**
 * Gösterge koduna göre tanım getir
 */
export const getILSMIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return ILSM_INDICATORS.find(ind => ind.code === code);
};
