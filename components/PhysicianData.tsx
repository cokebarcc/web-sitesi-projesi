
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DetailedScheduleData, MuayeneMetrics } from '../types';
import { MONTHS, YEARS } from '../constants';
import { normalizeDoctorName, getPeriodKey } from '../utils/formatters';
import { uploadMuayeneFile, uploadAmeliyatFile } from '../src/services/physicianDataStorage';
import { auth } from '../firebase';
import DataFilterPanel from './common/DataFilterPanel';

interface PhysicianDataProps {
  data: DetailedScheduleData[];
  onNavigateToDetailed: () => void;
  // Shared state props
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  setMuayeneByPeriod: React.Dispatch<React.SetStateAction<Record<string, Record<string, MuayeneMetrics>>>>;
  ameliyatByPeriod: Record<string, Record<string, number>>;
  setAmeliyatByPeriod: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  muayeneMetaByPeriod: Record<string, { fileName: string; uploadedAt: number }>;
  setMuayeneMetaByPeriod: React.Dispatch<React.SetStateAction<Record<string, { fileName: string; uploadedAt: number }>>>;
  ameliyatMetaByPeriod: Record<string, { fileName: string; uploadedAt: number }>;
  setAmeliyatMetaByPeriod: React.Dispatch<React.SetStateAction<Record<string, { fileName: string; uploadedAt: number }>>>;
  // Global month/year filters
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  // Hospital filter
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Load period data function
  onLoadPeriodData: (hospital: string, year: number, month: string) => Promise<void>;
  // Upload permission
  canUpload?: boolean;
}

interface MergedPhysician {
  name: string;
  branch: string;
  mhrsMuayene: number;
  ayaktanMuayene: number;
  toplamMuayene: number;
  ameliyatCount: number;
}

