/**
 * GÖREN BH Gösterge Detayları
 *
 * Her göstergenin hesaplama mantığı, parametreleri ve puanlama kriterleri
 */

export interface IndicatorParameter {
  key: string;
  name: string;
  description: string;
  calculation: string;
}

export interface ScoringRule {
  condition: string;
  points: number;
}

export interface IndicatorDetail {
  code: string;
  name: string;
  unit: string;
  source: string;
  hbysCalculable: boolean;
  maxPoints: number;
  acceptedDate: string;
  parameters: IndicatorParameter[];
  gdFormula: string;
  gdDescription?: string;
  scoringRules: ScoringRule[];
  notes?: string;
  appendix?: string[]; // EK referansları (örn: ['EK-1', 'EK-2'])
}

export const BH_INDICATOR_DETAILS: Record<number, IndicatorDetail> = {
  1: {
    code: 'SYPG-BH-1',
    name: 'Hasta Memnuniyet Oranı',
    unit: '%',
    source: 'MHRS',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Puan',
        description: 'Hasta Memnuniyeti Anketlerinden elde edilen toplam puan',
        calculation: 'MHRS hasta memnuniyeti anketlerinde, cevaplanan soruların toplam puanı'
      },
      {
        key: 'B',
        name: 'Cevaplanan Soru Sayısı',
        description: 'Cevaplanan soru sayısı',
        calculation: 'MHRS hasta memnuniyeti anketlerinde cevaplanan soru sayısı'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ %70', points: 3 },
      { condition: '%60 ≤ GD < %70', points: 2 },
      { condition: '%50 ≤ GD < %60', points: 1 },
      { condition: 'GD < %50', points: 0 }
    ]
  },
  2: {
    code: 'SYPG-BH-2',
    name: 'Çalışan Memnuniyet Oranı',
    unit: '%',
    source: 'SGGM (SABİM)',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Puan',
        description: 'Çalışan memnuniyeti anketlerinden elde edilen toplam puan',
        calculation: 'SGGM (SABİM) üzerinden yapılan çalışan memnuniyeti anketlerinde, cevaplanan soruların toplam puanı'
      },
      {
        key: 'B',
        name: 'Cevaplanan Soru Sayısı',
        description: 'Cevaplanan soru sayısı',
        calculation: 'Çalışan memnuniyeti anketlerinde cevaplanan soru sayısı'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ %70', points: 3 },
      { condition: '%60 ≤ GD < %70', points: 2 },
      { condition: '%50 ≤ GD < %60', points: 1 },
      { condition: 'GD < %50', points: 0 }
    ]
  },
  3: {
    code: 'SYPG-BH-3',
    name: 'Yeşil Alan Hariç Acil Muayene Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Acil Muayene Sayısı',
        description: 'Acil kliniklerinde yapılan muayene sayısı',
        calculation: 'Acil kliniklerinde başvuru klinik kodu (197001, 197002, 197003, 1, 101, 115) veya ACİL POLİKLİNİK MUAYENESİ işlem kodları (520020, 520021) ile yapılan başvuruların tekil SYS takip numarası sayısı'
      },
      {
        key: 'B',
        name: 'Yeşil Alan Acil Muayene Sayısı',
        description: 'Yeşil alan olarak değerlendirilen acil muayene sayısı',
        calculation: 'Başvuru klinik kodları (197001, 197002, 197003, 1, 101, 115) ve acil poliklinik muayenesi işlem kodu (520021) ile yapılan başvuruların tekil SYS takip numarası sayısı'
      },
      {
        key: 'C',
        name: 'Acil Dahil Toplam Muayene Sayısı',
        description: 'Acil dahil tüm muayenelerin toplam sayısı',
        calculation: 'Muayene SUT kodları (520020, 520021, 520010, 520030, 520040, 520050, 520051, 520052, 520070, 520080, 520090, 550010, 401010, 401020, 401040, 401030 ve P\'li SUT kodları) ile veri gönderimi yapılan başvuruların tekil SYS takip numarası sayısı'
      }
    ],
    gdFormula: 'GD = ((A − B) / C) × 100',
    gdDescription: 'Yeşil alan hariç acil muayene oranı',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'GO: İlgili dönem için tanımlı referans (hedef) değeri ifade eder. Kullanılan Veri Paketleri: 103 Muayene Bilgisi Kayıt (MUAYENE_BILGILERI / PAKETE_AIT_ISLEM_ZAMANI), 101 Hasta Kayıt (HASTA_BASVURU_BILGILERI / TRIAJ)'
  },
  4: {
    code: 'SYPG-BH-4',
    name: 'Randevulu Muayene Oranı',
    unit: '%',
    source: 'e-Nabız, MHRS',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'MHRS Randevu Sayısı',
        description: 'Merkezi Hekim Randevu Sistemi (MHRS) üzerinden gerçekleşen randevu sayısı',
        calculation: 'MHRS sisteminde aksiyon kodu 200 (Normal Muayene), randevu durumu 1 (Normal randevu) olan ve ilgili dönemde gerçekleşmiş randevuların sayısı. (HBYS Hesaplayabilir: Hayır)'
      },
      {
        key: 'B',
        name: 'Toplam Muayene Sayısı',
        description: 'MHRS\'ye esas polikliniklerdeki toplam muayene sayısı',
        calculation: 'e-Nabız sisteminde, MHRS esas kliniklerde aynı gün – aynı klinik – aynı kişi birden fazla başvurmuşsa tek sayılır. Muayene SUT kodları: 520020, 520021, 520010, 520030, 520040, 520050, 520051, 520052, 520070, 520080, 520090, 550010, 401010, 401020, 401040, 401030 ve P\'li SUT kodları. (HBYS Hesaplayabilir: Evet)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≥ %70', points: 3 },
      { condition: '%50 ≤ GD < %70', points: 2 },
      { condition: '%40 ≤ GD < %50', points: 1 },
      { condition: 'GD < %40', points: 0 }
    ]
  },
  5: {
    code: 'SYPG-BH-5',
    name: 'Uzman Hekim Başına Düşen Günlük Muayene Sayısı',
    unit: 'Sayı',
    source: 'e-Nabız, EKOBS',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Uzman Poliklinik Muayene Sayısı',
        description: 'Acil klinikler hariç toplam uzman poliklinik muayene sayısı',
        calculation: 'Acil klinikler hariç (klinik kodları: 1, 101, 115, 197001, 197002, 197003), aynı kurum–klinik–hekim için gönderilen muayene SUT kodları tek sayılır. 10 gün içinde aynı kişiye gönderilen birden fazla muayene SUT kodu kontrol muayenesi kabul edilerek dahil edilmez. EK-1 SUT kodları: 520030, 401010, 401020, 401030, 401040, 520040, 520050, 520051, 520052, 520070, 520080, 520090, 550010. (HBYS Hesaplayabilir: Evet)'
      },
      {
        key: 'B',
        name: 'Toplam Uzman Hekim Sayısı (Adam-Gün)',
        description: 'Poliklinik hizmeti veren toplam uzman hekim sayısı (adam-gün esaslı)',
        calculation: 'EKOBS verisi. Hekimler ÇKYS branş kodları ve unvan/kadro kriterleriyle filtrelenir (EK-2). Toplam uzman hekim sayısı basit kişi sayımı değil; aktif çalışma gün katsayısı (adam-gün) dikkate alınarak hesaplanır. (HBYS Hesaplayabilir: Hayır)'
      },
      {
        key: 'İş Günü',
        name: 'İş Günü Sayısı',
        description: 'İlgili dönemdeki resmi iş günü sayısı',
        calculation: 'İlgili dönemdeki resmi iş günü sayısı esas alınır.'
      }
    ],
    gdFormula: 'GD = (A / B) / İş Günü',
    gdDescription: 'Uzman hekim başına düşen günlük ortalama muayene sayısı',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 3 },
      { condition: 'GD < GO', points: 0 }
    ],
    notes: 'GO: İlgili dönem için tanımlı referans (hedef) değeri.',
    appendix: ['EK-1', 'EK-2']
  },
  6: {
    code: 'SYPG-BH-6',
    name: 'Kadın Doğum Uzmanı Başına Düşen Normal Doğum Sayısı',
    unit: 'Sayı',
    source: 'e-RAPOR, EKOBS',
    hbysCalculable: false,
    maxPoints: 4,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Normal Doğum Sayısı',
        description: 'Toplam normal doğum sayısı',
        calculation: 'e-RAPOR sistemindeki referans numarası saydırılarak normal doğum hesaplanmıştır. Çoğul doğumlarda yalnızca tek doğum sayısı hesaplanmıştır.'
      },
      {
        key: 'B',
        name: 'Kadın Doğum Uzman Sayısı',
        description: 'Kadın doğum uzman hekim sayısı (adam-gün)',
        calculation: 'EKOBS veritabanından EK-12\'de yer alan ÇKYS Unvan Kodu ve Branş Kodu olan hekim kimlik numaraları kullanılarak aktif çalışma gün katsayısı (adam gün) olarak hekim sayısı hesaplanmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 4 },
      { condition: 'GD < GO', points: 0 }
    ],
    appendix: ['EK-12']
  },
  7: {
    code: 'SYPG-BH-7',
    name: 'Başvuru Başına Tetkik Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Ayaktan Hastaya Yapılan Laboratuvar Tetkik Sayısı (Acil hariç)',
        description: 'Acil klinikler hariç ayaktan hastalara yapılan laboratuvar tetkik sayısı',
        calculation: 'Acil Klinikleri haricinde 105 Laboratuvar sonuç kayıt paketinde aşağıda yer alan SUT kodları üzerinden Başvuru Başına tetkik sayısı hesaplanmıştır. (EK-3) ve Ayaktan hastalara (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) ait tekil sys takip numarası saydırılmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam Ayaktan Başvuru Sayısı (Acil hariç)',
        description: 'Acil klinikler hariç toplam ayaktan başvuru sayısı',
        calculation: 'Acil klinik kodları hariç \'101\', \'115\', \'1\', Ayaktan hastalara (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) ait tekil sys takip numaraları sayılarak başvuruları hesaplanmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 105 Laboratuvar Sonuç Kayıt TETKIK_SONUC_BILGILERI / PAKETE_AIT_ISLEM_ZAMANI, 101 Hasta Kayıt HASTA_BASVURU_BILGILERI / YATIS_BILGISI / YATIS_KABUL_ZAMANI boş olan verilerin toplamıdır.',
    appendix: ['EK-3']
  },
  8: {
    code: 'SYPG-BH-8',
    name: 'Primer Sezaryen Oranı',
    unit: '%',
    source: 'e-RAPOR',
    hbysCalculable: false,
    maxPoints: 4,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Primer Sezaryen Sayısı',
        description: 'Primer sezaryen sayısı',
        calculation: 'e-RAPOR sisteminden doğum sonucu primer sezeryan olan e rapor referans numaralarının sayısıdır.'
      },
      {
        key: 'B',
        name: 'Toplam Canlı Doğum Sayısı',
        description: 'Toplam canlı doğum sayısı',
        calculation: 'e-RAPOR sisteminden canlı doğum verisi olan e rapor referans numarasının sayısıdır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 4 },
      { condition: 'GO < GD ≤ GO × 1,15', points: 2 },
      { condition: '1,15 × GO < GD ≤ GO × 1,30', points: 1 },
      { condition: 'GO × 1,30 < GD', points: 0 }
    ]
  },
  9: {
    code: 'SYPG-BH-9',
    name: 'Sezaryen Sayısının Referans Değerlerden Sapma Oranı',
    unit: '%',
    source: 'e-RAPOR',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Gerçekleşen Sezaryen Sayısı',
        description: 'Gerçekleşen sezaryen sayısı',
        calculation: 'e-RAPOR sisteminden toplam sezaryan sayısıdır.'
      },
      {
        key: 'B',
        name: 'Robson Sınıflamasına Göre Referans Değerlerle Hesaplanmış Sezaryen Sayısı',
        description: 'Robson sınıflamasına göre referans değerlerle hesaplanmış beklenen sezaryen sayısı',
        calculation: 'Robson gruplarının (1-10) her biri için gruptaki doğum sayısı ilgili katsayıyla çarpılarak hesaplanır. Katsayılar: Grup 1: 0,1 | Grup 2: 0,35 | Grup 3: 0,03 | Grup 4: 0,15 | Grup 5: 0,6 | Grup 6: 0,98 | Grup 7: 0,95 | Grup 8: 0,6 | Grup 9: 0,95 | Grup 10: 0,3. B = Σ (Gruptaki doğum sayısı × Katsayı)'
      }
    ],
    gdFormula: 'GD = ((A − B) / B) × 100',
    gdDescription: 'Gerçekleşen sezaryen sayısının referans değerlerden sapma oranı',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 },
      { condition: 'B = 0 ve A = 0 ise', points: 3 },
      { condition: 'B = 0 ve A > 0 ise', points: 0 },
      { condition: 'B > 0 ve A = 0 ise', points: 3 }
    ],
    notes: 'GO: İlgili dönem için tanımlı referans (hedef) değeri. Robson sınıflaması 10 gruptan oluşur ve her grubun sezaryen olasılık katsayısı farklıdır.'
  },
  10: {
    code: 'SYPG-BH-10',
    name: 'Başvuru Başına Reçete Sayısı',
    unit: '100 Başvuruda',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 4,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Ayaktan Reçete Sayısı',
        description: 'Toplam ayaktan reçete sayısı',
        calculation: 'Ayaktan hastalara (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) yazılan reçete sayısıdır.'
      },
      {
        key: 'B',
        name: 'Toplam Ayaktan Başvuru Sayısı',
        description: 'Toplam ayaktan başvuru sayısı',
        calculation: 'Ayaktan hastaların (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) yapmış olduğu başvuru sayısıdır. Tekil SYStakipNo saydırılmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 4 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 103 Muayene Bilgisi Kayıt / recete_tarihi, 101 Hasta Kayıt / kabul_zamani. GO: İlgili dönem için tanımlı referans (hedef) değeri.'
  },
  11: {
    code: 'SYPG-BH-11',
    name: 'Başvuru Başına Antibiyotik İçeren Reçete Sayısı',
    unit: '100 Başvuruda',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 4,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Antibiyotik İçeren Ayaktan Reçete Sayısı',
        description: 'Antibiyotik içeren ayaktan reçete sayısı',
        calculation: 'Ayaktan hastalara (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) antibiyotik (J01) içeren reçete sayısıdır.'
      },
      {
        key: 'B',
        name: 'Toplam Ayaktan Hasta Başvuru Sayısı',
        description: 'Toplam ayaktan hasta başvuru sayısı',
        calculation: 'Ayaktan hastaların (Yatış kabul zamanı boş veya günübirlik yatışı olmayan) yapmış olduğu başvuru sayısıdır. Tekil SYStakipNo saydırılmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 4 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 103 Muayene Bilgisi Kayıt / recete_tarihi, 101 Hasta Kayıt / kabul_zamani. GO: İlgili dönem için tanımlı referans (hedef) değeri.'
  },
  12: {
    code: 'SYPG-BH-12',
    name: 'E-Reçete Oranı',
    unit: '%',
    source: 'SGK',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yazılan E-Reçete Sayısı',
        description: 'Yazılan e-reçete sayısı',
        calculation: 'SGK\'dan alınan veriler ile ilgili dönemdeki yazılan e-reçete sayısı kullanılmıştır.'
      },
      {
        key: 'B',
        name: 'Yazılan Toplam Reçete Sayısı',
        description: 'Yazılan toplam reçete sayısı',
        calculation: 'SGK\'dan alınan veriler ile ilgili dönemdeki yazılan toplam reçete sayısı kullanılmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≥ %95', points: 2 },
      { condition: '%85 ≤ GD < %95', points: 1 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  13: {
    code: 'SYPG-BH-13',
    name: 'Veri Gönderme Başarı Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'E-Nabıza Zamanında Gönderilen Gösterge Bileşeni Sayısı',
        description: 'E-Nabıza zamanında gönderilen gösterge bileşeni sayısı',
        calculation: 'E-Nabız sisteminden alınan paket verilerine göre ilk gönderim zamanından itibaren altı bileşenin hesaplanması şu şekildedir;\n\n101 paketindeki Kabul zamanı ile e-nabıza aktarım zamanı arasındaki süre 24 saatten az olan hastaların sys takip numaraları 1 bileşen olarak sayılmaktadır.\nİşlem bilgisi için 102 paketindeki işlem zamanı ile e-nabıza aktarım zamanı arasındaki süre 24 saatten az olan hastalar için işlem referans numaraları alınarak 1 bileşen sayılır.\nLabaratuvar sonucu için 105 paketindeki tetkik örneğinin kabul zamanı ile e-nabıza aktarım zamanı arasındaki süre 24 saatten küçük olanların sys takip numarası 1 bileşen sayılır.\nTetkik sonuc tarihi ile e-nabıza aktarım zamanı arasındaki süre 24 saatten az olan hastaların işlem referans numarası da 1 bileşen olarak sayılmaktadır.\nHasta tanı bilgileri için 103 paketindeki muayene başlangıç tarihi ile e-nabıza aktarım zamanı arasındaki süre 24 saatten az olan hastaların systakip numarası da 1 bileşen olarak sayılmaktadır.\nHasta reçete bilgisi için 103 paketindeki reçete tarihi ile e-nabıza aktarım zamanı arasındaki süre 24 saatten az olan hastaların reçete numaraları 1 bileşen olarak sayılır.\n\nBu altı bileşenden 24 saat içerisinde gönderilen bileşen sayıları toplanarak hesaplanmıştır.'
      },
      {
        key: 'B',
        name: 'E-Nabıza Zamanında Gönderilmesi Gereken Gösterge Bileşeni Sayısı',
        description: 'E-Nabıza zamanında gönderilmesi gereken gösterge bileşeni sayısı',
        calculation: 'E-Nabız sisteminden alınan paket verilerine göre ilk gönderim zamanından itibaren altı bileşenin hesaplanması şu şekildedir;\n\n101 paketinden sys takip numaraları 1 bileşen olarak sayılmaktadır.\nİşlem bilgisi için 102 paketindeki işlem referans numaraları alınarak 1 bileşen sayılır.\nLabaratuvar sonucu için 105 paketindeki sys takip numarası 1 bileşen sayılır.\nTetkik sonucu için 105 paketindeki işlem referans numarası da 1 bileşen olarak sayılmaktadır.\nHasta tanı bilgileri için 103 paketindeki systakip numarası da 1 bileşen olarak sayılmaktadır.\nHasta reçete bilgisi için 103 paketindeki reçete numaraları 1 bileşen olarak sayılır.\n\nBu altı bileşenin toplamı ile hesaplanmaktadır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≥ 98', points: 2 },
      { condition: 'GD < 98', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt / kabul_zamani. 6 bileşen: 101 sys takip no, 102 işlem referans no, 105 sys takip no, 105 işlem referans no, 103 systakip no, 103 reçete no.'
  },
  14: {
    code: 'SYPG-BH-14',
    name: 'Yoğun Bakımda 10 Günden Fazla Yatan Hasta Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '18.12.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yoğun Bakımda 10 Günden Fazla Yatan Hasta Sayısı',
        description: 'Yoğun bakımda 10 günden fazla yatan hasta sayısı',
        calculation: 'Aşağıda yer alan yoğun bakım SUT kodları üzerinden çalışma yapılmıştır. Bu çalışmada her bir SUT kodu 1 gün olarak değerlendirilmiş olup peş peşe gönderilen SUT kodları toplam kalınan gün sayısını ifade etmektedir. Bir gün için iki farklı SUT kodu gönderilmiş ise yalnızca bir gün sayılmıştır.\nGünübirlik yatışlar hariç tutulmuştur.\n10 günü geçen yatışları ifade etmektedir.\n\nYoğun Bakım SUT Kodları:\n510090, 510122, 552001, 552002, 552003, 552004, 552005, 552006, 552007, 552008, 552009, 552010, P552001, P552002, P552003, P552006, P552007, P552008'
      },
      {
        key: 'B',
        name: 'Toplam Yoğun Bakımda Yatan Hastaların Yatış Sayısı',
        description: 'Toplam yoğun bakımda yatan hastaların yatış sayısı',
        calculation: 'Aşağıda yer alan yoğun bakım SUT kodları üzerinden çalışma yapılmıştır. Bu çalışmada her bir SUT kodu 1 gün olarak değerlendirilmiş olup peş peşe gönderilen SUT kodları toplam kalınan gün sayısını ifade etmektedir. Bir gün için iki farklı SUT kodu gönderilmiş ise yalnızca bir gün sayılmıştır.\nGünübirlik yatışlar hariç tutulmuştur.\n\nYoğun Bakım SUT Kodları:\n510090, 510122, 552001, 552002, 552003, 552004, 552005, 552006, 552007, 552008, 552009, 552010, P552001, P552002, P552003, P552006, P552007, P552008\n\nKişilerin her bir yatışı ayrı ayrı sayılmıştır. Tekilleştirme yapılmamıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt, 106 Çıkış Bilgisi Kayıt, 102 Hizmet / İlaç / Malzeme Bilgisi Kayıt.'
  },
  15: {
    code: 'SYPG-BH-15',
    name: 'Yoğun Bakımda 15 Günden Fazla Yatan Hasta Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 3,
    acceptedDate: '18.12.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yoğun Bakımda 15 Günden Fazla Yatan Hasta Sayısı',
        description: 'Yoğun bakımda 15 günden fazla yatan hasta sayısı',
        calculation: 'Aşağıda yer alan yoğun bakım SUT kodları üzerinden çalışma yapılmıştır. Bu çalışmada her bir SUT kodu 1 gün olarak değerlendirilmiş olup peş peşe gönderilen SUT kodları toplam kalınan gün sayısını ifade etmektedir. Bir gün için iki farklı SUT kodu gönderilmiş ise yalnızca bir gün sayılmıştır.\nGünübirlik yatışlar hariç tutulmuştur.\n15 günü geçen yatışları ifade etmektedir.\n\nYoğun Bakım SUT Kodları:\n510090, 510122, 552001, 552002, 552003, 552004, 552005, 552006, 552007, 552008, 552009, 552010, P552001, P552002, P552003, P552006, P552007, P552008'
      },
      {
        key: 'B',
        name: 'Toplam Yoğun Bakımda Yatan Hastaların Yatış Sayısı',
        description: 'Toplam yoğun bakımda yatan hastaların yatış sayısı',
        calculation: 'Aşağıda yer alan yoğun bakım SUT kodları üzerinden çalışma yapılmıştır. Bu çalışmada her bir SUT kodu 1 gün olarak değerlendirilmiş olup peş peşe gönderilen SUT kodları toplam kalınan gün sayısını ifade etmektedir. Bir gün için iki farklı SUT kodu gönderilmiş ise yalnızca bir gün sayılmıştır.\nGünübirlik yatışlar hariç tutulmuştur.\n\nYoğun Bakım SUT Kodları:\n510090, 510122, 552001, 552002, 552003, 552004, 552005, 552006, 552007, 552008, 552009, 552010, P552001, P552002, P552003, P552006, P552007, P552008\n\nKişilerin her bir yatışı ayrı ayrı sayılmıştır. Tekilleştirme yapılmamıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt, 106 Çıkış Bilgisi Kayıt, 102 Hizmet / İlaç / Malzeme Bilgisi Kayıt.'
  },
  16: {
    code: 'SYPG-BH-16',
    name: 'Servis Yatak Devir Hızı',
    unit: 'Hasta',
    source: 'e-Nabız, ASOS',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Serviste Yatan Hasta Sayısı',
        description: 'Serviste yatan hasta sayısı',
        calculation: 'Yatış kabul zamanı dolu ve çıkış zamanı dolu olan kişiler üzerinden yatan hasta sayısı hesaplanmıştır. Günübirlik yatışlar ve Yoğun bakım klinikleri üzerinden yapılan yatışlar hariç tutulmuştur. (EK-4.1)'
      },
      {
        key: 'B',
        name: 'Servis Yatak Sayısı',
        description: 'Servis yatak sayısı',
        calculation: 'İlgili aylık dönemde yer alan ilk ayda bulunan yatak sayıları ASOS\'tan elde edilmiştir.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt, 106 Çıkış Bilgisi Kayıt, 102 Hizmet/İlaç/Malzeme Bilgisi Kayıt.'
  },
  17: {
    code: 'SYPG-BH-17',
    name: 'Yoğun Bakım Yatak Devir Hızı',
    unit: 'Hasta',
    source: 'e-Nabız, ASOS',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yoğun Bakımda Yatan Hastaların Yatış Sayısı',
        description: 'Yoğun bakımda yatan hastaların yatış sayısı',
        calculation: 'Aşağıda yer alan yoğun bakım SUT kodları üzerinden çalışma yapılmıştır. Bu çalışmada her bir SUT kodu 1 gün olarak değerlendirilmiş olup peş peşe gönderilen SUT kodları toplam kalınan gün sayısını ifade etmektedir. Bir gün için iki farklı SUT kodu gönderilmiş ise yalnızca bir gün sayılmıştır. Günübirlik yatışlar hariç tutulmuştur.\n\nYoğun Bakım SUT Kodları: 510090, 510122, 552001, 552002, 552003, 552004, 552005, 552006, 552007, 552008, 552009, 552010, P552001, P552002, P552003, P552006, P552007, P552008\n\nKişilerin her bir yatışı ayrı ayrı sayılmıştır. Tekilleştirme yapılmamıştır.'
      },
      {
        key: 'B',
        name: 'Yoğun Bakım Yatak Sayısı',
        description: 'Yoğun bakım yatak sayısı',
        calculation: 'İlgili aylık dönemde yer alan ilk ayda bulunan yatak sayıları ASOS\'tan elde edilmiştir.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt, 106 Çıkış Bilgisi Kayıt, 102 Hizmet/İlaç/Malzeme Bilgisi Kayıt.'
  },
  18: {
    code: 'SYPG-BH-18',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A, B, C) Sayısı',
    unit: 'Sayı',
    source: 'e-Nabız, EKOBS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Ameliyat Sayısı',
        description: 'A1, A2, A3, B, C ameliyat grubunda yer alan ameliyat sayısı',
        calculation: 'A1, A2, A3, B, C ameliyat grubunda yer alan ameliyat sayısı işlem referans numarası ve işlem kodu birleştirilerek hesaplanmıştır. İlgili ameliyat gruplarındaki SUT kodları üzerinden çalışma sağlanmıştır.'
      },
      {
        key: 'B',
        name: 'Cerrahi Klinisyen Hekim Sayısı',
        description: 'Cerrahi klinisyen hekim sayısı (adam-gün)',
        calculation: '5352, 5351, 1200, 802, 900, 5101, 5141, 5400, 5210, 800, 1000, 1800, 1602, 1600, 1100, 1700, 1400, 1301, 1900 branş kodları ve 6325, 10503, 1555, 1556, 1567, 1568, 5986, 5987, 1570, 1550, 1551, 6175, 8100, 8122, 8105, 10504 ünvan kodları ile toplam cerrahi klinisyen hekim kimlik numaraları kullanılarak aktif çalışma gün katsayısı (adam gün) olarak hekim sayısı hesaplanmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  19: {
    code: 'SYPG-BH-19',
    name: 'Cerrahi Klinisyen Hekim Başına Düşen Ameliyat (A,B,C) Grup Katsayısı',
    unit: 'Puan',
    source: 'e-Nabız, EKOBS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Ameliyat Grup Katsayılı Puanı',
        description: 'A*5 + B*2 + C*1 formülü ile hesaplanan ameliyat puanı',
        calculation: 'A1, A2, A3, B, C ameliyat grubunda yer alan SUT kodları üzerinden 102 İşlem paketine gönderilen işlem kodu ve işlem referans numarası birleştirilerek ve sonrasında tekilleştirilerek saydırılmıştır.\n\nNOT: A grubu ameliyat sayısı × 5 + B grubu ameliyat sayısı × 2 + C grubu ameliyat sayısı × 1'
      },
      {
        key: 'B',
        name: 'Cerrahi Klinisyen Hekim Sayısı',
        description: 'Cerrahi klinisyen hekim sayısı (adam-gün)',
        calculation: '5352, 5351, 1200, 802, 900, 5101, 5141, 5400, 5210, 800, 1000, 1800, 1602, 1600, 1100, 1700, 1400, 1301, 1900 branş kodları ve 6325, 10503, 1555, 1556, 1567, 1568, 5986, 5987, 1570, 1550, 1551, 6175, 8100, 8122, 8105, 10504 ünvan kodları ile toplam cerrahi klinisyen hekim kimlik numaraları kullanılarak aktif çalışma gün katsayısı (adam gün) olarak hekim sayısı hesaplanmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  20: {
    code: 'SYPG-BH-20',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Puanı',
    unit: 'Puan',
    source: 'e-Nabız, TSİM',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'A, B ve C Grubu Ameliyatların Toplam Katsayıları Puanı',
        description: 'Ameliyat grup katsayılı toplam puan',
        calculation: 'A1, A2, A3, B, C ameliyat grubunda yer alan ameliyat SUT kodları ile 102 hizmet malzeme ilaç paketinde gönderilen işlem referans numarası ve işlem kodu birleştirilerek elde edilen ameliyat sayısı ile 268 hekim puan veri setinde bulunan puan bilgisi üzerinden toplam puan hesaplanmıştır. 268 Hekim Puan Bilgisi paketine veri gönderimi gerçekleşmemiş ise ameliyat puanı hesaplanmamaktadır.'
      },
      {
        key: 'B',
        name: 'Aktif Kullanılan Ameliyat Masası Sayısı',
        description: 'Aktif kullanılan ameliyat masası sayısı',
        calculation: 'TSİM\'den aktif ameliyat masa sayısı alınmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  21: {
    code: 'SYPG-BH-21',
    name: '10 Günü Geçen Patoloji Sonuçlanma Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '24.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Patoloji Sonuç Verme Gün Süresi 10 Günden Fazla Olan Hasta Sayısı',
        description: '10 günden fazla süren patoloji sonuçlarının hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderiminde işlem zamanı ile işlem gerçekleşme zamanı arasındaki farkın 10 gün üzerinde olan hasta sayısı hesaplanmıştır. (EK-4)'
      },
      {
        key: 'B',
        name: 'Toplam Patoloji Sonucu Verilen Hasta Sayısı',
        description: 'Toplam patoloji sonucu verilen hasta sayısı',
        calculation: '201 Patoloji paketi ile aşağıda yer alan patoloji SUT kodları üzerinden yapılan incelemede patoloji sonucu bulunan hasta sayısı hesaplanmıştır. (EK-4.2)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ],
    appendix: ['EK-4', 'EK-4.2']
  },
  22: {
    code: 'SYPG-BH-22',
    name: 'Aktif Cihaz Başına Düşen İş Yükü',
    unit: 'Sayı',
    source: 'e-Nabız, MKYS',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yapılan Çekim Sayısı',
        description: 'Yapılan çekim sayısı',
        calculation: 'e-Nabız sisteminde aşağıda yer alan SUT kodları üzerinden sys takip numarası ve işlem referans numarası birleştirilerek çekim sayısı hesaplanmıştır. (EK-5)'
      },
      {
        key: 'B',
        name: 'Aktif Cihaz Sayısı',
        description: 'Aktif cihaz sayısı',
        calculation: 'MKYS\'den aşağıda yer alan tur ve tanımlamalara göre aylık dönemlerdeki son aylarda kayıtlı olan aktif cihaz sayısı hesaplanmıştır. tur_id in (288, 134, 207, 216) and tanim_adi (EK-6)'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ],
    appendix: ['EK-5', 'EK-6']
  },
  23: {
    code: 'SYPG-BH-23',
    name: 'Aktif Cihaz Oranı',
    unit: '%',
    source: 'MKYS',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Aktif Cihaz Sayısı',
        description: 'Aktif cihaz sayısı',
        calculation: 'MKYS\'den aşağıda yer alan tur ve tanımlamalara göre aylık dönemlerdeki son aylarda kayıtlı olan toplam aktif cihaz sayısı hesaplanmıştır. tur_id in (288, 134, 207, 216) and tanim_adi (EK-6)'
      },
      {
        key: 'B',
        name: 'Toplam Cihaz Sayısı',
        description: 'Toplam cihaz sayısı',
        calculation: 'MKYS\'den aşağıda yer alan tur ve tanımlamalara göre aylık dönemlerdeki son aylarda kayıtlı olan toplam cihaz sayısı hesaplanmıştır. tur_id in (288, 134, 207, 216) and tanim_adi (EK-6)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 2 },
      { condition: 'GD < GO', points: 0 }
    ],
    appendix: ['EK-6']
  },
  24: {
    code: 'SYPG-BH-24',
    name: '3 Günü Geçen BT Randevu Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'BT Randevu Verme Süresi 3 Günün Üzerinde Olan Hasta Sayısı',
        description: '3 günü geçen BT randevulu hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderiminde işlem zamanı ile işlem gerçekleşme zamanı arasındaki farkın 3 gün üzerinde olan başvuran hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-7)'
      },
      {
        key: 'B',
        name: 'Toplam BT Randevulu Hasta Sayısı',
        description: 'Toplam BT randevulu hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları üzerinden e-Nabız\'a veri gönderimi gerçekleşen hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-7)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ],
    appendix: ['EK-7']
  },
  25: {
    code: 'SYPG-BH-25',
    name: 'Ortalama BT Raporlama Süresi',
    unit: 'Gün',
    source: 'Teleradyoloji',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '22.12.2025',
    parameters: [
      {
        key: 'A',
        name: 'BT Çekimlerinin Raporlama Sürelerinin Toplamı (Gün)',
        description: 'BT çekimlerinin raporlama süreleri toplamı',
        calculation: 'Teleradyoloji sisteminde BT çekimlerinin çekim tarihi ile raporlama tarihleri arasındaki günler toplanarak hesaplanmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam BT Çekim Sayısı',
        description: 'Toplam BT çekim sayısı',
        calculation: 'Teleradyoloji sisteminde BT istem sayısı 0\'dan farklı olan tüm istem sayılarının toplamı olarak hesaplanmıştır. NOT: Raporlanmış tüm istemler dahil edilmiştir.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  26: {
    code: 'SYPG-BH-26',
    name: '7 Günü Geçen MR Randevu Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'MR Randevu Verme Süresi 7 Günün Üzerinde Olan Hasta Sayısı',
        description: '7 günü geçen MR randevulu hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderiminde işlem zamanı ile işlem zamanı arasındaki farkın 7 gün üzerinde olan başvuran hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-8)'
      },
      {
        key: 'B',
        name: 'Toplam MR Randevulu Hasta Sayısı',
        description: 'Toplam MR randevulu hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderiminde gerçekleşen hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-8)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ],
    appendix: ['EK-8']
  },
  27: {
    code: 'SYPG-BH-27',
    name: 'Ortalama MR Raporlama Süresi',
    unit: 'Gün',
    source: 'Teleradyoloji',
    hbysCalculable: false,
    maxPoints: 3,
    acceptedDate: '22.12.2025',
    parameters: [
      {
        key: 'A',
        name: 'MR Çekimlerinin Raporlama Sürelerinin Toplamı (Gün)',
        description: 'MR çekimlerinin raporlama süreleri toplamı',
        calculation: 'Teleradyoloji sisteminde MR çekimlerinin çekim tarihi ile raporlama tarihleri arasındaki günler toplanarak hesaplanmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam MR Çekim Sayısı',
        description: 'Toplam MR çekim sayısı',
        calculation: 'Teleradyoloji sisteminde MR istem sayısı 0\'dan farklı olan tüm istem sayılarının toplamı olarak hesaplanmıştır. NOT: Raporlanmış tüm istemler dahil edilmiştir.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  28: {
    code: 'SYPG-BH-28',
    name: '10 Günü Geçen USG Randevu Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 3,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'USG Randevu Verme Süresi 10 Günün Üzerinde Olan Hasta Sayısı',
        description: '10 günü geçen USG randevulu hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderiminde işlem zamanı ile işlem gerçekleşme zamanı arasındaki farkın 10 gün üzerinde olan başvuran hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-9)'
      },
      {
        key: 'B',
        name: 'Toplam USG Çekimi Yapılan Toplam Hasta Sayısı',
        description: 'Toplam USG çekimi yapılan hasta sayısı',
        calculation: 'Ek göstergede yer alan SUT kodları ile veri gönderimi gerçekleşen hasta sayısı hesaplanmıştır. (tekilleştirilmemiştir.) (EK-9)'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 3 },
      { condition: 'GD > GO', points: 0 }
    ],
    appendix: ['EK-9']
  },
  29: {
    code: 'SYPG-BH-29',
    name: 'Aile Hekimliği Asistanı Başına Düşen EAHB Sayısı',
    unit: '100 Kişide',
    source: 'EKOBS, EKİP/ÇKYS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Eğitim AHB Sayısı',
        description: 'Eğitim Aile Hekimliği Birimi sayısı',
        calculation: 'ÇKYS/EKİP\'ten Eğitim AHB sayısı alınmıştır.'
      },
      {
        key: 'B',
        name: 'Aile Hekimi Asistan Hekim Sayısı',
        description: 'Aile hekimi asistan hekim sayısı',
        calculation: 'ÇKYS/EKİP\'te Kadro branş kodu 4200 ve kadro ünvan kodu 6330, 10505 olan tekil Hekim Kimlik Numarası saydırılmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ 1/2', points: 2 },
      { condition: '1/4 ≤ GD < 1/2', points: 1 },
      { condition: 'GD < 1/4', points: 0 }
    ]
  },
  30: {
    code: 'SYPG-BH-30',
    name: 'Metrekare Başına Düşen Tüketim Miktarı',
    unit: 'TL/m²',
    source: 'TDMS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'Elektrik, Su ve Yakacak Giderleri Toplamı',
        description: 'Elektrik, su ve yakacak giderleri toplamı',
        calculation: 'TDMS\'den alınmıştır.'
      },
      {
        key: 'B',
        name: 'Kurum Kullanım Alanı (m²)',
        description: 'Kurum kullanım alanı metrekare cinsinden',
        calculation: 'TDMS\'den alınmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  31: {
    code: 'SYPG-BH-31',
    name: 'Çalışma Cetvellerini Zamanında Girme Oranı',
    unit: '%',
    source: 'MHRS',
    hbysCalculable: false,
    maxPoints: 4,
    acceptedDate: '19.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Zamanında Girilen MHRS Cetvel Sayısı',
        description: 'Zamanında girilen MHRS cetvel sayısı',
        calculation: 'cetvel_baslama_saati ile slot_kayit_zamani (yoksa cetvel_son_islem_zamani) arasındaki gün farkı 15 günden büyük olan toplam tekil cetvel ID sayısını ifade etmektedir.'
      },
      {
        key: 'B',
        name: 'İlgili Ay Açılan MHRS Cetveli',
        description: 'İlgili ayda açılan toplam MHRS cetveli sayısı',
        calculation: 'Toplam tekil cetvel ID sayısını ifade etmektedir.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 4 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  32: {
    code: 'SYPG-BH-32',
    name: '60 Günü Geçen Stok Tutarının Toplam Tahakkuka Oranı',
    unit: '%',
    source: 'MKYS, TDMS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: '60 Günü Geçen Stoğun Parasal Değeri',
        description: '60 günü geçen stok tutarı',
        calculation: 'MKYS\'den alınmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam Tahakkuk',
        description: 'Toplam tahakkuk tutarı',
        calculation: 'TDMS\'den alınmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  33: {
    code: 'SYPG-BH-33',
    name: 'Muhasebeleştirme Süresi',
    unit: 'Gün',
    source: 'TDMS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'Toplam Muhasebeleştirme Gün Süresi',
        description: 'Toplam muhasebeleştirme gün süresi',
        calculation: 'TDMS\'den alınmıştır.'
      },
      {
        key: 'B',
        name: 'Muhasebeleştirilen İşlem Sayısı',
        description: 'Muhasebeleştirilen işlem sayısı',
        calculation: 'TDMS\'den alınmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  34: {
    code: 'SYPG-BH-34',
    name: 'Nöbet+İcap Ücretinin Taban Ücrete Oranı',
    unit: '%',
    source: 'TDMS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'Nöbet+İcap Ücreti Toplamı',
        description: 'Nöbet ve icap ücreti toplamı',
        calculation: 'TDMS\'den alınmıştır.'
      },
      {
        key: 'B',
        name: 'Personel Taban Ücreti Toplamı',
        description: 'Personel taban ücreti toplamı',
        calculation: 'TDMS\'den alınmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  35: {
    code: 'SYPG-BH-35',
    name: 'Tahakkukun İlaç ve Tıbbi Malzeme Giderini Karşılama Oranı',
    unit: '%',
    source: 'TDMS',
    hbysCalculable: false,
    maxPoints: 2,
    acceptedDate: '23.05.2025',
    parameters: [
      {
        key: 'A',
        name: 'İlaç ve Tıbbi Malzeme Gideri',
        description: 'İlaç ve tıbbi malzeme gideri',
        calculation: 'TDMS\'den alınmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam Tahakkuk',
        description: 'Toplam tahakkuk tutarı',
        calculation: 'TDMS\'den alınmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  },
  36: {
    code: 'SYPG-BH-36',
    name: 'Ameliyat Masası Başına Düşen Ameliyat (A,B,C) Sayısı',
    unit: 'Sayı',
    source: 'e-Nabız, TSİM',
    hbysCalculable: false,
    maxPoints: 4,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Yapılan A, B, C Ameliyat Sayısı',
        description: 'A, B, C grubu ameliyat sayısı',
        calculation: 'A1, A2, A3, B, C ameliyat grubunda yer alan ameliyat sayısı işlem referans numarası ve işlem kodu birleştirilerek hesaplanmıştır. İlgili ameliyat gruplarındaki SUT kodları üzerinden çalışma sağlanmıştır.'
      },
      {
        key: 'B',
        name: 'Aktif Kullanılan Ameliyat Masası Sayısı',
        description: 'Aktif kullanılan ameliyat masası sayısı',
        calculation: 'TSİM\'den aktif ameliyat masa sayısı alınmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≥ GO', points: 4 },
      { condition: 'GD < GO', points: 0 }
    ]
  },
  37: {
    code: 'SYPG-BH-37',
    name: 'Acil Servis Ortalama Bekleme Süresi',
    unit: 'Dakika',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '02.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Acil Kliniklerinde Triajı Kırmızı veya Sarı Olan Kişilerin Kabul Zamanı ile İlk İşlem Zamanı Arasında Geçen Toplam Süre (dakika)',
        description: 'Acil serviste kırmızı/sarı triajlı hastaların bekleme süresi toplamı',
        calculation: 'Yalnızca ayaktan hastaların (yatış kabul zamanı boş veya günübirlik yatışı olmayan) acil kliniklerine (115, 101, 1) başvurularında triajı kırmızı veya sarı olan kişilerin başvuru zamanı ile ilk işlem zamanı arasındaki toplam geçen süre (dakika) hesaplanmıştır. 101 Hasta Kayıt Paketinde triaj bilgisi iletilmemiş ise sarı ve kırmızı haricinde bir veri ise çalışmaya dahil edilmemiştir.'
      },
      {
        key: 'B',
        name: 'Acil Kliniklerinde Triajı Kırmızı veya Sarı Olan Başvuru Sayısı',
        description: 'Acil serviste kırmızı/sarı triajlı başvuru sayısı',
        calculation: 'Yalnızca ayaktan hastaların (yatış kabul zamanı boş veya günübirlik yatışı olmayan) acil kliniklerine (115, 101, 1) başvurularında triajı kırmızı veya sarı olan başvuru sayıları hesaplanmıştır.'
      }
    ],
    gdFormula: 'GD = A / B',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ],
    notes: 'Kaynak Paket: 101 Hasta Kayıt. Triaj bilgisi: kırmızı veya sarı.'
  },
  38: {
    code: 'SYPG-BH-38',
    name: 'Toplam İlaç İçindeki Antibiyotik Oranı',
    unit: '%',
    source: 'e-Nabız',
    hbysCalculable: true,
    maxPoints: 2,
    acceptedDate: '22.06.2025',
    parameters: [
      {
        key: 'A',
        name: 'Antibiyotik İçeren İlaç Sayısı',
        description: 'Antibiyotik içeren ilaç sayısı',
        calculation: 'Ayaktan hastaların (yatış kabul zamanı boş veya günübirlik yatışı olmayan) antibiyotik (J01) içeren ilaç barkodu saydırılmıştır.'
      },
      {
        key: 'B',
        name: 'Toplam İlaç Sayısı',
        description: 'Toplam ilaç sayısı',
        calculation: 'Ayaktan hastaların (yatış kabul zamanı boş veya günübirlik yatışı olmayan) ilaç barkodu saydırılmıştır.'
      }
    ],
    gdFormula: 'GD = (A / B) × 100',
    scoringRules: [
      { condition: 'GD ≤ GO', points: 2 },
      { condition: 'GD > GO', points: 0 }
    ]
  }
};

export default BH_INDICATOR_DETAILS;
