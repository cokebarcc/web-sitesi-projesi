/**
 * GÖREN - Başhekimlik (BH) Gösterge Registry
 *
 * 38 gösterge: SYPG-BH-1 ... SYPG-BH-38
 * Kaynak: GÖREN Kılavuzu
 *
 * NOT: Bu göstergeler Excel'den yüklenen verilerle çalışır.
 * Excel formatı: Sıra | Gösterge Adı | Birim | A | B | Dönem İçi | TR Rol Ortalama | Dönem İçi Puan | Muaf
 */

import { IndicatorDefinition } from '../../../components/goren/types/goren.types';

export const BH_INDICATORS: IndicatorDefinition[] = [
  // 1. Hasta Memnuniyet Oranı - Maks: 3
  {
    code: 'SYPG-BH-1',
    name: 'Hasta Memnuniyet Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Hasta memnuniyet puanı toplamı', type: 'number', required: true },
      { key: 'B', label: 'Anket sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 2. Çalışan Memnuniyet Oranı - Maks: 3
  {
    code: 'SYPG-BH-2',
    name: 'Çalışan Memnuniyet Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Çalışan memnuniyet puanı toplamı', type: 'number', required: true },
      { key: 'B', label: 'Anket sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 3. Yeşil Alan Hariç Acil Muayene Oranı - Maks: 3
  {
    code: 'SYPG-BH-3',
    name: 'Yeşil Alan Hariç Acil Muayene Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yeşil alan hariç acil muayene sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam acil muayene sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 4. Randevulu Muayene Oranı - Maks: 3
  {
    code: 'SYPG-BH-4',
    name: 'Randevulu Muayene Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Randevulu muayene sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam poliklinik muayene sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 5. Uzman Hekim Başına Düşen Günlük Muayene Sayısı - Maks: 3
  {
    code: 'SYPG-BH-5',
    name: 'Uzman Hekim Başına Düşen Günlük Muayene Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam poliklinik muayene sayısı', type: 'number', required: true },
      { key: 'B', label: 'Uzman hekim çalışma günü toplamı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 6. Kadın Doğum Uzmanı Başına Düşen Normal Doğum Sayısı - Maks: 4
  {
    code: 'SYPG-BH-6',
    name: 'Kadın Doğum Uzmanı Başına Düşen Normal Doğum Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 4,
    source: 'e-RAPOR, EKOBS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Toplam normal doğum sayısı (e-RAPOR)', type: 'number', required: true },
      { key: 'B', label: 'Kadın doğum uzman sayısı (EKOBS, EK-12)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 4 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 7. Başvuru Başına Tetkik Oranı - Maks: 2
  {
    code: 'SYPG-BH-7',
    name: 'Başvuru Başına Tetkik Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam ayaktan hastaya yapılan lab. tetkik sayısı (Acil hariç, EK-3)', type: 'number', required: true },
      { key: 'B', label: 'Toplam ayaktan başvuru sayısı (Acil hariç)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 8. Primer Sezaryen Oranı - Maks: 4
  {
    code: 'SYPG-BH-8',
    name: 'Primer Sezaryen Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 4,
    source: 'e-RAPOR',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Primer sezaryen sayısı (e-RAPOR)', type: 'number', required: true },
      { key: 'B', label: 'Toplam canlı doğum sayısı (e-RAPOR)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 4 },
      { operator: 'formula', formula: 'GD > GO && GD <= GO * 1.15', points: 2 },
      { operator: 'formula', formula: 'GD > GO * 1.15 && GD <= GO * 1.30', points: 1 },
      { operator: 'formula', formula: 'GD > GO * 1.30', points: 0 }
    ]
  },

  // 9. Sezaryen Sayısının Referans Değerlerden Sapma Oranı - Maks: 3
  {
    code: 'SYPG-BH-9',
    name: 'Sezaryen Sayısının Referans Değerlerden Sapma Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'e-RAPOR',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Gerçekleşen sezaryen sayısı (e-RAPOR)', type: 'number', required: true },
      { key: 'B', label: 'Robson sınıflamasına göre hesaplanmış referans sezaryen sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '((A - B) / B) * 100',
    gpRules: [
      // B > 0 durumları
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
      // Özel durumlar (B=0): Calculator hook'ta ayrıca ele alınmalı
      // B = 0 ve A = 0 → 3 puan
      // B = 0 ve A > 0 → 0 puan
    ]
  },

  // 10. Başvuru Başına Reçete Sayısı (100 Başvuruda) - Maks: 4
  {
    code: 'SYPG-BH-10',
    name: 'Başvuru Başına Reçete Sayısı (100 Başvuruda)',
    category: 'BH',
    unit: 'ratio',
    unitLabel: '100 Başvuruda',
    maxPoints: 4,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam ayaktan reçete sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam ayaktan başvuru sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 4 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 11. Başvuru Başına Antibiyotik İçeren Reçete Sayısı (100 Başvuruda) - Maks: 4
  {
    code: 'SYPG-BH-11',
    name: 'Başvuru Başına Antibiyotik İçeren Reçete Sayısı (100 Başvuruda)',
    category: 'BH',
    unit: 'ratio',
    unitLabel: '100 Başvuruda',
    maxPoints: 4,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Antibiyotik (J01) içeren ayaktan reçete sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam ayaktan hasta başvuru sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 4 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 12. E-Reçete Oranı - Maks: 2
  {
    code: 'SYPG-BH-12',
    name: 'E-Reçete Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'SGK',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Yazılan e-reçete sayısı (SGK)', type: 'number', required: true },
      { key: 'B', label: 'Yazılan toplam reçete sayısı (SGK)', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'gte', minValue: 95, points: 2 },
      { operator: 'between', minValue: 85, maxValue: 95, points: 1 },
      { operator: 'lt', maxValue: 85, points: 0 }
    ]
  },

  // 13. Veri Gönderme Başarı Oranı - Maks: 2
  {
    code: 'SYPG-BH-13',
    name: 'Veri Gönderme Başarı Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'E-Nabıza zamanında gönderilen gösterge bileşeni sayısı', type: 'number', required: true },
      { key: 'B', label: 'E-Nabıza gönderilmesi gereken gösterge bileşeni sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'gte', minValue: 98, points: 2 },
      { operator: 'lt', maxValue: 98, points: 0 }
    ]
  },

  // 14. Yoğun Bakımda 10 Günden Fazla Yatan Hasta Oranı - Maks: 2
  {
    code: 'SYPG-BH-14',
    name: 'Yoğun Bakımda 10 Günden Fazla Yatan Hasta Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yoğun bakımda 10 günden fazla yatan hasta sayısı (EK-4 SUT kodları)', type: 'number', required: true },
      { key: 'B', label: 'Toplam yoğun bakımda yatan hastaların yatış sayısı (EK-4 SUT kodları)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 15. Yoğun Bakımda 15 Günden Fazla Yatan Hasta Oranı - Maks: 3
  {
    code: 'SYPG-BH-15',
    name: 'Yoğun Bakımda 15 Günden Fazla Yatan Hasta Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'e-NABIZ',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yoğun bakımda 15 günden fazla yatan hasta sayısı (EK-4 SUT kodları)', type: 'number', required: true },
      { key: 'B', label: 'Toplam yoğun bakımda yatan hastaların yatış sayısı (EK-4 SUT kodları)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 16. Servis Yatak Devir Hızı - Maks: 2
  {
    code: 'SYPG-BH-16',
    name: 'Servis Yatak Devir Hızı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Hasta',
    maxPoints: 2,
    source: 'e-Nabız, ASOS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Serviste yatan hasta sayısı (EK-4.1)', type: 'number', required: true },
      { key: 'B', label: 'Servis yatak sayısı (ASOS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 17. Yoğun Bakım Yatak Devir Hızı - Maks: 2
  {
    code: 'SYPG-BH-17',
    name: 'Yoğun Bakım Yatak Devir Hızı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Hasta',
    maxPoints: 2,
    source: 'e-Nabız, ASOS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yoğun bakımda yatan hastaların yatış sayısı (YB SUT kodları)', type: 'number', required: true },
      { key: 'B', label: 'Yoğun bakım yatak sayısı (ASOS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 18. Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A, B, C) Sayısı - Maks: 2
  {
    code: 'SYPG-BH-18',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A, B, C) Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 2,
    source: 'e-Nabız, EKOBS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'A1,A2,A3,B,C grubu ameliyat sayısı (e-Nabız)', type: 'number', required: true },
      { key: 'B', label: 'Cerrahi klinisyen hekim sayısı (EKOBS, adam-gün)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 19. Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A,B,C) Grup Katsayısı - Maks: 2
  {
    code: 'SYPG-BH-19',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A,B,C) Grup Katsayısı',
    category: 'BH',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 2,
    source: 'e-Nabız, EKOBS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Ameliyat grup katsayılı puanı (A*5+B*2+C*1)', type: 'number', required: true },
      { key: 'B', label: 'Cerrahi klinisyen hekim sayısı (EKOBS, adam-gün)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 20. Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Puanı - Maks: 2
  {
    code: 'SYPG-BH-20',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Puanı',
    category: 'BH',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 2,
    source: 'e-Nabız, TSİM',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'A,B,C grubu ameliyat katsayılı toplam puanı (268 Hekim Puan)', type: 'number', required: true },
      { key: 'B', label: 'Aktif kullanılan ameliyat masası sayısı (TSİM)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 21. 10 Günü Geçen Patoloji Sonuçlanma Oranı - Maks: 2
  {
    code: 'SYPG-BH-21',
    name: '10 Günü Geçen Patoloji Sonuçlanma Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '10 günü geçen patoloji sonuç hasta sayısı (EK-4)', type: 'number', required: true },
      { key: 'B', label: 'Toplam patoloji sonucu verilen hasta sayısı (EK-4.2)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 22. Aktif Cihaz Başına Düşen İş Yükü - Maks: 2
  {
    code: 'SYPG-BH-22',
    name: 'Aktif Cihaz Başına Düşen İş Yükü',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 2,
    source: 'e-Nabız, MKYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yapılan çekim sayısı (EK-5)', type: 'number', required: true },
      { key: 'B', label: 'Aktif cihaz sayısı (MKYS, EK-6)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 23. Aktif Cihaz Oranı - Maks: 2
  {
    code: 'SYPG-BH-23',
    name: 'Aktif Cihaz Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'MKYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Aktif cihaz sayısı (MKYS, EK-6)', type: 'number', required: true },
      { key: 'B', label: 'Toplam cihaz sayısı (MKYS, EK-6)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 2 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 24. 3 Günü Geçen BT Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-24',
    name: '3 Günü Geçen BT Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '3 günü geçen BT randevulu hasta sayısı (EK-7)', type: 'number', required: true },
      { key: 'B', label: 'Toplam BT randevulu hasta sayısı (EK-7)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 25. Ortalama BT Raporlama Süresi - Maks: 3
  {
    code: 'SYPG-BH-25',
    name: 'Ortalama BT Raporlama Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 3,
    source: 'Teleradyoloji',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'BT çekimlerinin raporlama süreleri toplamı (gün)', type: 'number', required: true },
      { key: 'B', label: 'Toplam BT çekim sayısı (Teleradyoloji)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 26. 7 Günü Geçen MR Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-26',
    name: '7 Günü Geçen MR Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '7 günü geçen MR randevulu hasta sayısı (EK-8)', type: 'number', required: true },
      { key: 'B', label: 'Toplam MR randevulu hasta sayısı (EK-8)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 27. Ortalama MR Raporlama Süresi - Maks: 3
  {
    code: 'SYPG-BH-27',
    name: 'Ortalama MR Raporlama Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 3,
    source: 'Teleradyoloji',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'MR çekimlerinin raporlama süreleri toplamı (gün)', type: 'number', required: true },
      { key: 'B', label: 'Toplam MR çekim sayısı (Teleradyoloji)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 28. 10 Günü Geçen USG Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-28',
    name: '10 Günü Geçen USG Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '10 günü geçen USG randevulu hasta sayısı (EK-9)', type: 'number', required: true },
      { key: 'B', label: 'Toplam USG çekimi yapılan hasta sayısı (EK-9)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 3 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 29. Aile Hekimliği Asistanı Başına Düşen EAHB Sayısı - Maks: 2
  {
    code: 'SYPG-BH-29',
    name: 'Aile Hekimliği Asistanı Başına Düşen EAHB Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: '100 Kişide',
    maxPoints: 2,
    source: 'EKOBS, EKİP/ÇKYS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Eğitim AHB sayısı (ÇKYS/EKİP)', type: 'number', required: true },
      { key: 'B', label: 'Aile hekimi asistan hekim sayısı (branş:4200, ünvan:6330/10505)', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= 0.5', points: 2 },
      { operator: 'formula', formula: 'GD >= 0.25 && GD < 0.5', points: 1 },
      { operator: 'formula', formula: 'GD < 0.25', points: 0 }
    ]
  },

  // 30. Metrekare Başına Düşen Tüketim Miktarı - Maks: 2
  {
    code: 'SYPG-BH-30',
    name: 'Metrekare Başına Düşen Tüketim Miktarı',
    category: 'BH',
    unit: 'ratio',
    unitLabel: 'TL/m²',
    maxPoints: 2,
    source: 'TDMS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Elektrik, su ve yakacak giderleri toplamı (TDMS)', type: 'number', required: true },
      { key: 'B', label: 'Kurum kullanım alanı m² (TDMS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 31. Çalışma Cetvellerini Zamanında Girme Oranı - Maks: 4
  {
    code: 'SYPG-BH-31',
    name: 'Çalışma Cetvellerini Zamanında Girme Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 4,
    source: 'MHRS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Zamanında girilen MHRS cetvel sayısı (15 gün öncesi)', type: 'number', required: true },
      { key: 'B', label: 'İlgili ay açılan toplam MHRS cetveli sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 4 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 32. 60 Günü Geçen Stok Tutarının Toplam Tahakkuka Oranı - Maks: 2
  {
    code: 'SYPG-BH-32',
    name: '60 Günü Geçen Stok Tutarının Toplam Tahakkuka Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'MKYS, TDMS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: '60 günü geçen stoğun parasal değeri (MKYS)', type: 'number', required: true },
      { key: 'B', label: 'Toplam tahakkuk (TDMS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 33. Muhasebeleştirme Süresi - Maks: 2
  {
    code: 'SYPG-BH-33',
    name: 'Muhasebeleştirme Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 2,
    source: 'TDMS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Toplam muhasebeleştirme gün süresi (TDMS)', type: 'number', required: true },
      { key: 'B', label: 'Muhasebeleştirilen işlem sayısı (TDMS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 34. Nöbet+İcap Ücretinin Taban Ücrete Oranı - Maks: 2
  {
    code: 'SYPG-BH-34',
    name: 'Nöbet+İcap Ücretinin Taban Ücrete Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'TDMS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Nöbet+İcap ücreti toplamı (TDMS)', type: 'number', required: true },
      { key: 'B', label: 'Personel taban ücreti toplamı (TDMS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 35. Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı - Maks: 2
  {
    code: 'SYPG-BH-35',
    name: 'Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'TDMS',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'İlaç ve tıbbi malzeme gideri (TDMS)', type: 'number', required: true },
      { key: 'B', label: 'Toplam tahakkuk (TDMS)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 36. Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Sayısı - Maks: 4
  {
    code: 'SYPG-BH-36',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 4,
    source: 'e-Nabız, TSİM',
    hbysCalculable: false,
    parameters: [
      { key: 'A', label: 'Yapılan A,B,C ameliyat sayısı (e-Nabız)', type: 'number', required: true },
      { key: 'B', label: 'Aktif kullanılan ameliyat masası sayısı (TSİM)', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD >= GO', points: 4 },
      { operator: 'formula', formula: 'GD < GO', points: 0 }
    ]
  },

  // 37. Acil Servis Ortalama Bekleme Süresi (dk) - Maks: 2
  {
    code: 'SYPG-BH-37',
    name: 'Acil Servis Ortalama Bekleme Süresi (dk)',
    category: 'BH',
    unit: 'minutes',
    unitLabel: 'Dakika',
    maxPoints: 2,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Acil kırmızı/sarı triaj toplam bekleme süresi (dk)', type: 'number', required: true },
      { key: 'B', label: 'Acil kırmızı/sarı triaj başvuru sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: 'A / B',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  },

  // 38. Toplam İlaç İçindeki Antibiyotik Oranı - Maks: 2
  {
    code: 'SYPG-BH-38',
    name: 'Toplam İlaç İçindeki Antibiyotik Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'e-Nabız',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Antibiyotik (J01) içeren ilaç barkodu sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam ilaç barkodu sayısı', type: 'number', required: true },
      { key: 'GO', label: 'Gösterge referans değeri (Bakanlık hedefi)', type: 'number', required: false }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: [
      { operator: 'formula', formula: 'GD <= GO', points: 2 },
      { operator: 'formula', formula: 'GD > GO', points: 0 }
    ]
  }
];

/**
 * BH gösterge sayısı
 */
export const BH_INDICATOR_COUNT = BH_INDICATORS.length;

/**
 * BH maksimum toplam puan
 */
export const BH_MAX_TOTAL_POINTS = BH_INDICATORS.reduce(
  (sum, ind) => sum + ind.maxPoints,
  0
);

/**
 * Gösterge koduna göre tanım getir
 */
export const getBHIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return BH_INDICATORS.find(ind => ind.code === code);
};
