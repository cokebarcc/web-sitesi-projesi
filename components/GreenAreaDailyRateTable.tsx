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
  showProvinceTotals?: boolean; // İl geneli satırını göster/gizle (default: true)
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
  onCopy,
  showProvinceTotals = true
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

  // Hastane ortalama rengi (sol bar için) - 65+ yeşil, 60-64 sarı, 60 altı kırmızı
  const getAvgBarColor = (trend: (number | null)[]): string => {
    const valid = trend.filter(r => r !== null) as number[];
    if (valid.length === 0) return '#64748b';
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    if (avg >= 65) return '#34d399'; // emerald-400
    if (avg >= 60) return '#fbbf24'; // yellow-400
    return '#f87171'; // red-400
  };

  // Renk hesapla (oran bazlı) - site: sadece metin rengi, arka plan yok
  const getRateColor = (rate: number | null): string => {
    if (rate === null) return 'text-slate-500';
    if (rate >= 65) return 'text-emerald-400';
    if (rate >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // PNG export için: hücre arka plan rengi (koyu tema → açık tema dönüşümünde kullanılır)
  const getRateBgLight = (rate: number | null): string => {
    if (rate === null) return '#f1f5f9'; // slate-100
    if (rate >= 65) return '#d1fae5'; // emerald-100
    if (rate >= 60) return '#fef9c3'; // yellow-100
    return '#fee2e2'; // red-100
  };

  // PNG olarak indir (beyaz tema ile)
  const handlePngExport = async () => {
    if (!containerRef.current) return;

    try {
      const container = containerRef.current;
      const tableWrapper = container.querySelector('[data-table-scroll]') as HTMLElement;

      const savedOverflow = tableWrapper?.style.overflow || '';
      const savedWidth = container.style.width;
      const savedMinWidth = container.style.minWidth;

      if (tableWrapper) tableWrapper.style.overflow = 'visible';
      container.style.width = 'fit-content';
      container.style.minWidth = '100%';

      // Butonları gizle
      const hideEls = container.querySelectorAll('[data-export-hide]');
      hideEls.forEach(el => (el as HTMLElement).style.display = 'none');

      // Koyu→beyaz tema dönüşümü: computed style ile inline override
      const savedStyles: { el: HTMLElement; origStyle: string }[] = [];

      const convertToLight = (el: HTMLElement) => {
        savedStyles.push({ el, origStyle: el.getAttribute('style') || '' });

        // Renkli barları (data-avg-bar) ve legend pill'leri olduğu gibi bırak
        if (el.hasAttribute('data-avg-bar')) return;

        const cs = window.getComputedStyle(el);

        // Arka plan rengi
        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const nums = bg.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          // Renkli hücre arka planlarını dönüştür (koyu tema → açık tema)
          // emerald-500/20 (~16,185,129 alpha) → emerald-100
          if (g > 120 && r < 80 && b > 80 && b < 200) {
            el.style.backgroundColor = '#d1fae5'; // emerald-100
          }
          // yellow-500/20 → yellow-100
          else if (r > 180 && g > 150 && b < 50) {
            el.style.backgroundColor = '#fef9c3'; // yellow-100
          }
          // red-500/20 → red-100
          else if (r > 180 && g < 100 && b < 100) {
            el.style.backgroundColor = '#fee2e2'; // red-100
          }
          // Koyu arka planlar → beyaz/açık
          else if (r < 60 && g < 60 && b < 80) {
            el.style.backgroundColor = '#ffffff';
          } else if (r < 80 && g < 80) {
            el.style.backgroundColor = '#f8fafc'; // slate-50
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
          // emerald-400 (~52,211,153) → emerald-700
          else if (g > 160 && r < 100 && b > 100 && b < 200) {
            el.style.color = '#047857'; // emerald-700
          }
          // yellow-400 (~250,204,21) → yellow-700
          else if (r > 200 && g > 180 && b < 80) {
            el.style.color = '#a16207'; // yellow-700
          }
          // red-400 (~248,113,113) → red-700
          else if (r > 200 && g < 140 && b < 140) {
            el.style.color = '#b91c1c'; // red-700
          }
          // Orta tonlar (slate-400/500) → slate-600
          else if (r > 90 && r < 180 && g > 90 && b > 90) {
            el.style.color = '#475569'; // slate-600
          }
        }

        // Border rengi
        const bc = cs.borderTopColor || cs.borderColor;
        if (bc && bc !== 'rgba(0, 0, 0, 0)') {
          const nums = bc.match(/[\d.]+/g)?.map(Number) || [];
          const [r, g, b] = nums;
          // emerald border → açık emerald
          if (g > 150 && r < 100) {
            el.style.borderColor = '#a7f3d0'; // emerald-200
          }
          // Koyu border → slate-200
          else if (r < 120 && g < 120 && b < 140) {
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

      // Alternating row'lara açık tema zebra striping uygula
      container.querySelectorAll('tr[data-row-index]').forEach(tr => {
        const row = tr as HTMLElement;
        const idx = parseInt(row.getAttribute('data-row-index') || '0');
        if (idx % 2 !== 0) {
          row.style.backgroundColor = '#f8fafc'; // slate-50
          // Sticky td'lere de aynı rengi ver
          row.querySelectorAll('td.sticky').forEach(td => {
            (td as HTMLElement).style.backgroundColor = '#f8fafc';
          });
        }
      });

      // Tüm td hücrelerine dikey ortalama zorla (html2canvas uyumluluğu)
      container.querySelectorAll('td').forEach(td => {
        const el = td as HTMLElement;
        el.style.verticalAlign = 'middle';
      });

      // data-rate-val hücrelerine arka plan rengi ekle (PNG'de renkli hücreler)
      container.querySelectorAll('td[data-rate-val]').forEach(td => {
        const el = td as HTMLElement;
        const val = el.getAttribute('data-rate-val');
        if (!val) return;
        const rate = parseFloat(val);
        if (isNaN(rate)) return;
        if (rate >= 65) el.style.backgroundColor = '#d1fae5'; // emerald-100
        else if (rate >= 60) el.style.backgroundColor = '#fef9c3'; // yellow-100
        else el.style.backgroundColor = '#fee2e2'; // red-100
        // Metin rengini de açık tema karşılığına çevir
        if (rate >= 65) el.style.color = '#047857'; // emerald-700
        else if (rate >= 60) el.style.color = '#a16207'; // yellow-700
        else el.style.color = '#b91c1c'; // red-700
      });

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: container.scrollWidth + 100
      });

      // Stilleri geri al
      savedStyles.forEach(({ el, origStyle }) => {
        if (origStyle) el.setAttribute('style', origStyle);
        else el.removeAttribute('style');
      });

      // Layout geri al
      hideEls.forEach(el => (el as HTMLElement).style.display = '');
      if (tableWrapper) tableWrapper.style.overflow = savedOverflow;
      container.style.width = savedWidth;
      container.style.minWidth = savedMinWidth;

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

    // İl geneli satırı (sadece showProvinceTotals true ise)
    if (showProvinceTotals) {
      const provinceValues = sortedDates.map(date => {
        const rate = provinceTotals.dailyRates[date];
        return rate !== null ? `%${rate.toFixed(1)}` : '-';
      });
      const provinceValidRates = provinceTotals.trend.filter(r => r !== null) as number[];
      const provinceAvg = provinceValidRates.length > 0
        ? `%${(provinceValidRates.reduce((a, b) => a + b, 0) / provinceValidRates.length).toFixed(1)}`
        : '-';
      rows.push([provinceTotals.hospitalName, ...provinceValues, provinceAvg]);
    }

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

    // İl geneli (sadece showProvinceTotals true ise)
    if (showProvinceTotals) {
      const provinceValues = sortedDates.map(date => {
        const rate = provinceTotals.dailyRates[date];
        return rate !== null ? `%${rate.toFixed(1)}` : '-';
      });
      const provinceValidRates = provinceTotals.trend.filter(r => r !== null) as number[];
      const provinceAvg = provinceValidRates.length > 0
        ? `%${(provinceValidRates.reduce((a, b) => a + b, 0) / provinceValidRates.length).toFixed(1)}`
        : '-';
      rows.push([provinceTotals.hospitalName, ...provinceValues, provinceAvg].join('\t'));
    }

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
      <div className="bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/60 p-8 text-center">
        <div className="text-slate-400 text-sm">
          Günlük tablo için tarih aralığı seçin
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl shadow-lg overflow-hidden"
         style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
      {/* Başlık */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-1)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
              ŞANLIURFA İLİ ACİL SERVİS GÜNLÜK YEŞİL ALAN HASTA ORANLARI %
            </h3>
            {formatDateRange && (
              <p className="text-sm font-medium text-emerald-400 mt-1">
                {formatDateRange}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {sortedDates.length} günlük veri • {hospitalRows.length} kurum
              {localSelectedHospitals.length > 0 && ` (${localSelectedHospitals.length} seçili)`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap" data-export-hide>
            {/* Kurum Filtresi */}
            <div className="relative">
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
                  localSelectedHospitals.length > 0
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'text-slate-300 bg-slate-700/50 border-slate-600 hover:bg-slate-700/70'
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
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
                     style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-light)', backdropFilter: 'blur(12px)' }}>
                  <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Kurum Seçin</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {localSelectedHospitals.length === allHospitals.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                      </button>
                      {localSelectedHospitals.length > 0 && (
                        <button
                          onClick={() => setLocalSelectedHospitals([])}
                          className="text-xs text-red-400 hover:text-red-300"
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
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={localSelectedHospitals.includes(hospital)}
                          onChange={() => handleHospitalToggle(hospital)}
                          className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                          style={{ background: 'var(--surface-3)' }}
                        />
                        <span className="text-sm truncate" style={{ color: 'var(--text-2)' }}>
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
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopyala
            </button>
            <button
              onClick={handlePngExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}
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
      <div ref={tableRef} className="overflow-x-auto" data-table-scroll>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th className="sticky left-0 z-10 px-4 py-3 text-left font-semibold min-w-[180px] whitespace-nowrap"
                  style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-1)' }}>
                Kurum
              </th>
              {sortedDates.map(date => (
                <th
                  key={date}
                  className="px-2 py-3 text-center font-semibold min-w-[60px]"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-1)' }}
                >
                  {formatDateHeader(date)}
                </th>
              ))}
              <th className="sticky right-0 z-10 px-4 py-3 text-center font-semibold min-w-[140px]"
                  style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-1)' }}>
                Trend Eğrisi
              </th>
            </tr>
          </thead>
          <tbody>
            {hospitalRows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              const rowBg = isEven ? 'transparent' : 'rgba(255, 255, 255, 0.04)';
              const stickyBg = isEven ? 'var(--surface-1)' : 'rgba(30, 41, 59, 0.85)';
              return (
                <tr
                  key={row.hospitalName}
                  className="transition-colors hover:bg-white/[0.05]"
                  style={{ background: rowBg }}
                  data-row-index={idx}
                >
                  <td className="sticky left-0 z-10 px-4 py-2.5 font-medium whitespace-nowrap"
                      style={{ color: 'var(--text-1)', borderBottom: '1px solid var(--border-1)', background: stickyBg, verticalAlign: 'middle' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tabular-nums w-4 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </span>
                      <span data-avg-bar className="w-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: getAvgBarColor(row.trend), height: '16px' }}></span>
                      <span className="text-xs font-semibold">
                        {getShortHospitalName(row.hospitalName)}
                      </span>
                    </div>
                  </td>
                  {sortedDates.map(date => {
                    const rate = row.dailyRates[date];
                    return (
                      <td
                        key={date}
                        data-rate-val={rate !== null ? rate.toFixed(1) : ''}
                        className={`px-2 py-2 text-center font-bold ${getRateColor(rate)}`}
                        style={{ borderBottom: '1px solid var(--border-1)', verticalAlign: 'middle' }}
                      >
                        {rate !== null ? `${rate.toFixed(1)}` : '-'}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 px-4 py-2"
                      style={{ borderBottom: '1px solid var(--border-1)', background: stickyBg, verticalAlign: 'middle' }}>
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
              );
            })}
            {/* İl Geneli Satırı - Sadece showProvinceTotals true ise göster */}
            {showProvinceTotals && (
              <tr style={{ background: 'rgba(52, 211, 153, 0.06)' }} className="font-bold">
                <td className="sticky left-0 z-10 px-4 py-3 font-bold text-emerald-400"
                    style={{ borderTop: '2px solid rgba(52, 211, 153, 0.2)', background: 'rgba(52, 211, 153, 0.06)' }}>
                  {provinceTotals.hospitalName}
                </td>
                {sortedDates.map(date => {
                  const rate = provinceTotals.dailyRates[date];
                  return (
                    <td
                      key={date}
                      data-rate-val={rate !== null ? rate.toFixed(1) : ''}
                      className={`px-2 py-3 text-center font-bold ${getRateColor(rate)}`}
                      style={{ borderTop: '2px solid rgba(52, 211, 153, 0.2)' }}
                    >
                      {rate !== null ? `${rate.toFixed(1)}` : '-'}
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 px-4 py-3"
                    style={{ borderTop: '2px solid rgba(52, 211, 153, 0.2)', background: 'rgba(52, 211, 153, 0.06)' }}>
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
            )}
          </tbody>
        </table>
      </div>

      {/* Renk açıklaması */}
      <div className="px-6 py-3 flex items-center gap-4 text-xs" style={{ borderTop: '1px solid var(--border-1)', color: 'var(--text-3)' }}>
        <span className="font-medium">Oran Renkleri:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/30"></span> %65+
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-500/30"></span> %60-64
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/30"></span> %0-59
        </span>
      </div>
    </div>
  );
});

GreenAreaDailyRateTable.displayName = 'GreenAreaDailyRateTable';

export default GreenAreaDailyRateTable;
