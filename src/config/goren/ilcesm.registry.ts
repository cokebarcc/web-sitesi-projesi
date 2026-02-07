/**
 * GÖREN - İlçe Sağlık Müdürlüğü (İLÇESM) Gösterge Registry
 *
 * 13 gösterge: SYPG-İLÇESM-1..4, 8, 10..17
 * (5, 6, 7, 9 numaralar kılavuzda kullanılmamıştır)
 * Kaynak: GÖREN Kılavuzu
 */

import { IndicatorDefinition } from '../../../components/goren/types/goren.types';

export const ILCESM_INDICATORS: IndicatorDefinition[] = [
  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-1 — Aile Hekimliğinden Memnuniyet Oranı
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-1',
    name: 'Aile Hekimliğinden Memnuniyet Oranı',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'MHRS',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'İlçede Kayıtlı Kişilerin Aile Hekimlerinden Memnuniyet Düzeyi',
        type: 'number',
        required: true,
        description: 'MHRS anket sorularında cevap verilen soruların toplam puanı'
      },
      {
        key: 'B',
        label: 'İlde Aile Hekiminden Memnuniyet Ortalaması',
        type: 'number',
        required: true,
        description: 'MHRS anket sorularında cevap verilen soru sayısı'
      }
    ],
    gdFormula: 'A',
    gpRules: [
      { condition: 'A ≥ B', operator: 'formula', formula: 'GD >= B', points: 5 },
      { condition: 'B×0.8 ≤ A < B', operator: 'formula', formula: 'GD >= B*0.8 && GD < B', points: 3 },
      { condition: 'B×0.5 ≤ A < B×0.8', operator: 'formula', formula: 'GD >= B*0.5 && GD < B*0.8', points: 1 },
      { condition: 'A < B×0.5', operator: 'formula', formula: 'GD < B*0.5', points: 0 }
    ],
    notes: 'GD = A. İlçe memnuniyet puanı, il ortalaması ile kıyaslanarak değerlendirilir. Kaynak: MHRS.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-2 — Çalışan Memnuniyet Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-2',
    name: 'Çalışan Memnuniyet Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
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
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≥ %75', operator: 'gte', minValue: 75, points: 8 },
      { condition: '%70 ≤ GD < %75', operator: 'between', minValue: 70, maxValue: 75, points: 7 },
      { condition: '%65 ≤ GD < %70', operator: 'between', minValue: 65, maxValue: 70, points: 5 },
      { condition: '%60 ≤ GD < %65', operator: 'between', minValue: 60, maxValue: 65, points: 3 },
      { condition: '%50 ≤ GD < %60', operator: 'between', minValue: 50, maxValue: 60, points: 1 },
      { condition: 'GD < %50', operator: 'lt', maxValue: 50, points: 0 }
    ],
    notes: 'SGGM (SABİM) üzerinden toplanan çalışan memnuniyet anketi verileri kullanılır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-3 — 6'lı Karma 3.Doz Aşılama Hızı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-3',
    name: '6\'lı Karma 3.Doz Aşılama Hızı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Aşı Yapılan 6\'lı Karma 3. Doz Sayısı',
        type: 'number',
        required: true,
        description: 'Bağışıklama tablosunda takvimi olan çocuklarda gereken dönemde 6\'lı karma 3. doz aşısı yapılan bebek sayısı'
      },
      {
        key: 'B',
        label: '6\'lı Karma 3. Doz Aşısı Yapılması Gereken Bebek Sayısı',
        type: 'number',
        required: true,
        description: 'Bağışıklama tablosunda takvimi olan çocukların gereken dönemde aşı yapılması gereken bebek sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %98', operator: 'gte', minValue: 98, points: 8 },
      { condition: '%95 ≤ GD < %98', operator: 'between', minValue: 95, maxValue: 98, points: 6 },
      { condition: '%92 ≤ GD < %95', operator: 'between', minValue: 92, maxValue: 95, points: 3 },
      { condition: '%90 ≤ GD < %92', operator: 'between', minValue: 90, maxValue: 92, points: 1 },
      { condition: 'GD < %90', operator: 'lt', maxValue: 90, points: 0 }
    ],
    notes: 'e-Nabız bağışıklama verilerinden hesaplanır. Aşı erteleme/iptal veri seti de dikkate alınır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-4 — KKK 2.Doz Aşılama Hızı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-4',
    name: 'KKK 2.Doz Aşılama Hızı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Yıl İçerisinde 48 Aylık Çocuklarda Uygulanan Toplam KKK Aşısı Sayısı',
        type: 'number',
        required: true,
        description: 'Bağışıklama tablosunda takvimi olan çocukların gereken dönemde KKK aşısı uygulanan çocuklara toplam aşı sayısı'
      },
      {
        key: 'B',
        label: '48 Ayı Dolan KKK Aşısı Yapılması Gereken Çocuk Sayısı',
        type: 'number',
        required: true,
        description: 'Bağışıklama tablosunda takvimi olan çocukların gereken dönemde KKK aşısı yapılması gereken 4 yaşını doldurmuş çocuk sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %98', operator: 'gte', minValue: 98, points: 8 },
      { condition: '%95 ≤ GD < %98', operator: 'between', minValue: 95, maxValue: 98, points: 6 },
      { condition: '%92 ≤ GD < %95', operator: 'between', minValue: 92, maxValue: 95, points: 3 },
      { condition: '%90 ≤ GD < %92', operator: 'between', minValue: 90, maxValue: 92, points: 1 },
      { condition: 'GD < %90', operator: 'lt', maxValue: 90, points: 0 }
    ],
    notes: 'e-Nabız bağışıklama verilerinden hesaplanır. Aşı erteleme/iptal veri seti de dikkate alınır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-8 — HYP Takip Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-8',
    name: 'HYP Takip Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 10,
    source: 'HYP',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Tarama Oranı Ortalaması',
        type: 'number',
        required: true,
        description: '(HT Tarama Oranı + KVRD Tarama Oranı + Diyabet Tarama Oranı + Obezite Tarama Oranı) / 4'
      },
      {
        key: 'B',
        label: 'İzlem Oranı Ortalaması',
        type: 'number',
        required: true,
        description: '(HT İzlem Oranı + KVRD İzlem Oranı + Diyabet İzlem Oranı + Obezite İzlem Oranı + Yaşlı İzlem Oranı + ...) / İzlem Yapılan Hastalık Sayısı'
      }
    ],
    gdFormula: '((A + B) / 2)',
    gpRules: [
      { condition: 'GD ≥ 70', operator: 'gte', minValue: 70, points: 10 },
      { condition: '55 ≤ GD < 70', operator: 'between', minValue: 55, maxValue: 70, points: 6 },
      { condition: '40 ≤ GD < 55', operator: 'between', minValue: 40, maxValue: 55, points: 4 },
      { condition: 'GD < 40', operator: 'lt', maxValue: 40, points: 0 }
    ],
    notes: 'HYP (Hayata Yakın Plan) sistemi üzerinden tarama ve izlem oranlarının ortalaması alınır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-10 — Meme Kanseri Tarama Yüzdesi (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-10',
    name: 'Meme Kanseri Tarama Yüzdesi (%)',
    category: 'ILCESM',
    unit: 'ratio',
    unitLabel: 'Oran',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Tarama Yapılan Kişi Sayısı',
        type: 'number',
        required: true,
        description: 'Toplum Tabanlı Kanser Tarama Veri Setinden tarama kodu 2 (Meme Kanseri) olan ve tarama yapılan kişi sayısı'
      },
      {
        key: 'B',
        label: 'Hedef Nüfus',
        type: 'number',
        required: true,
        description: 'Meme kanseri taraması yapılması gereken hedef nüfus'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≥ 0.8', operator: 'gte', minValue: 0.8, points: 8 },
      { condition: '0.7 ≤ GD < 0.8', operator: 'between', minValue: 0.7, maxValue: 0.8, points: 7 },
      { condition: '0.6 ≤ GD < 0.7', operator: 'between', minValue: 0.6, maxValue: 0.7, points: 6 },
      { condition: '0.5 ≤ GD < 0.6', operator: 'between', minValue: 0.5, maxValue: 0.6, points: 2 },
      { condition: '0.4 ≤ GD < 0.5', operator: 'between', minValue: 0.4, maxValue: 0.5, points: 1 },
      { condition: 'GD < 0.4', operator: 'lt', maxValue: 0.4, points: 0 }
    ],
    notes: 'e-Nabız Toplum Tabanlı Kanser Tarama Veri Setinden (247) hesaplanır. GD = A/B (oran cinsinden).'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-11 — Rahim Ağzı Kanseri Tarama Yüzdesi (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-11',
    name: 'Rahim Ağzı Kanseri Tarama Yüzdesi (%)',
    category: 'ILCESM',
    unit: 'ratio',
    unitLabel: 'Oran',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Tarama Yapılan Kişi Sayısı',
        type: 'number',
        required: true,
        description: 'Toplum Tabanlı Kanser Tarama Veri Setinden tarama kodu 3 (Serviks Kanseri) olan ve tarama yapılan kişi sayısı'
      },
      {
        key: 'B',
        label: 'Hedef Nüfus',
        type: 'number',
        required: true,
        description: 'Rahim ağzı kanseri taraması yapılması gereken hedef nüfus'
      }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { condition: 'GD ≥ 0.8', operator: 'gte', minValue: 0.8, points: 8 },
      { condition: '0.75 ≤ GD < 0.8', operator: 'between', minValue: 0.75, maxValue: 0.8, points: 7 },
      { condition: '0.7 ≤ GD < 0.75', operator: 'between', minValue: 0.7, maxValue: 0.75, points: 6 },
      { condition: '0.6 ≤ GD < 0.7', operator: 'between', minValue: 0.6, maxValue: 0.7, points: 2 },
      { condition: '0.5 ≤ GD < 0.6', operator: 'between', minValue: 0.5, maxValue: 0.6, points: 1 },
      { condition: 'GD < 0.5', operator: 'lt', maxValue: 0.5, points: 0 }
    ],
    notes: 'e-Nabız Toplum Tabanlı Kanser Tarama Veri Setinden (247) hesaplanır. Alternatif: C/HN*12 ≥ 1 ise yıl boyunca GP=8.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-12 — En Az Üç Kez İzlenen Lohusa Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-12',
    name: 'En Az Üç Kez İzlenen Lohusa Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 8,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'En Az Üç Kez İzlenen Lohusa Sayısı',
        type: 'number',
        required: true,
        description: 'Lohusa İzlem Paketinde en az 3 kez izlem yapılan kişi sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Lohusa Sayısı',
        type: 'number',
        required: true,
        description: 'Dönem içindeki toplam lohusa sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %95', operator: 'gte', minValue: 95, points: 8 },
      { condition: '%91 ≤ GD < %95', operator: 'between', minValue: 91, maxValue: 95, points: 6 },
      { condition: '%88 ≤ GD < %91', operator: 'between', minValue: 88, maxValue: 91, points: 4 },
      { condition: '%85 ≤ GD < %88', operator: 'between', minValue: 85, maxValue: 88, points: 2 },
      { condition: 'GD < %85', operator: 'lt', maxValue: 85, points: 0 }
    ],
    notes: 'Lohusa İzlem Veri Setinden (238) hesaplanır.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-13 — Birinci Basamak Müracaat Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-13',
    name: 'Birinci Basamak Müracaat Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 10,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Birinci Basamak Sağlık Kuruluşlarına Başvuru Sayısı',
        type: 'number',
        required: true,
        description: 'Birinci basamak sağlık kuruluşlarına yapılan başvuru sayısı (laboratuvar, KETEM hariç)'
      },
      {
        key: 'B',
        label: 'Toplam Sağlık Kuruluşu Başvuru Sayısı',
        type: 'number',
        required: true,
        description: 'Tüm sağlık kuruluşlarına yapılan toplam başvuru sayısı'
      },
      {
        key: 'HD',
        label: 'Hedef Değer (HD)',
        type: 'number',
        required: true,
        description: 'Belirlenen hedef birinci basamak müracaat oranı'
      },
      {
        key: 'OD',
        label: 'Önceki Dönem Değeri (ÖD)',
        type: 'number',
        required: true,
        description: 'Önceki dönemdeki birinci basamak müracaat oranı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'HD ≤ GD', operator: 'formula', formula: 'GD >= HD', points: 10 },
      { condition: 'HD > GD ≥ HD-(0.33×F)', operator: 'formula', formula: 'GD >= HD-(0.33*(HD-OD))', points: 8 },
      { condition: 'HD-(0.33×F) > GD ≥ HD-(0.66×F)', operator: 'formula', formula: 'GD >= HD-(0.66*(HD-OD))', points: 6 },
      { condition: 'HD-(0.66×F) > GD > ÖD', operator: 'formula', formula: 'GD > OD', points: 3 },
      { condition: 'ÖD ≥ GD', operator: 'formula', formula: 'GD <= OD', points: 0 }
    ],
    notes: 'F = HD - ÖD formülü kullanılır. HD ve ÖD parametreleri kullanıcı tarafından girilmelidir.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-14 — Tütün İhbarlarına 2 Saat İçerisindeki Müdahale ve Usulsüzlük Belirleme Yüzdesi
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-14',
    name: 'Tütün İhbarlarına 2 Saat İçerisindeki Müdahale ve Usulsüzlük Belirleme Yüzdesi',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 10,
    source: 'DHSDS Yazılımı',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: '2 Saat İçerisinde Müdahale Edilen İhbar Sayısı',
        type: 'number',
        required: true,
        description: 'DHSDS yazılımından ilgili döneme ait 2 saat içerisinde müdahale edilen toplam ihbar sayısı'
      },
      {
        key: 'B',
        label: 'Görev Olarak Atanan Toplam İhbar Sayısı',
        type: 'number',
        required: true,
        description: 'DHSDS yazılımından ilgili döneme ait görev olarak atanan toplam ihbar sayısı'
      },
      {
        key: 'C',
        label: 'Gidilen İhbarda Usulsüzlük Yakalama Sayısı',
        type: 'number',
        required: true,
        description: 'DHSDS yazılımından ilgili döneme ait gidilen ihbarda usulsüzlük yakalama sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpFormula: 'GP = GP1 + GP2',
    gpRules: [
      { condition: 'B=0 ise', operator: 'formula', formula: 'B === 0', points: 10 },
      { condition: 'GD1 = %100 → GP1=3', operator: 'formula', formula: 'GD1 === 100', points: 3 },
      { condition: '%80 ≤ GD1 < %100 → GP1=2', operator: 'formula', formula: 'GD1 >= 80 && GD1 < 100', points: 2 },
      { condition: '%60 ≤ GD1 < %80 → GP1=1', operator: 'formula', formula: 'GD1 >= 60 && GD1 < 80', points: 1 },
      { condition: 'GD1 < %60 → GP1=0', operator: 'formula', formula: 'GD1 < 60', points: 0 }
    ],
    notes: 'Çift formüllü gösterge: GD1=(A/B)*100, GD2=(C/A)*100. GP = GP1 + GP2. GD2 kuralları: ≥%50 → GP2=7, ≥%40 → GP2=5, ≥%30 → GP2=3, ≥%10 → GP2=2, <%10 → GP2=0. B=0 ise GP=10.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-15 — Aile Hekimlerinin Hastaneden Randevu Alma Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-15',
    name: 'Aile Hekimlerinin Hastaneden Randevu Alma Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 7,
    source: 'MHRS, e-Nabız',
    hbysCalculable: false,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Aile Hekiminin Kayıtlı Hastasına Aldığı Toplam Randevu Sayısı',
        type: 'number',
        required: true,
        description: 'MHRS sisteminde operasyon tipi 201, aksiyon kodu 200 olan normal muayene randevuları'
      },
      {
        key: 'B',
        label: 'Aile Hekimine Kayıtlı Hastaların Toplam Hastane Başvuru Sayısı',
        type: 'number',
        required: true,
        description: 'e-Nabız sisteminden aile hekimine kayıtlı hastaların hastane başvuru sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≥ %10', operator: 'gte', minValue: 10, points: 7 },
      { condition: '%5 ≤ GD < %10', operator: 'between', minValue: 5, maxValue: 10, points: 5 },
      { condition: '%1 ≤ GD < %5', operator: 'between', minValue: 1, maxValue: 5, points: 2 },
      { condition: 'GD < %1', operator: 'lt', maxValue: 1, points: 0 }
    ],
    notes: 'Aile hekimlerinin kayıtlı hastalarına hastaneden randevu alma oranı.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-16 — Aile Hekimliği Başvuru Başına Antibiyotik İçeren Reçete Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-16',
    name: 'Aile Hekimliği Başvuru Başına Antibiyotik İçeren Reçete Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Antibiyotik İçeren Reçete Sayısı',
        type: 'number',
        required: true,
        description: 'Muayene bilgisi kaydında J01 ATC kodu içeren reçete sayısı'
      },
      {
        key: 'B',
        label: 'Toplam Reçete Sayısı',
        type: 'number',
        required: true,
        description: 'Toplam muayene sonrası yazılan reçete sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %30', operator: 'lte', maxValue: 30, points: 5 },
      { condition: '%30 < GD ≤ %40', operator: 'between', minValue: 30, maxValue: 40, points: 4 },
      { condition: '%40 < GD ≤ %50', operator: 'between', minValue: 40, maxValue: 50, points: 2 },
      { condition: 'GD > %50', operator: 'gt', minValue: 50, points: 0 }
    ],
    notes: 'Düşük antibiyotik oranı daha yüksek puan alır. Negatif performans göstergesi.'
  },

  // -----------------------------------------------------------------------
  // SYPG-İLÇESM-17 — Aile Hekimliği Toplam İlaç İçindeki Antibiyotik Oranı (%)
  // -----------------------------------------------------------------------
  {
    code: 'SYPG-İLÇESM-17',
    name: 'Aile Hekimliği Toplam İlaç İçindeki Antibiyotik Oranı (%)',
    category: 'ILCESM',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 5,
    source: 'e-Nabız',
    hbysCalculable: true,
    frequency: 'monthly',
    parameters: [
      {
        key: 'A',
        label: 'Antibiyotik İlaç Sayısı',
        type: 'number',
        required: true,
        description: 'Reçetelerdeki J01 ATC kodlu toplam antibiyotik ilaç sayısı'
      },
      {
        key: 'B',
        label: 'Toplam İlaç Sayısı',
        type: 'number',
        required: true,
        description: 'Reçetelerdeki toplam ilaç sayısı'
      }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { condition: 'GD ≤ %30', operator: 'lte', maxValue: 30, points: 5 },
      { condition: '%30 < GD ≤ %40', operator: 'between', minValue: 30, maxValue: 40, points: 4 },
      { condition: '%40 < GD ≤ %50', operator: 'between', minValue: 40, maxValue: 50, points: 2 },
      { condition: 'GD > %50', operator: 'gt', minValue: 50, points: 0 }
    ],
    notes: 'Düşük antibiyotik oranı daha yüksek puan alır. Negatif performans göstergesi.'
  }
];

/**
 * İLÇESM gösterge sayısı
 */
export const ILCESM_INDICATOR_COUNT = ILCESM_INDICATORS.length;

/**
 * İLÇESM maksimum toplam puan
 */
export const ILCESM_MAX_TOTAL_POINTS = ILCESM_INDICATORS.reduce(
  (sum, ind) => sum + ind.maxPoints,
  0
);

/**
 * Gösterge koduna göre tanım getir
 */
export const getILCESMIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return ILCESM_INDICATORS.find(ind => ind.code === code);
};