const PhysicianData: React.FC<PhysicianDataProps> = ({
  data,
  onNavigateToDetailed,
  muayeneByPeriod,
  setMuayeneByPeriod,
  ameliyatByPeriod,
  setAmeliyatByPeriod,
  muayeneMetaByPeriod,
  setMuayeneMetaByPeriod,
  ameliyatMetaByPeriod,
  setAmeliyatMetaByPeriod,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  onLoadPeriodData,
  canUpload = false
}) => {

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof MergedPhysician>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const periodKey = selectedYear > 0 && selectedMonth && selectedHospital
    ? `${selectedHospital}-${getPeriodKey(selectedYear, selectedMonth)}`
    : '';

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === "" || val === "-") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
    } else {
        str = str.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const handleFileUpload = async (files: FileList | null, type: 'muayene' | 'ameliyat') => {
    if (!files || files.length === 0) return;
    if (!selectedHospital || !selectedMonth || selectedYear === 0) {
      showToast("Lütfen önce hastane, ay ve yıl seçin.", "error");
      return;
    }
    if (!auth.currentUser?.email) {
      showToast("Dosya yüklemek için giriş yapmalısınız.", "error");
      return;
    }

    const file = files[0];

    try {
      if (type === 'muayene') {
        showToast("Muayene dosyası yükleniyor...", "success");
        const result = await uploadMuayeneFile(file, selectedHospital, selectedMonth, selectedYear, auth.currentUser.email);

        if (result.success && result.data) {
          setMuayeneByPeriod(prev => ({ ...prev, [periodKey]: result.data! }));
          setMuayeneMetaByPeriod(prev => ({ ...prev, [periodKey]: { fileName: file.name, uploadedAt: Date.now() } }));
          showToast(`✅ ${result.recordCount} hekim muayene verisi yüklendi ve Storage'a kaydedildi.`, 'success');
        } else {
          showToast(`❌ ${result.error}`, 'error');
        }
      } else if (type === 'ameliyat') {
        showToast("Ameliyat dosyası yükleniyor...", "success");
        const result = await uploadAmeliyatFile(file, selectedHospital, selectedMonth, selectedYear, auth.currentUser.email);

        if (result.success && result.data) {
          setAmeliyatByPeriod(prev => ({ ...prev, [periodKey]: result.data! }));
          setAmeliyatMetaByPeriod(prev => ({ ...prev, [periodKey]: { fileName: file.name, uploadedAt: Date.now() } }));
          showToast(`✅ ${result.recordCount} hekim ameliyat verisi yüklendi ve Storage'a kaydedildi.`, 'success');
        } else {
          showToast(`❌ ${result.error}`, 'error');
        }
      }
    } catch (err) {
      console.error('❌ Dosya yükleme hatası:', err);
      showToast("Dosya yükleme hatası.", "error");
    }
  };

  const clearPeriodData = (type: 'muayene' | 'ameliyat') => {
    if (type === 'muayene') {
      setMuayeneByPeriod(prev => { const n = { ...prev }; delete n[periodKey]; return n; });
      setMuayeneMetaByPeriod(prev => { const n = { ...prev }; delete n[periodKey]; return n; });
      showToast(`${selectedMonth} ${selectedYear} muayene verisi temizlendi.`, "warning");
    } else {
      setAmeliyatByPeriod(prev => { const n = { ...prev }; delete n[periodKey]; return n; });
      setAmeliyatMetaByPeriod(prev => { const n = { ...prev }; delete n[periodKey]; return n; });
      showToast(`${selectedMonth} ${selectedYear} ameliyat verisi temizlendi.`, "warning");
    }
  };

  const rosterForPeriod = useMemo(() => {
    // Filtreler boşsa boş array döndür
    if (!selectedMonth || selectedYear === 0) return [];

    const physMap = new Map<string, { name: string; branch: string }>();
    data.filter(d => d.month === selectedMonth && d.year === selectedYear).forEach(item => {
      const name = item.doctorName.trim();
      const branch = item.specialty.trim();
      const key = `${normalizeDoctorName(name)}|${normalizeDoctorName(branch)}`;
      if (!physMap.has(key)) {
        physMap.set(key, { name, branch });
      }
    });
    return Array.from(physMap.values());
  }, [data, selectedMonth, selectedYear]);

  const mergedPhysicians = useMemo(() => {
    if (!periodKey) return [];

    const muayeneData = muayeneByPeriod[periodKey] || {};
    const ameliyatData = ameliyatByPeriod[periodKey] || {};

    return rosterForPeriod.map(p => {
      const normName = normalizeDoctorName(p.name);
      const mMetrics = muayeneData[normName] || { mhrs: 0, ayaktan: 0, toplam: 0 };
      return {
        name: p.name,
        branch: p.branch,
        mhrsMuayene: mMetrics.mhrs,
        ayaktanMuayene: mMetrics.ayaktan,
        toplamMuayene: mMetrics.toplam,
        ameliyatCount: ameliyatData[normName] || 0
      };
    });
  }, [rosterForPeriod, muayeneByPeriod, ameliyatByPeriod, periodKey]);

  const processedList = useMemo(() => {
    let result = mergedPhysicians;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLocaleLowerCase('tr-TR');
      result = result.filter(p => 
        p.name.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        p.branch.toLocaleLowerCase('tr-TR').includes(lowerSearch)
      );
    }
    result.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal, 'tr-TR') : bVal.localeCompare(aVal, 'tr-TR');
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return result;
  }, [mergedPhysicians, searchTerm, sortKey, sortOrder]);

  const activeMuayeneFile = muayeneMetaByPeriod[periodKey];
  const activeAmeliyatFile = ameliyatMetaByPeriod[periodKey];

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20">
      {toast && (
        <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-right-10 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Veri Filtreleme"
        showHospitalFilter={true}
        selectedHospital={selectedHospital}
        availableHospitals={allowedHospitals}
        onHospitalChange={onHospitalChange}
        showYearFilter={true}
        selectedYears={selectedYear > 0 ? [selectedYear] : []}
        availableYears={YEARS}
        onYearsChange={(years) => setSelectedYear(years.length > 0 ? years[0] as number : 0)}
        showMonthFilter={true}
        selectedMonths={selectedMonth ? [MONTHS.indexOf(selectedMonth) + 1] : []}
        onMonthsChange={(months) => setSelectedMonth(months.length > 0 ? MONTHS[(months[0] as number) - 1] : '')}
        showApplyButton={true}
        onApply={async () => {
          if (selectedHospital && selectedYear > 0 && selectedMonth) {
            await onLoadPeriodData(selectedHospital, selectedYear, selectedMonth);
          } else {
            showToast('Lütfen hastane, yıl ve ay seçin', 'warning');
          }
        }}
        applyDisabled={!selectedHospital || selectedYear === 0 || !selectedMonth}
        customFilters={
          <>
            {/* Hekim Ara */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-3)]">Ara</label>
              <div className="relative">
                <input
                  type="text" placeholder="Hekim / Branş..."
                  className="pl-8 pr-3 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-1)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 w-[160px] h-[38px] placeholder-[var(--text-placeholder)]"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>

            {/* Muayene Dosyası - Sadece yükleme izni varsa göster */}
            {canUpload && (
              <div className="flex items-center gap-1">
                <label className={`flex items-center gap-2 px-3 py-2 h-[38px] rounded-lg font-semibold text-xs cursor-pointer transition-all active:scale-95 shadow-lg ${activeMuayeneFile ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-[var(--surface-2)] border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {activeMuayeneFile ? 'Muayene ✓' : 'Muayene'}
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e.target.files, 'muayene')} />
                </label>
                {activeMuayeneFile && (
                  <button onClick={() => clearPeriodData('muayene')} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors border border-rose-500/30">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}

            {/* Ameliyat Dosyası - Sadece yükleme izni varsa göster */}
            {canUpload && (
              <div className="flex items-center gap-1">
                <label className={`flex items-center gap-2 px-3 py-2 h-[38px] rounded-lg font-semibold text-xs cursor-pointer transition-all active:scale-95 shadow-lg ${activeAmeliyatFile ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-[var(--surface-2)] border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12V3" /></svg>
                  {activeAmeliyatFile ? 'Ameliyat ✓' : 'Ameliyat'}
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e.target.files, 'ameliyat')} />
                </label>
                {activeAmeliyatFile && (
                  <button onClick={() => clearPeriodData('ameliyat')} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors border border-rose-500/30">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}
          </>
        }
      />

      {/* Yüklü dosya bilgileri */}
      {(activeMuayeneFile || activeAmeliyatFile) && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-2xl shadow-lg border border-[var(--glass-border)] p-4">
          <div className="flex gap-4">
            {activeMuayeneFile && (
              <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/30">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight">Muayene: {activeMuayeneFile.fileName}</span>
              </div>
            )}
            {activeAmeliyatFile && (
              <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-xl border border-emerald-500/30">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-tight">Ameliyat: {activeAmeliyatFile.fileName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {rosterForPeriod.length > 0 ? (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
          <div className="p-8 border-b border-[var(--border-1)] bg-[var(--surface-2)] flex justify-between items-center">
            <div>
              <h4 className="text-xl font-black text-[var(--text-1)] uppercase italic">Performans Listesi: {selectedMonth} {selectedYear}</h4>
              <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-2">Dönem hekim kadrosu detaylı cetvellerden otomatik oluşturulmuştur.</p>
            </div>
            <div className="flex gap-4">
               <div className="bg-[var(--surface-1)] px-6 py-3 rounded-2xl border border-[var(--border-2)] text-center">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">Toplam Hekim</p>
                  <p className="text-xl font-black text-[var(--text-1)]">{rosterForPeriod.length}</p>
               </div>
               <div className="bg-[var(--surface-1)] px-6 py-3 rounded-2xl border border-[var(--border-2)] text-center">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">Aktif Branş</p>
                  <p className="text-xl font-black text-[var(--text-1)]">{new Set(rosterForPeriod.map(m => normalizeDoctorName(m.branch))).size}</p>
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--table-header-bg)] border-b border-[var(--table-border)]">
                <tr>
                  <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest cursor-pointer hover:text-blue-400 transition-colors" onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center gap-2">Hekim Ad Soyad {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest">Branş</th>
                  <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors" style={{ color: 'var(--th-indigo)' }} onClick={() => { setSortKey('mhrsMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">MHRS Muayene {sortKey === 'mhrsMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors" style={{ color: 'var(--th-indigo)' }} onClick={() => { setSortKey('ayaktanMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">Ayaktan Muayene {sortKey === 'ayaktanMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors" style={{ color: 'var(--th-indigo)' }} onClick={() => { setSortKey('toplamMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">Toplam Muayene {sortKey === 'toplamMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors" style={{ color: 'var(--th-emerald)' }} onClick={() => { setSortKey('ameliyatCount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-center gap-2">A+B+C Ameliyat {sortKey === 'ameliyatCount' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-border)]">
                {processedList.length > 0 ? processedList.map((p, idx) => (
                  <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors group">
                    <td className="px-10 py-5"><p className="font-black text-[var(--text-1)] uppercase text-sm">{p.name}</p></td>
                    <td className="px-10 py-5"><span className="text-xs font-bold text-[var(--text-3)] uppercase">{p.branch}</span></td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border" style={p.mhrsMuayene > 0 ? { background: 'var(--badge-indigo-bg)', color: 'var(--badge-indigo-text)', borderColor: 'var(--badge-indigo-border)' } : { background: 'var(--surface-3)', color: 'var(--text-muted)', borderColor: 'var(--border-1)' }}>
                        {p.mhrsMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border" style={p.ayaktanMuayene > 0 ? { background: 'var(--badge-indigo-bg)', color: 'var(--badge-indigo-text)', borderColor: 'var(--badge-indigo-border)' } : { background: 'var(--surface-3)', color: 'var(--text-muted)', borderColor: 'var(--border-1)' }}>
                        {p.ayaktanMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border" style={p.toplamMuayene > 0 ? { background: 'var(--badge-indigo-strong-bg)', color: 'var(--badge-indigo-strong-text)', borderColor: 'var(--badge-indigo-strong-border)' } : { background: 'var(--surface-3)', color: 'var(--text-muted)', borderColor: 'var(--border-1)' }}>
                        {p.toplamMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-10 py-5 text-center">
                      <span className="inline-block min-w-[80px] px-4 py-2 rounded-xl font-black text-sm border" style={p.ameliyatCount > 0 ? { background: 'var(--badge-emerald-bg)', color: 'var(--badge-emerald-text)', borderColor: 'var(--badge-emerald-border)' } : { background: 'var(--surface-3)', color: 'var(--text-muted)', borderColor: 'var(--border-1)' }}>
                        {p.ameliyatCount.toLocaleString('tr-TR')}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-12 py-32 text-center text-[var(--text-muted)] font-black uppercase tracking-widest text-lg italic">Kayıtlı hekim veya arama sonucu bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-24 rounded-[24px] border border-dashed border-[var(--border-2)] text-center flex flex-col items-center gap-8 animate-in fade-in duration-500">
           <div className="w-24 h-24 bg-rose-500/10 rounded-[24px] flex items-center justify-center text-rose-400/50 border border-rose-500/20">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black text-[var(--text-muted)] uppercase tracking-widest">BU DÖNEM İÇİN KADRO BULUNAMADI</h4>
             <p className="text-[var(--text-muted)] font-medium max-w-md mx-auto mt-2 italic">Lütfen önce <strong className="text-[var(--text-2)]">Detaylı Cetveller</strong> modülünden {selectedMonth} {selectedYear} dönemine ait verileri yükleyiniz.</p>
           </div>
           <button
             onClick={onNavigateToDetailed}
             className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
           >
             CETVELLERE GİT
           </button>
        </div>
      )}
    </div>
  );
};

export default PhysicianData;
