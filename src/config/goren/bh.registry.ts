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
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Normal doğum sayısı', type: 'number', required: true },
      { key: 'B', label: 'Kadın doğum uzmanı sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 7. Başvuru Başına Tetkik Oranı - Maks: 2
  {
    code: 'SYPG-BH-7',
    name: 'Başvuru Başına Tetkik Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam tetkik sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam başvuru sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 8. Primer Sezaryen Oranı - Maks: 4
  {
    code: 'SYPG-BH-8',
    name: 'Primer Sezaryen Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 4,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Primer sezaryen sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam doğum sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 9. Sezaryen Sayısının Referans Değerlerden Sapma Oranı - Maks: 3
  {
    code: 'SYPG-BH-9',
    name: 'Sezaryen Sayısının Referans Değerlerden Sapma Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Gerçekleşen sezaryen sayısı', type: 'number', required: true },
      { key: 'B', label: 'Referans sezaryen sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 10. Başvuru Başına Reçete Sayısı - Maks: 4
  {
    code: 'SYPG-BH-10',
    name: 'Başvuru Başına Reçete Sayısı',
    category: 'BH',
    unit: 'ratio',
    unitLabel: '100 Başvuruda',
    maxPoints: 4,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam reçete sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam başvuru sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 11. Başvuru Başına Antibiyotik İçeren Reçete Sayısı - Maks: 4
  {
    code: 'SYPG-BH-11',
    name: 'Başvuru Başına Antibiyotik İçeren Reçete Sayısı',
    category: 'BH',
    unit: 'ratio',
    unitLabel: '100 Başvuruda',
    maxPoints: 4,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Antibiyotik içeren reçete sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam başvuru sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 12. E-Reçete Oranı - Maks: 2
  {
    code: 'SYPG-BH-12',
    name: 'E-Reçete Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'E-Reçete sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam reçete sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 13. Veri Gönderme Başarı Oranı - Maks: 2
  {
    code: 'SYPG-BH-13',
    name: 'Veri Gönderme Başarı Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Başarılı gönderim sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam gönderim sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 14. Yoğun Bakım 10 Günden Fazla Yatan Hasta Oranı - Maks: 2
  {
    code: 'SYPG-BH-14',
    name: 'Yoğun Bakım 10 Günden Fazla Yatan Hasta Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '10 günden fazla yatan hasta sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam yoğun bakım hasta sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 15. Yoğun Bakım 15 Günden Fazla Yatan Hasta Oranı - Maks: 3
  {
    code: 'SYPG-BH-15',
    name: 'Yoğun Bakım 15 Günden Fazla Yatan Hasta Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '15 günden fazla yatan hasta sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam yoğun bakım hasta sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 16. Servis Yatak Devir Hızı - Maks: 2
  {
    code: 'SYPG-BH-16',
    name: 'Servis Yatak Devir Hızı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Hasta',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Taburcu hasta sayısı', type: 'number', required: true },
      { key: 'B', label: 'Yatak sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 17. Yoğun Bakım Yatak Devir Hızı - Maks: 2
  {
    code: 'SYPG-BH-17',
    name: 'Yoğun Bakım Yatak Devir Hızı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Hasta',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Yoğun bakım taburcu hasta sayısı', type: 'number', required: true },
      { key: 'B', label: 'Yoğun bakım yatak sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 18. Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A, B, C) Sayısı - Maks: 2
  {
    code: 'SYPG-BH-18',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A, B, C) Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'A, B, C grubu ameliyat sayısı', type: 'number', required: true },
      { key: 'B', label: 'Cerrahi klinisyen hekim sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 19. Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A,B,C) Puanı - Maks: 2
  {
    code: 'SYPG-BH-19',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A,B,C) Puanı',
    category: 'BH',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'A, B, C grubu ameliyat puanı toplamı', type: 'number', required: true },
      { key: 'B', label: 'Cerrahi klinisyen hekim sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 20. Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Puanı - Maks: 2
  {
    code: 'SYPG-BH-20',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Puanı',
    category: 'BH',
    unit: 'score',
    unitLabel: 'Puan',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'A, B, C grubu ameliyat puanı toplamı', type: 'number', required: true },
      { key: 'B', label: 'Ameliyat masası sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 21. 10 Günü Geçen Patoloji Sonuçlanma Oranı - Maks: 2
  {
    code: 'SYPG-BH-21',
    name: '10 Günü Geçen Patoloji Sonuçlanma Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '10 günü geçen patoloji sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam patoloji sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 22. Aktif Cihaz Başına Düşen İş Yükü - Maks: 2
  {
    code: 'SYPG-BH-22',
    name: 'Aktif Cihaz Başına Düşen İş Yükü',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam iş yükü', type: 'number', required: true },
      { key: 'B', label: 'Aktif cihaz sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 23. Aktif Cihaz Oranı - Maks: 2
  {
    code: 'SYPG-BH-23',
    name: 'Aktif Cihaz Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Aktif cihaz sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam cihaz sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 24. 3 Günü Geçen BT Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-24',
    name: '3 Günü Geçen BT Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '3 günü geçen BT randevu sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam BT randevu sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 25. Ortalama BT Raporlama Süresi - Maks: 3
  {
    code: 'SYPG-BH-25',
    name: 'Ortalama BT Raporlama Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam BT raporlama süresi', type: 'number', required: true },
      { key: 'B', label: 'Toplam BT rapor sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 26. 7 Günü Geçen MR Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-26',
    name: '7 Günü Geçen MR Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '7 günü geçen MR randevu sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam MR randevu sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 27. Ortalama MR Raporlama Süresi - Maks: 3
  {
    code: 'SYPG-BH-27',
    name: 'Ortalama MR Raporlama Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam MR raporlama süresi', type: 'number', required: true },
      { key: 'B', label: 'Toplam MR rapor sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 28. 10 Günü Geçen USG Randevu Oranı - Maks: 3
  {
    code: 'SYPG-BH-28',
    name: '10 Günü Geçen USG Randevu Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 3,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '10 günü geçen USG randevu sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam USG randevu sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 29. Aile Hekimliği Asistanı Başına Düşen EAHB Sayısı - Maks: 2
  {
    code: 'SYPG-BH-29',
    name: 'Aile Hekimliği Asistanı Başına Düşen EAHB Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'EAHB sayısı', type: 'number', required: true },
      { key: 'B', label: 'Aile hekimliği asistanı sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 30. Metrekare Başına Düşen Tüketim Miktarı - Maks: 2
  {
    code: 'SYPG-BH-30',
    name: 'Metrekare Başına Düşen Tüketim Miktarı',
    category: 'BH',
    unit: 'ratio',
    unitLabel: 'Birim/m²',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam tüketim miktarı', type: 'number', required: true },
      { key: 'B', label: 'Toplam metrekare', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 31. Çalışma Cetvellerini Zamanında Girme Oranı - Maks: 4
  {
    code: 'SYPG-BH-31',
    name: 'Çalışma Cetvellerini Zamanında Girme Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 4,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Zamanında girilen cetvel sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam cetvel sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 32. 60 Günü Geçen Stok Tutarının Toplam Tahakkuka Oranı - Maks: 2
  {
    code: 'SYPG-BH-32',
    name: '60 Günü Geçen Stok Tutarının Toplam Tahakkuka Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: '60 günü geçen stok tutarı', type: 'number', required: true },
      { key: 'B', label: 'Toplam tahakkuk tutarı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 33. Muhasebeleştirme Süresi - Maks: 2
  {
    code: 'SYPG-BH-33',
    name: 'Muhasebeleştirme Süresi',
    category: 'BH',
    unit: 'days',
    unitLabel: 'Gün',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam muhasebeleştirme süresi', type: 'number', required: true },
      { key: 'B', label: 'Toplam işlem sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 34. Nöbet+İcap Ücretinin Taban Ücrete Oranı - Maks: 2
  {
    code: 'SYPG-BH-34',
    name: 'Nöbet+İcap Ücretinin Taban Ücrete Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Nöbet+İcap ücreti toplamı', type: 'number', required: true },
      { key: 'B', label: 'Taban ücret toplamı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 35. Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı - Maks: 2
  {
    code: 'SYPG-BH-35',
    name: 'Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'İlaç ve tıbbi malzeme tahakkuku', type: 'number', required: true },
      { key: 'B', label: 'İlaç ve tıbbi malzeme gideri', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
  },

  // 36. Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Sayısı - Maks: 4
  {
    code: 'SYPG-BH-36',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Sayısı',
    category: 'BH',
    unit: 'count',
    unitLabel: 'Sayı',
    maxPoints: 4,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'A, B, C grubu ameliyat sayısı', type: 'number', required: true },
      { key: 'B', label: 'Ameliyat masası sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 37. Acil Servis Ortalama Bekleme Süresi (dk) - Maks: 2
  {
    code: 'SYPG-BH-37',
    name: 'Acil Servis Ortalama Bekleme Süresi (dk)',
    category: 'BH',
    unit: 'minutes',
    unitLabel: 'Dakika',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Toplam bekleme süresi', type: 'number', required: true },
      { key: 'B', label: 'Toplam hasta sayısı', type: 'number', required: true }
    ],
    gdFormula: 'A / B',
    gpRules: []
  },

  // 38. Toplam İlaç İçindeki Antibiyotik Oranı - Maks: 2
  {
    code: 'SYPG-BH-38',
    name: 'Toplam İlaç İçindeki Antibiyotik Oranı',
    category: 'BH',
    unit: 'percentage',
    unitLabel: '%',
    maxPoints: 2,
    source: 'HBYS',
    hbysCalculable: true,
    parameters: [
      { key: 'A', label: 'Antibiyotik sayısı', type: 'number', required: true },
      { key: 'B', label: 'Toplam ilaç sayısı', type: 'number', required: true }
    ],
    gdFormula: '(A / B) * 100',
    gpRules: []
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
