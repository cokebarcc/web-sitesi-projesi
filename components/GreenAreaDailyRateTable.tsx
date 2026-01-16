import React, { useMemo, useRef } from 'react';
import Sparkline from './Sparkline';
import * as XLSX from 'xlsx';

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

interface HospitalDailyRow {
  hospitalName: string;
  dailyRates: Record<string, number | null>; // date -> rate
  trend: (number | null)[];
}

const GreenAreaDailyRateTable: React.FC<GreenAreaDailyRateTableProps> = ({
  data,
  selectedDates,
  onCopy
}) => {
  const tableRef = useRef<HTMLDivElement>(null);

  // Tarihleri sırala
  const sortedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.localeCompare(b));
  }, [selectedDates]);

  // Tarih formatla (gün/ay)
  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}`;
  };

  // Veriyi hastane bazında pivot et
  const { hospitalRows, provinceTotals } = useMemo(() => {
    // Hastane bazında gruplama
    const hospitalMap: Record<string, Record<string, { green: number; total: number }>> = {};

    data.forEach(item => {
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

    data.forEach(item => {
      if (provinceTotalsByDate[item.date]) {
        provinceTotalsByDate[item.date].green += item.greenAreaCount;
        provinceTotalsByDate[item.date].total += item.totalCount;
      }
    });

    // Hastane satırlarını oluştur
    const rows: HospitalDailyRow[] = Object.keys(hospitalMap)
      .sort((a, b) => a.localeCompare(b, 'tr-TR'))
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
  }, [data, sortedDates]);

  // Renk hesapla (oran bazlı)
  const getRateColor = (rate: number | null): string => {
    if (rate === null) return 'bg-slate-50 text-slate-400';
    if (rate >= 70) return 'bg-emerald-100 text-emerald-700';
    if (rate >= 50) return 'bg-yellow-100 text-yellow-700';
    if (rate >= 30) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <div className="text-slate-400 text-sm">
          Günlük tablo için tarih aralığı seçin
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              ŞANLIURFA İLİ ACİL SERVİS GÜNLÜK YEŞİL ALAN HASTA ORANLARI %
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {sortedDates.length} günlük veri • {hospitalRows.length} kurum
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopyala
            </button>
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
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
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[200px]">
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
              <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                Trend Eğrisi
              </th>
            </tr>
          </thead>
          <tbody>
            {hospitalRows.map((row, idx) => (
              <tr
                key={row.hospitalName}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
              >
                <td className="sticky left-0 z-10 px-4 py-2 font-medium text-slate-800 border-b border-slate-100 bg-inherit">
                  <div className="truncate max-w-[200px]" title={row.hospitalName}>
                    {row.hospitalName}
                  </div>
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
              <td className="sticky left-0 z-10 px-4 py-3 font-bold text-emerald-800 border-t-2 border-emerald-200 bg-emerald-50">
                {provinceTotals.hospitalName}
              </td>
              {sortedDates.map(date => {
                const rate = provinceTotals.dailyRates[date];
                return (
                  <td
                    key={date}
                    className="px-2 py-3 text-center border-t-2 border-emerald-200 text-emerald-800"
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
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-4 text-xs text-slate-600">
        <span className="font-medium">Oran Renkleri:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100"></span> %70+
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100"></span> %50-69
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-100"></span> %30-49
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100"></span> %0-29
        </span>
      </div>
    </div>
  );
};

export default GreenAreaDailyRateTable;
