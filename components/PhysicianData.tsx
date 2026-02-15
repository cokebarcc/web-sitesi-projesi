
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DetailedScheduleData, MuayeneMetrics } from '../types';
import { MONTHS, YEARS } from '../constants';
import { normalizeDoctorName, getPeriodKey } from '../utils/formatters';
import { uploadMuayeneFile, uploadAmeliyatFile } from '../src/services/physicianDataStorage';
import { auth } from '../firebase';
import DataFilterPanel from './common/DataFilterPanel';
import { GlassCard, GlassButton } from './ui';

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
  theme?: 'dark' | 'light';
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
  canUpload = false,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

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
        <GlassCard isDark={isDark} variant="flat" hover={false} padding="p-4">
          <div className="flex gap-3">
            {activeMuayeneFile && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200/50'}`}>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                <span className={`text-[10px] font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Muayene: {activeMuayeneFile.fileName}</span>
              </div>
            )}
            {activeAmeliyatFile && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200/50'}`}>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className={`text-[10px] font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Ameliyat: {activeAmeliyatFile.fileName}</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {rosterForPeriod.length > 0 ? (
        <GlassCard isDark={isDark} hover={false} padding="p-0">
          <div className={`px-6 py-5 flex justify-between items-center border-b ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Performans Listesi: {selectedMonth} {selectedYear}</h4>
              <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Dönem hekim kadrosu detaylı cetvellerden otomatik oluşturulmuştur.</p>
            </div>
            <div className="flex gap-3">
               <div className={`px-4 py-2 rounded-xl text-center ${isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-slate-50 border border-black/[0.05]'}`}>
                  <p className={`text-[9px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Toplam Hekim</p>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{rosterForPeriod.length}</p>
               </div>
               <div className={`px-4 py-2 rounded-xl text-center ${isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-slate-50 border border-black/[0.05]'}`}>
                  <p className={`text-[9px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Aktif Branş</p>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{new Set(rosterForPeriod.map(m => normalizeDoctorName(m.branch))).size}</p>
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr className={isDark ? 'bg-white/[0.04]' : 'bg-slate-50/80'}>
                  <th className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-slate-500 border-b border-black/[0.06]'}`} onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center gap-1.5">Hekim Ad Soyad {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-slate-500 border-b border-black/[0.06]'}`}>Branş</th>
                  <th className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-center cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 border-b border-white/[0.06]' : 'text-indigo-600 border-b border-black/[0.06]'}`} onClick={() => { setSortKey('mhrsMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-1.5">MHRS Muayene {sortKey === 'mhrsMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-center cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 border-b border-white/[0.06]' : 'text-indigo-600 border-b border-black/[0.06]'}`} onClick={() => { setSortKey('ayaktanMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-1.5">Ayaktan Muayene {sortKey === 'ayaktanMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-center cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 border-b border-white/[0.06]' : 'text-indigo-600 border-b border-black/[0.06]'}`} onClick={() => { setSortKey('toplamMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-1.5">Toplam Muayene {sortKey === 'toplamMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-center cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-emerald-400 border-b border-white/[0.06]' : 'text-emerald-600 border-b border-black/[0.06]'}`} onClick={() => { setSortKey('ameliyatCount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-center gap-1.5">A+B+C Ameliyat {sortKey === 'ameliyatCount' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedList.length > 0 ? processedList.map((p, idx) => (
                  <tr key={idx} className={`transition-colors duration-150 ${
                    idx % 2 === 1 ? (isDark ? 'bg-white/[0.015]' : 'bg-black/[0.015]') : ''
                  } ${isDark ? 'hover:bg-white/[0.04] border-b border-white/[0.04]' : 'hover:bg-sky-50/50 border-b border-black/[0.04]'}`}>
                    <td className={`px-5 py-3 text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name}</td>
                    <td className={`px-5 py-3 text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.branch}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block min-w-[50px] px-2.5 py-1 rounded-lg font-semibold text-xs ${
                        p.mhrsMuayene > 0
                          ? isDark ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-200/50'
                          : isDark ? 'bg-white/[0.03] text-slate-600 border border-white/[0.06]' : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                      }`}>
                        {p.mhrsMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block min-w-[50px] px-2.5 py-1 rounded-lg font-semibold text-xs ${
                        p.ayaktanMuayene > 0
                          ? isDark ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-200/50'
                          : isDark ? 'bg-white/[0.03] text-slate-600 border border-white/[0.06]' : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                      }`}>
                        {p.ayaktanMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block min-w-[50px] px-2.5 py-1 rounded-lg font-bold text-xs ${
                        p.toplamMuayene > 0
                          ? isDark ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/25' : 'bg-indigo-100 text-indigo-700 border border-indigo-300/50'
                          : isDark ? 'bg-white/[0.03] text-slate-600 border border-white/[0.06]' : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                      }`}>
                        {p.toplamMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block min-w-[60px] px-3 py-1.5 rounded-lg font-bold text-sm ${
                        p.ameliyatCount > 0
                          ? isDark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                          : isDark ? 'bg-white/[0.03] text-slate-600 border border-white/[0.06]' : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                      }`}>
                        {p.ameliyatCount.toLocaleString('tr-TR')}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={`px-8 py-16 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Kayıtlı hekim veya arama sonucu bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        <GlassCard isDark={isDark} hover={false} padding="p-16">
          <div className="text-center flex flex-col items-center gap-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-200/50'}`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-rose-400/50' : 'text-rose-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h4 className={`text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bu Dönem İçin Kadro Bulunamadı</h4>
              <p className={`text-sm max-w-md mx-auto mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Lütfen önce <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>Detaylı Cetveller</strong> modülünden {selectedMonth} {selectedYear} dönemine ait verileri yükleyiniz.</p>
            </div>
            <GlassButton isDark={isDark} variant="primary" size="md" onClick={onNavigateToDetailed}>
              Cetvellere Git
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default PhysicianData;
