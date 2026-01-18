
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScheduleProposal, AppointmentData, HBYSData, DetailedScheduleData } from '../types';
import { MONTHS, YEARS } from '../constants';
import DataFilterPanel from './common/DataFilterPanel';

interface PlanningModuleProps {
  selectedBranch: string | null;
  appointmentData: AppointmentData[];
  hbysData: HBYSData[];
  detailedScheduleData?: DetailedScheduleData[];
  // Persistent state props
  proposals: ScheduleProposal[];
  setProposals: React.Dispatch<React.SetStateAction<ScheduleProposal[]>>;
  sourceMonth: string;
  setSourceMonth: (m: string) => void;
  sourceYear: number;
  setSourceYear: (y: number) => void;
  targetMonth: string;
  setTargetMonth: (m: string) => void;
  targetYear: number;
  setTargetYear: (y: number) => void;
  targetWorkDays: number;
  setTargetWorkDays: (d: number) => void;
}

const PlanningModule: React.FC<PlanningModuleProps> = ({ 
  selectedBranch, 
  appointmentData, 
  hbysData, 
  detailedScheduleData = [],
  proposals,
  setProposals,
  sourceMonth,
  setSourceMonth,
  sourceYear,
  setSourceYear,
  targetMonth,
  setTargetMonth,
  targetYear,
  setTargetYear,
  targetWorkDays,
  setTargetWorkDays
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\./g, '');
  };

  useEffect(() => {
    setError(null);
  }, [selectedBranch, sourceMonth, sourceYear, targetMonth, targetYear]);

  const aggregatedData = useMemo(() => {
    const normSelectedBranch = selectedBranch ? normalizeStr(selectedBranch) : null;

    const targetAppointments = appointmentData.filter(a => 
      a.month === targetMonth && 
      a.year === targetYear && 
      (!normSelectedBranch || normalizeStr(a.specialty) === normSelectedBranch)
    );

    const targetDetailed = detailedScheduleData.filter(d => 
      d.month === targetMonth && 
      d.year === targetYear && 
      (!normSelectedBranch || normalizeStr(d.specialty) === normSelectedBranch)
    );

    const docMap = new Map<string, string>();
    targetAppointments.forEach(a => docMap.set(normalizeStr(a.doctorName), a.doctorName));
    targetDetailed.forEach(d => docMap.set(normalizeStr(d.doctorName), d.doctorName));

    const targetDocNames = Array.from(docMap.keys());

    return targetDocNames.map(normName => {
      const originalName = docMap.get(normName)!;
      const sourceHbys = hbysData.find(h => normalizeStr(h.doctorName) === normName && h.month === sourceMonth && h.year === sourceYear);
      const sourceAppts = appointmentData.filter(a => normalizeStr(a.doctorName) === normName && a.month === sourceMonth && a.year === sourceYear);
      
      const norm = (str: any) => (str ? String(str).toLocaleLowerCase('tr-TR') : '');
      const sourceSurgDays = sourceAppts.filter(a => norm(a.actionType).includes('ameliyat')).reduce((a, b) => a + (b.daysCount || 0), 0);

      const specialty = sourceAppts.length > 0 ? sourceAppts[0].specialty : (targetAppointments.find(a => normalizeStr(a.doctorName) === normName)?.specialty || "Bilinmiyor");

      const currentDocAppts = targetAppointments.filter(a => normalizeStr(a.doctorName) === normName);
      let initialActions = currentDocAppts.map(a => ({ type: a.actionType, days: a.daysCount || 0 }));
      
      if (initialActions.length === 0) {
        const docDetailed = targetDetailed.filter(d => normalizeStr(d.doctorName) === normName);
        const dayCounts: {[key: string]: Set<string>} = {};
        docDetailed.forEach(d => {
           if (!dayCounts[d.action]) dayCounts[d.action] = new Set();
           dayCounts[d.action].add(d.startDate);
        });
        initialActions = Object.entries(dayCounts).map(([type, dates]) => ({ type, days: dates.size }));
      }

      return {
        doctorName: originalName,
        specialty: specialty,
        sourcePerformance: {
          surgeryDays: sourceSurgDays,
          totalSurgeries: sourceHbys?.surgeryABC || 0,
          totalExams: sourceHbys?.totalExams || 0
        },
        targetInitialSchedule: {
          polyclinicDays: initialActions.filter(a => norm(a.type).includes('muayene') || norm(a.type).includes('poliklinik')).reduce((a, b) => a + b.days, 0),
          surgeryDays: initialActions.filter(a => norm(a.type).includes('ameliyat')).reduce((a, b) => a + b.days, 0),
          allActions: initialActions
        }
      };
    }).filter(doc => doc.sourcePerformance.surgeryDays > 0 || doc.targetInitialSchedule.surgeryDays > 0);
  }, [selectedBranch, targetMonth, targetYear, sourceMonth, sourceYear, appointmentData, hbysData, detailedScheduleData]);

  const startAnalysis = () => {
    if (aggregatedData.length === 0) {
      setError(`${targetMonth} ${targetYear} dönemine ait ameliyat aksiyonu olan herhangi bir cetvel bulunamadı.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setLoadingStage('Performans Parametreleri İnceleniyor...');

    const branchStats = new Map<string, { totalSurg: number, totalDays: number, count: number }>();
    let hospitalTotalSurg = 0;
    let hospitalTotalDays = 0;

    aggregatedData.forEach(doc => {
      const stats = branchStats.get(doc.specialty) || { totalSurg: 0, totalDays: 0, count: 0 };
      stats.totalSurg += doc.sourcePerformance.totalSurgeries;
      stats.totalDays += doc.sourcePerformance.surgeryDays;
      stats.count += 1;
      branchStats.set(doc.specialty, stats);

      hospitalTotalSurg += doc.sourcePerformance.totalSurgeries;
      hospitalTotalDays += doc.sourcePerformance.surgeryDays;
    });

    const hospitalGlobalAverage = hospitalTotalDays > 0 ? hospitalTotalSurg / hospitalTotalDays : 0;

    setTimeout(() => {
      const results: ScheduleProposal[] = aggregatedData.map(doc => {
        const stats = branchStats.get(doc.specialty);
        const isSinglePhysician = stats ? stats.count === 1 : true;
        
        const branchAverage = isSinglePhysician 
          ? hospitalGlobalAverage 
          : (stats && stats.totalDays > 0 ? stats.totalSurg / stats.totalDays : 0);
        
        const hao = doc.sourcePerformance.surgeryDays > 0 
          ? (doc.sourcePerformance.totalSurgeries / doc.sourcePerformance.surgeryDays) 
          : 0;
        
        let newSurgeryDays = doc.targetInitialSchedule.surgeryDays;
        let justification = [
          isSinglePhysician 
            ? "Branşta tek hekim olduğu için hastane genel ortalaması (Genel BAO) baz alınmıştır." 
            : "Hekim performansı branş ortalaması ile kıyaslanmıştır."
        ];

        const bao80 = branchAverage * 0.8;
        const bao60 = branchAverage * 0.6;
        const bao40 = branchAverage * 0.4;

        const performancePercent = Math.round((hao / (branchAverage || 1)) * 100);
        const ratioText = `${hao.toFixed(2)} / ${branchAverage.toFixed(2)}${isSinglePhysician ? ' (Hastane Ort.)' : ''}`;
        const standardAiSuffix = "Düşük cerrahi verimlilik sebebi ile ai planlaması yapılarak düzenlenmiştir.";
        
        let changeReason = "Mevcut plan verimlilik sınırları dahilinde olduğu için korunmuştur.";
        let hasChange = false;

        // 80-60-40 Rules - ONLY REDUCE, NEVER INCREASE FOR LOW PERFORMANCE
        if (doc.sourcePerformance.surgeryDays > 0) {
          if (hao < bao40) {
            // Fix: If performance is below 40%, set to max 1 day, but only if it's already higher
            if (newSurgeryDays > 1) {
                newSurgeryDays = 1;
                hasChange = true;
            } else {
                // If it's 0 or 1, keep it as is, but still mark low performance as justification if needed
                // But definitely don't INCREASE to 1 if it was 0.
            }
          } else if (hao < bao60) {
            if (newSurgeryDays > 0) {
                newSurgeryDays = Math.max(0, newSurgeryDays - 2);
                hasChange = true;
            }
          } else if (hao < bao80) {
            if (newSurgeryDays > 0) {
                newSurgeryDays = Math.max(0, newSurgeryDays - 1);
                hasChange = true;
            }
          }
        }

        // 6-Day Cap Rule
        if (newSurgeryDays > 6 && hao < (branchAverage * 2)) {
          newSurgeryDays = 6;
          hasChange = true;
          justification.push("Hastane yönetim kararı gereği azami ameliyat günü 6 gün ile sınırlandırılmıştır (Üstün performans kriteri sağlanamadı).");
        }

        // HAO < 2.5 Rule
        if (hao > 0 && hao < 2.5 && newSurgeryDays > 3) {
           newSurgeryDays = 3;
           hasChange = true;
           justification.push("Hekim Ameliyat Ortalaması (HAO) 2.5 vakanın altında olduğu için ameliyat günü 3 gün ile sınırlandırılmıştır.");
        }

        if (hasChange) {
           changeReason = `Analiz Özeti: ${ratioText}. ${standardAiSuffix}`;
        }

        const reduction = doc.targetInitialSchedule.surgeryDays - newSurgeryDays;
        const newPolyclinicDays = doc.targetInitialSchedule.polyclinicDays + reduction;

        const polyDiff = newPolyclinicDays - doc.targetInitialSchedule.polyclinicDays;
        const surgDiff = newSurgeryDays - doc.targetInitialSchedule.surgeryDays;

        return {
          doctorName: doc.doctorName,
          specialty: doc.specialty,
          decSummary: changeReason,
          efficiencyComment: `HAO: ${hao.toFixed(2)}, BAO: ${branchAverage.toFixed(2)}. Hekim ${isSinglePhysician ? 'hastane genel' : 'branş'} ortalamasının %${performancePercent} kadardır.`,
          polyDiff,
          surgDiff,
          febPlan: {
            polyclinic: newPolyclinicDays,
            surgery: newSurgeryDays,
            fixedActions: doc.targetInitialSchedule.allActions.filter(a => {
              const n = a.type.toLocaleLowerCase('tr-TR');
              return !n.includes('muayene') && !n.includes('poliklinik') && !n.includes('ameliyat');
            })
          },
          justification: justification,
          risks: reduction > 0 ? "Poliklinik yükünde artış, MHRS randevu sayısında yükseliş beklenmektedir." : "Kapasite değişikliği öngörülmemektedir."
        };
      });

      setProposals(results);
      setLoading(false);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 1200);
  };

  const changedProposals = useMemo(() => proposals.filter(p => (p.polyDiff !== 0 || p.surgDiff !== 0)), [proposals]);

  return (
    <div className="space-y-6 pb-24">
      {/* Başlık */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-[var(--glass-border)]">
        <h2 className="text-2xl font-black text-[var(--text-1)] tracking-tight uppercase">CETVEL OPTİMİZASYON KURGUSU (80-60-40)</h2>
      </div>

      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Kaynak Dönem (Referans Performans)"
        showYearFilter={true}
        selectedYears={sourceYear ? [sourceYear] : []}
        availableYears={YEARS}
        onYearsChange={(years) => setSourceYear(years.length > 0 ? years[0] as number : 0)}
        showMonthFilter={true}
        selectedMonths={sourceMonth ? [MONTHS.indexOf(sourceMonth) + 1] : []}
        onMonthsChange={(months) => setSourceMonth(months.length > 0 ? MONTHS[(months[0] as number) - 1] : '')}
        showApplyButton={false}
      />

      <DataFilterPanel
        title="Hedef Dönem (Planlanacak)"
        showYearFilter={true}
        selectedYears={targetYear ? [targetYear] : []}
        availableYears={YEARS}
        onYearsChange={(years) => setTargetYear(years.length > 0 ? years[0] as number : 0)}
        showMonthFilter={true}
        selectedMonths={targetMonth ? [MONTHS.indexOf(targetMonth) + 1] : []}
        onMonthsChange={(months) => setTargetMonth(months.length > 0 ? MONTHS[(months[0] as number) - 1] : '')}
        showApplyButton={false}
        customFilters={
          <div className="flex flex-wrap items-end gap-4">
            {/* Hedef İş Günü */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-3)]">Hedef İş Günü</label>
              <input
                type="number"
                value={targetWorkDays}
                onChange={(e) => setTargetWorkDays(Number(e.target.value))}
                className="px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-1)] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-24"
              />
            </div>

            {/* Analiz Butonu */}
            <button
              onClick={startAnalysis}
              disabled={loading}
              className="px-6 py-2.5 h-[42px] bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Hesaplanıyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Optimize Et
                </>
              )}
            </button>

            <span className="text-xs font-medium text-[var(--text-muted)] self-end pb-2">
              {aggregatedData.length > 0 ? `${aggregatedData.length} hekim analizi hazır` : 'Veri bekleniyor'}
            </span>
          </div>
        }
      />

      {loading && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-16 rounded-[40px] shadow-sm border border-[var(--glass-border)] flex flex-col items-center gap-6 animate-in fade-in zoom-in-95">
          <div className="w-full max-w-xl bg-[var(--surface-2)] h-3 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
          <p className="text-[var(--text-1)] font-black text-lg">{loadingStage}</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border-2 border-rose-500/30 p-8 rounded-[32px] text-rose-400 font-bold text-center animate-in shake">
          {error}
        </div>
      )}

      <div ref={resultsRef} className="space-y-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {proposals.map((prop, idx) => {
            const calendarTotal = prop.febPlan.polyclinic + prop.febPlan.surgery + prop.febPlan.fixedActions.reduce((a, b) => a + b.days, 0);
            return (
              <div key={idx} className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[40px] shadow-2xl border border-[var(--glass-border)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-emerald-600 text-white py-4 px-8 text-center font-black uppercase text-[10px] tracking-widest">
                  {targetMonth.toUpperCase()} {targetYear} PLAN ÖNERİSİ
                </div>
                <div className="p-8 border-b border-[var(--border-1)] flex justify-between items-start bg-[var(--surface-2)]">
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text-1)] uppercase leading-none">{prop.doctorName}</h3>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-1 tracking-widest">{prop.specialty}</p>
                    <p className="text-[10px] font-black text-emerald-400 uppercase mt-1 tracking-widest">ANALİZ SONUCU</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">TAKVİM TOPLAMI</p>
                    <p className="text-2xl font-black text-[var(--text-1)] leading-none">{calendarTotal} GÜN</p>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <div className="bg-[var(--surface-1)] text-[var(--text-1)] p-6 rounded-[32px] border-l-8 border-emerald-500 shadow-lg border border-[var(--border-1)]">
                    <p className="text-sm font-bold italic mb-3">"{prop.decSummary}"</p>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">ANALİZ NOTU:</span>
                      <span className="text-xs font-bold text-[var(--text-2)]">{prop.efficiencyComment}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-blue-500/10 rounded-[32px] border border-blue-500/30 flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] font-black text-blue-400 uppercase mb-1">YENİ POLİKLİNİK</p>
                        <p className="text-4xl font-black text-blue-400">{prop.febPlan.polyclinic} G</p>
                      </div>
                      {prop.polyDiff !== undefined && prop.polyDiff !== 0 && (
                        <p className={`text-xs font-black mt-2 ${prop.polyDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {prop.polyDiff > 0 ? '+' : ''}{prop.polyDiff} POLİKLİNİK
                        </p>
                      )}
                    </div>
                    <div className="p-6 bg-emerald-500/10 rounded-[32px] border border-emerald-500/30 flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] font-black text-emerald-400 uppercase mb-1">YENİ AMELİYAT</p>
                        <p className="text-4xl font-black text-emerald-400">{prop.febPlan.surgery} G</p>
                      </div>
                      {prop.surgDiff !== undefined && prop.surgDiff !== 0 && (
                        <p className={`text-xs font-black mt-2 ${prop.surgDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {prop.surgDiff > 0 ? '+' : ''}{prop.surgDiff} AMELİYAT
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {changedProposals.length > 0 && (
          <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[56px] shadow-2xl border border-[var(--glass-border)] overflow-hidden mt-12 animate-in slide-in-from-bottom-8">
            <div className="p-12 border-b border-[var(--border-1)] bg-[var(--surface-1)] flex justify-between items-center">
              <div>
                <h4 className="text-3xl font-black text-[var(--text-1)] uppercase tracking-tight">ÖZET DEĞİŞİM TABLOSU</h4>
                <p className="text-[var(--text-muted)] text-[10px] mt-2 font-black uppercase tracking-[0.2em]">Değişiklik Yapılan Hekimlerin Net Değişimleri</p>
              </div>
              <div className="bg-emerald-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40">
                {changedProposals.length} DEĞİŞİKLİK
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border-1)]">
                  <tr>
                    <th className="px-10 py-8 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] whitespace-nowrap">Hekim Adı</th>
                    <th className="px-10 py-8 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] whitespace-nowrap">Branş</th>
                    <th className="px-10 py-8 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] text-center whitespace-nowrap">Poliklinik Değişimi</th>
                    <th className="px-10 py-8 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] text-center whitespace-nowrap">Ameliyat Değişimi</th>
                    <th className="px-10 py-8 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] whitespace-nowrap">Analiz Özeti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)]">
                  {changedProposals.map((prop, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-10 py-6 min-w-[200px]">
                        <p className="font-black text-[var(--text-1)] uppercase text-sm">{prop.doctorName}</p>
                      </td>
                      <td className="px-10 py-6 min-w-[200px]">
                        <p className="text-[11px] font-black text-[var(--text-muted)] uppercase leading-tight">{prop.specialty}</p>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-6 py-2 rounded-2xl text-[11px] font-black border tracking-widest uppercase inline-block whitespace-nowrap ${prop.polyDiff === 0 ? 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border-1)]' : prop.polyDiff! > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-sm'}`}>
                          {prop.polyDiff === 0 ? 'Değişim Yok' : `${prop.polyDiff! > 0 ? '+' : ''}${prop.polyDiff} GÜN`}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-6 py-2 rounded-2xl text-[11px] font-black border tracking-widest uppercase inline-block whitespace-nowrap ${prop.surgDiff === 0 ? 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border-1)]' : prop.surgDiff! > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-sm'}`}>
                          {prop.surgDiff === 0 ? 'Değişim Yok' : `${prop.surgDiff! > 0 ? '+' : ''}${prop.surgDiff} GÜN`}
                        </span>
                      </td>
                      <td className="px-10 py-6 min-w-[400px]">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] italic leading-snug">
                          {prop.decSummary}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningModule;
