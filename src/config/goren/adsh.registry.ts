/**
 * GÖREN - Ağız ve Diş Sağlığı Hastanesi (ADSH) Gösterge Registry
 *
 * 14 gösterge: SYPG-ADSH-1 ... SYPG-ADSH-14
 * Kaynak: GÖREN Kılavuzu
 */

import { IndicatorDefinition } from '../../../components/goren/types/goren.types';

export const ADSH_INDICATORS: IndicatorDefinition[] = [
  // -----------------------------------------------------------------------
  // SYPG-ADSH-1 — Hasta Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-1',
    name: 'Hasta Memnuniyet Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
    source: 'MHRS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Hasta Memnuniyeti Anketlerinden Elde Edilen Toplam Puan',
        type: 'number',
        required: true,
        description: 'MHRS anket sorularında cevap verilen soruların toplam puanı'
      },
      {
        key: 'B',
        label: 'Cevaplanan Soru Sayısı',
        type: 'number',
        required: true,
        description: 'MHRS anket sorularında cevap verilen soru sayısı'
      }
    ],
    gdFormula: '(A / B)',
    gpRules: [
      { condition: 'GD ≥ %80', operator: 'gte', minValue: 80, points: 6 },
      { condition: '%75 ≤ GD < %80', operator: 'between', minValue: 75, maxValue: 80, points: 5 },
      { condition: '%70 ≤ GD < %75', operator: 'between', minValue: 70, maxValue: 75, points: 4 },
      { condition: '%65 ≤ GD < %70', operator: 'between', minValue: 65, maxValue: 70, points: 3 },
      { condition: '%60 ≤ GD < %65', operator: 'between', minValue: 60, maxValue: 65, points: 2 },
      { condition: '%55 ≤ GD < %60', operator: 'between', minValue: 55, maxValue: 60, points: 1 },
      { condition: 'GD < %55', operator: 'lt', maxValue: 55, points: 0 }
    ],
    notes: 'MHRS üzerinden toplanan hasta memnuniyet anketi verileri kullanılır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-2 — Çalışan Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-2',
    name: 'Çalışan Memnuniyet Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
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
        description: 'Cevap verilen soru sayısı'
      }
    ],
    gdFormula: '(A / B)',
    gpRules: [
      { condition: 'GD ≥ %75', operator: 'gte', minValue: 75, points: 6 },
      { condition: '%70 ≤ GD < %75', operator: 'between', minValue: 70, maxValue: 75, points: 5 },
      { condition: '%65 ≤ GD < %70', operator: 'between', minValue: 65, maxValue: 70, points: 4 },
      { condition: '%60 ≤ GD < %65', operator: 'between', minValue: 60, maxValue: 65, points: 3 },
      { condition: '%55 ≤ GD < %60', operator: 'between', minValue: 55, maxValue: 60, points: 2 },
      { condition: '%50 ≤ GD < %55', operator: 'between', minValue: 50, maxValue: 55, points: 1 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'SGGM (SABİM) üzerinden toplanan çalışan memnuniyet anketi verileri kullanılır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-3 — Randevulu Muayene Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-3',
    name: 'Randevulu Muayene Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
    source: 'e-Nabız, MHRS',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'MHRS Üzerinden Yapılan Muayene Sayısı',
        type: 'number',
        required: true,
        description: 'MHRS sisteminde aksiyon kodu 200 (normal muayene) veya 201 (devam eden muayene), randevu durumu 1 olan muayene sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Muayene Sayısı',
        type: 'number',
        required: true,
        description: 'Hastanedeki toplam muayene sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %80', operator: 'gte', minValue: 80, points: 6 },
      { condition: '%70 ≤ GD < %80', operator: 'between', minValue: 70, maxValue: 80, points: 3 },
      { condition: 'GD < %70', operator: 'lt', maxValue: 70, points: 0 }
    ],
    notes: 'MHRS üzerinden randevulu yapılan muayenelerin toplam muayenelere oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-4 — Veri Gönderme Başarı Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-4',
    name: 'Veri Gönderme Başarı Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Başarılı Veri Gönderme Sayısı',
        type: 'number',
        required: true,
        description: 'e-Nabız sistemine başarılı şekilde gönderilen veri sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Veri Gönderme Sayısı',
        type: 'number',
        required: true,
        description: 'e-Nabız sistemine gönderilen toplam veri sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ 98', operator: 'gte', minValue: 98, points: 6 },
      { condition: 'GD < 98', operator: 'lt', maxValue: 98, points: 0 }
    ],
    notes: 'e-Nabız sistemine veri gönderme başarı oranı. %98 ve üzeri tam puan.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-5 — İşlem İçeren Başvuru Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-5',
    name: 'İşlem İçeren Başvuru Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İşlem İçeren Başvuru Sayısı',
        type: 'number',
        required: true,
        description: 'Diş tedavisi işlemi içeren hasta başvuru sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Başvuru Sayısı',
        type: 'number',
        required: true,
        description: 'Hastaneye yapılan toplam başvuru sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %70', operator: 'gte', minValue: 70, points: 8 },
      { condition: '%60 ≤ GD < %70', operator: 'between', minValue: 60, maxValue: 70, points: 6 },
      { condition: '%50 ≤ GD < %60', operator: 'between', minValue: 50, maxValue: 60, points: 4 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'İşlem içeren başvuruların toplam başvurulara oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-6 — Toplam İlaç İçindeki Antibiyotik Oranının Önceki Döneme Göre Değişimi (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-6',
    name: 'Toplam İlaç İçindeki Antibiyotik Oranının Önceki Döneme Göre Değişimi (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Bir Önceki Döneme Ait Antibiyotik Bulunan Reçete Yüzdesi',
        type: 'number',
        required: true,
        description: 'Önceki aylık dönemde ayaktan hastalar için (J01 ATC kodu içeren reçete sayısı / toplam reçete sayısı) × 100'
      },
      {
        key: 'B',
        label: 'İlgili Döneme Ait Antibiyotik Bulunan Reçete Yüzdesi',
        type: 'number',
        required: true,
        description: 'İlgili aylık dönemde ayaktan hastalar için (J01 ATC kodu içeren reçete sayısı / toplam reçete sayısı) × 100'
      }
    ],
    gdFormula: '((A - B) / A) * 100',
    gpRules: [
      { condition: 'GD ≥ 5 veya B ≤ 35', operator: 'formula', formula: 'GD >= 5 || B <= 35', points: 8 },
      { condition: 'B > 35 ve 3 ≤ GD < 5', operator: 'formula', formula: 'B > 35 && GD >= 3 && GD < 5', points: 6 },
      { condition: 'B > 35 ve 1 ≤ GD < 3', operator: 'formula', formula: 'B > 35 && GD >= 1 && GD < 3', points: 4 },
      { condition: 'B > 35 ve 0 < GD < 1', operator: 'formula', formula: 'B > 35 && GD > 0 && GD < 1', points: 2 },
      { condition: 'B > 35 ve GD ≤ 0', operator: 'formula', formula: 'B > 35 && GD <= 0', points: 0 }
    ],
    notes: 'Antibiyotik oranındaki düşüş ödüllendirilir. B ≤ 35 ise otomatik tam puan.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-7 — Dolgu Tedavisi Yapılan Dişin 6 Ay İçinde Tekrar Tedavi Görme Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-7',
    name: 'Dolgu Tedavisi Yapılan Dişin 6 Ay İçinde Tekrar Tedavi Görme Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: '6 Ay İçinde Tekrar Tedavi Gören Diş Sayısı',
        type: 'number',
        required: true,
        description: 'Dolgu tedavisi yapıldıktan sonra 6 ay içinde tekrar tedavi gören diş sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Dolgu Tedavisi Yapılan Diş Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içinde dolgu tedavisi yapılan toplam diş sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %5', operator: 'lte', maxValue: 5, points: 8 },
      { condition: '%5 < GD ≤ %10', operator: 'between', minValue: 5, maxValue: 10, points: 6 },
      { condition: '%10 < GD ≤ %15', operator: 'between', minValue: 10, maxValue: 15, points: 4 },
      { condition: 'GD > %15', operator: 'gt', minValue: 15, points: 0 }
    ],
    notes: 'Düşük tekrar tedavi oranı daha yüksek puan alır. Negatif performans göstergesi.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-8 — Kanal Tedavisi Yapılan Dişin 6 Ay İçinde Tekrar Tedavi Görme Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-8',
    name: 'Kanal Tedavisi Yapılan Dişin 6 Ay İçinde Tekrar Tedavi Görme Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: '6 Ay İçinde Tekrar Tedavi Gören Diş Sayısı',
        type: 'number',
        required: true,
        description: 'Kanal tedavisi yapıldıktan sonra 6 ay içinde tekrar tedavi gören diş sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Kanal Tedavisi Yapılan Diş Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içinde kanal tedavisi yapılan toplam diş sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %5', operator: 'lte', maxValue: 5, points: 8 },
      { condition: '%5 < GD ≤ %10', operator: 'between', minValue: 5, maxValue: 10, points: 6 },
      { condition: '%10 < GD ≤ %15', operator: 'between', minValue: 10, maxValue: 15, points: 4 },
      { condition: 'GD > %15', operator: 'gt', minValue: 15, points: 0 }
    ],
    notes: 'Düşük tekrar tedavi oranı daha yüksek puan alır. Negatif performans göstergesi.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-9 — 5-10 Yaş Aralığında Çekim Yapılan Süt Dişleri Yerine Yer Tutucu Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-9',
    name: '5-10 Yaş Aralığında Çekim Yapılan Süt Dişleri Yerine Yer Tutucu Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Yer Tutucu Uygulanan Süt Dişi Sayısı',
        type: 'number',
        required: true,
        description: '5-10 yaş aralığında çekim yapılan süt dişlerine yer tutucu uygulama sayısı'
      },
      {
        key: 'B',
        label: 'Çekim Yapılan Toplam Süt Dişi Sayısı',
        type: 'number',
        required: true,
        description: '5-10 yaş aralığında çekim yapılan toplam süt dişi sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %8', operator: 'gte', minValue: 8, points: 6 },
      { condition: '%5 ≤ GD < %8', operator: 'between', minValue: 5, maxValue: 8, points: 3 },
      { condition: '%2 ≤ GD < %5', operator: 'between', minValue: 2, maxValue: 5, points: 1 },
      { condition: 'GD < %2', operator: 'lt', maxValue: 2, points: 0 }
    ],
    notes: 'Çekim yapılan süt dişlerine yer tutucu uygulanma oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-10 — Sabit Protez Tesliminden Sonra 6 Ay İçerisinde Protez Yapılan Dişlere Tedavi Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-10',
    name: 'Sabit Protez Tesliminden Sonra 6 Ay İçerisinde Protez Yapılan Dişlere Tedavi Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 6,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: '6 Ay İçinde Tedavi Edilen Protez Dişi Sayısı',
        type: 'number',
        required: true,
        description: 'Sabit protez tesliminden sonra 6 ay içinde protez yapılan dişlere tedavi sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Sabit Protez Teslim Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içinde teslim edilen toplam sabit protez sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %10', operator: 'lte', maxValue: 10, points: 6 },
      { condition: '%10 < GD ≤ %15', operator: 'between', minValue: 10, maxValue: 15, points: 3 },
      { condition: '%15 < GD ≤ %20', operator: 'between', minValue: 15, maxValue: 20, points: 2 },
      { condition: 'GD > %20', operator: 'gt', minValue: 20, points: 0 }
    ],
    notes: 'Düşük tekrar tedavi oranı daha yüksek puan alır. Negatif performans göstergesi.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-11 — Hiç İşlem Yapılmadan Yeşil Listeye Alınan Hasta Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-11',
    name: 'Hiç İşlem Yapılmadan Yeşil Listeye Alınan Hasta Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İşlem Yapılmadan Yeşil Listeye Alınan Hasta Sayısı',
        type: 'number',
        required: true,
        description: 'Hiçbir işlem yapılmadan yeşil listeye alınan hasta sayısı'
      },
      {
        key: 'B',
        label: 'Yeşil Listeye Alınan Toplam Hasta Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içinde yeşil listeye alınan toplam hasta sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %25', operator: 'lte', maxValue: 25, points: 8 },
      { condition: '%25 < GD ≤ %50', operator: 'between', minValue: 25, maxValue: 50, points: 6 },
      { condition: '%50 < GD ≤ %75', operator: 'between', minValue: 50, maxValue: 75, points: 4 },
      { condition: 'GD > %75', operator: 'gt', minValue: 75, points: 0 }
    ],
    notes: 'Düşük işlemsiz yeşil liste oranı daha yüksek puan alır. Negatif performans göstergesi.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-12 — Mal Alımlarının Tahakkuklarının Muhasebeleştirilme Süresi (Gün)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-12',
    name: 'Mal Alımlarının Tahakkuklarının Muhasebeleştirilme Süresi (Gün)',
    category: 'ADSH',
    unit: 'ratio',
    unitLabel: 'Gün',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Toplam Muhasebeleştirme Süresi (Gün)',
        type: 'number',
        required: true,
        description: 'Mal alımlarının tahakkuklarının muhasebeleştirilmesi için geçen toplam gün sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Mal Alımı Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içindeki toplam mal alımı sayısı'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≤ 10', operator: 'lte', maxValue: 10, points: 8 },
      { condition: '10 < GD ≤ 12', operator: 'between', minValue: 10, maxValue: 12, points: 5 },
      { condition: '12 < GD ≤ 15', operator: 'between', minValue: 12, maxValue: 15, points: 3 },
      { condition: 'GD > 15', operator: 'gt', minValue: 15, points: 0 }
    ],
    notes: 'Ortalama muhasebeleştirme süresi gün cinsinden. Kısa süre daha yüksek puan alır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-13 — Mevcut İlaç ve Sarf Stok Tutarının Tüketim Tutarına Oranı (Gün)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-13',
    name: 'Mevcut İlaç ve Sarf Stok Tutarının Tüketim Tutarına Oranı (Gün)',
    category: 'ADSH',
    unit: 'ratio',
    unitLabel: 'Gün',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Mevcut İlaç ve Sarf Stok Tutarı',
        type: 'number',
        required: true,
        description: 'Dönem sonundaki mevcut ilaç ve sarf malzeme stok tutarı'
      },
      {
        key: 'B',
        label: 'Aylık Tüketim Tutarı',
        type: 'number',
        required: true,
        description: 'Aylık ortalama ilaç ve sarf malzeme tüketim tutarı'
      }
    ],
    gdFormula: '(A / B) * 30',
    gpRules: [
      { condition: 'GD ≤ 60 gün', operator: 'lte', maxValue: 60, points: 8 },
      { condition: '60 < GD ≤ 75 gün', operator: 'between', minValue: 60, maxValue: 75, points: 5 },
      { condition: '75 < GD ≤ 90 gün', operator: 'between', minValue: 75, maxValue: 90, points: 2 },
      { condition: 'GD > 90 gün', operator: 'gt', minValue: 90, points: 0 }
    ],
    notes: 'Stok devir hızı gün cinsinden. Düşük stok süresi daha yüksek puan alır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-ADSH-14 — Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-ADSH-14',
    name: 'Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı (%)',
    category: 'ADSH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İlaç ve Tıbbi Malzeme Gideri',
        type: 'number',
        required: true,
        description: 'Dönem içindeki toplam ilaç ve tıbbi malzeme gideri'
      },
      {
        key: 'B',
        label: 'Tahakkuk Tutarı',
        type: 'number',
        required: true,
        description: 'Dönem içindeki toplam tahakkuk tutarı'
      },
      {
        key: 'OD',
        label: 'Önceki Dönem Değeri (ÖD)',
        type: 'number',
        required: true,
        description: 'Belirlenen önceki dönem karşılama oranı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ ÖD', operator: 'formula', formula: 'GD <= OD', points: 8 },
      { condition: 'ÖD < GD ≤ ÖD×1.3', operator: 'formula', formula: 'GD > OD && GD <= OD*1.3', points: 6 },
      { condition: 'ÖD×1.3 < GD ≤ ÖD×1.5', operator: 'formula', formula: 'GD > OD*1.3 && GD <= OD*1.5', points: 2 },
      { condition: 'GD > ÖD×1.5', operator: 'formula', formula: 'GD > OD*1.5', points: 0 }
    ],
    notes: 'ÖD (Önceki Dönem) parametresi kullanıcı tarafından girilmelidir. Düşük gider/tahakkuk oranı daha yüksek puan alır.'
  }
];

/**
 * ADSH gösterge sayısı
 */
export const ADSH_INDICATOR_COUNT = ADSH_INDICATORS.length;

/**
 * ADSH maksimum toplam puan
 */
export const ADSH_MAX_TOTAL_POINTS = ADSH_INDICATORS.reduce(
  (sum, ind) => sum + ind.maxPoints,
  0
);

/**
 * Gösterge koduna göre tanım getir
 */
export const getADSHIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return ADSH_INDICATORS.find(ind => ind.code === code);
};
