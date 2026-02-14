
import React, { useState, useMemo } from 'react';
import { AppointmentData } from '../types';
import { MONTHS, YEARS } from '../constants';

interface ScheduleTableProps {
  data: AppointmentData[];
  selectedBranch: string | null;
  onImportExcel: (files: FileList | null, month: string, year: number) => void;
  onDelete: (id: string) => void;
  onClearMonth: (month: string, year: number) => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ data, selectedBranch, onImportExcel, onDelete, onClearMonth }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Kasım');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const branchMatch = !selectedBranch || item.specialty === selectedBranch;
      const monthMatch = item.month === selectedMonth;
      const yearMatch = item.year === selectedYear;
      return branchMatch && monthMatch && yearMatch;
    });
  }, [data, selectedBranch, selectedMonth, selectedYear]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => a.doctorName.localeCompare(b.doctorName));
  }, [filteredData]);

  const getActionBadgeColor = (type: string) => {
    const norm = (type || '').toLocaleLowerCase('tr-TR');
    if (norm.includes('muayene') || norm.includes('poliklinik')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (norm.includes('ameliyat')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (norm.includes('nobet')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (norm.includes('izin')) return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[32px] shadow-sm border flex flex-col lg:flex-row justify-between items-center gap-6" style={{ borderColor: 'var(--border-2)' }}>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--text-3)' }}>DÖNEM AYI</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded-2xl px-5 py-3 text-sm font-black outline-none cursor-pointer transition-colors w-40" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--text-1)' }}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--text-3)' }}>DÖNEM YILI</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="border rounded-2xl px-5 py-3 text-sm font-black outline-none cursor-pointer transition-colors w-32" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--text-1)' }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
          <button onClick={() => onClearMonth(selectedMonth, selectedYear)} disabled={sortedData.length === 0} className="px-6 py-4 rounded-2xl text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-rose-100 transition-all disabled:opacity-30 uppercase tracking-widest">Dönemi Temizle</button>
          <label className="bg-[#10b981] text-white px-10 py-4 rounded-2xl text-xs font-black cursor-pointer hover:bg-[#059669] transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-3 uppercase tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Excel Yükle
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { if(e.target.files) onImportExcel(e.target.files, selectedMonth, selectedYear); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      
      <div className="bg-white rounded-[40px] shadow-xl border overflow-hidden" style={{ borderColor: 'var(--border-2)' }}>
        <div className="p-10 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white gap-4" style={{ borderColor: 'var(--border-2)' }}>
          <div>
            <h4 className="text-2xl font-black tracking-tight uppercase" style={{ color: 'var(--text-1)' }}>Çalışma Cetveli: {selectedMonth} {selectedYear}</h4>
            <p className="text-xs mt-1 font-bold tracking-wide" style={{ color: 'var(--text-3)' }}>Hekimlerin {selectedMonth} {selectedYear} dönemine ait tüm faaliyetleri aşağıda listelenmiştir.</p>
          </div>
          <div className="text-right p-6 rounded-3xl shadow-sm border min-w-[140px] flex flex-col items-center" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
            <span className="text-4xl font-black text-blue-600 leading-none">{sortedData.length}</span>
            <p className="text-[10px] font-black uppercase tracking-widest mt-2" style={{ color: 'var(--text-3)' }}>Toplam Kayıt</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
              <tr>
                <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Hekim Adı</th>
                <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Aksiyon / Faaliyet</th>
                <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>Gün Sayısı</th>
                <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>MHRS Kapasite</th>
                <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--border-2)' } as React.CSSProperties}>
              {sortedData.length > 0 ? sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="font-black uppercase leading-tight text-sm" style={{ color: 'var(--text-1)' }}>{item.doctorName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-tight mt-1" style={{ color: 'var(--text-3)' }}>{item.specialty}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black border tracking-wider uppercase ${getActionBadgeColor(item.actionType)}`}>
                      {(item.actionType || 'BELİRSİZ')}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center font-black text-sm" style={{ color: 'var(--text-2)' }}>{item.daysCount} GÜN</td>
                  <td className="px-10 py-6">
                    {item.totalSlots && item.totalSlots > 0 ? (
                      <div className="w-48">
                        <div className="flex justify-between text-[10px] font-black mb-1.5 uppercase" style={{ color: 'var(--text-3)' }}>
                          <span>%{Math.round((item.bookedSlots! / item.totalSlots) * 100)} Tahmin</span>
                          <span className="text-blue-600">{item.totalSlots} Kapasite</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${(item.bookedSlots! / item.totalSlots) * 100}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}></div>
                        Poliklinik Dışı
                      </div>
                    )}
                  </td>
                  <td className="px-10 py-6 text-center">
                    <button onClick={() => { if(confirmingId === item.id) { onDelete(item.id); setConfirmingId(null); } else setConfirmingId(item.id); }} 
                      className={`px-6 py-2.5 rounded-2xl transition-all font-black text-[10px] border shadow-sm ${confirmingId === item.id ? 'bg-rose-600 text-white border-rose-500' : 'bg-white hover:text-rose-600'}`}
                      style={confirmingId !== item.id ? { color: 'var(--text-3)', borderColor: 'var(--border-2)' } : undefined}>
                      {confirmingId === item.id ? "SİLİNSİN Mİ?" : "SİL"}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-10 py-48 text-center" style={{ color: 'var(--text-3)' }}>
                    <div className="flex flex-col items-center gap-8">
                      <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'var(--surface-3)' }}>
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-3)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="font-black italic text-2xl uppercase tracking-[0.2em] opacity-60" style={{ color: 'var(--text-3)' }}>{selectedMonth} {selectedYear} İÇİN VERİ BULUNAMADI</p>
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

export default ScheduleTable;
