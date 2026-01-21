import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  uploadActiveDemandFile,
  getDemandSummary,
  getAvailableDateParts,
  getAvailableActiveDemandDates,
  getActiveDemandFiles
} from '../src/services/activeDemandStorage';
import { DemandSummary, BranchDemand } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import DateRangeCalendar, { DateRange } from './DateRangeCalendar';
import { HOSPITALS } from '../constants';

interface ActiveDemandProps {
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  canUpload?: boolean;
}

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Aktif Talep modülüne özel ek hastaneler (ADSH ve ADSM'ler)
const ACTIVE_DEMAND_EXTRA_HOSPITALS = [
  'Şanlıurfa ADSH',
  'Haliliye ADSH',
  'Eyyübiye ADSM',
  'Siverek ADSM'
];

// Aktif Talep modülü için TÜM hastaneler (normal + ek)
const ACTIVE_DEMAND_ALL_HOSPITALS = [...HOSPITALS, ...ACTIVE_DEMAND_EXTRA_HOSPITALS];

// Hastane kisa adlari mapping (uzun isimlerden kısa isimlere)
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

const getShortName = (fullName: string): string => {
  // Önce mapping'de ara
  if (hospitalShortNames[fullName]) {
    return hospitalShortNames[fullName];
  }
  // Zaten kısa ad ise (HOSPITALS veya ACTIVE_DEMAND_ALL_HOSPITALS listesinde varsa) doğrudan döndür
  if (ACTIVE_DEMAND_ALL_HOSPITALS.includes(fullName)) {
    return fullName;
  }
  // Son çare: dönüştürme yap
  return fullName.replace('Şanlıurfa ', '').replace(' Devlet Hastanesi', ' DH');
};

// Grafik renkleri - yan yana gelen renkler birbirine zıt olacak şekilde sıralandı
const CHART_COLORS = [
  '#22c55e', // Yeşil
  '#ef4444', // Kırmızı (yeşilin zıttı)
  '#3b82f6', // Mavi
  '#f97316', // Turuncu (mavinin zıttı)
  '#a855f7', // Mor
  '#eab308', // Sarı (morun zıttı)
  '#ec4899', // Pembe
  '#14b8a6', // Teal (pembenin zıttı)
  '#06b6d4', // Cyan
  '#f43f5e', // Rose (cyanın zıttı)
  '#84cc16', // Lime
  '#8b5cf6', // Lavanta (limeın zıttı)
  '#10b981', // Zümrüt
  '#d946ef', // Fuşya (zümrütün zıttı)
];

const ActiveDemand: React.FC<ActiveDemandProps> = ({
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  canUpload = false,
}) => {
  // Upload için state'ler
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadHospitalId, setUploadHospitalId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHospitalDropdownOpen, setUploadHospitalDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);

  // Filtre state'leri - EmergencyService ile aynı mantık
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Record<number, number[]>>({});
  const [availableDays, setAvailableDays] = useState<Record<string, number[]>>({});
  const [allDates, setAllDates] = useState<string[]>([]);

  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  // Hastane filtresi
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);

  // Veri state'leri
  const [summary, setSummary] = useState<DemandSummary | null>(null);
  const [selectedDatesForDisplay, setSelectedDatesForDisplay] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // PDF export refs - sayfa 1: KPI + grafikler, sayfa 2: hastane detayları
  const contentRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  // Bireysel bileşen ref'leri (PNG export için)
  const kpi1Ref = useRef<HTMLDivElement>(null);
  const kpi2Ref = useRef<HTMLDivElement>(null);
  const donutChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  // Hastane kartları için dinamik ref'ler
  const hospitalCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Kullanıcının yetkili olduğu hastaneler (kısa ad formatında)
  // Aktif Talep modülünde ek hastaneleri de dahil et
  const authorizedHospitalShortNames = useMemo(() => {
    if (allowedHospitals.length === 0) {
      // Tüm hastaneler + ek hastaneler (ADSH/ADSM)
      return ACTIVE_DEMAND_ALL_HOSPITALS;
    }
    // Kullanıcının yetkili olduğu hastaneler + ek hastaneler
    return [...allowedHospitals, ...ACTIVE_DEMAND_EXTRA_HOSPITALS];
  }, [allowedHospitals]);

  // Kullanıcının TÜM hastanelere yetkisi var mı?
  const hasAllHospitalsAccess = useMemo(() => {
    return allowedHospitals.length === 0 || allowedHospitals.length >= HOSPITALS.length;
  }, [allowedHospitals]);

  // Mevcut tarihleri yükle
  useEffect(() => {
    loadDateParts();
  }, []);

  // Upload dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target as Node)) {
        setUploadHospitalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDateParts = async () => {
    const parts = await getAvailableDateParts();
    setAvailableYears(parts.years);
    setAvailableMonths(parts.monthsByYear);
    setAvailableDays(parts.daysByYearMonth);

    const dates = await getAvailableActiveDemandDates();
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

  // Takvim için müsait tarihler
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

    // Tarih aralığı seçiliyse
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

    // Sadece yıl ve ay seçiliyse
    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);

      if (!selectedYears.includes(year)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return false;

      return true;
    });
  };

  // Toast gösterimi
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Hastane yetkisi kontrolü
  const isHospitalAuthorized = (hospitalName: string): boolean => {
    const shortName = getShortName(hospitalName);
    if (allowedHospitals.length === 0) return true;
    if (selectedHospitals.length > 0) {
      return selectedHospitals.includes(shortName);
    }
    return allowedHospitals.includes(shortName);
  };

  // Veri yükle
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
      // İlk tarih için özet yükle (şimdilik tek tarih destekli)
      const targetDate = matchingDates[0];
      const data = await getDemandSummary(targetDate);

      if (data) {
        // Yetkili hastanelere göre filtrele
        const filteredHospitals = data.hospitalSummaries.filter(h => isHospitalAuthorized(h.hospitalName));

        // Filtrelenmiş veriye göre branş toplamlarını yeniden hesapla
        const branchTotalsMap: Record<string, number> = {};
        let filteredTotalDemand = 0;

        filteredHospitals.forEach(hospital => {
          filteredTotalDemand += hospital.totalDemand;
          hospital.branches.forEach(branch => {
            if (!branchTotalsMap[branch.branchName]) {
              branchTotalsMap[branch.branchName] = 0;
            }
            branchTotalsMap[branch.branchName] += branch.demandCount;
          });
        });

        const filteredBranchTotals: BranchDemand[] = Object.entries(branchTotalsMap)
          .map(([branchName, demandCount]) => ({ branchName, demandCount }))
          .sort((a, b) => b.demandCount - a.demandCount);

        const filteredSummary: DemandSummary = {
          totalProvinceDemand: filteredTotalDemand,
          totalHospitals: filteredHospitals.length,
          branchTotals: filteredBranchTotals,
          hospitalSummaries: filteredHospitals
        };

        setSummary(filteredSummary);
        setSelectedDatesForDisplay(matchingDates);
        showToast(`${matchingDates.length} tarihten ${filteredHospitals.length} hastane verisi yüklendi`, 'success');
      } else {
        setSummary(null);
        showToast('Seçilen tarih için veri bulunamadı', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Veri yükleme hatası', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Dosya yükleme
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadHospitalId) {
      showToast('Lütfen hastane seçin', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const hospitalName = HOSPITALS.find(h => h.includes(uploadHospitalId)) || uploadHospitalId;
      const result = await uploadActiveDemandFile(file, uploadHospitalId, hospitalName, uploadDate, 'user');

      if (result.success) {
        showToast(`${result.totalDemand} talep verisi yüklendi`, 'success');
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

  // Yıl değişimi handler
  const handleYearsChange = (values: (string | number)[]) => {
    const newYears = values.map(v => Number(v));
    setSelectedYears(newYears);

    if (newYears.length === 0) {
      setSelectedMonths([]);
      setActiveMonth(null);
      setDateRange({ start: null, end: null });
    } else {
      const validMonths = new Set<number>();
      newYears.forEach(year => {
        (availableMonths[year] || []).forEach(m => validMonths.add(m));
      });
      const newMonths = selectedMonths.filter(m => validMonths.has(m));
      if (newMonths.length !== selectedMonths.length) {
        setSelectedMonths(newMonths);
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

    if (newMonths.length === 0) {
      setActiveMonth(null);
      setDateRange({ start: null, end: null });
    } else {
      const lastMonth = newMonths[newMonths.length - 1];
      setActiveMonth(lastMonth);
      setDateRange({ start: null, end: null });
    }
  };

  // Hastane seçimi handler
  const handleHospitalsChange = (values: (string | number)[]) => {
    setSelectedHospitals(values.map(v => String(v)));
  };

  // PDF export - 2 sayfa: Sayfa 1 = KPI + Grafikler, Sayfa 2 = Hastane Detayları
  const handleExportPdf = async () => {
    if (!page1Ref.current || !page2Ref.current || !summary) return;

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Sayfa 1: KPI kartları ve grafikler
      const canvas1 = await html2canvas(page1Ref.current, {
        backgroundColor: '#1e293b', // slate-800
        scale: 2,
        useCORS: true,
      });

      const imgData1 = canvas1.toDataURL('image/png');
      const aspectRatio1 = canvas1.width / canvas1.height;

      let imgWidth1 = contentWidth;
      let imgHeight1 = imgWidth1 / aspectRatio1;

      if (imgHeight1 > contentHeight) {
        imgHeight1 = contentHeight;
        imgWidth1 = imgHeight1 * aspectRatio1;
      }

      const x1 = margin + (contentWidth - imgWidth1) / 2;
      const y1 = margin + (contentHeight - imgHeight1) / 2;

      pdf.addImage(imgData1, 'PNG', x1, y1, imgWidth1, imgHeight1);

      // Sayfa 2: Hastane detayları
      pdf.addPage();

      const canvas2 = await html2canvas(page2Ref.current, {
        backgroundColor: '#1e293b', // slate-800
        scale: 2,
        useCORS: true,
      });

      const imgData2 = canvas2.toDataURL('image/png');
      const aspectRatio2 = canvas2.width / canvas2.height;

      let imgWidth2 = contentWidth;
      let imgHeight2 = imgWidth2 / aspectRatio2;

      if (imgHeight2 > contentHeight) {
        imgHeight2 = contentHeight;
        imgWidth2 = imgHeight2 * aspectRatio2;
      }

      const x2 = margin + (contentWidth - imgWidth2) / 2;
      const y2 = margin + (contentHeight - imgHeight2) / 2;

      pdf.addImage(imgData2, 'PNG', x2, y2, imgWidth2, imgHeight2);

      const dateStr = selectedDatesForDisplay.length === 1
        ? selectedDatesForDisplay[0]
        : `${selectedDatesForDisplay.length}-tarih`;
      pdf.save(`aktif-talep-raporu-${dateStr}.pdf`);
      showToast('PDF indirildi', 'success');
    } catch (error) {
      console.error('PDF hatası:', error);
      showToast('PDF indirme hatası', 'error');
    }
  };

  // PNG export - Sayfa 1 (KPI + Grafikler)
  const handleExportPng = async () => {
    if (!page1Ref.current || !summary) return;

    try {
      const canvas = await html2canvas(page1Ref.current, {
        backgroundColor: '#0f172a', // slate-900
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `aktif-talep-ozet-${selectedDatesForDisplay.length === 1 ? selectedDatesForDisplay[0] : `${selectedDatesForDisplay.length}-tarih`}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG indirildi', 'success');
    } catch (error) {
      console.error('PNG hatası:', error);
      showToast('PNG indirme hatası', 'error');
    }
  };

  // Bireysel bileşen PNG export
  const handleExportComponent = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;

    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#1e293b', // slate-800
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `${filename}-${selectedDatesForDisplay.length === 1 ? selectedDatesForDisplay[0] : `${selectedDatesForDisplay.length}-tarih`}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG indirildi', 'success');
    } catch (error) {
      console.error('PNG hatası:', error);
      showToast('PNG indirme hatası', 'error');
    }
  };

  // Hastane kartı PNG export (dinamik ref için)
  const handleExportHospitalCard = async (idx: number, hospitalName: string) => {
    const element = hospitalCardRefs.current.get(idx);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#1e293b', // slate-800
        scale: 2,
        useCORS: true,
      });

      const safeName = hospitalName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, '-').toLowerCase();
      const link = document.createElement('a');
      link.download = `${safeName}-talep-${selectedDatesForDisplay.length === 1 ? selectedDatesForDisplay[0] : `${selectedDatesForDisplay.length}-tarih`}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG indirildi', 'success');
    } catch (error) {
      console.error('PNG hatası:', error);
      showToast('PNG indirme hatası', 'error');
    }
  };

  // Dropdown options
  const yearOptions: DropdownOption[] = useMemo(() =>
    availableYears.map(year => ({ value: year, label: String(year) })),
    [availableYears]
  );

  const monthOptions: DropdownOption[] = useMemo(() =>
    displayableMonths().map(month => ({ value: month, label: MONTH_NAMES[month] })),
    [selectedYears, availableMonths]
  );

  const hospitalOptions: DropdownOption[] = useMemo(() =>
    authorizedHospitalShortNames.map(h => ({ value: h, label: h })).sort((a, b) => a.label.localeCompare(b.label, 'tr-TR')),
    [authorizedHospitalShortNames]
  );

  const uploadHospitalOptions: DropdownOption[] = useMemo(() =>
    ACTIVE_DEMAND_ALL_HOSPITALS.map(h => ({ value: h, label: h })).sort((a, b) => a.label.localeCompare(b.label, 'tr-TR')),
    []
  );

  // Tarih gösterimi
  const getDateRangeDisplay = (): string => {
    if (selectedDatesForDisplay.length === 0) return '';
    if (selectedDatesForDisplay.length === 1) {
      const d = new Date(selectedDatesForDisplay[0]);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
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
          <h1 className="text-2xl font-bold text-orange-400">Aktif Talep Analizi</h1>
          <p className="text-slate-400 mt-1">Hastanelerin branş bazlı aktif talep verileri</p>
        </div>
        {summary && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPng}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              PNG İndir
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
          </div>
        )}
      </div>

      {/* Veri Yükleme Bölümü */}
      {canUpload && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Veri Yükleme</h3>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Hastane Seçimi - Custom Dropdown */}
            <div className="flex flex-col gap-1.5" ref={uploadDropdownRef}>
              <label className="text-sm font-medium text-slate-400">Hastane</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUploadHospitalDropdownOpen(!uploadHospitalDropdownOpen)}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[200px] text-left"
                >
                  <span className={uploadHospitalId ? 'text-white' : 'text-slate-400'}>
                    {uploadHospitalId || 'Hastane seçiniz...'}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${uploadHospitalDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {uploadHospitalDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-[280px] overflow-y-auto">
                    {uploadHospitalOptions.map(opt => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => {
                          setUploadHospitalId(String(opt.value));
                          setUploadHospitalDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2 ${uploadHospitalId === opt.value ? 'bg-orange-500/20 text-orange-400' : 'text-slate-200'}`}
                      >
                        {uploadHospitalId === opt.value && (
                          <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span className={uploadHospitalId === opt.value ? '' : 'ml-6'}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Yükleme için Tarih Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Yükleme Tarihi</label>
              <input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                disabled={isUploading || !uploadDate || !uploadHospitalId}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <span className="font-semibold">Excel Formatı:</span> Tek sütun - "Klinik Adı" (her satır 1 talep, aynı branş tekrarlanıyorsa talep sayısı artar)
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
              <span className="text-sm text-orange-400 font-medium bg-orange-500/20 px-3 py-1 rounded-full">
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
                  setSelectedHospitals([]);
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
          {/* Hastane Seçimi - Sadece belirli hastanelere yetkisi varsa göster */}
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
                onChange={(e) => {
                  setActiveMonth(Number(e.target.value));
                  setDateRange({ start: null, end: null });
                }}
                className="px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[140px]"
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
            onChange={setDateRange}
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
            className="px-6 py-2.5 h-[42px] bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
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

      {/* Veri Yok Mesajı */}
      {!summary && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Veri Gösterimi */}
      {summary && (
        <div ref={contentRef} className="space-y-6">
          {/* SAYFA 1: KPI Kartları ve Grafikler */}
          <div ref={page1Ref} className="space-y-6 bg-slate-900 p-4 rounded-2xl">
          {/* KPI Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toplam Talep */}
            <div ref={kpi1Ref} className="bg-slate-800/80 rounded-2xl border-2 border-orange-500/50 p-6 shadow-lg shadow-orange-500/10 relative group">
              {/* İndirme ikonu */}
              <button
                onClick={() => handleExportComponent(kpi1Ref, 'toplam-talep')}
                className="absolute top-3 right-3 w-7 h-7 bg-slate-700/80 hover:bg-orange-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md"
                title="PNG İndir"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-300">
                    {summary.totalHospitals === 1
                      ? getShortName(summary.hospitalSummaries[0]?.hospitalName || '')
                      : hasAllHospitalsAccess
                        ? 'İl Toplam Talep'
                        : 'Seçili Toplam Talep'}
                  </p>
                  <p className="text-3xl font-bold text-orange-400">{summary.totalProvinceDemand.toLocaleString('tr-TR')}</p>
                </div>
              </div>
            </div>

            {/* En Yüksek Branş */}
            <div ref={kpi2Ref} className="bg-slate-800/80 rounded-2xl border-2 border-purple-500/50 p-6 shadow-lg shadow-purple-500/10 relative group">
              {/* İndirme ikonu */}
              <button
                onClick={() => handleExportComponent(kpi2Ref, 'en-yuksek-brans')}
                className="absolute top-3 right-3 w-7 h-7 bg-slate-700/80 hover:bg-purple-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md"
                title="PNG İndir"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-300">En Yüksek Talep</p>
                  <p className="text-lg font-bold text-purple-400">
                    {summary.branchTotals[0]?.branchName || '-'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {summary.branchTotals[0]?.demandCount.toLocaleString('tr-TR') || 0} talep
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grafikler - Yan yana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hastane Bazlı Donut Chart */}
            <div ref={donutChartRef} className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6 relative group">
              {/* İndirme ikonu */}
              <button
                onClick={() => handleExportComponent(donutChartRef, 'hastane-dagilimi')}
                className="absolute top-3 right-3 w-7 h-7 bg-slate-700/80 hover:bg-emerald-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md z-10"
                title="PNG İndir"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <h3 className="text-lg font-semibold text-white mb-4">Hastane Bazlı Talep Dağılımı</h3>
              <div className="flex items-center gap-4">
                {/* Grafik - daha büyük */}
                <div className="h-[320px] flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.totalHospitals === 1
                          ? [{
                              name: getShortName(summary.hospitalSummaries[0]?.hospitalName || ''),
                              value: summary.hospitalSummaries[0]?.totalDemand || 0,
                              fill: CHART_COLORS[0]
                            }]
                          : summary.hospitalSummaries
                              .filter(item => item.totalDemand >= 100)
                              .sort((a, b) => b.totalDemand - a.totalDemand)
                              .map((item, idx) => ({
                                name: getShortName(item.hospitalName),
                                value: item.totalDemand,
                                fill: CHART_COLORS[idx % CHART_COLORS.length]
                              }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={130}
                        paddingAngle={summary.totalHospitals === 1 ? 0 : 2}
                        dataKey="value"
                      >
                        {summary.totalHospitals === 1
                          ? <Cell key="cell-0" fill={CHART_COLORS[0]} />
                          : summary.hospitalSummaries
                              .filter(item => item.totalDemand >= 100)
                              .sort((a, b) => b.totalDemand - a.totalDemand)
                              .map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const hospitalName = data.name;
                          const totalDemand = data.value as number;
                          const color = data.fill;

                          // Bu hastanenin branş detaylarını bul
                          const hospitalData = summary.hospitalSummaries.find(
                            h => getShortName(h.hospitalName) === hospitalName
                          );
                          const topBranches = hospitalData?.branches
                            .sort((a, b) => b.demandCount - a.demandCount)
                            .slice(0, 5) || [];

                          return (
                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-600">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                                <p className="font-semibold text-white">{hospitalName}</p>
                              </div>
                              <p className="text-orange-400 font-bold mb-2">
                                {totalDemand.toLocaleString('tr-TR')} talep
                              </p>
                              {topBranches.length > 0 && (
                                <>
                                  <p className="text-xs text-slate-400 mb-1">En Yüksek Talepler:</p>
                                  <div className="space-y-0.5">
                                    {topBranches.map((b, i) => (
                                      <div key={i} className="flex justify-between text-xs">
                                        <span className="text-slate-300">{b.branchName}</span>
                                        <span className="text-white font-medium ml-2">{b.demandCount.toLocaleString('tr-TR')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Sağ taraftaki sıralı liste */}
                <div className="w-[220px] flex-shrink-0 space-y-1.5 max-h-[320px] overflow-y-auto">
                  {(summary.totalHospitals === 1 ? summary.hospitalSummaries : summary.hospitalSummaries.filter(item => item.totalDemand >= 100))
                    .sort((a, b) => b.totalDemand - a.totalDemand)
                    .map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-700/30 transition-colors">
                        <div
                          className="w-3 h-3 rounded flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="text-xs text-slate-300 flex-1 whitespace-nowrap">{getShortName(item.hospitalName)}</span>
                        <span className="text-xs font-bold text-white">{item.totalDemand.toLocaleString('tr-TR')}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Branş Bazlı Yatay Bar Chart */}
            <div ref={barChartRef} className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6 relative group">
              {/* İndirme ikonu */}
              <button
                onClick={() => handleExportComponent(barChartRef, 'brans-dagilimi')}
                className="absolute top-3 right-3 w-7 h-7 bg-slate-700/80 hover:bg-blue-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md z-10"
                title="PNG İndir"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <h3 className="text-lg font-semibold text-white mb-4">Branş Bazlı Talep Dağılımı</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.branchTotals.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="branchName"
                      stroke="#9ca3af"
                      tick={{ fontSize: 10, fill: '#e2e8f0' }}
                      width={150}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const branchName = payload[0].payload.branchName;
                        const totalDemand = payload[0].value as number;

                        // Bu branşa sahip hastaneleri bul
                        const hospitalDetails = summary.hospitalSummaries
                          .map(h => {
                            const branch = h.branches.find(b => b.branchName === branchName);
                            return branch ? { name: getShortName(h.hospitalName), count: branch.demandCount } : null;
                          })
                          .filter(Boolean)
                          .sort((a, b) => (b?.count || 0) - (a?.count || 0)) as { name: string; count: number }[];

                        return (
                          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl max-w-[280px]">
                            <p className="font-semibold text-white mb-2 border-b border-slate-600 pb-2">
                              {branchName}
                            </p>
                            <p className="text-orange-400 font-bold mb-3">
                              Toplam: {totalDemand.toLocaleString('tr-TR')} talep
                            </p>
                            <p className="text-xs text-slate-400 mb-1">Hastane Dağılımı:</p>
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                              {hospitalDetails.map((h, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-slate-300">{h.name}</span>
                                  <span className="text-white font-medium ml-3">{h.count.toLocaleString('tr-TR')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="demandCount" radius={[0, 4, 4, 0]}>
                      {summary.branchTotals.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          </div>
          {/* SAYFA 1 SONU */}

          {/* SAYFA 2: Hastane Bazlı Detaylar */}
          <div ref={page2Ref} className="space-y-4 bg-slate-900 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Hastane Bazlı Talep Detayları</h3>
              <p className="text-sm text-slate-400">Tarih: {getDateRangeDisplay()}</p>
            </div>

            {/* İl Toplamı Özet Kartı */}
            {hasAllHospitalsAccess && (
              <div className="bg-slate-800/80 rounded-2xl border-2 border-orange-500/50 p-5 shadow-lg shadow-orange-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-300">
                        {summary.totalHospitals === 1
                          ? getShortName(summary.hospitalSummaries[0]?.hospitalName || '') + ' TOPLAM'
                          : 'İL GENELİ TOPLAM'}
                      </p>
                      <p className="text-2xl font-bold text-orange-400">{summary.totalProvinceDemand.toLocaleString('tr-TR')} Talep</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {summary.totalHospitals > 1 && (
                      <p className="text-sm font-medium text-slate-300">{summary.totalHospitals} Hastane</p>
                    )}
                    <p className="text-sm font-medium text-slate-300">{summary.branchTotals.length} Branş</p>
                  </div>
                </div>
              </div>
            )}

            {/* Her hastane için ayrı tablo */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summary.hospitalSummaries
                .sort((a, b) => b.totalDemand - a.totalDemand)
                .map((hospital, idx) => (
                <div
                  key={idx}
                  ref={(el) => {
                    if (el) hospitalCardRefs.current.set(idx, el);
                    else hospitalCardRefs.current.delete(idx);
                  }}
                  className="bg-slate-800/50 rounded-xl border border-slate-700/60 overflow-hidden relative group"
                >
                  {/* İndirme ikonu */}
                  <button
                    onClick={() => handleExportHospitalCard(idx, getShortName(hospital.hospitalName))}
                    className="absolute top-2 right-2 w-6 h-6 bg-slate-600/80 hover:bg-orange-500 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md z-10"
                    title="PNG İndir"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  {/* Hastane Başlığı */}
                  <div className="bg-slate-700/40 px-4 py-3 border-b border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">{getShortName(hospital.hospitalName)}</h4>
                      <span className="text-lg font-bold text-orange-400">{hospital.totalDemand.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>

                  {/* Branş Listesi */}
                  <div className="p-3">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-medium text-slate-400 pb-2">Branş</th>
                          <th className="text-right text-xs font-medium text-slate-400 pb-2">Talep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hospital.branches
                          .sort((a, b) => b.demandCount - a.demandCount)
                          .map((branch, bIdx) => (
                          <tr key={bIdx} className={bIdx % 2 === 0 ? 'bg-slate-800/30' : ''}>
                            <td className="py-1.5 px-2 text-sm text-slate-300 rounded-l">{branch.branchName}</td>
                            <td className="py-1.5 px-2 text-sm text-white text-right font-medium rounded-r">{branch.demandCount.toLocaleString('tr-TR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveDemand;
