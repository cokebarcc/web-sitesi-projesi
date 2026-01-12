
import React, { useState, useMemo, useEffect } from 'react';
import { DetailedScheduleData } from '../types';
import { MONTHS, YEARS } from '../constants';

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
}

interface DoctorSummary {
  actionDays: { [action: string]: number };
  totalCapacity: number;
}

const AM_WINDOW = { start: 8 * 60, end: 12 * 60 };
const PM_WINDOW = { start: 13 * 60, end: 17 * 60 };
const MIN_SESSION_THRESHOLD = 30;

const DetailedSchedule: React.FC<DetailedScheduleProps> = ({ data, selectedBranch, onImportExcel, onDelete, onClearAll, onRemoveMonth, selectedHospital, allowedHospitals, onHospitalChange, onLoadData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Boş başlangıç
  const [selectedYear, setSelectedYear] = useState<number>(0); // Boş başlangıç
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('summary');
  const [uploadHospital, setUploadHospital] = useState('');
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadYear, setUploadYear] = useState(0);
  const [lastUploadTarget, setLastUploadTarget] = useState<{hospital: string, month: string, year: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // Otomatik dönem seçimi kaldırıldı - kullanıcı manuel seçecek

  // Yükleme sonrası hedef döneme otomatik geçiş
  useEffect(() => {
    if (lastUploadTarget && data.length > 0) {
      const { hospital, month, year } = lastUploadTarget;
      // Eğer yükleme yapılan hastane şu anki seçili hastane değilse, hastaneyi değiştir
      if (hospital !== selectedHospital) {
        onHospitalChange(hospital);
      }
      // Ay ve yılı güncelle
      setSelectedMonth(month);
      setSelectedYear(year);
      setLastUploadTarget(null);
    }
  }, [data, lastUploadTarget, selectedHospital, onHospitalChange]);

  const filteredData = useMemo(() => {
    const filtered = data.filter(item => {
      const branchMatch = !selectedBranch || item.specialty === selectedBranch;
      const monthMatch = !selectedMonth || item.month === selectedMonth; // Boşsa filtreleme yapma
      const yearMatch = !selectedYear || item.year === selectedYear; // Boşsa filtreleme yapma
      const searchMatch = !searchTerm || item.doctorName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'));
      return branchMatch && monthMatch && yearMatch && searchMatch;
    });

    console.log('📋 DetailedSchedule filtreleme:', {
      totalData: data.length,
      selectedMonth: selectedMonth || 'Boş',
      selectedYear: selectedYear || 'Boş',
      filteredCount: filtered.length,
      sampleMonths: [...new Set(data.slice(0, 10).map(d => d.month))],
      sampleYears: [...new Set(data.slice(0, 10).map(d => d.year))]
    });

    return filtered;
  }, [data, selectedMonth, selectedYear, searchTerm, selectedBranch]);

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

    filteredData.forEach(item => {
      const d = item.doctorName; const t = item.startDate; const a = item.action.trim().toLocaleUpperCase('tr-TR');
      const rowStart = getTimeInMinutes(item.startTime);
      const rowEnd = rowStart + (item.duration || 0);
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
    });

    Object.entries(dailyMap).forEach(([docName, dates]) => {
      summary[docName] = { actionDays: {}, totalCapacity: docCap[docName] || 0 };
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
      {/* Hafızadaki Dönemler Yönetim Alanı */}
      {data.length > 0 && (
        <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
             <div>
               <h4 className="text-lg font-black uppercase tracking-tight">Hafızadaki Dönem Kayıtları</h4>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Birden fazla ay hafızada biriktirilmiştir.</p>
             </div>
             <div className="flex flex-wrap gap-3">
               {loadedPeriods.map(p => (
                 <div key={`${p.month}-${p.year}`} className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all ${selectedMonth === p.month && selectedYear === p.year ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <button onClick={() => { setSelectedMonth(p.month); setSelectedYear(p.year); }} className="text-xs font-black uppercase tracking-widest">{p.month} {p.year}</button>
                    <button onClick={() => { if(window.confirm(`${p.month} ${p.year} verisini sileyim mi?`)) onRemoveMonth(p.month, p.year); }} className="text-white/30 hover:text-rose-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-wrap items-end gap-6">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HASTANE</label>
            <select
              value={selectedHospital}
              onChange={(e) => onHospitalChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-900 outline-none cursor-pointer min-w-[240px]"
            >
              <option value="">Hastane Seçiniz</option>
              {allowedHospitals.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">YIL</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-900 outline-none cursor-pointer">
              <option value={0}>Yıl Seçiniz</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AY</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-900 outline-none cursor-pointer">
              <option value="">Ay Seçiniz</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button
            onClick={async () => {
              if (!selectedHospital || !selectedMonth || !selectedYear) {
                alert('Lütfen hastane, ay ve yıl seçiniz!');
                return;
              }
              setIsLoading(true);
              try {
                await onLoadData(selectedHospital, selectedMonth, selectedYear);
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading || !selectedHospital || !selectedMonth || !selectedYear}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-green-700 transition-all uppercase tracking-widest shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            {isLoading ? 'YÜKLENIYOR...' : 'UYGULA'}
          </button>
        </div>
        <div className="flex-1 min-w-[200px] flex flex-col gap-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HEKİM ARA</label>
          <input
            type="text" placeholder="Hekim adı soyadı..."
            className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 ring-blue-500/20"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setViewMode('summary')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Aylık Özet</button>
          <button onClick={() => setViewMode('list')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Detaylı Satırlar</button>
        </div>
        <label className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black cursor-pointer hover:bg-blue-700 transition-all uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          DOSYA YÜKLE
          <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => {
            if (e.target.files?.length) {
              setLastUploadTarget({ hospital: selectedHospital, month: selectedMonth, year: selectedYear });
              onImportExcel(e.target.files, selectedHospital, selectedMonth, selectedYear);
              e.target.value = '';
            }
          }} />
        </label>
        <button onClick={async () => {
          const { getDetailedScheduleFiles } = await import('../src/services/detailedScheduleStorage');
          const files = await getDetailedScheduleFiles();
          const fileList = files.map(f => `${f.hospital} - ${f.month} ${f.year} (${f.recordCount} kayıt)`).join('\n');
          alert(`Veri Durumu:\n\nFirebase Storage:\n- Yüklü dosya sayısı: ${files.length}\n\nDosyalar:\n${fileList || 'Yok'}\n\nMemory:\n- State kayıt: ${data.length}`);
        }} className="px-6 py-3 text-xs font-black text-purple-600 hover:bg-purple-50 rounded-2xl transition-all uppercase border border-purple-100">Debug</button>
        {data.length > 0 && (
          <button onClick={() => { if(window.confirm("Tüm aylar hafızadan silinecek! Emin misiniz?")) onClearAll(); }} className="px-6 py-3 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-2xl transition-all uppercase border border-rose-100">Belleği Boşalt</button>
        )}
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h4 className="text-xl font-black text-slate-900 uppercase italic underline decoration-indigo-500 decoration-4 underline-offset-8 leading-relaxed">
              {selectedMonth} {selectedYear} Analiz Raporu
            </h4>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-3">
              YARIM GÜN (AM/PM) ESASLI: Sabah (08-12) ve Öğle (13-17) oturumları ayrı değerlendirilir.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Hekim Ad Soyad</th>
                  <th className="px-10 py-6 text-[11px] font-black text-blue-600 uppercase tracking-widest text-center bg-blue-50/30">TOPLAM KAPASİTE</th>
                  {activeActions.map(action => (
                    <th key={action} className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center border-l border-slate-50">{action} (GÜN)</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(summaryData).length > 0 ? Object.entries(summaryData).map(([name, stats]: [string, DoctorSummary]) => (
                  <tr key={name} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-10 py-6 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <p className="font-black text-slate-900 uppercase text-sm leading-normal">{name}</p>
                    </td>
                    <td className="px-10 py-6 text-center">
                       <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl font-black text-xs border border-blue-200">{stats.totalCapacity.toLocaleString('tr-TR')}</span>
                    </td>
                    {activeActions.map(action => {
                      const dayCount = stats.actionDays[action] || 0;
                      return (
                        <td key={action} className={`px-10 py-6 text-center font-black border-l border-slate-50/50 ${dayCount > 0 ? 'text-slate-800' : 'text-slate-200'}`}>
                          {dayCount % 1 === 0 ? dayCount : dayCount.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={activeActions.length + 2} className="px-10 py-32 text-center text-slate-300 uppercase font-black tracking-widest opacity-40">Seçili dönem için veri bulunamadı</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksiyon Tarihi</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hekim Ad Soyad</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksiyon</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Başlangıç / Bitiş (Süre)</th>
                  <th className="px-8 py-5 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Kapasite</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.length > 0 ? filteredData.slice(0, 1000).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-4 font-bold text-slate-600 text-xs">{item.startDate}</td>
                    <td className="px-8 py-4 font-black text-slate-900 uppercase text-xs">{item.doctorName}</td>
                    <td className="px-8 py-4">
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{item.action}</span>
                    </td>
                    <td className="px-8 py-4 text-center text-xs font-bold text-slate-400">
                      {item.startTime} - {item.endTime}
                      <span className="ml-2 text-indigo-500 font-black">({item.duration} dk)</span>
                    </td>
                    <td className="px-8 py-4 text-center"><span className="font-black text-slate-700 text-sm">{item.capacity || '-'}</span></td>
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => onDelete(item.id)} className="text-rose-300 hover:text-rose-600 p-2 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-10 py-32 text-center text-slate-300 uppercase font-black tracking-widest opacity-40">Seçili dönem için veri bulunamadı</td>
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
