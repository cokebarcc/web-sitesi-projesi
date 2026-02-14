
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  DetailedScheduleData, 
  ScheduleVersion, 
  ProcessedPhysicianSummary,
  SessionActionStats
} from '../types';
import { MONTHS, YEARS } from '../constants';

interface PastScheduleChangesProps {
  versions: Record<string, Record<string, ScheduleVersion>>;
  setVersions: React.Dispatch<React.SetStateAction<Record<string, Record<string, ScheduleVersion>>>>;
  selectedBranch: string | null;
}

const AM_WINDOW = { start: 8 * 60, end: 12 * 60 };
const PM_WINDOW = { start: 13 * 60, end: 17 * 60 };
const MIN_MINUTES_THRESHOLD = 30; 
const MIN_DOMINANCE_RATIO = 0.4;  

const PastScheduleChanges: React.FC<PastScheduleChangesProps> = ({ versions, setVersions, selectedBranch }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Aralık');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [baselineLabel, setBaselineLabel] = useState<string>('');
  const [updatedLabel, setUpdatedLabel] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const monthKey = `${selectedYear}-${selectedMonth}`;
  
  const availableVersions = useMemo(() => {
    const periodVersions = versions[monthKey] || {};
    return Object.keys(periodVersions).sort((a, b) => periodVersions[b].timestamp - periodVersions[a].timestamp);
  }, [versions, monthKey]);

  // Otomatik sürüm seçimi için useEffect - Yeni sürüm geldiğinde tetiklenir
  useEffect(() => {
    if (availableVersions.length > 0) {
      if (!baselineLabel || !availableVersions.includes(baselineLabel)) {
        // Eğer tek sürüm varsa veya seçim yoksa en eskiyi baseline yap
        setBaselineLabel(availableVersions[availableVersions.length - 1]);
      }
      if (!updatedLabel || !availableVersions.includes(updatedLabel)) {
        // En yeniyi updated yap
        setUpdatedLabel(availableVersions[0]);
      }
    }
  }, [availableVersions, monthKey]);

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\.|doç\./g, '');
  };

  const cleanForMatch = (str: any) => normalizeStr(str);

  const parseNumberFlex = (val: any): number => {
    if (val === undefined || val === null || val === "" || val === "-") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.includes(',')) str = str.replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const toMins = (val: any): number => {
    if (val === null || val === undefined || val === "") return 0;
    if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
    if (typeof val === 'number') return Math.round(val * 1440);
    if (typeof val === 'string') {
      const p = val.trim().split(':');
      if (p.length >= 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
    }
    return 0;
  };

  const getOverlap = (s1: number, e1: number, s2: number, e2: number) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));

  const processExcelData = async (file: File, label: string) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const allParsedRows: DetailedScheduleData[] = [];
        let missingColumns = new Set<string>();
        
        workbook.SheetNames.forEach(sn => {
          const sheet = workbook.Sheets[sn];
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
          if (rawData.length < 1) return;

          let headerIdx = -1;
          const targetKws = ['hekim', 'aksiyon', 'tarih', 'kapasite', 'saati', 'islem', 'brans', 'klinik', 'personel', 'doktor'];
          for(let i = 0; i < Math.min(rawData.length, 60); i++){
             if (!rawData[i]) continue;
             const matches = rawData[i].filter(c => c && targetKws.some(kw => cleanForMatch(c).includes(kw))).length;
             if(matches >= 2) { headerIdx = i; break; }
          }
          if(headerIdx === -1) headerIdx = 0;

          const headers = rawData[headerIdx]?.map(h => String(h || "")) || [];
          const dataRows = rawData.slice(headerIdx + 1);

          const getIdx = (pt: string[]) => headers.findIndex(h => pt.some(p => cleanForMatch(h).includes(cleanForMatch(p))));
          
          const dIdx = getIdx(['Hekim Ad Soyad', 'Hekim', 'Ad Soyad', 'Adı', 'Hekim Adı', 'Personel', 'Doktor', 'Ad-Soyad']);
          const aIdx = getIdx(['Aksiyon', 'İşlem', 'Faaliyet', 'Aksiyon Tipi', 'Tür', 'İşlem Tipi', 'Action']);
          const tIdx = getIdx(['Aksiyon Tarihi', 'Tarih', 'Günü', 'Aksiyon Günü', 'Tarihi', 'İşlem Tarihi', 'Vak Tarihi']);
          const sIdx = getIdx(['Aksiyon Başlangıç Saati', 'Başlangıç Saati', 'Saat', 'Başlangıç', 'Giriş', 'Oturum Başlama', 'Start']);
          const eIdx = getIdx(['Aksiyon Bitiş Saati', 'Bitiş Saati', 'Bitiş', 'Çıkış', 'Oturum Bitiş', 'End']);
          const cIdx = getIdx(['Randevu Kapasitesi', 'Kapasite', 'Slot', 'Kapasite Sayısı', 'MHRS Kapasite', 'Cap']);
          const spIdx = getIdx(['Klinik Adı', 'Klinik', 'Branş', 'Bölüm', 'Uzmanlık', 'Birim', 'Kısım']);

          if (dIdx === -1) missingColumns.add("Hekim Adı");
          if (tIdx === -1) missingColumns.add("Tarih");
          if (aIdx === -1) missingColumns.add("Aksiyon Tipi");

          if (dIdx === -1 || tIdx === -1) return; 

          dataRows.forEach(row => {
            const dRaw = row[dIdx];
            if (!dRaw || String(dRaw).trim() === "" || cleanForMatch(dRaw).includes('toplam') || cleanForMatch(dRaw) === '0') return;

            const docName = String(dRaw).trim().toLocaleUpperCase('tr-TR');
            const startStr = sIdx !== -1 ? String(row[sIdx] || '08:00') : '08:00';
            const endStr = eIdx !== -1 ? String(row[eIdx] || '17:00') : '17:00';
            const start = toMins(row[sIdx] || '08:00');
            const end = toMins(row[eIdx] || '17:00');
            let dur = end - start;
            if (dur < 0) dur += 1440;

            let dateStr = "01.01.2025";
            const rDate = row[tIdx];
            if (rDate instanceof Date) {
              dateStr = `${String(rDate.getDate()).padStart(2, '0')}.${String(rDate.getMonth() + 1).padStart(2, '0')}.${rDate.getFullYear()}`;
            } else if (typeof rDate === 'number') {
              const dateObj = new Date(Math.round((rDate - 25569) * 864e5));
              dateStr = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`;
            } else if (rDate) {
              dateStr = String(rDate);
            }

            allParsedRows.push({
              id: Math.random().toString(36).substr(2, 9),
              doctorName: docName,
              specialty: String(spIdx !== -1 ? row[spIdx] : (sn || 'BİLİNMİYOR')).toLocaleUpperCase('tr-TR'),
              hospital: "HOSPITAL",
              startDate: dateStr,
              startTime: startStr,
              endDate: "",
              endTime: endStr,
              action: String(aIdx !== -1 ? row[aIdx] : 'BELİRSİZ').trim().toLocaleUpperCase('tr-TR'),
              slotCount: 0,
              duration: dur,
              capacity: parseNumberFlex(cIdx !== -1 ? row[cIdx] : 0),
              month: selectedMonth,
              year: selectedYear
            });
          });
        });

        if (allParsedRows.length === 0) {
          const missArr = Array.from(missingColumns);
          alert(`Hata: Excel dosyasında işlenebilir veri bulunamadı.\n\nEksik Sütunlar: ${missArr.length > 0 ? missArr.join(', ') : 'Hekim listesi boş'}\n\nLütfen dosyanın başlık satırını ve verileri kontrol ediniz.`);
          setIsProcessing(false);
          return;
        }

        const physMap: Record<string, ProcessedPhysicianSummary> = {};
        const daily: Record<string, Record<string, { AM: Record<string, SessionActionStats>, PM: Record<string, SessionActionStats> }>> = {};

        allParsedRows.forEach(row => {
          const d = row.doctorName; const t = row.startDate; const a = row.action;
          const s = toMins(row.startTime); const dur = row.duration; const e = s + dur;
          if (!physMap[d]) physMap[d] = { name: d, branch: row.specialty, totalCapacity: 0, totalWorkDays: 0, actionDays: {}, rawRows: [] };
          physMap[d].totalCapacity += row.capacity;
          physMap[d].rawRows.push(row);
          if (!daily[d]) daily[d] = {};
          if (!daily[d][t]) daily[d][t] = { AM: {}, PM: {} };
          const amO = getOverlap(s, e, AM_WINDOW.start, AM_WINDOW.end);
          if (amO > 0) {
            if (!daily[d][t].AM[a]) daily[d][t].AM[a] = { action: a, mins: 0, firstStart: s };
            daily[d][t].AM[a].mins += amO;
          }
          const pmO = getOverlap(s, e, PM_WINDOW.start, PM_WINDOW.end);
          if (pmO > 0) {
            if (!daily[d][t].PM[a]) daily[d][t].PM[a] = { action: a, mins: 0, firstStart: s };
            daily[d][t].PM[a].mins += pmO;
          }
        });

        Object.keys(daily).forEach(doc => {
          Object.keys(daily[doc]).forEach(date => {
            ['AM', 'PM'].forEach(stype => {
              const sMap = stype === 'AM' ? daily[doc][date].AM : daily[doc][date].PM;
              const totalM = (Object.values(sMap) as any[]).reduce((sum, s) => sum + s.mins, 0);
              let win = ""; let maxM = -1;
              (Object.values(sMap) as any[]).forEach(stat => {
                const ratio = totalM > 0 ? stat.mins / totalM : 0;
                if (stat.mins >= MIN_MINUTES_THRESHOLD || ratio >= MIN_DOMINANCE_RATIO) {
                  if (stat.mins > maxM) { maxM = stat.mins; win = stat.action; }
                }
              });
              if (win) {
                physMap[doc].totalWorkDays += 0.5;
                physMap[doc].actionDays[win] = (physMap[doc].actionDays[win] || 0) + 0.5;
              }
            });
          });
        });

        // Fix: Updated ScheduleVersion object literal to match its interface definition.
        // Moved qualityIssues into diagnostics and added missing required fields (fileName, monthKey).
        const v: ScheduleVersion = { 
          id: `v-${Date.now()}`, 
          label, 
          timestamp: Date.now(), 
          fileName: file.name,
          monthKey,
          physicians: physMap, 
          diagnostics: {
            rawRowsCount: allParsedRows.length,
            validRowsCount: allParsedRows.length,
            invalidRowsCount: 0,
            mapping: {},
            qualityIssues: {
              unparseableDate: 0,
              unparseableTime: 0,
              zeroDuration: 0
            }
          }
        };
        
        setVersions(prev => ({
          ...prev, 
          [monthKey]: { 
            ...(prev[monthKey] || {}), 
            [v.label]: v 
          }
        }));

      } catch (err) { 
        console.error(err); 
        alert("Dosya ayrıştırma hatası. Lütfen Excel formatının doğruluğundan emin olun."); 
      } finally { 
        setIsProcessing(false); 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const comparison = useMemo(() => {
    const base = versions[monthKey]?.[baselineLabel];
    const upd = versions[monthKey]?.[updatedLabel];
    if (!base || !upd) return null;

    const phys_compare: any[] = [];
    const allPhysIds = Array.from(new Set([
      ...Object.keys(base.physicians).map(name => `${normalizeStr(name)}|${normalizeStr(base.physicians[name].branch)}`),
      ...Object.keys(upd.physicians).map(name => `${normalizeStr(name)}|${normalizeStr(upd.physicians[name].branch)}`)
    ]));

    allPhysIds.forEach(id => {
      const [normName, normBranch] = id.split('|');
      const bPhys = (Object.values(base.physicians) as ProcessedPhysicianSummary[]).find(p => normalizeStr(p.name) === normName && normalizeStr(p.branch) === normBranch);
      const uPhys = (Object.values(upd.physicians) as ProcessedPhysicianSummary[]).find(p => normalizeStr(p.name) === normName && normalizeStr(p.branch) === normBranch);
      
      const physician_name_display = uPhys?.name || bPhys?.name || "Bilinmiyor";
      const branch_display = uPhys?.branch || bPhys?.branch || "Bilinmiyor";

      if (selectedBranch && normalizeStr(branch_display) !== normalizeStr(selectedBranch)) return;

      const baseline_capacity = bPhys?.totalCapacity || 0;
      const updated_capacity = uPhys?.totalCapacity || 0;
      const capacity_delta = updated_capacity - baseline_capacity;
      
      const baseline_action_days = bPhys?.actionDays || {};
      const updated_action_days = uPhys?.actionDays || {};
      
      const all_actions = Array.from(new Set([...Object.keys(baseline_action_days), ...Object.keys(updated_action_days)]));
      const action_deltas: Record<string, number> = {};
      let has_action_change = false;

      all_actions.forEach(act => {
        const delta = (updated_action_days[act] || 0) - (baseline_action_days[act] || 0);
        if (Math.abs(delta) > 0.01) {
          action_deltas[act] = delta;
          has_action_change = true;
        }
      });

      let change_type = "Değişiklik Yok";
      if (Math.abs(capacity_delta) > 0.1 && !has_action_change) change_type = "Sadece Kapasite Değişimi";
      else if (Math.abs(capacity_delta) <= 0.1 && has_action_change) change_type = "Sadece Aksiyon Karışımı";
      else if (Math.abs(capacity_delta) > 0.1 && has_action_change) change_type = "Kapasite + Aksiyon Değişimi";

      let top_driver_action = "N/A";
      if (has_action_change) {
        let maxAbs = -1;
        Object.entries(action_deltas).forEach(([act, d]) => {
          if (Math.abs(d) > maxAbs) {
            maxAbs = Math.abs(d);
            top_driver_action = `${act} Δ ${d > 0 ? '+' : ''}${d}G`;
          }
        });
      }

      if (change_type !== "Değişiklik Yok") {
        phys_compare.push({
          physician_id: id, physician_name_display, branch_display, baseline_capacity, updated_capacity, capacity_delta,
          baseline_action_days, updated_action_days, action_deltas, has_action_change, change_type, top_driver_action,
          baseline_raw: bPhys, updated_raw: uPhys
        });
      }
    });

    const branchStats: Record<string, { delta: number, base: number }> = {};
    phys_compare.forEach(p => {
      if (!branchStats[p.branch_display]) branchStats[p.branch_display] = { delta: 0, base: 0 };
      branchStats[p.branch_display].delta += p.capacity_delta;
      branchStats[p.branch_display].base += p.baseline_capacity;
    });

    const totalAbsDelta = Object.values(branchStats).reduce((sum, b) => sum + Math.abs(b.delta), 0);
    const topBranches = Object.entries(branchStats)
      .map(([name, s]) => ({ name, delta: s.delta, share: totalAbsDelta > 0 ? (Math.abs(s.delta) / totalAbsDelta) * 100 : 0 }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

    const topPhysDrivers = [...phys_compare].sort((a, b) => Math.abs(b.capacity_delta) - Math.abs(a.capacity_delta)).slice(0, 5);
    
    return { 
      phys_compare, topPhysDrivers, topBranches, 
      totalBaseCap: (Object.values(base.physicians) as ProcessedPhysicianSummary[]).reduce((s,p) => s + p.totalCapacity, 0),
      totalUpdCap: (Object.values(upd.physicians) as ProcessedPhysicianSummary[]).reduce((s,p) => s + p.totalCapacity, 0),
    };
  }, [versions, monthKey, baselineLabel, updatedLabel, selectedBranch]);

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="bg-white p-8 lg:p-12 rounded-[48px] shadow-xl border relative overflow-hidden" style={{ borderColor: 'var(--border-2)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full -mr-40 -mt-40 blur-3xl opacity-60"></div>
        
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
          <div className="xl:col-span-4 space-y-6">
            <div>
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-tight" style={{ color: 'var(--text-1)' }}>CETVEL KIYASLAMA MERKEZİ</h2>
              <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--text-3)' }}>Sürümler Arası Net Kapasite Değişimi</p>
            </div>
            <div className="flex gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-1 border rounded-2xl px-4 py-3.5 font-black text-xs outline-none cursor-pointer uppercase transition-colors hover:border-indigo-200" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-28 text-white rounded-2xl px-4 py-3.5 font-black text-xs outline-none cursor-pointer transition-transform active:scale-95" style={{ background: 'var(--bg-app)' }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="xl:col-span-5 grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
             <div className="md:col-span-5 flex flex-col gap-2">
               <label className="text-[10px] font-black uppercase ml-1 tracking-widest" style={{ color: 'var(--text-3)' }}>İLK CETVEL (BAŞLANGIÇ)</label>
               <select value={baselineLabel} onChange={(e) => setBaselineLabel(e.target.value)} className="border-2 rounded-2xl px-4 py-3.5 text-xs font-black outline-none w-full transition-all focus:border-indigo-500 shadow-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                 <option value="">Seçiniz...</option>
                 {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
               </select>
             </div>
             <div className="hidden md:flex md:col-span-1 justify-center items-center pt-5">
               <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
               </div>
             </div>
             <div className="md:col-span-5 flex flex-col gap-2">
               <label className="text-[10px] font-black text-rose-400 uppercase ml-1 tracking-widest">GÜNCEL CETVEL (KIYAS)</label>
               <select value={updatedLabel} onChange={(e) => setUpdatedLabel(e.target.value)} className="bg-white border-2 border-rose-100 rounded-2xl px-4 py-3.5 text-xs font-black text-rose-600 outline-none w-full transition-all focus:border-rose-500 shadow-sm">
                 <option value="">Seçiniz...</option>
                 {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
               </select>
             </div>
          </div>

          <div className="xl:col-span-3 flex justify-end">
             <label className="w-full xl:w-auto bg-indigo-600 text-white px-8 py-6 rounded-3xl font-black text-xs shadow-2xl cursor-pointer hover:bg-indigo-700 active:scale-95 flex items-center justify-center gap-3 uppercase transition-all shadow-indigo-200 group">
               <div className="bg-white/20 p-2 rounded-xl group-hover:bg-white/30 transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
               </div>
               <span>YENİ SÜRÜM YÜKLE</span>
               <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => {
                 if (e.target.files && e.target.files[0]) {
                   const file = e.target.files[0];
                   const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                   const sug = `Sürüm ${availableVersions.length + 1} (${now})`;
                   const label = prompt("Yüklenecek cetvel için bir isim belirleyin:", sug);
                   if(label !== null) processExcelData(file, label || sug);
                   e.target.value = ''; 
                 }
               }} />
             </label>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="bg-white p-24 rounded-[48px] shadow-sm border flex flex-col items-center gap-8 animate-in zoom-in-95" style={{ borderColor: 'var(--border-2)' }}>
           <div className="relative">
             <div className="w-20 h-20 border-4 border-indigo-600/10 rounded-full"></div>
             <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0 shadow-lg shadow-indigo-200"></div>
           </div>
           <div className="text-center space-y-2">
             <p className="font-black text-xl uppercase tracking-tight italic" style={{ color: 'var(--text-1)' }}>Dosya Analiz Ediliyor...</p>
             <p className="font-bold text-sm" style={{ color: 'var(--text-3)' }}>Hekim bazlı kapasite ve aksiyon verileri işleniyor.</p>
           </div>
        </div>
      )}

      {comparison && !isProcessing && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
          <div className="text-white p-12 rounded-[56px] shadow-2xl relative overflow-hidden" style={{ background: 'var(--bg-app)' }}>
             <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                <div className="text-center md:text-left">
                  <p className="font-black text-[10px] uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--text-3)' }}>BAŞLANGIÇ KAPASİTESİ</p>
                  <h3 className="text-5xl font-black">{comparison.totalBaseCap.toLocaleString('tr-TR')}</h3>
                  <p className="text-xs font-bold mt-2 italic" style={{ color: 'var(--text-muted)' }}>{baselineLabel}</p>
                </div>
                <div className="flex items-center justify-center">
                   <div className={`px-10 py-6 rounded-[32px] border-2 text-center min-w-[220px] transition-all hover:scale-105 ${ (comparison.totalUpdCap - comparison.totalBaseCap) >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-900/20 shadow-xl'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>NET FARK</p>
                      <p className="text-4xl font-black">{(comparison.totalUpdCap - comparison.totalBaseCap) > 0 ? '+' : ''}{(comparison.totalUpdCap - comparison.totalBaseCap).toLocaleString('tr-TR')}</p>
                   </div>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-rose-400 font-black text-[10px] uppercase tracking-[0.3em] mb-4">GÜNCEL KAPASİTE</p>
                  <h3 className="text-5xl font-black">{comparison.totalUpdCap.toLocaleString('tr-TR')}</h3>
                  <p className="text-xs font-bold mt-2 italic" style={{ color: 'var(--text-muted)' }}>{updatedLabel}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white p-10 rounded-[48px] shadow-sm border" style={{ borderColor: 'var(--border-2)' }}>
                <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
                  <div className="w-2.5 h-6 bg-indigo-600 rounded-full"></div>
                  En Çok Etkilenen Branşlar
                </h3>
                <div className="space-y-6">
                   {comparison.topBranches.map((br, idx) => (
                     <div key={br.name} className="flex items-center gap-6">
                       <span className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>{idx+1}</span>
                       <div className="flex-1">
                          <div className="flex justify-between mb-2">
                             <span className="text-[11px] font-black uppercase" style={{ color: 'var(--text-1)' }}>{br.name}</span>
                             <span className={`text-[11px] font-black ${br.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {br.delta > 0 ? '+' : ''}{br.delta} (%{br.share.toFixed(1)})
                             </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                             <div className={`h-full ${br.delta > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${br.share}%` }}></div>
                          </div>
                       </div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-white p-10 rounded-[48px] shadow-sm border relative" style={{ borderColor: 'var(--border-2)' }}>
                <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
                  <div className="w-2.5 h-6 bg-rose-600 rounded-full"></div>
                  Kapasite Değişim Driverları
                </h3>
                <div className="space-y-6">
                    {comparison.topPhysDrivers.map((res, idx) => (
                      <div key={res.physician_id} className="flex items-center gap-6 p-5 rounded-[32px] transition-all border border-transparent" style={{ background: 'var(--surface-3)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--surface-3)'; }}>
                          <span className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-xs" style={{ color: 'var(--text-3)' }}>{idx+1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                                <span className="text-[12px] font-black uppercase" style={{ color: 'var(--text-1)' }}>{res.physician_name_display}</span>
                                <span className={`text-[11px] font-black ${res.capacity_delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {res.capacity_delta > 0 ? '+' : ''}{res.capacity_delta}
                                </span>
                            </div>
                            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{res.branch_display}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="text-[8px] px-2 py-1 rounded text-white font-black uppercase shadow-sm" style={{ background: 'var(--bg-app)' }}>{res.change_type}</span>
                                {res.has_action_change && (
                                  <div className="bg-indigo-600 text-white px-2.5 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                                    DRIVER: {res.top_driver_action}
                                  </div>
                                )}
                            </div>
                          </div>
                      </div>
                    ))}
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[48px] shadow-2xl border overflow-hidden" style={{ borderColor: 'var(--border-2)' }}>
            <div className="p-10 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-3)' }}>
               <div>
                  <h4 className="text-xl font-black uppercase italic" style={{ color: 'var(--text-1)' }}>Hekim Bazlı Değişim Detayları</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest mt-2" style={{ color: 'var(--text-3)' }}>Toplam {comparison.phys_compare.length} hekimde anlamlı değişim bulundu</p>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead style={{ background: 'var(--surface-3)' }}>
                   <tr>
                     <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Hekim & Branş</th>
                     <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>Eski Kap</th>
                     <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>Yeni Kap</th>
                     <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>Fark</th>
                     <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Aksiyon Farkları (Gün)</th>
                     <th className="px-8 py-5"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--border-2)' } as React.CSSProperties}>
                   {comparison.phys_compare.map((p) => (
                     <React.Fragment key={p.physician_id}>
                       <tr className="transition-colors group cursor-pointer" style={{ background: expandedDoc === p.physician_id ? 'var(--surface-3)' : undefined }}
                         onMouseEnter={e => { if (expandedDoc !== p.physician_id) e.currentTarget.style.background = 'var(--table-row-hover)'; }}
                         onMouseLeave={e => { if (expandedDoc !== p.physician_id) e.currentTarget.style.background = ''; }}
                         onClick={() => setExpandedDoc(expandedDoc === p.physician_id ? null : p.physician_id)}>
                         <td className="px-8 py-6">
                            <p className="font-black uppercase text-xs" style={{ color: 'var(--text-1)' }}>{p.physician_name_display}</p>
                            <p className="text-[10px] font-bold uppercase tracking-tighter mt-1" style={{ color: 'var(--text-3)' }}>{p.branch_display}</p>
                         </td>
                         <td className="px-8 py-6 text-center text-xs font-bold" style={{ color: 'var(--text-2)' }}>{p.baseline_capacity}</td>
                         <td className="px-8 py-6 text-center text-xs font-black" style={{ color: 'var(--text-1)' }}>{p.updated_capacity}</td>
                         <td className="px-8 py-6 text-center">
                            <span className={`px-3 py-1 rounded-full font-black text-[10px] ${p.capacity_delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {p.capacity_delta > 0 ? '+' : ''}{p.capacity_delta}
                            </span>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-2">
                               {Object.entries(p.action_deltas).length > 0 ? Object.entries(p.action_deltas).map(([a, d]: [string, any]) => (
                                 <div key={a} className={`text-[9px] font-black px-2 py-1 rounded-md border ${d > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    {a}: {d > 0 ? '+' : ''}{d}
                                 </div>
                               )) : <span className="text-[9px] font-bold italic" style={{ color: 'var(--text-2)' }}>Değişim Yok</span>}
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                           <div className={`p-2 rounded-full transition-transform ${expandedDoc === p.physician_id ? 'rotate-180' : ''}`} style={{ background: 'var(--surface-3)' }}>
                             <svg className="w-4 h-4" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                           </div>
                         </td>
                       </tr>
                       {expandedDoc === p.physician_id && (
                         <tr className="animate-in slide-in-from-top-2 duration-300" style={{ background: 'var(--surface-3)' }}>
                           <td colSpan={6} className="px-12 py-10">
                              <div className="bg-white rounded-[32px] p-8 shadow-inner border" style={{ borderColor: 'var(--border-2)' }}>
                                 <div className="flex justify-between items-center mb-8 border-b pb-4">
                                   <h5 className="text-sm font-black uppercase" style={{ color: 'var(--text-1)' }}>Detaylı Denetim İzi</h5>
                                   <span className="text-[9px] font-black px-3 py-1 rounded text-white uppercase" style={{ background: 'var(--bg-app)' }}>{p.change_type}</span>
                                 </div>
                                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                       <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{baselineLabel} ({p.baseline_raw?.rawRows?.length || 0} Satır)</p>
                                       <div className="max-h-[300px] overflow-y-auto custom-scrollbar border rounded-2xl">
                                          <table className="w-full text-[10px]">
                                             <thead className="sticky top-0" style={{ background: 'var(--surface-3)' }}><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Saat</th><th className="p-3 text-left">Aksiyon</th><th className="p-3 text-center">Kap.</th></tr></thead>
                                             <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--border-2)' } as React.CSSProperties}>
                                               {p.baseline_raw?.rawRows?.map((r: any, idx: number) => (
                                                 <tr key={idx}
                                                   onMouseEnter={e => { e.currentTarget.style.background = 'var(--table-row-hover)'; }}
                                                   onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                                                    <td className="p-3 font-bold" style={{ color: 'var(--text-1)' }}>{r.startDate}</td>
                                                    <td className="p-3" style={{ color: 'var(--text-3)' }}>{r.startTime}</td>
                                                    <td className="p-3 uppercase font-bold" style={{ color: 'var(--text-1)' }}>{r.action}</td>
                                                    <td className="p-3 text-center font-black text-indigo-600">{r.capacity}</td>
                                                 </tr>
                                               ))}
                                             </tbody>
                                          </table>
                                       </div>
                                    </div>
                                    <div className="space-y-4">
                                       <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{updatedLabel} ({p.updated_raw?.rawRows?.length || 0} Satır)</p>
                                       <div className="max-h-[300px] overflow-y-auto custom-scrollbar border rounded-2xl">
                                          <table className="w-full text-[10px]">
                                             <thead className="bg-rose-50/50 sticky top-0"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Saat</th><th className="p-3 text-left">Aksiyon</th><th className="p-3 text-center">Kap.</th></tr></thead>
                                             <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--border-2)' } as React.CSSProperties}>
                                               {p.updated_raw?.rawRows?.map((r: any, idx: number) => (
                                                 <tr key={idx}
                                                   onMouseEnter={e => { e.currentTarget.style.background = 'var(--table-row-hover)'; }}
                                                   onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                                                    <td className="p-3 font-bold" style={{ color: 'var(--text-1)' }}>{r.startDate}</td>
                                                    <td className="p-3" style={{ color: 'var(--text-3)' }}>{r.startTime}</td>
                                                    <td className="p-3 uppercase font-bold" style={{ color: 'var(--text-1)' }}>{r.action}</td>
                                                    <td className="p-3 text-center font-black text-indigo-600">{r.capacity}</td>
                                                 </tr>
                                               ))}
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
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {availableVersions.length < 1 && !isProcessing && (
        <div className="bg-white p-32 rounded-[56px] border-2 border-dashed text-center flex flex-col items-center gap-8 shadow-inner" style={{ borderColor: 'var(--border-2)' }}>
           <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>KIYASLANACAK VERİ BULUNAMADI</h4>
             <p className="font-medium max-w-md mx-auto mt-2 italic" style={{ color: 'var(--text-3)' }}>Lütfen sağ taraftaki butondan "Sürüm 1" ve "Sürüm 2" olarak iki farklı cetvel yükleyiniz.</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default PastScheduleChanges;
