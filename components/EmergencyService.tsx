import React, { useState, useRef, useEffect, useMemo } from 'react';
import { uploadGreenAreaFile, loadMultipleDatesData, getAvailableDateParts, getAvailableGreenAreaDates, GreenAreaData, getGreenAreaFiles } from '../src/services/greenAreaStorage';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import DateRangeCalendar, { DateRange } from './DateRangeCalendar';
import GreenAreaDailyRateTable, { GreenAreaDailyRateTableRef } from './GreenAreaDailyRateTable';
import { HOSPITALS } from '../constants';

// Günlük tablo için veri yapısı
interface DailyData {
  date: string;
  hospitalName: string;
  greenAreaCount: number;
  totalCount: number;
  greenAreaRate: number;
}

interface EmergencyServiceProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Upload permission
  canUpload?: boolean;
}

// Hastane kısa adları mapping
const hospitalShortNames: Record<string, string> = {
  'Şanlıurfa Birecik Devlet Hastanesi': 'Birecik DH',
  'Şanlıurfa Bozova Devlet Hastanesi': 'Bozova DH',
  'Şanlıurfa Halfeti İlçe Hastanesi': 'Halfeti DH',
  'Şanlıurfa Hilvan Devlet Hastanesi': 'Hilvan DH',
  'Şanlıurfa Suruç Devlet Hastanesi': 'Suruç DH',
  'Şanlıurfa Harran Devlet Hastanesi': 'Harran DH',
  'Şanlıurfa Ceylanpınar Devlet Hastanesi': 'Ceylanpınar DH',
  'Şanlıurfa Siverek Devlet Hastanesi': 'Siverek DH',
  'Şanlıurfa Akçakale Devlet Hastanesi': 'Akçakale DH',
  'Şanlıurfa Balıklıgöl Devlet Hastanesi': 'Balıklıgöl DH',
  'Şanlıurfa Viranşehir Devlet Hastanesi': 'Viranşehir DH',
  'Şanlıurfa Sağlık Bilimleri Üniversitesi Mehmet Akif İnan EAH': 'Mehmet Akif İnan EAH',
  'Şanlıurfa Eğitim ve Araştırma Hastanesi': 'Şanlıurfa EAH',
};

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const getShortName = (fullName: string): string => {
  return hospitalShortNames[fullName] || fullName.replace('Şanlıurfa ', '').replace(' Devlet Hastanesi', ' DH');
};

