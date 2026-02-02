
import React, { useState, useMemo, useEffect } from 'react';
import { DetailedScheduleData } from '../types';
import { MONTHS, YEARS } from '../constants';
import DataFilterPanel from './common/DataFilterPanel';

interface DetailedScheduleProps {
  data: DetailedScheduleData[];
  selectedBranch: string | null;
  onImportExcel: (files: FileList | null, hospital?: string, month?: string, year?: number) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRemoveMonth: (month: string, year: number) => void; // New Granular removal
  // Hospital filter
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Load data function
  onLoadData: (hospital: string, month: string, year: number) => Promise<void>;
  // Upload permission
  canUpload?: boolean;
}

interface DoctorSummary {
  actionDays: { [action: string]: number };
  totalCapacity: number;
  branch: string;
}

const AM_WINDOW = { start: 8 * 60, end: 12 * 60 };
const PM_WINDOW = { start: 13 * 60, end: 17 * 60 };
const MIN_SESSION_THRESHOLD = 30;
const EXCLUDED_DAY_COUNT_ACTIONS = ["SONUÇ/KONTROL MUAYENE", "SONUÇ/KONTROL MUAYENESİ"];

const DetailedSchedule: React.FC<DetailedScheduleProps> = ({ data, selectedBranch, onImportExcel, onDelete, onClearAll, onRemoveMonth, selectedHospital, allowedHospitals, onHospitalChange, onLoadData, canUpload = false }) => {
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [appliedYears, setAppliedYears] = useState<number[]>([]);
  const [appliedMonths, setAppliedMonths] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('summary');
  const [lastUploadTarget, setLastUploadTarget] = useState<{hospital: string, month: string, year: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Uygulanmış filtreler için string formatı (veri yükleme için ilk seçili değer)
  const selectedMonth = appliedMonths.length > 0 ? MONTHS[appliedMonths[0] - 1] : '';
  const selectedYear = appliedYears.length > 0 ? appliedYears[0] : 0;

  // Derive loaded months from memory
  const loadedPeriods = useMemo(() => {
    const periods = new Set<string>();
    data.forEach(d => {
      if (d.month !== 'Bilinmiyor') periods.add(`${d.month}-${d.year}`);
    });
    return Array.from(periods).map(p => {
      const [m, y] = p.split('-');
      return { month: m, year: parseInt(y) };
    }).sort((a, b) => b.year - a.year || MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month));
  }, [data]);

  // Yıl ve ay filtreleri sabit YEARS ve MONTHS listelerinden gelir (DataFilterPanel içinde)

  const handleApply = async () => {
    if (!selectedHospital || selectedYears.length === 0 || selectedMonths.length === 0) {
      alert('Lütfen hastane, yıl ve ay seçiniz!');
      return;
    }
    setAppliedYears([...selectedYears]);
    setAppliedMonths([...selectedMonths]);

    // İlk seçili değerlerle veri yükle
    setIsLoading(true);
    try {
      await onLoadData(selectedHospital, MONTHS[selectedMonths[0] - 1], selectedYears[0]);
    } finally {
      setIsLoading(false);
    }
  };

  // Yükleme sonrası hedef döneme otomatik geçiş
  useEffect(() => {
    if (lastUploadTarget && data.length > 0) {
      const { hospital, month, year } = lastUploadTarget;
      if (hospital !== selectedHospital) {
        onHospitalChange(hospital);
      }
      const monthIndex = MONTHS.indexOf(month) + 1;
      setSelectedYears([year]);
      setSelectedMonths([monthIndex]);
      setAppliedYears([year]);
      setAppliedMonths([monthIndex]);
      setLastUploadTarget(null);
    }
  }, [data, lastUploadTarget, selectedHospital, onHospitalChange]);

  const filteredData = useMemo(() => {
    const filtered = data.filter(item => {
      const branchMatch = !selectedBranch || item.specialty === selectedBranch;
      const monthIndex = MONTHS.indexOf(item.month) + 1;
      const monthMatch = appliedMonths.length === 0 || appliedMonths.includes(monthIndex);
      const yearMatch = appliedYears.length === 0 || appliedYears.includes(item.year);
      const searchMatch = !searchTerm || item.doctorName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'));
      return branchMatch && monthMatch && yearMatch && searchMatch;
    });

    console.log('📋 DetailedSchedule filtreleme:', {
      totalData: data.length,
      appliedMonths,
      appliedYears,
      filteredCount: filtered.length
    });

    return filtered;
  }, [data, appliedMonths, appliedYears, searchTerm, selectedBranch]);

  // Dönem açıklaması için metin
  const periodText = useMemo(() => {
    if (appliedMonths.length === 0 || appliedYears.length === 0) return 'Dönem seçilmedi';
    const monthNames = appliedMonths.map(m => MONTHS[m - 1]).join(', ');
    const yearNames = appliedYears.join(', ');
    return `${monthNames} ${yearNames}`;
  }, [appliedMonths, appliedYears]);

  const getTimeInMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) || isNaN(m)) ? 0 : (h * 60 + m);
  };

  const getOverlapMinutes = (start1: number, end1: number, start2: number, end2: number): number => {
    const start = Math.max(start1, start2);
    const end = Math.min(end1, end2);
    return Math.max(0, end - start);
  };

  const summaryData = useMemo(() => {
    const summary: { [doctor: string]: DoctorSummary } = {};
    const dailyMap: Record<string, Record<string, {
      AM: Record<string, { mins: number, firstStart: number }>,
      PM: Record<string, { mins: number, firstStart: number }>
    }>> = {};
    const docCap: Record<string, number> = {};
    const docBranch: Record<string, string> = {};

    filteredData.forEach(item => {
      const d = item.doctorName; const t = item.startDate; const a = item.action.trim().toLocaleUpperCase('tr-TR');
      const rowStart = getTimeInMinutes(item.startTime);
      const rowEnd = rowStart + (item.duration || 0);
      // Gün hesabından muaf aksiyonları atla (sadece kapasiteleri sayılır)
      if (EXCLUDED_DAY_COUNT_ACTIONS.some(ex => a.includes(ex))) {
        docCap[d] = (docCap[d] || 0) + (item.capacity || 0);
        if (item.specialty && !docBranch[d]) docBranch[d] = item.specialty;
        return;
      }
      if (!dailyMap[d]) dailyMap[d] = {};
      if (!dailyMap[d][t]) dailyMap[d][t] = { AM: {}, PM: {} };
      const amOverlap = getOverlapMinutes(rowStart, rowEnd, AM_WINDOW.start, AM_WINDOW.end);
      if (amOverlap > 0) {
        if (!dailyMap[d][t].AM[a]) dailyMap[d][t].AM[a] = { mins: 0, firstStart: Infinity };
        dailyMap[d][t].AM[a].mins += amOverlap;
        dailyMap[d][t].AM[a].firstStart = Math.min(dailyMap[d][t].AM[a].firstStart, rowStart);
      }
      const pmOverlap = getOverlapMinutes(rowStart, rowEnd, PM_WINDOW.start, PM_WINDOW.end);
      if (pmOverlap > 0) {
        if (!dailyMap[d][t].PM[a]) dailyMap[d][t].PM[a] = { mins: 0, firstStart: Infinity };
        dailyMap[d][t].PM[a].mins += pmOverlap;
        dailyMap[d][t].PM[a].firstStart = Math.min(dailyMap[d][t].PM[a].firstStart, rowStart);
      }
      docCap[d] = (docCap[d] || 0) + (item.capacity || 0);
      if (item.specialty && !docBranch[d]) docBranch[d] = item.specialty;
    });

    Object.entries(dailyMap).forEach(([docName, dates]) => {
      summary[docName] = { actionDays: {}, totalCapacity: docCap[docName] || 0, branch: docBranch[docName] || '' };
      Object.entries(dates).forEach(([dateStr, sessions]) => {
        let amWinner = ""; let amMaxMins = -1; let amEarliest = Infinity;
        Object.entries(sessions.AM).forEach(([act, stats]) => {
          if (stats.mins >= MIN_SESSION_THRESHOLD) {
             if (stats.mins > amMaxMins) { amMaxMins = stats.mins; amWinner = act; amEarliest = stats.firstStart; }
             else if (stats.mins === amMaxMins && stats.firstStart < amEarliest) { amWinner = act; amEarliest = stats.firstStart; }
          }
        });
        let pmWinner = ""; let pmMaxMins = -1; let pmEarliest = Infinity;
        Object.entries(sessions.PM).forEach(([act, stats]) => {
          if (stats.mins >= MIN_SESSION_THRESHOLD) {
             if (stats.mins > pmMaxMins) { pmMaxMins = stats.mins; pmWinner = act; pmEarliest = stats.firstStart; }
             else if (stats.mins === pmMaxMins && stats.firstStart < pmEarliest) { pmWinner = act; pmEarliest = stats.firstStart; }
          }
        });
        if (amWinner) summary[docName].actionDays[amWinner] = (summary[docName].actionDays[amWinner] || 0) + 0.5;
        if (pmWinner) summary[docName].actionDays[pmWinner] = (summary[docName].actionDays[pmWinner] || 0) + 0.5;
      });
    });
    return summary;
  }, [filteredData]);

  const activeActions = useMemo(() => {
    const actions = new Set<string>();
    Object.values(summaryData).forEach((doc: DoctorSummary) => {
      Object.keys(doc.actionDays).forEach(a => actions.add(a));
    });
    return Array.from(actions).sort();
  }, [summaryData]);

  return (
    <div className="space-y-6 pb-20">
      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Veri Filtreleme"
        showHospitalFilter={true}
        selectedHospital={selectedHospital}
        availableHospitals={allowedHospitals}
        onHospitalChange={onHospitalChange}
        showYearFilter={true}
        selectedYears={selectedYears}
        availableYears={YEARS}
        onYearsChange={setSelectedYears}
        showMonthFilter={true}
        selectedMonths={selectedMonths}
        onMonthsChange={setSelectedMonths}
        showApplyButton={true}
        onApply={handleApply}
        isLoading={isLoading}
        applyDisabled={!selectedHospital || selectedYears.length === 0 || selectedMonths.length === 0}
        selectionCount={appliedMonths.length * appliedYears.length}
        selectionLabel="dönem seçili"
        customFilters={
          <>
            {/* Arama */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-3)]">Ara</label>
              <input
                type="text" placeholder="Hekim adı..."
                className="px-3 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-1)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 w-[140px] h-[38px] placeholder-[var(--text-placeholder)]"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Görünüm Modu */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-3)]">Görünüm</label>
              <div className="flex bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--border-1)] h-[38px]">
                <button onClick={() => setViewMode('summary')} className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'summary' ? 'bg-[var(--surface-1)] text-emerald-400 shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'}`}>Özet</button>
                <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-[var(--surface-1)] text-emerald-400 shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'}`}>Detay</button>
              </div>
            </div>

            {/* Dosya Yükle - Sadece yükleme izni varsa göster */}
            {canUpload && (
              <label className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 h-[38px] rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Yükle
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => {
                  if (e.target.files?.length) {
                    setLastUploadTarget({ hospital: selectedHospital, month: selectedMonth, year: selectedYear });
                    onImportExcel(e.target.files, selectedHospital, selectedMonth, selectedYear);
                    e.target.value = '';
                  }
                }} />
              </label>
            )}

            {data.length > 0 && (
              <button onClick={() => { if(window.confirm("Tüm aylar hafızadan silinecek! Emin misiniz?")) onClearAll(); }} className="px-3 py-2 h-[38px] text-xs font-semibold text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all border border-rose-500/30">
                Temizle
              </button>
            )}
          </>
        }
      />

      {viewMode === 'summary' ? (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
          <div className="p-8 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
            <h4 className="text-xl font-black text-[var(--text-1)] uppercase italic underline decoration-indigo-500 decoration-4 underline-offset-8 leading-relaxed">
              {periodText} Analiz Raporu
            </h4>
            <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-3">
              YARIM GÜN (AM/PM) ESASLI: Sabah (08-12) ve Öğle (13-17) oturumları ayrı değerlendirilir.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--table-header-bg)] border-b border-[var(--table-border)]">
                <tr>
                  <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest sticky left-0 bg-[var(--table-header-bg)] shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Hekim Ad Soyad</th>
                  <th className="px-10 py-5 text-[11px] font-black text-sky-300 uppercase tracking-widest text-center bg-sky-500/10">TOPLAM KAPASİTE</th>
                  {activeActions.map(action => (
                    <th key={action} className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest text-center border-l border-[var(--table-border)]">{action} (GÜN)</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-border)]">
                {Object.entries(summaryData).length > 0 ? Object.entries(summaryData).map(([name, stats]: [string, DoctorSummary]) => (
                  <tr key={name} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="px-10 py-5 sticky left-0 bg-[var(--surface-1)] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                      <p className="font-black text-[var(--text-1)] uppercase text-sm leading-normal">{name}</p>
                      {stats.branch && <p className="text-[10px] font-medium text-[var(--text-muted)] mt-0.5">{stats.branch}</p>}
                    </td>
                    <td className="px-10 py-5 text-center">
                       <span className="bg-sky-500/20 text-white px-4 py-1.5 rounded-xl font-black text-xs border border-sky-400/30">{stats.totalCapacity.toLocaleString('tr-TR')}</span>
                    </td>
                    {activeActions.map(action => {
                      const dayCount = stats.actionDays[action] || 0;
                      return (
                        <td key={action} className={`px-10 py-5 text-center font-black border-l border-[var(--table-border)] ${dayCount > 0 ? 'text-[var(--text-1)]' : 'text-[var(--text-muted)]'}`}>
                          {dayCount % 1 === 0 ? dayCount : dayCount.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={activeActions.length + 2} className="px-10 py-32 text-center text-[var(--text-muted)] uppercase font-black tracking-widest">Seçili dönem için veri bulunamadı</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--table-header-bg)] border-b border-[var(--table-border)]">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest">Aksiyon Tarihi</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest">Hekim Ad Soyad</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest">Aksiyon</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Başlangıç / Bitiş (Süre)</th>
                  <th className="px-8 py-5 text-[10px] font-black text-sky-300 uppercase tracking-widest text-center">Kapasite</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-border)]">
                {filteredData.length > 0 ? filteredData.slice(0, 1000).map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--table-row-hover)] transition-colors group">
                    <td className="px-8 py-4 font-bold text-[var(--text-3)] text-xs">{item.startDate}</td>
                    <td className="px-8 py-4 font-black text-[var(--text-1)] uppercase text-xs">{item.doctorName}</td>
                    <td className="px-8 py-4">
                      <span className="text-[10px] font-black uppercase text-[var(--text-2)] bg-[var(--surface-3)] px-3 py-1 rounded-lg border border-[var(--border-1)]">{item.action}</span>
                    </td>
                    <td className="px-8 py-4 text-center text-xs font-bold text-[var(--text-muted)]">
                      {item.startTime} - {item.endTime}
                      <span className="ml-2 text-indigo-400 font-black">({item.duration} dk)</span>
                    </td>
                    <td className="px-8 py-4 text-center"><span className="font-black text-sky-200 text-sm">{item.capacity || '-'}</span></td>
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => onDelete(item.id)} className="text-rose-400/50 hover:text-rose-400 p-2 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-10 py-32 text-center text-[var(--text-muted)] uppercase font-black tracking-widest">Seçili dönem için veri bulunamadı</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedSchedule;
