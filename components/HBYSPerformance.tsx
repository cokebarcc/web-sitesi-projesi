
import React, { useState, useMemo } from 'react';
import { HBYSData, DetailedScheduleData } from '../types';
import { MONTHS, YEARS } from '../constants';

interface HBYSPerformanceProps {
  data: HBYSData[];
  detailedScheduleData: DetailedScheduleData[];
  onImportHBYSExams: (files: FileList | null, month: string, year: number) => void;
  onImportHBYSSurgeries: (files: FileList | null, month: string, year: number) => void;
  onDelete: (id: string) => void;
  onClearMonth: (month: string, year: number) => void;
}

const HBYSPerformance: React.FC<HBYSPerformanceProps> = ({ data, detailedScheduleData, onImportHBYSExams, onImportHBYSSurgeries, onDelete, onClearMonth }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Aralık');
  const [selectedYear, setSelectedYear] = useState<number>(2025);

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
    const periodSchedules = detailedScheduleData.filter(d => d.month === selectedMonth && d.year === selectedYear);
    const uniqueDocs = new Map<string, { doctorName: string; specialty: string }>();
    
    periodSchedules.forEach(s => {
      const key = `${normalizeStr(s.doctorName)}|${normalizeStr(s.specialty)}`;
      if (!uniqueDocs.has(key)) {
        uniqueDocs.set(key, { doctorName: s.doctorName, specialty: s.specialty });
      }
    });

    return Array.from(uniqueDocs.values()).sort((a, b) => a.doctorName.localeCompare(b.doctorName, 'tr-TR'));
  }, [detailedScheduleData, selectedMonth, selectedYear]);

  // Performans verilerini hekim listesiyle harmanla
  const mergedPerformanceData = useMemo(() => {
    const periodHBYS = data.filter(h => h.month === selectedMonth && h.year === selectedYear);
    
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
  }, [scheduledPhysicians, data, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DÖNEM AYI</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none cursor-pointer hover:bg-slate-100 transition-colors w-full sm:w-48">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DÖNEM YILI</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none cursor-pointer hover:bg-slate-100 transition-colors w-full sm:w-32">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <button onClick={() => onClearMonth(selectedMonth, selectedYear)} disabled={mergedPerformanceData.filter(d => !d.isTemp).length === 0} className="px-6 py-4 rounded-2xl text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-rose-100 transition-all disabled:opacity-30 uppercase tracking-widest">Dönemi Temizle</button>
          
          <label className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black cursor-pointer hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-3 uppercase tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Muayene Sayılarını Yükle
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { onImportHBYSExams(e.target.files, selectedMonth, selectedYear); e.target.value = ''; }} />
          </label>

          <label className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black cursor-pointer hover:bg-slate-800 transition shadow-lg active:scale-95 flex items-center gap-3 uppercase tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.319l-3.08 1.925a1 1 0 001.06 1.698l3.08-1.925a2 2 0 011.183-.319l2.533.362a6 6 0 003.86-.517l.318-.158a6 6 0 013.86-.517l2.387.477a2 2 0 011.022.547l3.08 1.925a1 1 0 001.06-1.698l-3.08-1.925z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 12V3" /></svg>
            Cerrahi Vakaları Yükle
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { onImportHBYSSurgeries(e.target.files, selectedMonth, selectedYear); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      
      <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/30 gap-4">
          <div>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Hekim Verileri: {selectedMonth} {selectedYear}</h4>
            <p className="text-slate-500 text-sm mt-1 font-medium tracking-wide">Excel'deki veriler mevcut cetveldeki hekimlerle otomatik eşleştirilir.</p>
          </div>
          <div className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg tracking-widest">{mergedPerformanceData.length} HEKİM TAKİPTE</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Hekim Adı Soyadı</th>
                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Toplam Muayene</th>
                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">A+B+C Ameliyat</th>
                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mergedPerformanceData.length > 0 ? mergedPerformanceData.map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="font-black text-slate-900 uppercase text-sm">{item.doctorName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{item.specialty}</p>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`text-lg font-black ${item.totalExams > 0 ? 'text-blue-600' : 'text-slate-200'}`}>
                      {item.totalExams > 0 ? item.totalExams.toLocaleString('tr-TR') : '0'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`text-lg font-black ${item.surgeryABC > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                      {item.surgeryABC > 0 ? item.surgeryABC.toLocaleString('tr-TR') : '0'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    {!item.isTemp ? (
                      <button onClick={() => onDelete(item.id)} className="p-3 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    ) : (
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Veri Bekleniyor</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-10 py-40 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <p className="font-black italic text-xl uppercase tracking-widest">HİÇ HEKİM KAYDI YOK</p>
                      <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">Veri yüklemeden önce lütfen "Cetveller" modülünden Excel yükleyerek hekim listesini oluşturun.</p>
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
