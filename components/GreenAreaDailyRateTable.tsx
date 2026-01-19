import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import Sparkline from './Sparkline';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { getAvailableDateParts, getAvailableGreenAreaDates, getGreenAreaFiles } from '../src/services/greenAreaStorage';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import DateRangeCalendar, { DateRange } from './DateRangeCalendar';

interface DailyData {
  date: string; // YYYY-MM-DD
  hospitalName: string;
  greenAreaCount: number;
  totalCount: number;
  greenAreaRate: number;
}

interface GreenAreaDailyRateTableProps {
  onCopy?: () => void;
}

export interface GreenAreaDailyRateTableRef {
  getTableElement: () => HTMLDivElement | null;
}

interface HospitalDailyRow {
  hospitalName: string;
  dailyRates: Record<string, number | null>; // date -> rate
  trend: (number | null)[];
}

// Hastane adını kısalt
const getShortHospitalName = (fullName: string): string => {
  // Özel durum: Sağlık Bilimleri Üniversitesi Mehmet Akif İnan -> Mehmet Akif İnan EAH
  if (fullName.includes('Sağlık Bilimleri Üni') || fullName.includes('Mehmet Akif İnan')) {
    return 'Mehmet Akif İnan EAH';
  }

  // Özel durum: Şanlıurfa Eğitim ve Araştırma Hastanesi -> Şanlıurfa EAH
  if (fullName.includes('Eğitim ve Araştırma')) {
    return 'Şanlıurfa EAH';
  }

  let name = fullName
    .replace(/Şanlıurfa\s*/gi, '')
    .replace(/Devlet Hastanesi/gi, 'DH')
    .replace(/İlçe Hastanesi/gi, 'DH')
    .trim();

  return name;
};

// Öncelikli hastaneler (kartlarla aynı sıralama)
const priorityHospitals = [
  'Şanlıurfa EAH',
  'Mehmet Akif İnan EAH',
  'Balıklıgöl DH'
];