// Progress bar rengi belirleme - %65+ yeşil, %60-64 sarı, %60 altı kırmızı
const getProgressColor = (rate: number): string => {
  if (rate >= 65) return 'bg-emerald-500';
  if (rate >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getTextColor = (rate: number): string => {
  if (rate >= 65) return 'text-emerald-400';
  if (rate >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

// Hastane sıralama - öncelikli hastaneler
const priorityHospitals = [
  'Şanlıurfa EAH',
  'Mehmet Akif İnan EAH',
  'Balıklıgöl DH'
];

const sortHospitals = (data: GreenAreaData[]): GreenAreaData[] => {
  return [...data].sort((a, b) => {
    const aShort = getShortName(a.hospitalName);
    const bShort = getShortName(b.hospitalName);

    const aIndex = priorityHospitals.indexOf(aShort);
    const bIndex = priorityHospitals.indexOf(bShort);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return aShort.localeCompare(bShort, 'tr-TR');
  });
};

const EmergencyService: React.FC<EmergencyServiceProps> = ({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  canUpload = false,
}) => {
  // Upload için tarih
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Filtre için çoklu seçim
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Record<number, number[]>>({});
  const [availableDays, setAvailableDays] = useState<Record<string, number[]>>({});
  const [allDates, setAllDates] = useState<string[]>([]);

  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  // Aktif ay (takvim için) - birden fazla ay seçiliyse en son seçilen
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GreenAreaData[] | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]); // Günlük tablo için
  const [selectedDatesForDisplay, setSelectedDatesForDisplay] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const dailyTableRef = useRef<GreenAreaDailyRateTableRef>(null);

  // Bağımsız günlük tablo için state'ler
  const [tableDateRange, setTableDateRange] = useState<DateRange>({ start: null, end: null });
  const [tableData, setTableData] = useState<DailyData[]>([]);
  const [tableDates, setTableDates] = useState<string[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [tableSelectedYears, setTableSelectedYears] = useState<number[]>([]);
  const [tableSelectedMonths, setTableSelectedMonths] = useState<number[]>([]);
  const [tableActiveMonth, setTableActiveMonth] = useState<number | null>(null);
  const [tableSelectedHospitals, setTableSelectedHospitals] = useState<string[]>([]);

  // Hastane filtresi için state
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);

  // Kullanıcının yetkili olduğu hastaneler (kısa ad formatında)
  const authorizedHospitalShortNames = useMemo(() => {
    // allowedHospitals boşsa tüm hastaneler yetkili
    if (allowedHospitals.length === 0) {
      return Object.values(hospitalShortNames);
    }
    // allowedHospitals'daki kısa adları döndür
    return allowedHospitals;
  }, [allowedHospitals]);

  // Kullanıcının TÜM hastanelere yetkisi var mı? (boş liste = tüm hastaneler, veya tüm hastaneler seçilmiş)
  const hasAllHospitalsAccess = useMemo(() => {
    return allowedHospitals.length === 0 || allowedHospitals.length >= HOSPITALS.length;
  }, [allowedHospitals]);

  // Hastane seçimi handler (MultiSelectDropdown için)
  const handleHospitalsChange = (values: (string | number)[]) => {
    setSelectedHospitals(values.map(v => String(v)));
  };

  // Tablo hastane seçimi handler
  const handleTableHospitalsChange = (values: (string | number)[]) => {
    setTableSelectedHospitals(values.map(v => String(v)));
  };

  // Load available date parts on mount
  useEffect(() => {
    loadDateParts();
  }, []);

  const loadDateParts = async () => {
    const parts = await getAvailableDateParts();
    setAvailableYears(parts.years);
    setAvailableMonths(parts.monthsByYear);
    setAvailableDays(parts.daysByYearMonth);

    const dates = await getAvailableGreenAreaDates();
    setAllDates(dates);
  };

  // Seçili yıllara göre gösterilecek aylar
  const displayableMonths = (): number[] => {
    if (selectedYears.length === 0) return [];
    const months = new Set<number>();
    selectedYears.forEach(year => {
      (availableMonths[year] || []).forEach(m => months.add(m));
    });
    return Array.from(months).sort((a, b) => a - b);
  };

  // Takvim için müsait tarihler (aktif yıl + ay kombinasyonuna göre)
  const availableDatesForCalendar = useMemo((): string[] => {
    if (selectedYears.length === 0 || activeMonth === null) return [];

    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);
      return selectedYears.includes(year) && month === activeMonth;
    });
  }, [selectedYears, activeMonth, allDates]);

  // Seçimlere göre eşleşen tarihleri bul
  const getMatchingDates = (): string[] => {
    if (selectedYears.length === 0) return [];

    // Tarih aralığı seçiliyse, aralıktaki tarihleri döndür
    if (dateRange.start && dateRange.end) {
      const dates: string[] = [];
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      const current = new Date(Math.min(start.getTime(), end.getTime()));
      const endDate = new Date(Math.max(start.getTime(), end.getTime()));

      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        if (allDates.includes(dateStr)) {
          dates.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    }

    // Sadece yıl ve ay seçiliyse (gün seçilmemişse) tüm günleri döndür
    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);

      if (!selectedYears.includes(year)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return false;

      return true;
    });
  };

  // Bağımsız tablo için takvim tarihleri
  const tableAvailableDatesForCalendar = useMemo((): string[] => {
    if (tableSelectedYears.length === 0 || tableActiveMonth === null) return [];

    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);
      return tableSelectedYears.includes(year) && month === tableActiveMonth;
    });
  }, [tableSelectedYears, tableActiveMonth, allDates]);

  // Bağımsız tablo için ay seçenekleri
  const tableMonthOptions: DropdownOption[] = useMemo(() => {
    if (tableSelectedYears.length === 0) return [];
    const months = new Set<number>();
    tableSelectedYears.forEach(year => {
      (availableMonths[year] || []).forEach(m => months.add(m));
    });
    return Array.from(months).sort((a, b) => a - b).map(m => ({
      value: m,
      label: MONTH_NAMES[m]
    }));
  }, [tableSelectedYears, availableMonths]);

  // Bağımsız tablo için eşleşen tarihleri bul
  const getTableMatchingDates = (): string[] => {
    if (tableSelectedYears.length === 0) return [];

    if (tableDateRange.start && tableDateRange.end) {
      const dates: string[] = [];
      const start = new Date(tableDateRange.start);
      const end = new Date(tableDateRange.end);
      const current = new Date(Math.min(start.getTime(), end.getTime()));
      const endDate = new Date(Math.max(start.getTime(), end.getTime()));

      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        if (allDates.includes(dateStr)) {
          dates.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    }

    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);
      if (!tableSelectedYears.includes(year)) return false;
      if (tableSelectedMonths.length > 0 && !tableSelectedMonths.includes(month)) return false;
      return true;
    });
  };

  // Tablo için hastane yetkisi kontrolü
  const isTableHospitalAuthorized = (hospitalName: string): boolean => {
    const shortName = getShortName(hospitalName);
    // allowedHospitals boşsa tüm hastaneler yetkili
    if (allowedHospitals.length === 0) return true;
    // Seçili hastaneler varsa onlara göre filtrele
    if (tableSelectedHospitals.length > 0) {
      return tableSelectedHospitals.includes(shortName);
    }
    // Seçili hastane yoksa yetkili tüm hastaneleri göster
    return allowedHospitals.includes(shortName);
  };

  // Bağımsız tablo veri yükleme
  const handleLoadTableData = async () => {
    const matchingDates = getTableMatchingDates();
    if (matchingDates.length === 0) {
      showToast('Seçimlere uygun tarih bulunamadı', 'error');
      return;
    }

    // Hastane seçimi kontrolü
    if (tableSelectedHospitals.length === 0 && allowedHospitals.length > 0) {
      showToast('Lütfen en az bir hastane seçiniz', 'error');
      return;
    }

    setIsTableLoading(true);
    try {
      const allFiles = await getGreenAreaFiles();
      const dailyDataArr: DailyData[] = [];

      matchingDates.forEach(date => {
        const fileForDate = allFiles.find(f => f.date === date);
        if (fileForDate && fileForDate.data) {
          fileForDate.data.forEach(hospital => {
            // Sadece yetkili hastaneleri ekle
            if (isTableHospitalAuthorized(hospital.hospitalName)) {
              dailyDataArr.push({
                date,
                hospitalName: hospital.hospitalName,
                greenAreaCount: hospital.greenAreaCount,
                totalCount: hospital.totalCount,
                greenAreaRate: hospital.greenAreaRate
              });
            }
          });
        }
      });

      setTableData(dailyDataArr);
      setTableDates(matchingDates);
      showToast(`${matchingDates.length} günlük tablo verisi yüklendi`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Tablo verisi yükleme hatası', 'error');
    } finally {
      setIsTableLoading(false);
    }
  };

  // Tablo yıl değişimi
  const handleTableYearsChange = (years: number[]) => {
    setTableSelectedYears(years);
    setTableSelectedMonths([]);
    setTableActiveMonth(null);
    setTableDateRange({ start: null, end: null });
  };

  // Tablo ay değişimi
  const handleTableMonthsChange = (months: number[]) => {
    setTableSelectedMonths(months);
    if (months.length > 0) {
      setTableActiveMonth(months[months.length - 1]);
    } else {
      setTableActiveMonth(null);
    }
    setTableDateRange({ start: null, end: null });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadGreenAreaFile(file, uploadDate, 'user');
      if (result.success && result.data) {
        setData(result.data);
        setSelectedDatesForDisplay([uploadDate]);
        showToast(`${result.recordCount} hastane verisi yüklendi`, 'success');
        await loadDateParts();
      } else {
        showToast(result.error || 'Yükleme hatası', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Yükleme hatası', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Hastane kısa adının yetkili olup olmadığını kontrol et
  const isHospitalAuthorized = (hospitalName: string): boolean => {
    const shortName = getShortName(hospitalName);
    // allowedHospitals boşsa tüm hastaneler yetkili
    if (allowedHospitals.length === 0) return true;
    // Seçili hastaneler varsa onlara göre filtrele
    if (selectedHospitals.length > 0) {
      return selectedHospitals.includes(shortName);
    }
    // Seçili hastane yoksa yetkili tüm hastaneleri göster
    return allowedHospitals.includes(shortName);
  };

  const handleLoadData = async () => {
    const matchingDates = getMatchingDates();
    if (matchingDates.length === 0) {
      showToast('Seçimlere uygun tarih bulunamadı', 'error');
      return;
    }

    // Hastane seçimi kontrolü
    if (selectedHospitals.length === 0 && allowedHospitals.length > 0) {
      showToast('Lütfen en az bir hastane seçiniz', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Toplu veri yükle (kartlar için)
      const loadedData = await loadMultipleDatesData(matchingDates);

      // Günlük veri yükle (tablo için)
      const allFiles = await getGreenAreaFiles();
      const dailyDataArr: DailyData[] = [];

      matchingDates.forEach(date => {
        const fileForDate = allFiles.find(f => f.date === date);
        if (fileForDate && fileForDate.data) {
          fileForDate.data.forEach(hospital => {
            // Sadece yetkili hastaneleri ekle
            if (isHospitalAuthorized(hospital.hospitalName)) {
              dailyDataArr.push({
                date,
                hospitalName: hospital.hospitalName,
                greenAreaCount: hospital.greenAreaCount,
                totalCount: hospital.totalCount,
                greenAreaRate: hospital.greenAreaRate
              });
            }
          });
        }
      });

      if (loadedData) {
        // Yetkili hastanelere göre filtrele
        const filteredData = loadedData.filter(d => isHospitalAuthorized(d.hospitalName));
        setData(filteredData);
        setDailyData(dailyDataArr);
        setSelectedDatesForDisplay(matchingDates);
        showToast(`${matchingDates.length} tarihten ${filteredData.length} hastane verisi yüklendi`, 'success');
      } else {
        showToast('Veri bulunamadı', 'error');
        setData(null);
        setDailyData([]);
      }
    } catch (error: any) {
      showToast(error.message || 'Veri yükleme hatası', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!cardsContainerRef.current) return;

    try {
      const container = cardsContainerRef.current;

      // Export için geçici olarak açık tema uygula (koyu→açık dönüşüm)
      // Computed style kullanarak doğrudan inline style override
      const savedStyles: { el: HTMLElement; origStyle: string }[] = [];

      const convertToLight = (el: HTMLElement) => {
        savedStyles.push({ el, origStyle: el.getAttribute('style') || '' });
        const cs = window.getComputedStyle(el);

        // Arka plan rengi
        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const nums = bg.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          // Renkli arka planları koru (yeşil progress bar, sarı bar, kırmızı bar vb.)
          const isColorful = (g > 120 && r < 80) || (r > 180 && g < 100) || (r > 180 && g > 120 && b < 50);
          if (isColorful) {
            // Olduğu gibi bırak — progress bar veya renkli element
          }
          // Koyu arka planlar (r < 80) → beyaz/açık
          else if (r < 80 && g < 80) {
            el.style.backgroundColor = '#f8fafc'; // slate-50
          } else if (r < 120 && g < 120) {
            el.style.backgroundColor = '#f1f5f9'; // slate-100
          }
        }

        // Metin rengi
        const color = cs.color;
        if (color) {
          const nums = color.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          // Beyaz/çok açık metin → koyu
          if (r > 200 && g > 200 && b > 200) {
            el.style.color = '#1e293b'; // slate-800
          }
          // slate-400 benzeri orta tonlar → daha koyu
          else if (r > 130 && r < 200 && g > 140 && b > 160) {
            el.style.color = '#475569'; // slate-600
          }
          // Yeşil tonları (emerald-400 ~52,211,153) → daha koyu yeşil
          else if (g > 180 && r < 100 && b > 100 && b < 200) {
            el.style.color = '#059669'; // emerald-600
          }
          // Sarı tonları (yellow-400 ~250,204,21) → koyu sarı
          else if (r > 200 && g > 160 && b < 80) {
            el.style.color = '#ca8a04'; // yellow-600
          }
          // Kırmızı tonları (red-400 ~248,113,113) → koyu kırmızı
          else if (r > 200 && g < 130 && b < 130) {
            el.style.color = '#dc2626'; // red-600
          }
        }

        // Border rengi
        const bc = cs.borderTopColor || cs.borderColor;
        if (bc && bc !== 'rgba(0, 0, 0, 0)') {
          const nums = bc.match(/[\d.]+/g)?.map(Number) || [];
          const [r] = nums;
          if (r < 120) {
            el.style.borderColor = '#e2e8f0'; // slate-200
          }
        }
      };

      // Container ve tüm child'lara uygula
      convertToLight(container);
      container.style.backgroundColor = '#ffffff';
      container.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) convertToLight(child);
      });

      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Stilleri geri al
      savedStyles.forEach(({ el, origStyle }) => {
        if (origStyle) el.setAttribute('style', origStyle);
        else el.removeAttribute('style');
      });

      const link = document.createElement('a');
      const dateStr = selectedDatesForDisplay.length === 1
        ? selectedDatesForDisplay[0]
        : `${selectedDatesForDisplay.length}-tarih`;
      link.download = `yesil-alan-oranlari-${dateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG indirildi', 'success');
    } catch (error) {
      showToast('PNG indirme hatası', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!cardsContainerRef.current) return;

    try {
      // A4 boyutları (mm)
      const pageWidth = 297; // Landscape A4
      const pageHeight = 210;
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const container = cardsContainerRef.current;

      // Export için geçici olarak açık tema uygula (computed style override)
      const pdfSavedStyles: { el: HTMLElement; origStyle: string }[] = [];

      const convertToLightPdf = (el: HTMLElement) => {
        pdfSavedStyles.push({ el, origStyle: el.getAttribute('style') || '' });
        const cs = window.getComputedStyle(el);

        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const nums = bg.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          if (r < 80 && g < 80) el.style.backgroundColor = '#f8fafc';
          else if (r < 120) el.style.backgroundColor = '#f1f5f9';
        }

        const color = cs.color;
        if (color) {
          const nums = color.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          if (r > 200 && g > 200 && b > 200) el.style.color = '#1e293b';
          else if (r > 130 && r < 200 && g > 140 && b > 160) el.style.color = '#475569';
          else if (g > 180 && r < 100 && b > 100 && b < 200) el.style.color = '#059669';
          else if (r > 200 && g < 130 && b < 130) el.style.color = '#dc2626';
        }

        const bc = cs.borderTopColor || cs.borderColor;
        if (bc && bc !== 'rgba(0, 0, 0, 0)') {
          const nums = bc.match(/[\d.]+/g)?.map(Number) || [];
          if (nums[0] < 120) el.style.borderColor = '#e2e8f0';
        }
      };

      convertToLightPdf(container);
      container.style.backgroundColor = '#ffffff';
      container.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) convertToLightPdf(child);
      });

      // Sayfa 1: Kartlar
      const cardsCanvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Stilleri geri al
      pdfSavedStyles.forEach(({ el, origStyle }) => {
        if (origStyle) el.setAttribute('style', origStyle);
        else el.removeAttribute('style');
      });

      const cardsImgData = cardsCanvas.toDataURL('image/png');
      const cardsAspectRatio = cardsCanvas.width / cardsCanvas.height;

      let cardsWidth = contentWidth;
      let cardsHeight = cardsWidth / cardsAspectRatio;

      // Yükseklik fazlaysa yüksekliğe göre ölçekle
      if (cardsHeight > contentHeight) {
        cardsHeight = contentHeight;
        cardsWidth = cardsHeight * cardsAspectRatio;
      }

      // Ortalamak için offset hesapla
      const cardsX = margin + (contentWidth - cardsWidth) / 2;
      const cardsY = margin + (contentHeight - cardsHeight) / 2;

      pdf.addImage(cardsImgData, 'PNG', cardsX, cardsY, cardsWidth, cardsHeight);

      // Sayfa 2: Günlük tablo (eğer varsa - bağımsız tablo verisi kontrolü)
      const tableElement = dailyTableRef.current?.getTableElement();
      if (tableElement && tableDates.length > 0 && tableData.length > 0) {
        pdf.addPage('a4', 'landscape');

        // Export için geçici olarak overflow'u kaldır
        const tableWrapper = tableElement.querySelector('.overflow-x-auto') as HTMLElement;
        const originalOverflow = tableWrapper?.style.overflow;
        const originalWidth = tableElement.style.width;

        if (tableWrapper) {
          tableWrapper.style.overflow = 'visible';
        }
        tableElement.style.width = 'fit-content';
        tableElement.style.minWidth = '100%';

        const tableCanvas = await html2canvas(tableElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          windowWidth: tableElement.scrollWidth + 100
        });

        // Stilleri geri al
        if (tableWrapper) {
          tableWrapper.style.overflow = originalOverflow || '';
        }
        tableElement.style.width = originalWidth;
        tableElement.style.minWidth = '';

        const tableImgData = tableCanvas.toDataURL('image/png');
        const tableAspectRatio = tableCanvas.width / tableCanvas.height;

        let tableWidth = contentWidth;
        let tableHeight = tableWidth / tableAspectRatio;

        // Yükseklik fazlaysa yüksekliğe göre ölçekle
        if (tableHeight > contentHeight) {
          tableHeight = contentHeight;
          tableWidth = tableHeight * tableAspectRatio;
        }

        // Ortalamak için offset hesapla
        const tableX = margin + (contentWidth - tableWidth) / 2;
        const tableY = margin + (contentHeight - tableHeight) / 2;

        pdf.addImage(tableImgData, 'PNG', tableX, tableY, tableWidth, tableHeight);
      }

      const dateStr = selectedDatesForDisplay.length === 1
        ? selectedDatesForDisplay[0]
        : `${selectedDatesForDisplay[0]}_${selectedDatesForDisplay[selectedDatesForDisplay.length - 1]}`;
      pdf.save(`yesil-alan-raporu-${dateStr}.pdf`);
      showToast('PDF indirildi', 'success');
    } catch (error) {
      console.error('PDF hatası:', error);
      showToast('PDF indirme hatası', 'error');
    }
  };

  // Dropdown options için memoized değerler
  const hospitalOptions: DropdownOption[] = useMemo(() =>
    authorizedHospitalShortNames.map(h => ({ value: h, label: h })).sort((a, b) => a.label.localeCompare(b.label, 'tr-TR')),
    [authorizedHospitalShortNames]
  );

  const yearOptions: DropdownOption[] = useMemo(() =>
    availableYears.map(year => ({ value: year, label: String(year) })),
    [availableYears]
  );

  const monthOptions: DropdownOption[] = useMemo(() =>
    displayableMonths().map(month => ({ value: month, label: MONTH_NAMES[month] })),
    [selectedYears, availableMonths]
  );

  // Aktif ay seçenekleri (takvim için)
  const activeMonthOptions: DropdownOption[] = useMemo(() =>
    selectedMonths.map(month => ({ value: month, label: MONTH_NAMES[month] })),
    [selectedMonths]
  );

  // Yıl değişimi handler
  const handleYearsChange = (values: (string | number)[]) => {
    const newYears = values.map(v => Number(v));
    setSelectedYears(newYears);

    // Yıl değişince geçersiz ay seçimlerini temizle ve tarih aralığını sıfırla
    if (newYears.length === 0) {
      setSelectedMonths([]);
      setActiveMonth(null);
      setDateRange({ start: null, end: null });
    } else {
      // Seçili yıllarda mevcut olmayan ayları temizle
      const validMonths = new Set<number>();
      newYears.forEach(year => {
        (availableMonths[year] || []).forEach(m => validMonths.add(m));
      });
      const newMonths = selectedMonths.filter(m => validMonths.has(m));
      if (newMonths.length !== selectedMonths.length) {
        setSelectedMonths(newMonths);
        // Aktif ay hala geçerliyse koru, değilse sıfırla
        if (activeMonth !== null && !newMonths.includes(activeMonth)) {
          setActiveMonth(newMonths.length > 0 ? newMonths[newMonths.length - 1] : null);
        }
        setDateRange({ start: null, end: null });
      }
    }
  };

  // Ay değişimi handler
  const handleMonthsChange = (values: (string | number)[]) => {
    const newMonths = values.map(v => Number(v));
    setSelectedMonths(newMonths);

    // Ay değişince aktif ayı güncelle ve tarih aralığını temizle
    if (newMonths.length === 0) {
      setActiveMonth(null);
      setDateRange({ start: null, end: null });
    } else {
      // En son eklenen ayı aktif yap
      const lastMonth = newMonths[newMonths.length - 1];
      setActiveMonth(lastMonth);
      setDateRange({ start: null, end: null });
    }
  };

  // Aktif ay değişimi handler
  const handleActiveMonthChange = (values: (string | number)[]) => {
    if (values.length > 0) {
      setActiveMonth(Number(values[0]));
      setDateRange({ start: null, end: null });
    }
  };

  // Tarih aralığı değişimi handler
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  // İl geneli hesapla
  const ilGeneli = data ? {
    hospitalName: 'ŞANLIURFA İL GENELİ',
    greenAreaCount: data.reduce((sum, d) => sum + d.greenAreaCount, 0),
    totalCount: data.reduce((sum, d) => sum + d.totalCount, 0),
    greenAreaRate: 0
  } : null;

  if (ilGeneli) {
    ilGeneli.greenAreaRate = ilGeneli.totalCount > 0 ? (ilGeneli.greenAreaCount / ilGeneli.totalCount) * 100 : 0;
  }

  // Tarih gösterimi
  const getDateRangeDisplay = (): string => {
    if (selectedDatesForDisplay.length === 0) return '';
    if (selectedDatesForDisplay.length === 1) {
      const d = new Date(selectedDatesForDisplay[0]);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const sorted = [...selectedDatesForDisplay].sort();
    const first = new Date(sorted[0]);
    const last = new Date(sorted[sorted.length - 1]);
    return `${first.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${last.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} (${selectedDatesForDisplay.length} gün)`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Yeşil Alan Oranları</h1>
          <p className="text-slate-400 mt-1">Acil servise başvuran hastaların yeşil alan oranları</p>
        </div>
      </div>

      {/* Veri Yükleme Bölümü - Sadece yükleme izni varsa göster */}
      {canUpload && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Veri Yükleme</h3>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Yükleme için Tarih Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Yükleme Tarihi</label>
              <input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Upload Button */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Excel Dosyası</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !uploadDate}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Excel Yükle
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Excel format info */}
          <div className="mt-4 p-4 bg-slate-700/30 rounded-xl">
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Excel Formatı:</span> Kurum Adı | Yeşil Alan Muayene Sayısı | Toplam Muayene Sayısı
            </p>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Veri Filtreleme</h3>
          <div className="flex items-center gap-3">
            {getMatchingDates().length > 0 && (
              <span className="text-sm text-emerald-400 font-medium bg-emerald-500/20 px-3 py-1 rounded-full">
                {getMatchingDates().length} tarih seçili
              </span>
            )}
            {(selectedYears.length > 0 || selectedMonths.length > 0 || dateRange.start) && (
              <button
                onClick={() => {
                  setSelectedYears([]);
                  setSelectedMonths([]);
                  setActiveMonth(null);
                  setDateRange({ start: null, end: null });
                }}
                className="text-sm text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Tümünü Temizle
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Dropdowns */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Hastane Seçimi - En başta */}
          {allowedHospitals.length > 0 && (
            <MultiSelectDropdown
              label="Hastane Seçimi"
              options={hospitalOptions}
              selectedValues={selectedHospitals}
              onChange={handleHospitalsChange}
              placeholder="Hastane seçiniz..."
              disabled={hospitalOptions.length === 0}
              emptyMessage="Yetkili hastane yok"
              showSearch={true}
            />
          )}

          {/* Yıl Seçimi */}
          <MultiSelectDropdown
            label="Yıl Seçimi"
            options={yearOptions}
            selectedValues={selectedYears}
            onChange={handleYearsChange}
            placeholder="Yıl seçiniz..."
            disabled={availableYears.length === 0}
            emptyMessage="Kayıtlı veri yok"
            showSearch={false}
          />

          {/* Ay Seçimi */}
          <MultiSelectDropdown
            label="Ay Seçimi"
            options={monthOptions}
            selectedValues={selectedMonths}
            onChange={handleMonthsChange}
            placeholder="Ay seçiniz..."
            disabled={selectedYears.length === 0}
            emptyMessage={selectedYears.length === 0 ? "Önce yıl seçiniz" : "Seçili yıllarda veri yok"}
            showSearch={false}
          />

          {/* Aktif Ay Seçimi (birden fazla ay seçiliyse göster) */}
          {selectedMonths.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-400">Takvim Ayı</label>
              <select
                value={activeMonth || ''}
                onChange={(e) => handleActiveMonthChange([Number(e.target.value)])}
                className="px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[140px]"
              >
                {selectedMonths.map(month => (
                  <option key={month} value={month}>{MONTH_NAMES[month]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tarih Aralığı Takvimi */}
          <DateRangeCalendar
            label="Tarih Aralığı"
            value={dateRange}
            onChange={handleDateRangeChange}
            availableDates={availableDatesForCalendar}
            activeYear={selectedYears.length > 0 ? selectedYears[0] : null}
            activeMonth={activeMonth}
            disabled={selectedMonths.length === 0}
            placeholder={selectedMonths.length === 0 ? "Önce ay seçiniz..." : "Tarih aralığı seçiniz..."}
          />

          {/* Uygula Butonu */}
          <button
            onClick={handleLoadData}
            disabled={isLoading || getMatchingDates().length === 0 || (allowedHospitals.length > 0 && selectedHospitals.length === 0)}
            className="px-6 py-2.5 h-[42px] bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Yükleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Uygula
              </>
            )}
          </button>
        </div>

        {/* Hastane seçimi uyarısı */}
        {allowedHospitals.length > 0 && selectedHospitals.length === 0 && (
          <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl">
            <p className="text-sm text-amber-400 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Veri görüntülemek için en az bir hastane seçmelisiniz
            </p>
          </div>
        )}
      </div>

      {/* No Data Message */}
      {!data && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Veri Yüklenmedi</h2>
            <p className="text-slate-400 max-w-md">
              Yukarıdan tarih seçip "Uygula" butonuna tıklayarak mevcut veriyi yükleyebilir
              veya yeni bir Excel dosyası yükleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Cards Container */}
      {data && (
        <>
          {/* İndirme Butonları */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleDownloadPng}
              className="px-4 py-2.5 bg-slate-700/50 text-slate-200 border border-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              PNG
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
          </div>

          <div ref={cardsContainerRef} className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/60 shadow-lg">
            {/* Header for PNG */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Acil Servis Yeşil Alan Oranları</h2>
                  <p className="text-slate-400">Şanlıurfa İl Sağlık Müdürlüğü</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">{getDateRangeDisplay()}</p>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* İl Geneli Card - Tüm hastanelere yetkisi olan kullanıcılara göster */}
              {ilGeneli && hasAllHospitalsAccess && (
                <HospitalCard
                  data={ilGeneli}
                  isIlGeneli={true}
                  dailyDetails={
                    // İl geneli için tüm hastanelerin günlük toplamları
                    selectedDatesForDisplay.map(date => {
                      const dayData = dailyData.filter(d => d.date === date);
                      const totalGreen = dayData.reduce((sum, d) => sum + d.greenAreaCount, 0);
                      const totalCount = dayData.reduce((sum, d) => sum + d.totalCount, 0);
                      return {
                        date,
                        greenAreaCount: totalGreen,
                        totalCount: totalCount,
                        greenAreaRate: totalCount > 0 ? (totalGreen / totalCount) * 100 : 0
                      };
                    })
                  }
                />
              )}

              {/* Hospital Cards - Özel sıralama */}
              {sortHospitals(data).map((hospital, index) => (
                <HospitalCard
                  key={index}
                  data={hospital}
                  isIlGeneli={false}
                  dailyDetails={
                    dailyData
                      .filter(d => d.hospitalName === hospital.hospitalName)
                      .map(d => ({
                        date: d.date,
                        greenAreaCount: d.greenAreaCount,
                        totalCount: d.totalCount,
                        greenAreaRate: d.greenAreaRate
                      }))
                  }
                />
              ))}
            </div>

            {/* Footer with formula */}
            <div className="mt-8 pt-4 border-t border-slate-700/60">
              <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 font-medium">
                  Yeşil Alan Oranı Hesaplama Formülü: <span className="text-emerald-400">Yeşil Alan Hasta Sayısı / Acil Servise Başvuran Toplam Hasta Sayısı X 100</span>
                </p>
                {ilGeneli && hasAllHospitalsAccess && (
                  <p className="text-sm text-slate-500 mt-2">
                    Yeşil Alan Oranı Hesaplama Formülü: <span className="font-semibold text-white">{ilGeneli.greenAreaCount.toLocaleString('tr-TR')} / {ilGeneli.totalCount.toLocaleString('tr-TR')} x 100 = %{ilGeneli.greenAreaRate.toFixed(1)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

        </>
      )}

      {/* Bağımsız Günlük Oran Tablosu Bölümü */}
      <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6 mt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">
              Günlük Yeşil Alan Oranları Tablosu
            </h3>
            <p className="text-sm text-slate-400">
              (Ana filtreden bağımsız çalışır)
            </p>
          </div>

          {/* Tablo Filtreleri */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-slate-700/30 rounded-xl">
            {/* Hastane Seçimi - En başta */}
            {allowedHospitals.length > 0 && (
              <MultiSelectDropdown
                label="Hastane Seçimi"
                options={hospitalOptions}
                selectedValues={tableSelectedHospitals}
                onChange={handleTableHospitalsChange}
                placeholder="Hastane seçiniz..."
                disabled={hospitalOptions.length === 0}
                emptyMessage="Yetkili hastane yok"
                showSearch={true}
              />
            )}

            {/* Yıl Seçimi */}
            <MultiSelectDropdown
              label="Yıl Seçimi"
              options={availableYears.map(y => ({ value: y, label: y.toString() }))}
              selectedValues={tableSelectedYears}
              onChange={handleTableYearsChange}
              placeholder="Yıl seçiniz..."
              disabled={availableYears.length === 0}
              emptyMessage="Kayıtlı veri yok"
              showSearch={false}
            />

            {/* Ay Seçimi */}
            <MultiSelectDropdown
              label="Ay Seçimi"
              options={tableMonthOptions}
              selectedValues={tableSelectedMonths}
              onChange={handleTableMonthsChange}
              placeholder="Ay seçiniz..."
              disabled={tableSelectedYears.length === 0}
              emptyMessage={tableSelectedYears.length === 0 ? "Önce yıl seçiniz" : "Seçili yıllarda veri yok"}
              showSearch={false}
            />

            {/* Aktif Ay Seçimi */}
            {tableSelectedMonths.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-400">Takvim Ayı</label>
                <select
                  value={tableActiveMonth || ''}
                  onChange={(e) => setTableActiveMonth(Number(e.target.value))}
                  className="px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[140px]"
                >
                  {tableSelectedMonths.map(month => (
                    <option key={month} value={month}>{MONTH_NAMES[month]}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tarih Aralığı */}
            <DateRangeCalendar
              label="Tarih Aralığı"
              value={tableDateRange}
              onChange={setTableDateRange}
              availableDates={tableAvailableDatesForCalendar}
              activeYear={tableSelectedYears.length > 0 ? tableSelectedYears[0] : null}
              activeMonth={tableActiveMonth}
              disabled={tableSelectedMonths.length === 0}
              placeholder={tableSelectedMonths.length === 0 ? "Önce ay seçiniz..." : "Tarih aralığı seçiniz..."}
            />

            {/* Uygula Butonu */}
            <button
              onClick={handleLoadTableData}
              disabled={isTableLoading || getTableMatchingDates().length === 0 || (allowedHospitals.length > 0 && tableSelectedHospitals.length === 0)}
              className="px-6 py-2.5 h-[42px] bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
            >
              {isTableLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Uygula
                </>
              )}
            </button>
          </div>

          {/* Hastane seçimi uyarısı */}
          {allowedHospitals.length > 0 && tableSelectedHospitals.length === 0 && (
            <div className="mt-2 p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl">
              <p className="text-sm text-amber-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Tablo verisi görüntülemek için en az bir hastane seçmelisiniz
              </p>
            </div>
          )}
        </div>

        {/* Tablo */}
        {tableDates.length > 0 && tableData.length > 0 ? (
          <div className="mt-4">
            <GreenAreaDailyRateTable
              ref={dailyTableRef}
              data={tableData}
              selectedDates={tableDates}
              onCopy={() => showToast('Tablo panoya kopyalandı', 'success')}
              showProvinceTotals={hasAllHospitalsAccess}
            />
          </div>
        ) : (
          <div className="mt-4 p-8 text-center">
            <div className="text-slate-400">
              Tablo için tarih aralığı seçin ve "Uygula" butonuna tıklayın
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Hospital Card Component
interface HospitalDailyDetail {
  date: string;
  greenAreaCount: number;
  totalCount: number;
  greenAreaRate: number;
}

interface HospitalCardProps {
  data: GreenAreaData;
  isIlGeneli: boolean;
  dailyDetails?: HospitalDailyDetail[];
}

const HospitalCard: React.FC<HospitalCardProps> = ({ data, isIlGeneli, dailyDetails = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shortName = isIlGeneli ? data.hospitalName : getShortName(data.hospitalName);
  const progressColor = getProgressColor(data.greenAreaRate);
  const textColor = getTextColor(data.greenAreaRate);

  // Tarihleri sırala
  const sortedDetails = [...dailyDetails].sort((a, b) => a.date.localeCompare(b.date));

  // Tarih formatla (gün/ay)
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}`;
  };

  // Oran için renk (koyu tema)
  const getRateColor = (rate: number): string => {
    if (rate >= 70) return 'bg-emerald-500/20 text-emerald-400';
    if (rate >= 60) return 'bg-yellow-500/20 text-yellow-400';
    if (rate >= 50) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className={`bg-slate-700/40 rounded-2xl shadow-sm border border-slate-600/50 p-5 ${isIlGeneli ? 'col-span-1 md:col-span-2 lg:col-span-1 ring-2 ring-emerald-500/50' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIlGeneli ? 'bg-emerald-500/20' : 'bg-slate-600/50'}`}>
          <svg className={`w-5 h-5 ${isIlGeneli ? 'text-emerald-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className={`font-bold ${isIlGeneli ? 'text-emerald-400' : 'text-white'}`}>{shortName}</h3>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Toplam Hasta</span>
          <span className="font-bold text-white">{data.totalCount.toLocaleString('tr-TR')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Yeşil Alan</span>
          <span className="font-bold text-white">{data.greenAreaCount.toLocaleString('tr-TR')}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Yeşil Alan Oranı</span>
          <span className={`font-bold text-lg ${textColor}`}>%{data.greenAreaRate.toFixed(1)}</span>
        </div>
        <div className="h-2 bg-slate-600/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(data.greenAreaRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Günlük Detay Accordion */}
      {dailyDetails.length > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-600/50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Günlük Detay ({dailyDetails.length} gün)
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isExpanded && (
            <div className="mt-3 -mx-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-600/30">
                    <th className="sticky left-0 bg-slate-600/30 px-2 py-1.5 text-left font-semibold text-slate-300 whitespace-nowrap">Tarih</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-300 whitespace-nowrap">Yeşil Alan</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-300 whitespace-nowrap">Toplam</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-300 whitespace-nowrap">Oran</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDetails.map((detail, idx) => (
                    <tr key={detail.date} className={idx % 2 === 0 ? 'bg-slate-700/30' : 'bg-slate-700/10'}>
                      <td className="sticky left-0 bg-inherit px-2 py-1.5 font-medium text-slate-300 whitespace-nowrap">
                        {formatDate(detail.date)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-400 whitespace-nowrap">
                        {detail.greenAreaCount.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-400 whitespace-nowrap">
                        {detail.totalCount.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getRateColor(detail.greenAreaRate)}`}>
                          %{detail.greenAreaRate.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmergencyService;
