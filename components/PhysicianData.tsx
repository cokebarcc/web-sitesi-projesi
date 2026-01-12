
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DetailedScheduleData, MuayeneMetrics } from '../types';
import { MONTHS, YEARS } from '../constants';
import { normalizeDoctorName, getPeriodKey } from '../utils/formatters';
import { uploadMuayeneFile, uploadAmeliyatFile } from '../src/services/physicianDataStorage';
import { auth } from '../firebase';

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
  onLoadPeriodData
}) => {

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof MergedPhysician>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const periodKey = selectedYear > 0 && selectedMonth ? getPeriodKey(selectedYear, selectedMonth) : '';

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
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {toast && (
        <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-right-10 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
          <div className="flex flex-wrap items-end gap-4 w-full xl:w-auto">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">HASTANE</p>
              <select
                value={selectedHospital}
                onChange={(e) => onHospitalChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 ring-indigo-50 transition-all cursor-pointer min-w-[240px]"
              >
                <option value="">Hastane Seçin</option>
                {allowedHospitals.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">YIL</p>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 text-white rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all cursor-pointer"
              >
                <option value={0}>Yıl Seçin</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">AY</p>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 ring-indigo-50 transition-all cursor-pointer"
                >
                  <option value="">Ay Seçin</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <button
                onClick={async () => {
                  if (selectedHospital && selectedYear > 0 && selectedMonth) {
                    await onLoadPeriodData(selectedHospital, selectedYear, selectedMonth);
                  } else {
                    showToast('Lütfen hastane, yıl ve ay seçin', 'warning');
                  }
                }}
                disabled={!selectedHospital || selectedYear === 0 || !selectedMonth}
                className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                  selectedHospital && selectedYear > 0 && selectedMonth
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-xl hover:scale-105 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                UYGULA
              </button>
            </div>
            <div className="flex flex-col gap-2 flex-1 md:min-w-[300px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">HEKİM / BRANŞ ARA</p>
              <div className="relative">
                <input
                  type="text" placeholder="Hekim veya Branş adı..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-sm font-bold outline-none focus:ring-4 ring-indigo-50 transition-all"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">MUAYENE DOSYASI</p>
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-lg ${activeMuayeneFile ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {activeMuayeneFile ? 'Güncelle' : 'Excel Yükle'}
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e.target.files, 'muayene')} />
                </label>
                {activeMuayeneFile && (
                  <button onClick={() => clearPeriodData('muayene')} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors border border-rose-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">AMELİYAT DOSYASI</p>
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-lg ${activeAmeliyatFile ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.319l-3.08 1.925a1 1 0 001.06 1.698l3.08-1.925a2 2 0 011.183-.319l2.533.362a6 6 0 003.86-.517l.318-.158a6 6 0 013.86-.517l2.387.477a2 2 0 011.022.547l3.08 1.925a1 1 0 001.06-1.698l-3.08-1.925z" /></svg>
                  {activeAmeliyatFile ? 'Güncelle' : 'Excel Yükle'}
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e.target.files, 'ameliyat')} />
                </label>
                {activeAmeliyatFile && (
                  <button onClick={() => clearPeriodData('ameliyat')} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors border border-rose-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {(activeMuayeneFile || activeAmeliyatFile) && (
          <div className="flex gap-4 pt-4 border-t border-slate-50">
            {activeMuayeneFile && (
              <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight">Muayene: {activeMuayeneFile.fileName}</span>
              </div>
            )}
            {activeAmeliyatFile && (
              <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Ameliyat: {activeAmeliyatFile.fileName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {rosterForPeriod.length > 0 ? (
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase italic">Performans Listesi: {selectedMonth} {selectedYear}</h4>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Dönem hekim kadrosu detaylı cetvellerden otomatik oluşturulmuştur.</p>
            </div>
            <div className="flex gap-4">
               <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Toplam Hekim</p>
                  <p className="text-xl font-black text-slate-900">{rosterForPeriod.length}</p>
               </div>
               <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Aktif Branş</p>
                  <p className="text-xl font-black text-slate-900">{new Set(rosterForPeriod.map(m => normalizeDoctorName(m.branch))).size}</p>
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600" onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center gap-2">Hekim Ad Soyad {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Branş</th>
                  <th className="px-6 py-6 text-[11px] font-black text-indigo-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-50" onClick={() => { setSortKey('mhrsMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">MHRS Muayene {sortKey === 'mhrsMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-6 text-[11px] font-black text-indigo-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-50" onClick={() => { setSortKey('ayaktanMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">Ayaktan Muayene {sortKey === 'ayaktanMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-6 text-[11px] font-black text-indigo-700 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-50" onClick={() => { setSortKey('toplamMuayene'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                     <div className="flex items-center justify-center gap-2">Toplam Muayene {sortKey === 'toplamMuayene' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-10 py-6 text-[11px] font-black text-emerald-600 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-50" onClick={() => { setSortKey('ameliyatCount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-center gap-2">A+B+C Ameliyat {sortKey === 'ameliyatCount' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processedList.length > 0 ? processedList.map((p, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-10 py-6"><p className="font-black text-slate-900 uppercase text-sm">{p.name}</p></td>
                    <td className="px-10 py-6"><span className="text-xs font-bold text-slate-500 uppercase">{p.branch}</span></td>
                    <td className="px-6 py-6 text-center">
                      <span className={`inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border ${p.mhrsMuayene > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                        {p.mhrsMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border ${p.ayaktanMuayene > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                        {p.ayaktanMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`inline-block min-w-[60px] px-3 py-1.5 rounded-xl font-black text-xs border ${p.toplamMuayene > 0 ? 'bg-indigo-100 text-indigo-800 border-indigo-200 shadow-md' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                        {p.toplamMuayene.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={`inline-block min-w-[80px] px-4 py-2 rounded-xl font-black text-sm border ${p.ameliyatCount > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                        {p.ameliyatCount.toLocaleString('tr-TR')}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-12 py-32 text-center text-slate-300 font-black uppercase tracking-widest text-lg opacity-50 italic">Kayıtlı hekim veya arama sonucu bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-32 rounded-[48px] border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-8 shadow-inner animate-in fade-in duration-500">
           <div className="w-24 h-24 bg-rose-50 rounded-[40px] flex items-center justify-center text-rose-200 shadow-inner">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black text-slate-400 uppercase tracking-widest">BU DÖNEM İÇİN KADRO BULUNAMADI</h4>
             <p className="text-slate-400 font-medium max-w-md mx-auto mt-2 italic">Lütfen önce <strong>Detaylı Cetveller</strong> modülünden {selectedMonth} {selectedYear} dönemine ait verileri yükleyiniz.</p>
           </div>
           <button 
             onClick={onNavigateToDetailed}
             className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
           >
             CETVELLERE GİT
           </button>
        </div>
      )}
    </div>
  );
};

export default PhysicianData;
