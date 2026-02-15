
import React, { useState, useMemo } from 'react';
import { HBYSData, DetailedScheduleData } from '../types';
import { MONTHS, YEARS } from '../constants';
import DataFilterPanel from './common/DataFilterPanel';

interface HBYSPerformanceProps {
  data: HBYSData[];
  detailedScheduleData: DetailedScheduleData[];
  onImportHBYSExams: (files: FileList | null, month: string, year: number) => void;
  onImportHBYSSurgeries: (files: FileList | null, month: string, year: number) => void;
  onDelete: (id: string) => void;
  onClearMonth: (month: string, year: number) => void;
}

const HBYSPerformance: React.FC<HBYSPerformanceProps> = ({ data, detailedScheduleData, onImportHBYSExams, onImportHBYSSurgeries, onDelete, onClearMonth }) => {
  const [selectedYears, setSelectedYears] = useState<number[]>([2025]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([12]); // 12 = Aralık
  const [appliedYears, setAppliedYears] = useState<number[]>([2025]);
  const [appliedMonths, setAppliedMonths] = useState<number[]>([12]);

  // Uygulanmış filtreler için string formatı (dosya yükleme için ilk seçili değer)
  const selectedMonth = appliedMonths.length > 0 ? MONTHS[appliedMonths[0] - 1] : '';
  const selectedYear = appliedYears.length > 0 ? appliedYears[0] : 0;

  // Mevcut yıllar
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    detailedScheduleData.forEach(d => years.add(d.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [detailedScheduleData]);

  // Seçili yıllara göre mevcut aylar
  const availableMonths = useMemo(() => {
    if (selectedYears.length === 0) return [];
    const months = new Set<number>();
    detailedScheduleData
      .filter(d => selectedYears.includes(d.year))
      .forEach(d => {
        const monthIndex = MONTHS.indexOf(d.month) + 1;
        if (monthIndex > 0) months.add(monthIndex);
      });
    return Array.from(months).sort((a, b) => a - b);
  }, [detailedScheduleData, selectedYears]);

  const handleApply = () => {
    setAppliedYears([...selectedYears]);
    setAppliedMonths([...selectedMonths]);
  };

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\./g, '');
  };

  // Seçili döneme ait cetvellerden hekim listesini oluştur
  const scheduledPhysicians = useMemo(() => {
    const periodSchedules = detailedScheduleData.filter(d => {
      const monthIndex = MONTHS.indexOf(d.month) + 1;
      return appliedMonths.includes(monthIndex) && appliedYears.includes(d.year);
    });
    const uniqueDocs = new Map<string, { doctorName: string; specialty: string }>();

    periodSchedules.forEach(s => {
      const key = `${normalizeStr(s.doctorName)}|${normalizeStr(s.specialty)}`;
      if (!uniqueDocs.has(key)) {
        uniqueDocs.set(key, { doctorName: s.doctorName, specialty: s.specialty });
      }
    });

    return Array.from(uniqueDocs.values()).sort((a, b) => a.doctorName.localeCompare(b.doctorName, 'tr-TR'));
  }, [detailedScheduleData, appliedMonths, appliedYears]);

  // Performans verilerini hekim listesiyle harmanla
  const mergedPerformanceData = useMemo(() => {
    const periodHBYS = data.filter(h => {
      const monthIndex = MONTHS.indexOf(h.month) + 1;
      return appliedMonths.includes(monthIndex) && appliedYears.includes(h.year);
    });
    
    return scheduledPhysicians.map((phys, idx) => {
      const perf = periodHBYS.find(h => 
        normalizeStr(h.doctorName) === normalizeStr(phys.doctorName) && 
        normalizeStr(h.specialty) === normalizeStr(phys.specialty)
      );

      return {
        id: perf?.id || `temp-${idx}`,
        doctorName: phys.doctorName,
        specialty: phys.specialty,
        totalExams: perf?.totalExams || 0,
        surgeryABC: perf?.surgeryABC || 0,
        isTemp: !perf
      };
    });
  }, [scheduledPhysicians, data, appliedMonths, appliedYears]);

  // Dönem açıklaması için metin
  const periodText = useMemo(() => {
    if (appliedMonths.length === 0 || appliedYears.length === 0) return 'Dönem seçilmedi';
    const monthNames = appliedMonths.map(m => MONTHS[m - 1]).join(', ');
    const yearNames = appliedYears.join(', ');
    return `${monthNames} ${yearNames}`;
  }, [appliedMonths, appliedYears]);

  return (
    <div className="space-y-4">
      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Veri Filtreleme"
        showYearFilter={true}
        selectedYears={selectedYears}
        availableYears={availableYears.length > 0 ? availableYears : YEARS}
        onYearsChange={setSelectedYears}
        showMonthFilter={true}
        selectedMonths={selectedMonths}
        availableMonths={availableMonths}
        onMonthsChange={setSelectedMonths}
        showApplyButton={true}
        onApply={handleApply}
        applyDisabled={selectedYears.length === 0 || selectedMonths.length === 0}
        selectionCount={appliedMonths.length * appliedYears.length}
        selectionLabel="dönem seçili"
        customFilters={
          <>
            <button onClick={() => onClearMonth(selectedMonth, selectedYear)} disabled={mergedPerformanceData.filter(d => !d.isTemp).length === 0} className="px-3 py-2 h-[38px] rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-all disabled:opacity-30">
              Temizle
            </button>

            <label className="bg-indigo-600 text-white px-3 py-2 h-[38px] rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-500 transition shadow-sm active:scale-95 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Muayene
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { onImportHBYSExams(e.target.files, selectedMonth, selectedYear); e.target.value = ''; }} />
            </label>

            <label className="bg-[var(--surface-1)] text-[var(--text-1)] border border-[var(--border-2)] px-3 py-2 h-[38px] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--surface-hover)] transition shadow-sm active:scale-95 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12V3" /></svg>
              Cerrahi
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { onImportHBYSSurgeries(e.target.files, selectedMonth, selectedYear); e.target.value = ''; }} />
            </label>
          </>
        }
      />
      
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[40px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
        <div className="p-10 border-b border-[var(--border-1)] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--surface-2)] gap-4">
          <div>
            <h4 className="text-2xl font-black text-[var(--text-1)] tracking-tight uppercase">Hekim Verileri: {periodText}</h4>
            <p className="text-[var(--text-muted)] text-sm mt-1 font-medium tracking-wide">Excel'deki veriler mevcut cetveldeki hekimlerle otomatik eşleştirilir.</p>
          </div>
          <div className="bg-[var(--surface-1)] text-[var(--text-1)] border border-[var(--border-2)] px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg tracking-widest">{mergedPerformanceData.length} HEKİM TAKİPTE</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border-1)]">
              <tr>
                <th className="px-10 py-6 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">Hekim Adı Soyadı</th>
                <th className="px-10 py-6 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Toplam Muayene</th>
                <th className="px-10 py-6 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">A+B+C Ameliyat</th>
                <th className="px-10 py-6 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-1)]">
              {mergedPerformanceData.length > 0 ? mergedPerformanceData.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--surface-hover)] transition-colors group">
                  <td className="px-10 py-6">
                    <p className="font-black text-[var(--text-1)] uppercase text-sm">{item.doctorName}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tight mt-1">{item.specialty}</p>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`text-lg font-black ${item.totalExams > 0 ? 'text-blue-400' : 'text-[var(--text-muted)]'}`}>
                      {item.totalExams > 0 ? item.totalExams.toLocaleString('tr-TR') : '0'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`text-lg font-black ${item.surgeryABC > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                      {item.surgeryABC > 0 ? item.surgeryABC.toLocaleString('tr-TR') : '0'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    {!item.isTemp ? (
                      <button onClick={() => onDelete(item.id)} className="p-3 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/30 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    ) : (
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">Veri Bekleniyor</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-10 py-40 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-20 h-20 bg-[var(--surface-2)] rounded-full flex items-center justify-center text-[var(--text-muted)]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <p className="font-black italic text-xl uppercase tracking-widest">HİÇ HEKİM KAYDI YOK</p>
                      <p className="text-sm font-medium text-[var(--text-muted)] max-w-xs mx-auto">Veri yüklemeden önce lütfen "Cetveller" modülünden Excel yükleyerek hekim listesini oluşturun.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HBYSPerformance;