// Hastaneleri sırala (kartlarla aynı mantık)
const sortHospitalNames = (hospitalNames: string[]): string[] => {
  return [...hospitalNames].sort((a, b) => {
    const aShort = getShortHospitalName(a);
    const bShort = getShortHospitalName(b);

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

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const GreenAreaDailyRateTable = forwardRef<GreenAreaDailyRateTableRef, GreenAreaDailyRateTableProps>(({
  onCopy
}, ref) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtre state'leri
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Record<number, number[]>>({});
  const [allDates, setAllDates] = useState<string[]>([]);

  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  // Veri state'leri
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dışarıya table element'i expose et
  useImperativeHandle(ref, () => ({
    getTableElement: () => containerRef.current
  }));

  // Load available date parts on mount
  useEffect(() => {
    loadDateParts();
  }, []);

  const loadDateParts = async () => {
    const parts = await getAvailableDateParts();
    setAvailableYears(parts.years);
    setAvailableMonths(parts.monthsByYear);

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

    // Sadece yıl ve ay seçiliyse tüm günleri döndür
    return allDates.filter(dateStr => {
      const [year, month] = dateStr.split('-').map(Number);

      if (!selectedYears.includes(year)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return false;

      return true;
    });
  };

  // Veri yükle
  const handleLoadData = async () => {
    const matchingDates = getMatchingDates();
    if (matchingDates.length === 0) return;

    setIsLoading(true);
    try {
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

      setDailyData(dailyDataArr);
      setSelectedDates(matchingDates);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setIsLoading(false);
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

  // Tarihleri sırala
  const sortedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.localeCompare(b));
  }, [selectedDates]);

  // Tarih formatla (gün/ay)
  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}`;
  };

  // Tarih aralığı gösterimi (başlık için)
  const getDateRangeDisplay = (): string => {
    if (sortedDates.length === 0) return '';
    if (sortedDates.length === 1) {
      const d = new Date(sortedDates[0]);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const first = new Date(sortedDates[0]);
    const last = new Date(sortedDates[sortedDates.length - 1]);
    return `${first.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${last.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Veriyi hastane bazında pivot et
  const { hospitalRows, provinceTotals } = useMemo(() => {
    // Hastane bazında gruplama
    const hospitalMap: Record<string, Record<string, { green: number; total: number }>> = {};

    dailyData.forEach(item => {
      if (!hospitalMap[item.hospitalName]) {
        hospitalMap[item.hospitalName] = {};
      }
      if (!hospitalMap[item.hospitalName][item.date]) {
        hospitalMap[item.hospitalName][item.date] = { green: 0, total: 0 };
      }
      hospitalMap[item.hospitalName][item.date].green += item.greenAreaCount;
      hospitalMap[item.hospitalName][item.date].total += item.totalCount;
    });

    // İl geneli hesapla
    const provinceTotalsByDate: Record<string, { green: number; total: number }> = {};
    sortedDates.forEach(date => {
      provinceTotalsByDate[date] = { green: 0, total: 0 };
    });

    dailyData.forEach(item => {
      if (provinceTotalsByDate[item.date]) {
        provinceTotalsByDate[item.date].green += item.greenAreaCount;
        provinceTotalsByDate[item.date].total += item.totalCount;
      }
    });

    // Hastane satırlarını oluştur (kartlarla aynı sıralama)
    const sortedHospitalNames = sortHospitalNames(Object.keys(hospitalMap));
    const rows: HospitalDailyRow[] = sortedHospitalNames
      .map(hospitalName => {
        const dailyRates: Record<string, number | null> = {};
        const trend: (number | null)[] = [];

        sortedDates.forEach(date => {
          const dayData = hospitalMap[hospitalName][date];
          if (dayData && dayData.total > 0) {
            const rate = (dayData.green / dayData.total) * 100;
            dailyRates[date] = rate;
            trend.push(rate);
          } else {
            dailyRates[date] = null;
            trend.push(null);
          }
        });

        return { hospitalName, dailyRates, trend };
      });

    // İl geneli satırı
    const provinceDailyRates: Record<string, number | null> = {};
    const provinceTrend: (number | null)[] = [];

    sortedDates.forEach(date => {
      const dayTotal = provinceTotalsByDate[date];
      if (dayTotal && dayTotal.total > 0) {
        const rate = (dayTotal.green / dayTotal.total) * 100;
        provinceDailyRates[date] = rate;
        provinceTrend.push(rate);
      } else {
        provinceDailyRates[date] = null;
        provinceTrend.push(null);
      }
    });

    return {
      hospitalRows: rows,
      provinceTotals: {
        hospitalName: 'İL GENELİ',
        dailyRates: provinceDailyRates,
        trend: provinceTrend
      }
    };
  }, [dailyData, sortedDates]);

  // Renk hesapla (oran bazlı) - 65+ yeşil, 60-65 sarı, 60 altı kırmızı (light tema)
  const getRateColor = (rate: number | null): string => {
    if (rate === null) return 'bg-slate-100 text-slate-400';
    if (rate >= 65) return 'bg-emerald-100 text-emerald-700';
    if (rate >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  // PNG olarak indir
  const handlePngExport = async () => {
    if (!containerRef.current) return;

    try {
      const container = containerRef.current;
      const tableWrapper = container.querySelector('.overflow-x-auto') as HTMLElement;
      const table = container.querySelector('table') as HTMLElement;

      // Export için geçici olarak stilleri değiştir
      const originalOverflow = tableWrapper?.style.overflow;
      const originalContainerWidth = container.style.width;
      const originalContainerMinWidth = container.style.minWidth;
      const originalTableWidth = table?.style.width;
      const originalWrapperWidth = tableWrapper?.style.width;

      if (tableWrapper) {
        tableWrapper.style.overflow = 'visible';
        tableWrapper.style.width = 'fit-content';
      }
      if (table) {
        table.style.width = 'auto';
      }
      container.style.width = 'fit-content';
      container.style.minWidth = 'auto';

      // DOM'un yeniden render olmasını bekle
      await new Promise(resolve => setTimeout(resolve, 50));

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      // Stilleri geri al
      if (tableWrapper) {
        tableWrapper.style.overflow = originalOverflow || '';
        tableWrapper.style.width = originalWrapperWidth || '';
      }
      if (table) {
        table.style.width = originalTableWidth || '';
      }
      container.style.width = originalContainerWidth;
      container.style.minWidth = originalContainerMinWidth;

      const link = document.createElement('a');
      link.download = `yesil_alan_gunluk_tablo_${sortedDates[0] || 'rapor'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export hatası:', err);
    }
  };

  // Excel export
  const handleExcelExport = () => {
    const headers = ['Kurum', ...sortedDates.map(formatDateHeader), 'Ortalama'];

    const rows = hospitalRows.map(row => {
      const values = sortedDates.map(date => {
        const rate = row.dailyRates[date];
        return rate !== null ? `%${rate.toFixed(1)}` : '-';
      });
      const validRates = row.trend.filter(r => r !== null) as number[];
      const avg = validRates.length > 0
        ? `%${(validRates.reduce((a, b) => a + b, 0) / validRates.length).toFixed(1)}`
        : '-';
      return [row.hospitalName, ...values, avg];
    });

    // İl geneli satırı
    const provinceValues = sortedDates.map(date => {
      const rate = provinceTotals.dailyRates[date];
      return rate !== null ? `%${rate.toFixed(1)}` : '-';
    });
    const provinceValidRates = provinceTotals.trend.filter(r => r !== null) as number[];
    const provinceAvg = provinceValidRates.length > 0
      ? `%${(provinceValidRates.reduce((a, b) => a + b, 0) / provinceValidRates.length).toFixed(1)}`
      : '-';
    rows.push([provinceTotals.hospitalName, ...provinceValues, provinceAvg]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Günlük Yeşil Alan Oranları');

    const fileName = `yesil_alan_gunluk_${sortedDates[0] || 'rapor'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Panoya kopyala
  const handleCopy = async () => {
    const headers = ['Kurum', ...sortedDates.map(formatDateHeader), 'Ortalama'].join('\t');

    const rows = hospitalRows.map(row => {
      const values = sortedDates.map(date => {
        const rate = row.dailyRates[date];
        return rate !== null ? `%${rate.toFixed(1)}` : '-';
      });
      const validRates = row.trend.filter(r => r !== null) as number[];
      const avg = validRates.length > 0
        ? `%${(validRates.reduce((a, b) => a + b, 0) / validRates.length).toFixed(1)}`
        : '-';
      return [row.hospitalName, ...values, avg].join('\t');
    });

    // İl geneli
    const provinceValues = sortedDates.map(date => {
      const rate = provinceTotals.dailyRates[date];
      return rate !== null ? `%${rate.toFixed(1)}` : '-';
    });
    const provinceValidRates = provinceTotals.trend.filter(r => r !== null) as number[];
    const provinceAvg = provinceValidRates.length > 0
      ? `%${(provinceValidRates.reduce((a, b) => a + b, 0) / provinceValidRates.length).toFixed(1)}`
      : '-';
    rows.push([provinceTotals.hospitalName, ...provinceValues, provinceAvg].join('\t'));

    const text = [headers, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      onCopy?.();
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Günlük Tablo Filtreleri</h3>
          <div className="flex items-center gap-3">
            {getMatchingDates().length > 0 && (
              <span className="text-sm text-blue-600 font-medium bg-blue-100 px-3 py-1 rounded-full">
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
                  setDailyData([]);
                  setSelectedDates([]);
                }}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Temizle
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Yıl Seçimi */}
          <MultiSelectDropdown
            label="Yıl"
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
            label="Ay"
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
              <label className="text-sm font-medium text-slate-600">Takvim Ayı</label>
              <select
                value={activeMonth || ''}
                onChange={(e) => handleActiveMonthChange([Number(e.target.value)])}
                className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[140px]"
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
            className="px-6 py-2.5 h-[42px] bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
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

      {/* Tablo */}
      {sortedDates.length === 0 || hospitalRows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Günlük Tablo</h3>
            <p className="text-slate-500 text-sm max-w-md">
              Yukarıdaki filtrelerden tarih aralığı seçip "Uygula" butonuna tıklayarak günlük oran tablosunu görüntüleyebilirsiniz.
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Başlık */}
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  ŞANLIURFA İLİ ACİL SERVİS GÜNLÜK YEŞİL ALAN HASTA ORANLARI %
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-semibold text-blue-600">{getDateRangeDisplay()}</span>
                  <span className="mx-2">•</span>
                  {sortedDates.length} günlük veri • {hospitalRows.length} kurum
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Kopyala
                </button>
                <button
                  onClick={handlePngExport}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  PNG
                </button>
                <button
                  onClick={handleExcelExport}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* Tablo */}
          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                    Kurum
                  </th>
                  {sortedDates.map(date => (
                    <th
                      key={date}
                      className="px-2 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 min-w-[60px]"
                    >
                      {formatDateHeader(date)}
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                    Trend Eğrisi
                  </th>
                </tr>
              </thead>
              <tbody>
                {hospitalRows.map((row, idx) => (
                  <tr
                    key={row.hospitalName}
                    className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}
                  >
                    <td className="sticky left-0 z-10 px-4 py-2 font-medium text-slate-800 border-b border-slate-100 bg-inherit whitespace-nowrap">
                      {getShortHospitalName(row.hospitalName)}
                    </td>
                    {sortedDates.map(date => {
                      const rate = row.dailyRates[date];
                      return (
                        <td
                          key={date}
                          className={`px-2 py-2 text-center border-b border-slate-100 font-medium ${getRateColor(rate)}`}
                        >
                          {rate !== null ? `${rate.toFixed(1)}` : '-'}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 px-4 py-2 border-b border-slate-100 bg-inherit">
                      <div className="flex justify-center">
                        <Sparkline
                          values={row.trend}
                          width={120}
                          height={28}
                          color="#10b981"
                          showDots={true}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {/* İl Geneli Satırı */}
                <tr className="bg-blue-50 font-bold">
                  <td className="sticky left-0 z-10 px-4 py-3 font-bold text-blue-700 border-t-2 border-blue-200 bg-blue-50 whitespace-nowrap">
                    {provinceTotals.hospitalName}
                  </td>
                  {sortedDates.map(date => {
                    const rate = provinceTotals.dailyRates[date];
                    return (
                      <td
                        key={date}
                        className="px-2 py-3 text-center border-t-2 border-blue-200 text-blue-700"
                      >
                        {rate !== null ? `${rate.toFixed(1)}` : '-'}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 px-4 py-3 border-t-2 border-blue-200 bg-blue-50">
                    <div className="flex justify-center">
                      <Sparkline
                        values={provinceTotals.trend}
                        width={120}
                        height={28}
                        color="#2563eb"
                        showDots={true}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Renk açıklaması */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-4 text-xs text-slate-600">
            <span className="font-medium">Oran Renkleri:</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-200"></span> %65+
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-200"></span> %60-64
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-200"></span> %0-59
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

GreenAreaDailyRateTable.displayName = 'GreenAreaDailyRateTable';

export default GreenAreaDailyRateTable;
