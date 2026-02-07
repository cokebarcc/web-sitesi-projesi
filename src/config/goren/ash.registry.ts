/**
 * GÖREN - Acil Sağlık Hizmetleri (ASH) Gösterge Registry
 *
 * 5 gösterge: SYPG-ASH-1 ... SYPG-ASH-5
 * Kaynak: GÖREN Kılavuzu
 */

import { IndicatorDefinition } from '../../../components/goren/types/goren.types';

export const ASH_INDICATORS: IndicatorDefinition[] = [
  // -----------------------------------------------------------------------
  // SYPG-ASH-1 — Çalışan Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ASH-1',
    name: 'Çalışan Memnuniyet Oranı (%)',
    category: 'ASH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 20,
    source: 'SGGM (SABİM)',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Çalışan Memnuniyeti Anketlerinden Elde Edilen Toplam Puan',
        type: 'number',
        required: true,
        description: 'Anket sorularında cevap verilen soruların toplam puanı'
      },
      {
        key: 'B',
        label: 'Cevaplanan Soru Sayısı',
        type: 'number',
        required: true,
        description: 'Anket sorularında cevap verilen soru sayısı'
      }
    ],
    gdFormula: '(A / B)',
    gpRules: [
      { condition: 'GD ≥ %75', operator: 'gte', minValue: 75, points: 20 },
      { condition: '%70 ≤ GD < %75', operator: 'between', minValue: 70, maxValue: 75, points: 15 },
      { condition: '%65 ≤ GD < %70', operator: 'between', minValue: 65, maxValue: 70, points: 12 },
      { condition: '%60 ≤ GD < %65', operator: 'between', minValue: 60, maxValue: 65, points: 8 },
      { condition: '%55 ≤ GD < %60', operator: 'between', minValue: 55, maxValue: 60, points: 4 },
      { condition: '%50 ≤ GD < %55', operator: 'between', minValue: 50, maxValue: 55, points: 2 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'SGGM (SABİM) üzerinden toplanan çalışan memnuniyet anketi verileri kullanılır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ASH-2 — Sağlık KKM'lerde Acil Çağrıların Ekibe Ortalama Verilme Süresi (Saniye)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ASH-2',
    name: 'Sağlık KKM\'lerde Acil Çağrıların Ekibe Ortalama Verilme Süresi (Saniye)',
    category: 'ASH',
    unit: 'ratio',
    unitLabel: 'Saniye',
    maxPoints: 20,
    source: 'ASOS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Acil Çağrıların Ekibe Ortalama Verilme Süresi (saniye)',
        type: 'number',
        required: true,
        description: 'ASOS sisteminde aynı kişiden gelen çağrıların en fazla bir ihbarı kayıt etmesi durumunda ortalama verilme süresi'
      }
    ],
    gdFormula: 'A',
    gpRules: [
      { condition: 'GD ≤ 120 sn', operator: 'lte', maxValue: 120, points: 20 },
      { condition: '120 < GD ≤ 130 sn', operator: 'between', minValue: 120, maxValue: 130, points: 15 },
      { condition: '130 < GD ≤ 140 sn', operator: 'between', minValue: 130, maxValue: 140, points: 12 },
      { condition: '140 < GD ≤ 150 sn', operator: 'between', minValue: 140, maxValue: 150, points: 9 },
      { condition: '150 < GD ≤ 180 sn', operator: 'between', minValue: 150, maxValue: 180, points: 5 },
      { condition: 'GD > 180 sn', operator: 'gt', minValue: 180, points: 0 }
    ],
    notes: 'ASOS sisteminden hesaplanır. Kısa süre daha yüksek puan alır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ASH-3 — Kentsel 0–10 Dakika Arası Ulaşılan Acil Vaka Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ASH-3',
    name: 'Kentsel 0–10 Dakika Arası Ulaşılan Acil Vaka Oranı (%)',
    category: 'ASH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 20,
    source: 'ASOS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Kentsel 0-10 Dakika Arası Ulaşılan Acil Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminde kentsel alanda 10 dakika içinde ulaşılan acil vaka sayısı'
      },
      {
        key: 'B',
        label: 'Kentsel Toplam Acil Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminde kentsel alandaki toplam acil vaka sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %95', operator: 'gte', minValue: 95, points: 20 },
      { condition: '%90 ≤ GD < %95', operator: 'between', minValue: 90, maxValue: 95, points: 15 },
      { condition: '%85 ≤ GD < %90', operator: 'between', minValue: 85, maxValue: 90, points: 9 },
      { condition: '%80 ≤ GD < %85', operator: 'between', minValue: 80, maxValue: 85, points: 6 },
      { condition: '%75 ≤ GD < %80', operator: 'between', minValue: 75, maxValue: 80, points: 4 },
      { condition: 'GD < %75', operator: 'lt', maxValue: 75, points: 0 }
    ],
    notes: 'ASOS sisteminden hesaplanır. Kentsel alanda 10 dakika içinde ulaşılan acil vaka oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ASH-4 — Kırsal 0–30 Dakika Arası Ulaşılan Acil Vaka Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ASH-4',
    name: 'Kırsal 0–30 Dakika Arası Ulaşılan Acil Vaka Oranı (%)',
    category: 'ASH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 20,
    source: 'ASOS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Kırsalda 0–30 Dakika Arası Ulaşılan Acil Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminde kırsal alanda 30 dakika içinde ulaşılan acil vaka sayısı'
      },
      {
        key: 'B',
        label: 'Kırsal Toplam Acil Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminde kırsal alandaki toplam acil vaka sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %95', operator: 'gte', minValue: 95, points: 20 },
      { condition: '%90 ≤ GD < %95', operator: 'between', minValue: 90, maxValue: 95, points: 15 },
      { condition: '%85 ≤ GD < %90', operator: 'between', minValue: 85, maxValue: 90, points: 9 },
      { condition: '%80 ≤ GD < %85', operator: 'between', minValue: 80, maxValue: 85, points: 6 },
      { condition: '%75 ≤ GD < %80', operator: 'between', minValue: 75, maxValue: 80, points: 4 },
      { condition: 'GD < %75', operator: 'lt', maxValue: 75, points: 0 }
    ],
    notes: 'ASOS sisteminden hesaplanır. Kırsal alanda 30 dakika içinde ulaşılan acil vaka oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ASH-5 — ASOS'ta Kapatılmış Vaka Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ASH-5',
    name: 'ASOS\'ta Kapatılmış Vaka Oranı (%)',
    category: 'ASH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 20,
    source: 'ASOS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Kapatılan Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminden ilgili aydaki toplam kapatılan vaka sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Vaka Sayısı',
        type: 'number',
        required: true,
        description: 'ASOS sisteminden ilgili aydaki toplam vaka sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD = %100', operator: 'gte', minValue: 100, points: 20 },
      { condition: '%99 ≤ GD < %100', operator: 'between', minValue: 99, maxValue: 100, points: 10 },
      { condition: 'GD < %99', operator: 'lt', maxValue: 99, points: 0 }
    ],
    notes: 'ASOS sisteminden hesaplanır. %100 kapatma oranı tam puan alır.'
  }
];

/**
 * ASH gösterge sayısı
 */
export const ASH_INDICATOR_COUNT = ASH_INDICATORS.length;

/**
 * ASH maksimum toplam puan
 */
export const ASH_MAX_TOTAL_POINTS = ASH_INDICATORS.reduce(
  (sum, ind) => sum + ind.maxPoints,
  0
);

/**
 * Gösterge koduna göre tanım getir
 */
export const getASHIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return ASH_INDICATORS.find(ind => ind.code === code);
};
