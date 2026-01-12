
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  DetailedScheduleData,
  ScheduleVersion,
  ProcessedPhysicianSummary,
  SessionActionStats
} from '../types';
import { MONTHS, YEARS } from '../constants';
import { saveVersionAsJson, loadAllChangeAnalysisVersions } from '../src/services/changeAnalysisStorage';
import { auth } from '../firebase';

interface ChangeAnalysisProps {
  versions: Record<string, Record<string, ScheduleVersion>>;
  setVersions: React.Dispatch<React.SetStateAction<Record<string, Record<string, ScheduleVersion>>>>;
  selectedBranch: string | null;
  // Hospital filters
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Global month/year filters
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  // Global cetvel label filters
  baselineLabel: string;
  setBaselineLabel: (label: string) => void;
  updatedLabel: string;
  setUpdatedLabel: (label: string) => void;
  // Admin check
  isAdmin: boolean;
}

const ChangeAnalysis: React.FC<ChangeAnalysisProps> = ({
  versions,
  setVersions,
  selectedBranch,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  baselineLabel,
  setBaselineLabel,
  updatedLabel,
  setUpdatedLabel,
  isAdmin
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load data for selected period
  const handleLoadPeriodData = async () => {
    if (!selectedHospital || !selectedMonth || selectedYear === 0) {
      showToast('Lütfen hastane, yıl ve ay seçin', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast('Veriler yükleniyor...', 'success');

    try {
      const loadedVersions = await loadAllChangeAnalysisVersions(selectedHospital, selectedMonth, selectedYear);
      const monthKey = `${selectedYear}-${selectedMonth}`;

      if (loadedVersions[monthKey] && Object.keys(loadedVersions[monthKey]).length > 0) {
        setVersions(prev => ({
          ...prev,
          [monthKey]: loadedVersions[monthKey]
        }));
        showToast(`${Object.keys(loadedVersions[monthKey]).length} versiyon yüklendi`, 'success');
      } else {
        showToast('Bu dönem için kayıtlı versiyon bulunamadı', 'warning');
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      showToast('Veri yükleme hatası', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cetvel silme fonksiyonu
  const handleDeleteVersion = (versionLabel: string) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(`"${versionLabel}" sürümünü silmek istediğinizden emin misiniz?`);
    if (!confirmDelete) return;

    setVersions(prev => {
      const updated = { ...prev };
      if (updated[monthKey]) {
        const { [versionLabel]: removed, ...rest } = updated[monthKey];
        updated[monthKey] = rest;
      }
      return updated;
    });

    // Silinen sürüm seçiliyse, seçimi temizle
    if (baselineLabel === versionLabel) setBaselineLabel('');
    if (updatedLabel === versionLabel) setUpdatedLabel('');
  };

  const monthKey = `${selectedYear}-${selectedMonth}`;
  
  const availableVersions = useMemo(() => {
    const periodVersions = versions[monthKey] || {};
    return Object.keys(periodVersions).sort((a, b) => periodVersions[b].timestamp - periodVersions[a].timestamp);
  }, [versions, monthKey]);

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\.|doç\./g, '');
  };

  const formatPct = (val: number) => {
    const formatted = Math.abs(val).toFixed(1).replace('.', ',');
    return `${val >= 0 ? '+' : '-'}${formatted}%`;
  };

  const toMins = (val: any): number => {
    if (val === null || val === undefined || val === "") return -1;
    if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
    if (typeof val === 'number') return Math.round(val * 1440);
    if (typeof val === 'string') {
      const p = val.trim().split(':');
      if (p.length >= 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
    }
    return -1;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedHospital || !selectedMonth || selectedYear === 0) {
      showToast('Lütfen önce hastane, ay ve yıl seçin', 'warning');
      e.target.value = '';
      return;
    }

    if (!auth.currentUser?.email) {
      showToast('Dosya yüklemek için giriş yapmalısınız', 'error');
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    showToast('Dosya işleniyor...', 'success');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      const allParsedRows: DetailedScheduleData[] = [];
      json.forEach((row, idx) => {
        const docName = String(row["Hekim Ad Soyad"] || "").trim().toLocaleUpperCase('tr-TR');
        if (!docName || docName.includes("TOPLAM")) return;

        const startMins = toMins(row["Aksiyon Başlangıç Saati"]);
        const endMins = toMins(row["Aksiyon Bitiş Saati"]);
        let dur = (startMins !== -1 && endMins !== -1) ? (endMins - startMins) : 480;
        if (dur < 0) dur += 1440;

        let dateStr = "01.01.2025";
        const rDate = row["Aksiyon Tarihi"];
        if (rDate instanceof Date) {
          dateStr = `${String(rDate.getDate()).padStart(2, '0')}.${String(rDate.getMonth() + 1).padStart(2, '0')}.${rDate.getFullYear()}`;
        } else if (rDate) {
          dateStr = String(rDate);
        }

        allParsedRows.push({
          id: `row-${Date.now()}-${idx}`,
          doctorName: docName,
          specialty: String(row["Klinik Adı"] || "BİLİNMİYOR").trim().toLocaleUpperCase('tr-TR'),
          hospital: "HOSPITAL",
          startDate: dateStr,
          startTime: String(row["Aksiyon Başlangıç Saati"] || "08:00"),
          endDate: dateStr,
          endTime: String(row["Aksiyon Bitiş Saati"] || "17:00"),
          action: String(row["Aksiyon"] || "BELİRSİZ").trim().toLocaleUpperCase('tr-TR'),
          slotCount: 0,
          duration: dur,
          capacity: Number(row["Randevu Kapasitesi"] || 0),
          month: selectedMonth,
          year: selectedYear
        });
      });

      const physMap: Record<string, ProcessedPhysicianSummary> = {};
      const dailyMinutes: Record<string, Record<string, Record<string, number>>> = {};

      allParsedRows.forEach(row => {
        const key = `${row.doctorName}||${row.specialty}`;
        const date = row.startDate;
        const action = row.action;

        if (!physMap[key]) physMap[key] = { name: row.doctorName, branch: row.specialty, totalCapacity: 0, totalWorkDays: 0, actionDays: {}, rawRows: [] };
        physMap[key].totalCapacity += row.capacity;
        physMap[key].rawRows.push(row);

        if (!dailyMinutes[key]) dailyMinutes[key] = {};
        if (!dailyMinutes[key][date]) dailyMinutes[key][date] = {};
        dailyMinutes[key][date][action] = (dailyMinutes[key][date][action] || 0) + row.duration;
      });

      // Günlük Aksiyon Belirleme (0.5 kuralı)
      Object.keys(dailyMinutes).forEach(key => {
        Object.keys(dailyMinutes[key]).forEach(date => {
          const actions = dailyMinutes[key][date];
          const sortedActions = Object.entries(actions).sort((a, b) => b[1] - a[1]);
          const totalMins = Object.values(actions).reduce((a, b) => a + b, 0);

          if (sortedActions.length === 0) return;

          const topAction = sortedActions[0];
          const secondAction = sortedActions[1];

          // İki aksiyon da anlamlı paya sahip mi? (%25+ veya 180dk+)
          const isSplit = secondAction && (
            (secondAction[1] / totalMins >= 0.25) || 
            (secondAction[1] >= 180)
          );

          if (isSplit) {
            physMap[key].actionDays[topAction[0]] = (physMap[key].actionDays[topAction[0]] || 0) + 0.5;
            physMap[key].actionDays[secondAction[0]] = (physMap[key].actionDays[secondAction[0]] || 0) + 0.5;
            physMap[key].totalWorkDays += 1;
          } else {
            physMap[key].actionDays[topAction[0]] = (physMap[key].actionDays[topAction[0]] || 0) + 1;
            physMap[key].totalWorkDays += 1;
          }
        });
      });

      const label = `Sürüm ${availableVersions.length + 1} (${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })})`;
      const newVersion: ScheduleVersion = {
        id: `v-${Date.now()}`, label, timestamp: Date.now(), fileName: file.name, monthKey, physicians: physMap,
        diagnostics: { rawRowsCount: json.length, validRowsCount: allParsedRows.length, invalidRowsCount: 0, mapping: {}, qualityIssues: { unparseableDate: 0, unparseableTime: 0, zeroDuration: 0 } }
      };

      // Save to Storage
      showToast('Versiyon Storage\'a kaydediliyor...', 'success');
      const saveResult = await saveVersionAsJson(
        newVersion,
        selectedHospital,
        selectedMonth,
        selectedYear,
        auth.currentUser!.email
      );

      if (saveResult.success) {
        setVersions(prev => ({ ...prev, [monthKey]: { ...(prev[monthKey] || {}), [newVersion.label]: newVersion } }));
        if (!baselineLabel) setBaselineLabel(newVersion.label);
        else setUpdatedLabel(newVersion.label);
        showToast(`✅ Versiyon "${label}" başarıyla kaydedildi`, 'success');
      } else {
        showToast(`❌ Storage kayıt hatası: ${saveResult.error}`, 'error');
      }

    } catch (err) {
      console.error(err);
      showToast('Dosya işleme hatası', 'error');
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const comparison = useMemo(() => {
    const base = versions[monthKey]?.[baselineLabel];
    const upd = versions[monthKey]?.[updatedLabel];
    if (!base || !upd) return null;

    const allDocKeys = Array.from(new Set([...Object.keys(base.physicians), ...Object.keys(upd.physicians)]));

    const processedDocs = allDocKeys.map(key => {
      const bPhys = base.physicians[key];
      const uPhys = upd.physicians[key];
      
      const name = uPhys?.name || bPhys?.name || "Bilinmiyor";
      const branch = uPhys?.branch || bPhys?.branch || "Bilinmiyor";
      
      const baseline_capacity: number = bPhys?.totalCapacity || 0;
      const updated_capacity: number = uPhys?.totalCapacity || 0;
      const capacity_delta: number = updated_capacity - baseline_capacity;
      
      const baseline_action_days = bPhys?.actionDays || {};
      const updated_action_days = uPhys?.actionDays || {};
      const all_actions = Array.from(new Set([...Object.keys(baseline_action_days), ...Object.keys(updated_action_days)]));
      
      const action_deltas: Record<string, number> = {};
      let has_action_change = false;
      all_actions.forEach(act => {
        const bDays = baseline_action_days[act] || 0;
        const uDays = updated_action_days[act] || 0;
        const delta = uDays - bDays;
        if (Math.abs(delta) >= 0.1) {
          action_deltas[act] = delta;
          has_action_change = true;
        }
      });

      return { id: key, name, branch, baseline_capacity, updated_capacity, capacity_delta, action_deltas, has_action_change, bPhys, uPhys, baseline_action_days, updated_action_days };
    });

    const isBranchFilterActive = selectedBranch && selectedBranch.trim() !== "" && normalizeStr(selectedBranch) !== normalizeStr("Tüm Branşlar");
    const filteredDocs = isBranchFilterActive 
      ? processedDocs.filter(d => normalizeStr(d.branch) === normalizeStr(selectedBranch))
      : processedDocs;

    const branchAgg: Record<string, { baseline: number, updated: number }> = {};
    filteredDocs.forEach(d => {
       if (!branchAgg[d.branch]) branchAgg[d.branch] = { baseline: 0, updated: 0 };
       branchAgg[d.branch].baseline += d.baseline_capacity;
       branchAgg[d.branch].updated += d.updated_capacity;
    });

    const topBranchChanges = Object.entries(branchAgg).map(([name, caps]) => {
      const delta = caps.updated - caps.baseline;
      const pct = caps.baseline > 0 ? (delta / caps.baseline) * 100 : (caps.updated > 0 ? 100 : 0);
      return { name, delta, pct };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

    const topDoctorDrivers = filteredDocs
      .filter(p => p.capacity_delta < -0.1)
      .map(p => ({ name: p.name, branch: p.branch, delta: p.capacity_delta, pct: p.baseline_capacity > 0 ? (p.capacity_delta / p.baseline_capacity) * 100 : -100 }))
      .sort((a, b) => a.delta - b.delta) 
      .slice(0, 5);

    // Cast the return object to 'any' to resolve inference issues in downstream useMemos and JSX.
    return { 
      phys_compare: filteredDocs.filter(d => Math.abs(d.capacity_delta) > 0.1 || d.has_action_change), 
      topBranchChanges, topDoctorDrivers,
      totalBaseCap: filteredDocs.reduce((s: number, p) => s + p.baseline_capacity, 0),
      totalUpdCap: filteredDocs.reduce((s: number, p) => s + p.updated_capacity, 0),
    } as any;
  }, [versions, monthKey, baselineLabel, updatedLabel, selectedBranch]);

  // Fix: Added explicit casting and Number() conversion for arithmetic reliability.
  const maxAbsBranchDelta = useMemo(() => {
    if (!comparison || !comparison.topBranchChanges.length) return 1;
    const deltas = comparison.topBranchChanges.map((b: any) => Math.abs(Number(b.delta)));
    return Math.max(...(deltas as number[]));
  }, [comparison]);

  // Fix: Added explicit casting and Number() conversion for arithmetic reliability.
  const maxAbsDoctorDelta = useMemo(() => {
    if (!comparison || !comparison.topDoctorDrivers.length) return 1;
    const deltas = comparison.topDoctorDrivers.map((d: any) => Math.abs(Number(d.delta)));
    return Math.max(...(deltas as number[]));
  }, [comparison]);

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {toast && (
        <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-right-10 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white p-8 lg:p-12 rounded-[48px] shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full -mr-40 -mt-40 blur-3xl opacity-60"></div>
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-tight italic mb-6">CETVEL KIYASLAMA MERKEZİ</h2>

            {/* Filtreler: Hastane → Yıl → Ay → Uygula */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">HASTANE</label>
                <select
                  value={selectedHospital}
                  onChange={(e) => onHospitalChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none uppercase transition-colors hover:border-indigo-200"
                >
                  <option value="">Hastane Seçiniz</option>
                  {allowedHospitals.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">YIL</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-900 text-white rounded-xl px-4 py-2 font-bold text-xs outline-none uppercase">
                  <option value={0}>Yıl Seçiniz</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">AY</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none uppercase transition-colors hover:border-indigo-200">
                  <option value="">Ay Seçiniz</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>

              <button
                onClick={handleLoadPeriodData}
                disabled={!selectedHospital || selectedYear === 0 || !selectedMonth || isProcessing}
                className={`px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                  selectedHospital && selectedYear > 0 && selectedMonth && !isProcessing
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-xl hover:scale-105 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                {isProcessing ? 'YÜKLENİYOR...' : 'UYGULA'}
              </button>
            </div>
          </div>

          {/* Cetvel Seçimleri */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* İlk Cetvel (Başlangıç) */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ESKİ SÜRÜM (BAŞLANGIÇ)</label>
              <div className="flex gap-2">
                <select value={baselineLabel} onChange={(e) => setBaselineLabel(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold shadow-sm outline-none focus:border-indigo-500 transition-all">
                  <option value="">Sürüm Seçiniz...</option>
                  {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {isAdmin && baselineLabel && (
                  <button
                    onClick={() => handleDeleteVersion(baselineLabel)}
                    className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-200"
                    title="Sürümü Sil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Güncel Cetvel (Kıyas) */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">YENİ SÜRÜM (KIYAS)</label>
              <div className="flex gap-2">
                <select value={updatedLabel} onChange={(e) => setUpdatedLabel(e.target.value)} className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 shadow-sm outline-none focus:border-rose-500 transition-all">
                  <option value="">Sürüm Seçiniz...</option>
                  {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {isAdmin && updatedLabel && (
                  <button
                    onClick={() => handleDeleteVersion(updatedLabel)}
                    className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-200"
                    title="Sürümü Sil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sürüm Yükleme Butonları */}
          {isAdmin && (
            <div className="flex flex-wrap gap-3 justify-end">
              <label htmlFor="oldVersionUpload" className="bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg cursor-pointer hover:bg-slate-800 active:scale-95 flex items-center gap-2 uppercase transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span>ESKİ SÜRÜM YÜKLE</span>
              </label>
              <input id="oldVersionUpload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} disabled={isProcessing} />

              <label htmlFor="newVersionUpload" className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg cursor-pointer hover:bg-indigo-700 active:scale-95 flex items-center gap-2 uppercase transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span>YENİ SÜRÜM YÜKLE</span>
              </label>
              <input id="newVersionUpload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} disabled={isProcessing} />
            </div>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="p-32 text-center bg-white rounded-[48px] border-2 border-dashed border-indigo-100 shadow-inner animate-in fade-in zoom-in-95">
           <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
           <p className="font-black text-xl text-slate-900 uppercase tracking-tighter">Excel Verisi Analiz Ediliyor...</p>
        </div>
      )}

      {comparison && !isProcessing && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          {/* Dashboard Summary Bar */}
          <div className="bg-slate-900 text-white p-12 rounded-[56px] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-10 border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
            <div className="text-center md:text-left relative z-10">
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4">BAŞLANGIÇ TOPLAMI ({baselineLabel})</p>
              <h3 className="text-5xl font-black tracking-tighter">{Number(comparison.totalBaseCap).toLocaleString('tr-TR')}</h3>
            </div>
            <div className="text-center relative z-10">
              {/* Fix: Ensured number type for subtraction using Number() for robustness. */}
              <div className={`px-10 py-6 rounded-[32px] border-2 ${(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)) >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">NET FARK</p>
                <h3 className="text-5xl font-black tracking-tighter">
                  {(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)) > 0 ? '+' : ''}{(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)).toLocaleString('tr-TR')}
                </h3>
              </div>
            </div>
            <div className="text-center md:text-right relative z-10">
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4">GÜNCEL TOPLAM ({updatedLabel})</p>
              <h3 className="text-5xl font-black tracking-tighter">{Number(comparison.totalUpdCap).toLocaleString('tr-TR')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-200/60 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                  BRANŞ BAZLI KAPASİTE DEĞİŞİMİ
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOP 5</span>
              </div>
              <div className="space-y-2.5">
                {comparison.topBranchChanges.map((br: any, idx: number) => (
                  <div key={br.name} className="bg-white border border-slate-100 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm hover:bg-slate-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-bold uppercase text-slate-800 leading-tight break-words">{br.name}</p></div>
                      <div className="text-right shrink-0">
                        <p className={`text-[12px] font-black leading-none ${br.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{br.delta > 0 ? '+' : ''}{br.delta.toLocaleString('tr-TR')}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase leading-none">{formatPct(br.pct)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${br.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(Math.abs(br.delta) / maxAbsBranchDelta) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-200/60 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-rose-600 rounded-full"></div>
                  EN BÜYÜK HEKİM DRIVERLARI
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EN YÜKSEK KAYIPLAR</span>
              </div>
              <div className="space-y-2.5">
                {comparison.topDoctorDrivers.map((doc: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm hover:bg-slate-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-0">
                        <p className="text-[11px] font-bold uppercase text-slate-800 leading-tight truncate">{doc.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5 truncate">{doc.branch}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black text-rose-600 leading-none">{doc.delta.toLocaleString('tr-TR')}</p>
                        <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase leading-none">{formatPct(doc.pct)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${(Math.abs(doc.delta) / maxAbsDoctorDelta) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[48px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
               <h4 className="text-xl font-black text-slate-900 uppercase italic">Hekim Bazlı Değişim Detayları</h4>
               <div className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{comparison.phys_compare.length} HEKİMDE DEĞİŞİM</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white">
                  <tr>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Hekim & Branş</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Eski Kap</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Yeni Kap</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Fark</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Aksiyon Değişimleri (GÜN)</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comparison.phys_compare.map((p: any) => {
                    const sortedDeltas = Object.entries(p.action_deltas).sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])));
                    const displayedDeltas = sortedDeltas.slice(0, 3);
                    const remainingCount = sortedDeltas.length - 3;

                    return (
                      <React.Fragment key={p.id}>
                        <tr className={`hover:bg-indigo-50/30 cursor-pointer transition-colors group ${expandedDoc === p.id ? 'bg-indigo-50/50' : ''}`} onClick={() => setExpandedDoc(expandedDoc === p.id ? null : p.id)}>
                          <td className="px-10 py-7">
                            <p className="font-black text-slate-900 uppercase text-xs tracking-tight">{p.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{p.branch}</p>
                          </td>
                          <td className="px-10 py-7 text-center text-xs font-bold text-slate-300">{p.baseline_capacity}</td>
                          <td className="px-10 py-7 text-center text-xs font-black text-slate-700">{p.updated_capacity}</td>
                          <td className="px-10 py-7 text-center">
                            <span className={`px-4 py-1.5 rounded-full font-black text-[11px] border ${p.capacity_delta >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                              {p.capacity_delta > 0 ? '+' : ''}{p.capacity_delta}
                            </span>
                          </td>
                          <td className="px-10 py-7">
                            <div className="flex flex-wrap gap-1.5">
                              {sortedDeltas.length > 0 ? (
                                <>
                                  {displayedDeltas.map(([act, d]) => (
                                    <span key={act} className={`text-[9px] font-black px-2 py-0.5 rounded-md border shadow-sm ${Number(d) > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                      {act} {Number(d) > 0 ? '+' : ''}{d.toString().replace('.', ',')}
                                    </span>
                                  ))}
                                  {remainingCount > 0 && <span className="text-[9px] font-black text-slate-400 px-1 py-0.5">+{remainingCount} daha...</span>}
                                </>
                              ) : <span className="text-[10px] text-slate-300 font-bold italic">Aksiyon gün dağılımı değişmedi</span>}
                            </div>
                          </td>
                          <td className="px-10 py-7 text-right">
                             <div className={`p-2 rounded-full bg-slate-100 text-slate-400 transition-transform ${expandedDoc === p.id ? 'rotate-180' : ''}`}>
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                             </div>
                          </td>
                        </tr>
                        {expandedDoc === p.id && (
                          <tr className="bg-slate-50/50 animate-in slide-in-from-top-2 duration-300">
                            <td colSpan={6} className="px-12 py-10">
                              <div className="space-y-8">
                                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                                  <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                    Aksiyon Kıyas Tablosu
                                  </h5>
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b-2 border-slate-100">
                                        <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksiyon</th>
                                        <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Eski Gün</th>
                                        <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Yeni Gün</th>
                                        <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fark</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {Array.from(new Set([...Object.keys(p.baseline_action_days), ...Object.keys(p.updated_action_days)])).sort().map(act => {
                                        const oldD = p.baseline_action_days[act] || 0;
                                        const newD = p.updated_action_days[act] || 0;
                                        const diff = newD - oldD;
                                        if (oldD === 0 && newD === 0) return null;
                                        return (
                                          <tr key={act} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 text-[11px] font-bold text-slate-700 uppercase">{act}</td>
                                            <td className="py-3 text-[11px] font-black text-slate-400 text-center">{oldD.toString().replace('.', ',')} G</td>
                                            <td className="py-3 text-[11px] font-black text-slate-800 text-center">{newD.toString().replace('.', ',')} G</td>
                                            <td className="py-3 text-center">
                                              <span className={`text-[11px] font-black ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toString().replace('.', ',')} G
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">BAŞLANGIÇ OTURUMLARI ({baselineLabel})</p>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar border rounded-2xl">
                                      <table className="w-full text-[10px] text-left">
                                        <thead className="bg-slate-50 sticky top-0"><tr><th className="p-3">TARİH</th><th className="p-3">AKSİYON</th><th className="p-3 text-center">KAP</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {p.bPhys?.rawRows?.map((r: any, i: number) => <tr key={i} className="hover:bg-slate-50"><td className="p-3 font-bold">{r.startDate}</td><td className="p-3 uppercase">{r.action}</td><td className="p-3 text-center font-black">{r.capacity}</td></tr>)}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-rose-100">
                                    <p className="text-[10px] font-black text-rose-400 uppercase mb-4 tracking-widest">GÜNCEL OTURUMLAR ({updatedLabel})</p>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar border rounded-2xl">
                                      <table className="w-full text-[10px] text-left">
                                        <thead className="bg-rose-50/50 sticky top-0"><tr><th className="p-3">TARİH</th><th className="p-3">AKSİYON</th><th className="p-3 text-center">KAP</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {p.uPhys?.rawRows?.map((r: any, i: number) => <tr key={i} className="hover:bg-rose-50/30"><td className="p-3 font-bold">{r.startDate}</td><td className="p-3 uppercase">{r.action}</td><td className="p-3 text-center font-black">{r.capacity}</td></tr>)}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!comparison && !isProcessing && (
        <div className="bg-white p-32 rounded-[56px] border-4 border-dashed border-slate-100 text-center flex flex-col items-center gap-8 shadow-inner animate-in fade-in duration-1000">
           <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 shadow-inner group">
             <svg className="w-12 h-12 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black text-slate-400 uppercase tracking-[0.2em]">KIYASLANACAK VERİ BULUNAMADI</h4>
             <p className="text-slate-400 font-medium max-w-md mx-auto mt-3 italic">Lütfen sağ taraftaki "Yeni Sürüm Yükle" butonu ile iki farklı aylık cetvel yükleyiniz.</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChangeAnalysis;
