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
  }
  // Gösterge 16-38 için henüz hesaplama mantığı girilmedi.
  // Gerçek veriler sağlandığında eklenecek.
};

export default BH_INDICATOR_DETAILS;
