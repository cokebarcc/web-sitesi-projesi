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
  }
  // Gösterge 6-38 için henüz hesaplama mantığı girilmedi.
  // Gerçek veriler sağlandığında eklenecek.
};

export default BH_INDICATOR_DETAILS;
