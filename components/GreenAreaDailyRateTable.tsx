import React, { useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import Sparkline from './Sparkline';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface DailyData {
  date: string; // YYYY-MM-DD
  hospitalName: string;
  greenAreaCount: number;
  totalCount: number;
  greenAreaRate: number;
}

interface GreenAreaDailyRateTableProps {
  data: DailyData[];
  selectedDates: string[]; // Seçili tarihler
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
  // Özel durum: Sağlık Bilimleri Üniversitesi Mehmet Akif İnan
  if (fullName.includes('Sağlık Bilimleri Üni') || fullName.includes('Mehmet Akif İnan')) {
    return 'Mehmet Akif İnan EAH';
  }

  // Özel durum: Şanlıurfa Eğitim ve Araştırma Hastanesi
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

const GreenAreaDailyRateTable = forwardRef<GreenAreaDailyRateTableRef, GreenAreaDailyRateTableProps>(({
  data,
  selectedDates,
  onCopy
}, ref) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [localSelectedHospitals, setLocalSelectedHospitals] = useState<string[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Dışarıya table element'i expose et
  useImperativeHandle(ref, () => ({
    getTableElement: () => containerRef.current
  }));

  // Tarihleri sırala
  const sortedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.localeCompare(b));
  }, [selectedDates]);

  // Tarih aralığını formatla (başlık için)
  const formatDateRange = useMemo(() => {
    if (sortedDates.length === 0) return '';

    const formatFullDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-');
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    };

    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    if (firstDate === lastDate) {
      return formatFullDate(firstDate);
    }

    return `${formatFullDate(firstDate)} - ${formatFullDate(lastDate)}`;
  }, [sortedDates]);

  // Tüm hastanelerin listesi (filtre için)
  const allHospitals = useMemo(() => {
    const hospitals = [...new Set(data.map(item => item.hospitalName))];
    return sortHospitalNames(hospitals);
  }, [data]);

  // Tarih formatla (gün/ay)
  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}`;
  };

  // Veriyi hastane bazında pivot et
  const { hospitalRows, provinceTotals } = useMemo(() => {
    // Filtrelenmiş veri
    const filteredData = localSelectedHospitals.length > 0
      ? data.filter(item => localSelectedHospitals.includes(item.hospitalName))
      : data;

    // Hastane bazında gruplama
    const hospitalMap: Record<string, Record<string, { green: number; total: number }>> = {};

    filteredData.forEach(item => {
      if (!hospitalMap[item.hospitalName]) {
        hospitalMap[item.hospitalName] = {};
      }
      if (!hospitalMap[item.hospitalName][item.date]) {
        hospitalMap[item.hospitalName][item.date] = { green: 0, total: 0 };
      }
      hospitalMap[item.hospitalName][item.date].green += item.greenAreaCount;
      hospitalMap[item.hospitalName][item.date].total += item.totalCount;
    });

    // İl geneli hesapla (sadece filtrelenmiş hastaneler için)
    const provinceTotalsByDate: Record<string, { green: number; total: number }> = {};
    sortedDates.forEach(date => {
      provinceTotalsByDate[date] = { green: 0, total: 0 };
    });

    filteredData.forEach(item => {
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

    // İl geneli satırı (seçili hastanelerin toplamı)
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
        hospitalName: localSelectedHospitals.length > 0 ? 'SEÇİLİ KURUMLAR' : 'İL GENELİ',
        dailyRates: provinceDailyRates,
        trend: provinceTrend
      }
    };
  }, [data, sortedDates, localSelectedHospitals]);

  // Filtre toggle fonksiyonu
  const handleHospitalToggle = (hospitalName: string) => {
    setLocalSelectedHospitals(prev => {
      if (prev.includes(hospitalName)) {
        return prev.filter(h => h !== hospitalName);
      } else {
        return [...prev, hospitalName];
      }
    });
  };

  // Tümünü seç/kaldır
  const handleSelectAll = () => {
    if (localSelectedHospitals.length === allHospitals.length) {
      setLocalSelectedHospitals([]);
    } else {
      setLocalSelectedHospitals(allHospitals);
    }
  };

  // Renk hesapla (oran bazlı) - 65+ yeşil, 60-65 sarı, 60 altı kırmızı (beyaz tema)
  const getRateColor = (rate: number | null): string => {
    if (rate === null) return 'bg-slate-100 text-slate-400';
    if (rate >= 65) return 'bg-emerald-100 text-emerald-700';
    if (rate >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  // PNG olarak indir (açık tema ile)
  const handlePngExport = async () => {
    if (!containerRef.current) return;

    try {
      // Export için geçici olarak overflow'u kaldır ve genişliği auto yap
      const container = containerRef.current;
      const tableWrapper = container.querySelector('.overflow-x-auto') as HTMLElement;

      const originalOverflow = tableWrapper?.style.overflow;
      const originalWidth = container.style.width;

      if (tableWrapper) {
        tableWrapper.style.overflow = 'visible';
      }
      container.style.width = 'fit-content';
      container.style.minWidth = '100%';

      // Export için geçici olarak açık tema uygula
      const originalClasses = container.className;
      container.className = container.className
        .replace(/bg-slate-800\/50/g, 'bg-white')
        .replace(/border-slate-700\/60/g, 'border-slate-200')
        .replace(/border-slate-700/g, 'border-slate-200');

      // İç elementlere de açık tema uygula
      const allElements = container.querySelectorAll('*');
      const originalStyles: { el: Element; classes: string }[] = [];

      allElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        // SVG elementleri için className string değil, kontrol et
        if (typeof htmlEl.className !== 'string') return;
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
          .replace(/bg-emerald-500\/10/g, 'bg-emerald-50')
          .replace(/bg-emerald-500\/30/g, 'bg-emerald-100')
          .replace(/bg-yellow-500\/20/g, 'bg-yellow-100')
          .replace(/bg-yellow-500\/30/g, 'bg-yellow-100')
          .replace(/bg-red-500\/20/g, 'bg-red-100')
          .replace(/bg-red-500\/30/g, 'bg-red-100')
          .replace(/text-yellow-400/g, 'text-yellow-600')
          .replace(/text-red-400/g, 'text-red-600')
          .replace(/text-slate-500/g, 'text-slate-400');
      });

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: container.scrollWidth + 100
      });

      // Stilleri geri al
      container.className = originalClasses;
      originalStyles.forEach(({ el, classes }) => {
        (el as HTMLElement).className = classes;
      });

      if (tableWrapper) {
        tableWrapper.style.overflow = originalOverflow || '';
      }
      container.style.width = originalWidth;
      container.style.minWidth = '';

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

  if (sortedDates.length === 0 || hospitalRows.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="text-slate-500 text-sm">
          Günlük tablo için tarih aralığı seçin
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              ŞANLIURFA İLİ ACİL SERVİS GÜNLÜK YEŞİL ALAN HASTA ORANLARI %
            </h3>
            {formatDateRange && (
              <p className="text-sm font-medium text-emerald-600 mt-1">
                {formatDateRange}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {sortedDates.length} günlük veri • {hospitalRows.length} kurum
              {localSelectedHospitals.length > 0 && ` (${localSelectedHospitals.length} seçili)`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Kurum Filtresi */}
            <div className="relative">
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
                  localSelectedHospitals.length > 0
                    ? 'text-emerald-600 bg-emerald-100 border-emerald-300 hover:bg-emerald-200'
                    : 'text-slate-600 bg-slate-100 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Kurum Filtresi
                {localSelectedHospitals.length > 0 && (
                  <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {localSelectedHospitals.length}
                  </span>
                )}
                <svg className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">Kurum Seçin</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-emerald-600 hover:text-emerald-700"
                      >
                        {localSelectedHospitals.length === allHospitals.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                      </button>
                      {localSelectedHospitals.length > 0 && (
                        <button
                          onClick={() => setLocalSelectedHospitals([])}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {allHospitals.map(hospital => (
                      <label
                        key={hospital}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={localSelectedHospitals.includes(hospital)}
                          onChange={() => handleHospitalToggle(hospital)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700 truncate">
                          {getShortHospitalName(hospital)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopyala
            </button>
            <button
              onClick={handlePngExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              PNG
            </button>
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
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
              <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[180px] whitespace-nowrap">
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
                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
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
            <tr className="bg-emerald-50 font-bold">
              <td className="sticky left-0 z-10 px-4 py-3 font-bold text-emerald-600 border-t-2 border-emerald-200 bg-emerald-50">
                {provinceTotals.hospitalName}
              </td>
              {sortedDates.map(date => {
                const rate = provinceTotals.dailyRates[date];
                return (
                  <td
                    key={date}
                    className="px-2 py-3 text-center border-t-2 border-emerald-200 text-emerald-600 font-bold"
                  >
                    {rate !== null ? `${rate.toFixed(1)}` : '-'}
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 px-4 py-3 border-t-2 border-emerald-200 bg-emerald-50">
                <div className="flex justify-center">
                  <Sparkline
                    values={provinceTotals.trend}
                    width={120}
                    height={28}
                    color="#059669"
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
  );
});

GreenAreaDailyRateTable.displayName = 'GreenAreaDailyRateTable';

export default GreenAreaDailyRateTable;
