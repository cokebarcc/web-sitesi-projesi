
import { AppointmentData, PerformanceData } from './types';

export const HOSPITALS = [
  'Akçakale DH',
  'Şanlıurfa EAH',
  'Mehmet Akif İnan EAH',
  'Balıklıgöl DH',
  'Bozova DH',
  'Birecik DH',
  'Ceylanpınar DH',
  'Harran DH',
  'Halfeti DH',
  'Hilvan DH',
  'Suruç DH',
  'Siverek DH',
  'Viranşehir DH'
];

export const HOSPITAL_DEPARTMENTS: { [key: string]: string[] } = {
  'Akçakale DH': [],
  'Şanlıurfa EAH': [
    'Kadın Doğum',
    'Kardiyoloji',
    'Göz Hastalıkları',
    'İç Hastalıkları',
    'Ortopedi ve Travmatoloji',
    'Nöroloji',
    'Üroloji'
  ]
};

// Varsayılan global liste (eğer hastane eşleşmezse kullanılacak)
export const DEPARTMENTS = [
  'İç Hastalıkları',
  'Genel Cerrahi',
  'Çocuk Sağlığı ve Hastalıkları',
  'Kadın Hastalıkları ve Doğum'
];

export const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const YEARS = [2024, 2025, 2026, 2027];

export const INITIAL_PERFORMANCE: PerformanceData[] = [
  {
    id: 'm1',
    doctorName: 'Esra Yazkan',
    specialty: 'Kadın Hastalıkları ve Doğum',
    hospital: 'Akçakale DH',
    month: 'Kasım',
    year: 2025,
    polyclinic: { days: 16, totalExams: 320, mhrsCapacity: 400, noShowRate: 15 },
    surgery: { days: 2, totalSurgeries: 12, groupABC: "N/A" },
    ward: { days: 0, bedOccupancy: 0 },
    otherDays: 2,
    allActions: [
      { type: 'Poliklinik', days: 16 },
      { type: 'Ameliyat', days: 2 },
      { type: 'Diğer', days: 2 }
    ],
    constraints: ""
  }
];

export const MOCK_DATA: AppointmentData[] = [
  { id: '1', doctorName: 'ADEM DİLEK', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Akçakale DH', month: 'Kasım', year: 2025, date: 'Aylık Özet', actionType: 'Muayene', totalSlots: 198, bookedSlots: 168, daysCount: 3, status: 'active' },
  { id: '2', doctorName: 'ADEM DİLEK', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Akçakale DH', month: 'Kasım', year: 2025, date: 'Aylık Özet', actionType: 'Ameliyatta', daysCount: 2, status: 'active' },
  { id: '3', doctorName: 'ADEM DİLEK', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Akçakale DH', month: 'Kasım', year: 2025, date: 'Aylık Özet', actionType: 'Acil Polikliniği', daysCount: 1, status: 'active' },
  { id: '4', doctorName: 'ADEM DİLEK', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Akçakale DH', month: 'Kasım', year: 2025, date: 'Aylık Özet', actionType: 'Nöbet', daysCount: 4, status: 'active' },
];
