import React, { useState, useRef, useEffect, useMemo } from 'react';
import { uploadGreenAreaFile, loadMultipleDatesData, getAvailableDateParts, getAvailableGreenAreaDates, GreenAreaData, getGreenAreaFiles } from '../src/services/greenAreaStorage';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import DateRangeCalendar, { DateRange } from './DateRangeCalendar';
import GreenAreaDailyRateTable, { GreenAreaDailyRateTableRef } from './GreenAreaDailyRateTable';

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
  'Şanlıurfa Sağlık Bilimleri Üniversitesi Mehmet Akif İnan EAH': 'Şanlıurfa EAH',
  'Şanlıurfa Eğitim ve Araştırma Hastanesi': 'Mehmet Akif İnan EAH',
};

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const getShortName = (fullName: string): string => {
  return hospitalShortNames[fullName] || fullName.replace('Şanlıurfa ', '').replace(' Devlet Hastanesi', ' DH');
};

// Progress bar rengi belirleme - %60 altı kırmızı, %60 ve üzeri yeşil
const getProgressColor = (rate: number): string => {
  if (rate >= 60) return 'bg-emerald-500';
  return 'bg-red-500';
};

const getTextColor = (rate: number): string => {
  if (rate >= 60) return 'text-emerald-600';
  return 'text-red-600';
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

  const handleLoadData = async () => {
    const matchingDates = getMatchingDates();
    if (matchingDates.length === 0) {
      showToast('Seçimlere uygun tarih bulunamadı', 'error');
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
            dailyDataArr.push({
              date,
              hospitalName: hospital.hospitalName,
              greenAreaCount: hospital.greenAreaCount,
              totalCount: hospital.totalCount,
              greenAreaRate: hospital.greenAreaRate
            });
          });
        }
      });

      if (loadedData) {
        setData(loadedData);
        setDailyData(dailyDataArr);
        setSelectedDatesForDisplay(matchingDates);
        showToast(`${matchingDates.length} tarihten ${loadedData.length} hastane verisi yüklendi`, 'success');
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

      // Export için geçici olarak açık tema uygula
      const originalClasses = container.className;
      container.className = container.className
        .replace(/bg-slate-800\/50/g, 'bg-white')
        .replace(/border-slate-700\/60/g, 'border-slate-200')
        .replace(/border-slate-700/g, 'border-slate-200')
        .replace(/text-white/g, 'text-slate-800')
        .replace(/text-slate-400/g, 'text-slate-600')
        .replace(/text-slate-300/g, 'text-slate-700')
        .replace(/bg-slate-700\/30/g, 'bg-slate-100');

      // İç elementlere de açık tema uygula
      const allElements = container.querySelectorAll('*');
      const originalStyles: { el: Element; classes: string }[] = [];

      allElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({ el, classes: htmlEl.className });
        htmlEl.className = htmlEl.className
          .replace(/bg-slate-800\/50/g, 'bg-white')
          .replace(/bg-slate-800\/30/g, 'bg-slate-50')
          .replace(/bg-slate-700\/50/g, 'bg-slate-100')
          .replace(/bg-slate-700\/30/g, 'bg-slate-50')
          .replace(/bg-slate-700\/20/g, 'bg-slate-50')
          .replace(/bg-slate-600\/50/g, 'bg-slate-100')
          .replace(/bg-slate-600\/30/g, 'bg-slate-50')
          .replace(/bg-slate-600\/20/g, 'bg-slate-50')
          .replace(/border-slate-700\/60/g, 'border-slate-200')
          .replace(/border-slate-700\/50/g, 'border-slate-200')
          .replace(/border-slate-700/g, 'border-slate-200')
          .replace(/border-slate-600\/60/g, 'border-slate-200')
          .replace(/border-slate-600\/50/g, 'border-slate-200')
          .replace(/border-slate-600/g, 'border-slate-200')
          .replace(/text-white/g, 'text-slate-800')
          .replace(/text-slate-400/g, 'text-slate-600')
          .replace(/text-slate-300/g, 'text-slate-700')
          .replace(/text-emerald-400/g, 'text-emerald-600')
          .replace(/bg-emerald-500\/20/g, 'bg-emerald-100')
          .replace(/bg-emerald-500\/10/g, 'bg-emerald-50');
      });

      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Stilleri geri al
      container.className = originalClasses;
      originalStyles.forEach(({ el, classes }) => {
        (el as HTMLElement).className = classes;
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

      // Export için geçici olarak açık tema uygula
      const originalClasses = container.className;
      container.className = container.className
        .replace(/bg-slate-800\/50/g, 'bg-white')
        .replace(/border-slate-700\/60/g, 'border-slate-200')
        .replace(/border-slate-700/g, 'border-slate-200')
        .replace(/text-white/g, 'text-slate-800')
        .replace(/text-slate-400/g, 'text-slate-600')
        .replace(/text-slate-300/g, 'text-slate-700')
        .replace(/bg-slate-700\/30/g, 'bg-slate-100');

      // İç elementlere de açık tema uygula
      const allElements = container.querySelectorAll('*');
      const originalStyles: { el: Element; classes: string }[] = [];

      allElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({ el, classes: htmlEl.className });
        htmlEl.className = htmlEl.className
          .replace(/bg-slate-800\/50/g, 'bg-white')
          .replace(/bg-slate-800\/30/g, 'bg-slate-50')
          .replace(/bg-slate-700\/50/g, 'bg-slate-100')
          .replace(/bg-slate-700\/30/g, 'bg-slate-50')
          .replace(/bg-slate-700\/20/g, 'bg-slate-50')
          .replace(/bg-slate-600\/50/g, 'bg-slate-100')
          .replace(/bg-slate-600\/30/g, 'bg-slate-50')
          .replace(/bg-slate-600\/20/g, 'bg-slate-50')
          .replace(/border-slate-700\/60/g, 'border-slate-200')
          .replace(/border-slate-700\/50/g, 'border-slate-200')
          .replace(/border-slate-700/g, 'border-slate-200')
          .replace(/border-slate-600\/60/g, 'border-slate-200')
          .replace(/border-slate-600\/50/g, 'border-slate-200')
          .replace(/border-slate-600/g, 'border-slate-200')
          .replace(/text-white/g, 'text-slate-800')
          .replace(/text-slate-400/g, 'text-slate-600')
          .replace(/text-slate-300/g, 'text-slate-700')
          .replace(/text-emerald-400/g, 'text-emerald-600')
          .replace(/bg-emerald-500\/20/g, 'bg-emerald-100')
          .replace(/bg-emerald-500\/10/g, 'bg-emerald-50');
      });

      // Sayfa 1: Kartlar
      const cardsCanvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      // Stilleri geri al
      container.className = originalClasses;
      originalStyles.forEach(({ el, classes }) => {
        (el as HTMLElement).className = classes;
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

      // Sayfa 2: Günlük tablo (eğer varsa)
      const tableElement = dailyTableRef.current?.getTableElement();
      if (tableElement && selectedDatesForDisplay.length > 1) {
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

      {/* Veri Yükleme Bölümü */}
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
            disabled={isLoading || getMatchingDates().length === 0}
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

          <div ref={cardsContainerRef} className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/60">
            {/* Header for PNG */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {/* İl Geneli Card - First and Larger */}
              {ilGeneli && (
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
            <div className="mt-8 pt-4 border-t border-slate-700">
              <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-300 font-medium">
                  Yeşil Alan Oranı Hesaplama Formülü: <span className="text-emerald-400">Yeşil Alan Hasta Sayısı / Acil Servise Başvuran Toplam Hasta Sayısı X 100</span>
                </p>
                {ilGeneli && (
                  <p className="text-sm text-slate-400 mt-2">
                    Yeşil Alan Oranı Hesaplama Formülü: <span className="font-semibold text-white">{ilGeneli.greenAreaCount.toLocaleString('tr-TR')} / {ilGeneli.totalCount.toLocaleString('tr-TR')} x 100 = %{ilGeneli.greenAreaRate.toFixed(1)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Günlük Oran Tablosu */}
          {selectedDatesForDisplay.length > 1 && dailyData.length > 0 && (
            <GreenAreaDailyRateTable
              ref={dailyTableRef}
              data={dailyData}
              selectedDates={selectedDatesForDisplay}
              onCopy={() => showToast('Tablo panoya kopyalandı', 'success')}
            />
          )}
        </>
      )}
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

  // Oran için renk (dark tema)
  const getRateColor = (rate: number): string => {
    if (rate >= 70) return 'bg-emerald-500/20 text-emerald-400';
    if (rate >= 60) return 'bg-yellow-500/20 text-yellow-400';
    if (rate >= 50) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className={`bg-slate-700/50 rounded-2xl shadow-sm border border-slate-600/60 p-5 ${isIlGeneli ? 'col-span-1 md:col-span-2 lg:col-span-1 ring-2 ring-emerald-500/30' : ''}`}>
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
                    <tr key={detail.date} className={idx % 2 === 0 ? 'bg-slate-700/30' : 'bg-slate-600/20'}>
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
