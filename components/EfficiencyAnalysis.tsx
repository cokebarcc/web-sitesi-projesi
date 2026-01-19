import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, Line, LabelList } from 'recharts';
import { DetailedScheduleData, MuayeneMetrics, ScheduleVersion, ProcessedPhysicianSummary } from '../types';
import { MONTHS, YEARS } from '../constants';
import { getPeriodKey, normalizeDoctorName } from '../utils/formatters';
import DataFilterPanel from './common/DataFilterPanel';

interface EfficiencyAnalysisProps {
  detailedScheduleData: DetailedScheduleData[];
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  ameliyatByPeriod: Record<string, Record<string, number>>;
  muayeneMetaByPeriod: Record<string, { fileName: string; uploadedAt: number }>;
  ameliyatMetaByPeriod: Record<string, { fileName: string; uploadedAt: number }>;
  versions: Record<string, Record<string, ScheduleVersion>>;
  changeAnalysisPhysCompare?: any[];
  // Global filtre state'leri
  globalSelectedYears: number[];
  setGlobalSelectedYears: (years: number[]) => void;
  globalSelectedMonths: number[];
  setGlobalSelectedMonths: (months: number[]) => void;
  globalAppliedYears: number[];
  globalAppliedMonths: number[];
  // Hospital filter
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Merkezi veri yükleme fonksiyonu
  onCentralDataLoad: (hospital: string, years: number[], months: number[]) => Promise<void>;
  isLoading?: boolean;
  // Optional overrides for controlled rendering (e.g. for Presentation snapshots)
  overrideMonth?: string;
  overrideYear?: number;
  overrideBranch?: string;
}

const EXCLUDED_SCHEDULE_ACTION_LABELS = ["HAFTA SONU TATİLİ", "HAFTASONU TATİLİ"];
const COLOR_PALETTE = ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#d946ef', '#84cc16', '#f97316', '#14b8a6'];

const getActionColor = (actionName: string): string => {
  let hash = 0;
  const str = actionName.toLocaleUpperCase('tr-TR');
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
};

const formatMetric = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
  if (Number.isInteger(val)) return val.toLocaleString('tr-TR');
  return parseFloat(val.toFixed(1)).toLocaleString('tr-TR');
};

const EfficiencyAnalysis: React.FC<EfficiencyAnalysisProps> = ({
  detailedScheduleData,
  muayeneByPeriod,
  ameliyatByPeriod,
  muayeneMetaByPeriod,
  ameliyatMetaByPeriod,
  versions,
  changeAnalysisPhysCompare = [],
  globalSelectedYears,
  setGlobalSelectedYears,
  globalSelectedMonths,
  setGlobalSelectedMonths,
  globalAppliedYears,
  globalAppliedMonths,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  onCentralDataLoad,
  isLoading = false,
  overrideMonth,
  overrideYear,
  overrideBranch
}) => {
  // Uygulanan filtrelerden ilk değerleri al (geriye uyumluluk için)
  const selectedMonth = overrideMonth || (globalAppliedMonths.length > 0 ? MONTHS[globalAppliedMonths[0] - 1] : '');
  const selectedYear = overrideYear ? String(overrideYear) : (globalAppliedYears.length > 0 ? String(globalAppliedYears[0]) : '');

  const [selectedBranch, setSelectedBranch] = useState<string>(overrideBranch || 'ALL');
  
  const [chartBranchFilter, setChartBranchFilter] = useState<string>(overrideBranch || 'ALL');
  const [viewLimit, setViewLimit] = useState<number | 'ALL'>(12);
  const [currentPage, setCurrentPage] = useState(1);

  const [surgBranchFilter, setSurgBranchFilter] = useState<string>(overrideBranch || 'ALL');
  const [surgViewLimit, setSurgViewLimit] = useState<number | 'ALL'>(12);
  const [surgCurrentPage, setSurgCurrentPage] = useState(1);

  const [distBranchFilter, setDistBranchFilter] = useState<string>(overrideBranch || 'ALL');

  const [hoursBranchFilter, setHoursBranchFilter] = useState<string>(overrideBranch || 'ALL');
  const [hoursViewLimit, setHoursViewLimit] = useState<number | 'ALL'>(12);
  const [hoursCurrentPage, setHoursCurrentPage] = useState(1);

  const [selectedDoctorForDetail, setSelectedDoctorForDetail] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filtre değişimlerinde sayfalamayı sıfırla
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      setCurrentPage(1);
      setSurgCurrentPage(1);
      setHoursCurrentPage(1);
      setChartBranchFilter(selectedBranch);
      setSurgBranchFilter(selectedBranch);
      setDistBranchFilter(selectedBranch);
      setHoursBranchFilter(selectedBranch);
    }
  }, [selectedMonth, selectedYear, selectedBranch]);

  const periodKey = selectedMonth && selectedYear && selectedHospital
    ? `${selectedHospital}-${getPeriodKey(Number(selectedYear), selectedMonth)}`
    : '';

  const availableBranches = useMemo(() => {
    if (!selectedMonth || !selectedYear) return [];
    const branches = new Set<string>();
    detailedScheduleData.filter(d => d.month === selectedMonth && d.year === Number(selectedYear)).forEach(d => { if (d.specialty && d.specialty !== 'Bilinmiyor') branches.add(d.specialty); });
    return Array.from(branches).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [detailedScheduleData, selectedMonth, selectedYear]);

  const isPeriodSelected = !!(selectedMonth && selectedYear);

  const { stats, fullChartData, fullSurgeryChartData, fullSurgHoursChartData, eligibleSurgicalBranches, distributionChartData } = useMemo(() => {
    if (!isPeriodSelected) return { stats: { totalCapacityCount: 0, totalExamsCount: 0, totalMhrsExamsCount: 0, totalSurgeryDays: 0, totalAbcSurgeriesCount: 0, totalScheduledSurgeryHours: 0, hasSchedule: false, hasMuayene: false, hasAmeliyat: false, rowCount: 0 }, fullChartData: [], fullSurgeryChartData: [], fullSurgHoursChartData: [], eligibleSurgicalBranches: [], distributionChartData: [] };
    const periodSchedules = detailedScheduleData.filter(d => d.month === selectedMonth && d.year === Number(selectedYear));
    const rawMuayeneData = muayeneByPeriod[periodKey] || {};
    const rawAmeliyatData = ameliyatByPeriod[periodKey] || {};
    let kpiSchedules = [...periodSchedules]; if (selectedBranch !== 'ALL') kpiSchedules = kpiSchedules.filter(s => s.specialty === selectedBranch);
    const physicianMap = new Map<string, { name: string, branch: string, capacity: number }>();
    const docSurgHoursMap = new Map<string, number>();
    const surgeryActions = ['AMELİYAT', 'AMELİYATTA', 'SURGERY', 'AMELİYATHANE'];
    periodSchedules.forEach(s => { const norm = normalizeDoctorName(s.doctorName); if (!physicianMap.has(norm)) physicianMap.set(norm, { name: s.doctorName, branch: s.specialty, capacity: 0 }); physicianMap.get(norm)!.capacity += (s.capacity || 0); const actionNorm = s.action.toLocaleUpperCase('tr-TR'); if (surgeryActions.some(sa => actionNorm.includes(sa))) { const hours = (s.duration || 0) / 60; docSurgHoursMap.set(norm, (docSurgHoursMap.get(norm) || 0) + hours); } });
    const doctorSurgeryDaysMap = new Map<string, Set<string>>();
    periodSchedules.forEach(item => { const actionNorm = item.action.toLocaleUpperCase('tr-TR'); if (surgeryActions.some(sa => actionNorm.includes(sa))) { const normName = normalizeDoctorName(item.doctorName); if (!doctorSurgeryDaysMap.has(normName)) doctorSurgeryDaysMap.set(normName, new Set()); doctorSurgeryDaysMap.get(normName)!.add(item.startDate); } });
    const totalCapacityCount = kpiSchedules.reduce((acc, curr) => acc + (curr.capacity || 0), 0);
    // Fix: Explicitly typed the Set to prevent 'unknown' inference for .size usage
    const distinctSurgeryDays = new Set<string>(); let totalScheduledSurgeryHours = 0; kpiSchedules.forEach(item => { const actionNorm = item.action.toLocaleUpperCase('tr-TR'); if (surgeryActions.some(sa => actionNorm.includes(sa))) { distinctSurgeryDays.add(`${item.doctorName}|${item.startDate}`); totalScheduledSurgeryHours += (item.duration || 0) / 60; } });
    const totalSurgeryDays = distinctSurgeryDays.size; let totalExamsCount = 0; let totalMhrsExamsCount = 0; let totalAbcSurgeriesCount = 0;
    (Object.entries(rawMuayeneData) as [string, MuayeneMetrics][]).forEach(([docName, metrics]) => { const docBase = physicianMap.get(docName); if (docBase && (selectedBranch === 'ALL' || docBase.branch === selectedBranch)) { totalExamsCount += (metrics.toplam || 0); totalMhrsExamsCount += (metrics.mhrs || 0); } });
    (Object.entries(rawAmeliyatData) as [string, number][]).forEach(([docName, count]) => { const docBase = physicianMap.get(docName); if (docBase && (selectedBranch === 'ALL' || docBase.branch === selectedBranch)) totalAbcSurgeriesCount += (count || 0); });
    const capacityList = Array.from(physicianMap.entries()).map(([normName, base]) => { const metrics = rawMuayeneData[normName] || { mhrs: 0, ayaktan: 0, toplam: 0 }; const total = metrics.toplam || 0; const cap = base.capacity || 0; let status = "NORMAL"; let diffPct = 0; if (cap > 0) { diffPct = (total - cap) / cap; if (total < cap) status = "UNDER"; else status = "OVER"; } else { status = total > 0 ? "NO_CAP" : "BOTH_ZERO"; } return { doctorName: base.name, branchName: base.branch, capacity: cap, totalExam: total, performanceDiff: total - cap, diffPct, status, usageRatePct: cap > 0 ? (total / cap) * 100 : null }; }).filter(item => { const isBothZero = item.capacity <= 0 && item.totalExam <= 0; const branchMatch = chartBranchFilter === 'ALL' || item.branchName === chartBranchFilter; return !isBothZero && branchMatch && !!item.doctorName; });
    const underGroup = capacityList.filter(d => d.status === "UNDER").sort((a, b) => a.diffPct - b.diffPct); const noCapGroup = capacityList.filter(d => d.status === "NO_CAP").sort((a, b) => b.totalExam - a.totalExam); const overGroup = capacityList.filter(d => d.status === "OVER" || (d.capacity > 0 && d.totalExam === d.capacity)).sort((a, b) => a.diffPct - b.diffPct);
    const surgeryList = Array.from(physicianMap.entries()).map(([normName, base]) => { const plannedDays = doctorSurgeryDaysMap.get(normName)?.size || 0; const performedABC = rawAmeliyatData[normName] || 0; const efficiencyVal = plannedDays > 0 ? (performedABC / plannedDays) : 0; return { doctorName: base.name, branchName: base.branch, plannedDays, performedABC, efficiencyVal, efficiencyStr: plannedDays > 0 ? efficiencyVal.toFixed(2) : "—" }; }).filter(item => { const isBothZero = item.plannedDays <= 0 && item.performedABC <= 0; return !isBothZero && !!item.doctorName; });
    const surgHoursList = Array.from(physicianMap.entries()).map(([normName, base]) => { const totalHours = docSurgHoursMap.get(normName) || 0; const cases = rawAmeliyatData[normName] || 0; const avgHoursPerCase = cases > 0 ? (totalHours / cases) : 0; return { doctorName: base.name, branchName: base.branch, totalSurgHours: totalHours, surgCaseCount: cases, avgHoursPerCase: avgHoursPerCase, avgHoursStr: avgHoursPerCase > 0 ? avgHoursPerCase.toFixed(2) : (totalHours > 0 ? "Vaka Yok" : "0.00") }; }).filter(item => { const isBothZero = item.totalSurgHours <= 0 && item.surgCaseCount <= 0; return !isBothZero && !!item.doctorName; });
    const actionMap: Map<string, { label: string; totalHours: number; rowCount: number }> = new Map();
    periodSchedules.forEach(row => { const branchMatch = distBranchFilter === 'ALL' || row.specialty === distBranchFilter; if (!branchMatch) return; const rawLabel = row.action?.replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR') || "(BOŞ / TANIMSIZ)"; if (EXCLUDED_SCHEDULE_ACTION_LABELS.includes(rawLabel)) return; if (!row.duration || row.duration <= 0) return; const hours = row.duration / 60; const current = actionMap.get(rawLabel) || { label: row.action?.trim() || "(BOŞ)", totalHours: 0, rowCount: 0 }; current.totalHours += hours; current.rowCount++; actionMap.set(rawLabel, current); });
    const distributionChartData = Array.from(actionMap.values()).map(item => ({ ...item, color: getActionColor(item.label) })).sort((a, b) => b.totalHours - a.totalHours);
    const surgicalBranchesSet = new Set<string>(); surgeryList.forEach(item => { if (item.plannedDays > 0 || item.performedABC > 0) surgicalBranchesSet.add(item.branchName); });
    const eligibleSurgicalBranches = Array.from(surgicalBranchesSet).sort((a, b) => a.localeCompare(b, 'tr-TR'));
    return { stats: { totalCapacityCount, totalExamsCount, totalMhrsExamsCount, totalSurgeryDays, totalAbcSurgeriesCount, totalScheduledSurgeryHours, hasSchedule: periodSchedules.length > 0, hasMuayene: !!muayeneMetaByPeriod[periodKey], hasAmeliyat: !!ameliyatMetaByPeriod[periodKey], rowCount: kpiSchedules.length }, fullChartData: [...underGroup, ...noCapGroup, ...overGroup], fullSurgeryChartData: surgeryList.filter(item => surgBranchFilter === 'ALL' || item.branchName === surgBranchFilter).sort((a, b) => b.efficiencyVal - a.efficiencyVal), fullSurgHoursChartData: surgHoursList.filter(item => hoursBranchFilter === 'ALL' || item.branchName === hoursBranchFilter).sort((a, b) => b.avgHoursPerCase - a.avgHoursPerCase), eligibleSurgicalBranches, distributionChartData };
  }, [detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, muayeneMetaByPeriod, ameliyatMetaByPeriod, selectedMonth, selectedYear, periodKey, isPeriodSelected, selectedBranch, chartBranchFilter, surgBranchFilter, hoursBranchFilter, distBranchFilter]);

  const paginatedChartData = useMemo(() => { if (viewLimit === 'ALL') return fullChartData; const startIndex = (currentPage - 1) * viewLimit; return fullChartData.slice(startIndex, startIndex + (viewLimit as number)); }, [fullChartData, viewLimit, currentPage]);
  const paginatedSurgData = useMemo(() => { if (surgViewLimit === 'ALL') return fullSurgeryChartData; const startIndex = (surgCurrentPage - 1) * surgViewLimit; return fullSurgeryChartData.slice(startIndex, startIndex + (surgViewLimit as number)); }, [fullSurgeryChartData, surgViewLimit, surgCurrentPage]);
  const paginatedHoursData = useMemo(() => { if (hoursViewLimit === 'ALL') return fullSurgHoursChartData; const startIndex = (hoursCurrentPage - 1) * hoursViewLimit; return fullSurgHoursChartData.slice(startIndex, startIndex + (hoursViewLimit as number)); }, [fullSurgHoursChartData, hoursViewLimit, hoursCurrentPage]);

  const totalPages = viewLimit === 'ALL' ? 1 : Math.ceil(fullChartData.length / (Number(viewLimit) || 1));
  const totalSurgPages = surgViewLimit === 'ALL' ? 1 : Math.ceil(fullSurgeryChartData.length / (Number(surgViewLimit) || 1));
  const totalHoursPages = hoursViewLimit === 'ALL' ? 1 : Math.ceil(fullSurgHoursChartData.length / (Number(hoursViewLimit) || 1));

  const appointmentRate = useMemo(() => (isPeriodSelected && stats.totalExamsCount > 0) ? (stats.totalMhrsExamsCount / stats.totalExamsCount) * 100 : null, [isPeriodSelected, stats]);
  const avgHoursPerSurgery = useMemo(() => (isPeriodSelected && stats.totalAbcSurgeriesCount > 0) ? stats.totalScheduledSurgeryHours / stats.totalAbcSurgeriesCount : 0, [isPeriodSelected, stats]);

  const handleBarClick = (data: any) => { 
    if (data && data.doctorName) { 
      const enrichedDoctor = fullChartData.find(d => normalizeDoctorName(d.doctorName) === normalizeDoctorName(data.doctorName));
      setSelectedDoctorForDetail(enrichedDoctor || data); 
      setIsDetailModalOpen(true); 
    } 
  };

  // Merkezi Uygula butonu handler
  const handleApply = async () => {
    if (!selectedHospital || globalSelectedYears.length === 0 || globalSelectedMonths.length === 0) {
      alert('Lütfen hastane, yıl ve ay seçiniz!');
      return;
    }
    // Merkezi veri yükleme fonksiyonunu çağır
    await onCentralDataLoad(selectedHospital, globalSelectedYears, globalSelectedMonths);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {!overrideMonth && (
        <>
          <DataFilterPanel
            title="Veri Filtreleme (Merkezi)"
            showHospitalFilter={true}
            selectedHospital={selectedHospital}
            availableHospitals={allowedHospitals}
            onHospitalChange={onHospitalChange}
            showYearFilter={true}
            selectedYears={globalSelectedYears}
            availableYears={YEARS}
            onYearsChange={setGlobalSelectedYears}
            showMonthFilter={true}
            selectedMonths={globalSelectedMonths}
            onMonthsChange={setGlobalSelectedMonths}
            showBranchFilter={true}
            selectedBranch={selectedBranch === 'ALL' ? null : selectedBranch}
            availableBranches={availableBranches}
            onBranchChange={(branch) => setSelectedBranch(branch || 'ALL')}
            showApplyButton={true}
            onApply={handleApply}
            isLoading={isLoading}
            applyDisabled={!selectedHospital || globalSelectedYears.length === 0 || globalSelectedMonths.length === 0}
            selectionCount={globalAppliedYears.length * globalAppliedMonths.length}
            selectionLabel="dönem yüklendi"
          />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <KpiCard title="Toplam Kapasite Sayısı" value={isPeriodSelected ? stats.totalCapacityCount : null} source="Detaylı Cetveller" accent="capacity" isEmpty={!isPeriodSelected} />
        <KpiCard title="Toplam Muayene Sayısı" value={isPeriodSelected ? stats.totalExamsCount : null} source="Hekim Verileri" accent="visits" isEmpty={!isPeriodSelected} />
        <KpiCard title="Randevulu Muayene Oranı" value={appointmentRate !== null ? `${appointmentRate.toFixed(1).replace('.', ',')}%` : null} source="Hekim Verileri" accent="ratio" subtitle="(MHRS / TOPLAM)" isEmpty={!isPeriodSelected || stats.totalExamsCount === 0} />
        <KpiCard title="MHRS'de Planlanan Ameliyat Gün Sayısı" value={isPeriodSelected ? stats.totalSurgeryDays : null} source="Detaylı Cetveller" accent="surgeryDay" isEmpty={!isPeriodSelected} />
        <KpiCard title="Yapılan Toplam A+B+C Grubu Ameliyat Sayısı" value={isPeriodSelected ? stats.totalAbcSurgeriesCount : null} source="Hekim Verileri" accent="surgeryCount" isEmpty={!isPeriodSelected} />
        <KpiCard title="Ameliyat Başına Düşen Saat" value={isPeriodSelected ? avgHoursPerSurgery.toFixed(2).replace('.', ',') : null} source="Cetvel + Hekim Verileri" accent="surgeryHour" subtitle="SAAT / AMELİYAT" isEmpty={!isPeriodSelected || stats.totalAbcSurgeriesCount === 0} />
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div><h3 className="text-xl font-black text-[var(--text-1)] uppercase">KAPASİTE KULLANIM GRAFİĞİ</h3><p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Hekim bazında kapasite ve muayene karşılaştırması</p></div>
          {isPeriodSelected && <LocalFilters value={chartBranchFilter} onChange={setChartBranchFilter} limit={viewLimit} onLimitChange={setViewLimit} currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} branches={availableBranches} />}
        </div>
        {!isPeriodSelected ? <EmptyState /> : <CapacityUsageChart data={paginatedChartData} onClick={handleBarClick} />}
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div><h3 className="text-xl font-black text-[var(--text-1)] uppercase">CERRAHİ VERİMLİLİK GRAFİĞİ</h3><p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Planlanan ameliyat günleri ve gerçekleşen vaka sayısı</p></div>
          {isPeriodSelected && <LocalFilters value={surgBranchFilter} onChange={setSurgBranchFilter} limit={surgViewLimit} onLimitChange={setSurgViewLimit} currentPage={surgCurrentPage} totalPages={totalSurgPages} onPageChange={setSurgCurrentPage} branches={eligibleSurgicalBranches} />}
        </div>
        {!isPeriodSelected ? <EmptyState /> : <SurgicalEfficiencyChart data={paginatedSurgData} />}
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div><h3 className="text-xl font-black text-[var(--text-1)] uppercase">AMELİYAT BAŞINA DÜŞEN CETVEL SÜRESİ</h3><p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Vaka başına düşen ortalama cetvel saati</p></div>
          {isPeriodSelected && <LocalFilters value={hoursBranchFilter} onChange={setHoursBranchFilter} limit={hoursViewLimit} onLimitChange={setHoursViewLimit} currentPage={hoursCurrentPage} totalPages={totalHoursPages} onPageChange={setHoursCurrentPage} branches={availableBranches} />}
        </div>
        {!isPeriodSelected ? <EmptyState /> : <SurgHoursChart data={paginatedHoursData} />}
      </div>

      {isDetailModalOpen && (
        <DoctorDetailModal
          doctor={selectedDoctorForDetail}
          onClose={() => setIsDetailModalOpen(false)}
          versions={versions}
          changeAnalysisPhysCompare={changeAnalysisPhysCompare}
          detailedScheduleData={detailedScheduleData}
          periodMonth={selectedMonth}
          periodYear={Number(selectedYear)}
          periodHospital={selectedHospital}
          muayeneByPeriod={muayeneByPeriod}
          ameliyatByPeriod={ameliyatByPeriod}
        />
      )}
    </div>
  );
};

const LegendItem = ({ color, label }: any) => <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}></div><span className="text-[9px] font-black text-[var(--text-muted)] uppercase whitespace-nowrap">{label}</span></div>;

export const CapacityUsageChart = ({ data, onClick }: any) => (
  <div className="bg-[var(--surface-2)] p-8 rounded-[20px] border border-[var(--border-1)] h-[550px]">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-wide">Kapasite Kullanım Grafiği</h3>
      <div className="flex items-center gap-4">
        <LegendItem color="#818cf8" label="Randevu Kapasitesi" />
        <LegendItem color="#10b981" label="Gerçekleşen (Hedef Üstü)" />
        <LegendItem color="#ef4444" label="Gerçekleşen (Hedef Altı)" />
        <LegendItem color="#64748b" label="Kapasite Tanımsız" />
      </div>
    </div>
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="doctorName" interval={0} tick={<CustomizedXAxisTick onClick={onClick} />} axisLine={false} tickLine={false} height={100} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
        <Tooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const d = payload[0].payload;
            const f = d.capacity > 0 ? (d.totalExam - d.capacity) : null;
            return <TooltipCard name={d.doctorName} branch={d.branchName} metrics={[{label:'Planlanan', val: d.capacity > 0 ? d.capacity.toLocaleString('tr-TR') : 'Tanımsız', color:'text-indigo-400'}, {label:'Gerçekleşen', val: d.totalExam.toLocaleString('tr-TR'), color:d.status==='UNDER'?'text-rose-400':'text-emerald-400'}, {label:'Verim', val: d.usageRatePct !== null ? `%${formatMetric(d.usageRatePct)}` : '-', color:'text-blue-400'}]} footerLabel="FARK" footer={f === null ? 'Tanımsız' : (f >= 0 ? `+${f.toLocaleString('tr-TR')}` : f.toLocaleString('tr-TR'))} />;
          }
          return null;
        }} />
        <Bar name="Randevu Kapasitesi" dataKey="capacity" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={25} onClick={(d) => onClick?.(d)} className="cursor-pointer" />
        <Bar name="Toplam Muayene" dataKey="totalExam" radius={[4, 4, 0, 0]} barSize={25} onClick={(d) => onClick?.(d)} className="cursor-pointer">
          {data.map((e: any, cellIdx: number) => <Cell key={`cell-${cellIdx}`} fill={e.status==='UNDER'?'#ef4444':e.status==='NO_CAP'?'#64748b':'#10b981'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const SurgicalEfficiencyChart = ({ data }: any) => (
  <div className="bg-[var(--surface-2)] p-8 rounded-[20px] border border-[var(--border-1)] h-[550px]">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-wide">Cerrahi Verimlilik Grafiği</h3>
      <div className="flex items-center gap-4">
        <LegendItem color="#818cf8" label="Planlanan Gün" />
        <LegendItem color="#10b981" label="A+B+C Vaka Sayısı" />
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase whitespace-nowrap">Verimlilik Oranı</span>
        </div>
      </div>
    </div>
    <ResponsiveContainer width="100%" height="90%">
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="doctorName" interval={0} tick={<CustomizedXAxisTick />} axisLine={false} tickLine={false} height={100} />
        <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
        <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
        <Tooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const d = payload[0].payload;
            return <TooltipCard name={d.doctorName} branch={d.branchName} metrics={[{label:'Planlanan Gün', val: formatMetric(d.plannedDays), color:'text-indigo-400'}, {label:'A+B+C Vaka', val: formatMetric(d.performedABC), color:'text-emerald-400'}]} footerLabel="Verimlilik" footer={formatMetric(d.efficiencyVal)} footerColor="text-rose-400" />;
          }
          return null;
        }} />
        <Bar yAxisId="left" name="Plan" dataKey="plannedDays" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={25} />
        <Bar yAxisId="left" name="Vaka" dataKey="performedABC" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
        <Line yAxisId="right" name="Verimlilik" type="monotone" dataKey="efficiencyVal" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

export const SurgHoursChart = ({ data }: any) => (
  <div className="bg-[var(--surface-2)] p-8 rounded-[20px] border border-[var(--border-1)] h-[550px]">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-wide">Cerrahi Süre Grafiği</h3>
      <div className="flex items-center gap-4">
        <LegendItem color="#6366f1" label="Ortalama Cerrahi Süresi (Saat/Vaka)" />
      </div>
    </div>
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="doctorName" interval={0} tick={<CustomizedXAxisTick />} axisLine={false} tickLine={false} height={100} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
        <Tooltip cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const d = payload[0].payload;
            return <TooltipCard name={d.doctorName} branch={d.branchName} metrics={[{label:'Cerrahi Süre', val:`${formatMetric(d.totalSurgHours)} Saat`, color:'text-indigo-400'}, {label:'Vaka Sayısı', val:formatMetric(d.surgCaseCount), color:'text-emerald-400'}]} footerLabel="Ortalama" footer={`${formatMetric(d.avgHoursPerCase)} S/V`} />;
          }
          return null;
        }} />
        <Bar dataKey="avgHoursPerCase" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const CustomizedXAxisTick = ({ x, y, payload, onClick }: any) => {
  const l = payload.value; const t = l.length > 16 ? l.substring(0, 14) + '...' : l;
  return <g transform={`translate(${x},${y})`} className="cursor-pointer group" onClick={() => onClick?.({ doctorName: l })}><text x={0} y={0} dy={16} textAnchor="end" fill="#64748b" fontSize={9} fontWeight={800} transform="rotate(-45)" className="group-hover:fill-blue-600">{t}</text></g>;
};

const KpiCard = ({ title, value, subtitle, source, accent, isEmpty, isWarning, warningText }: any) => {
  const colorMap: Record<string, string> = {
    capacity: 'border-t-sky-400 text-sky-300 bg-sky-400',
    visits: 'border-t-cyan-400 text-cyan-300 bg-cyan-400',
    ratio: 'border-t-purple-400 text-purple-300 bg-purple-400',
    surgery: 'border-t-teal-400 text-teal-300 bg-teal-400',
    surgeryDay: 'border-t-teal-400 text-teal-300 bg-teal-400',
    surgeryCount: 'border-t-lime-400 text-lime-300 bg-lime-400',
    surgeryHour: 'border-t-amber-400 text-amber-300 bg-amber-400'
  };
  const p = colorMap[accent] || colorMap.capacity;
  const [b, t, d] = p.split(' ');
  return <div className={`bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] border-t-[3px] ${b} rounded-[20px] p-6 shadow-lg flex flex-col justify-between h-[180px] transition-all hover:shadow-xl group relative overflow-hidden`}><div className="space-y-3 relative z-10"><div className="flex justify-between items-center"><span className="text-[11px] font-semibold text-[var(--text-2)] uppercase tracking-wide leading-tight">{title}</span>{isWarning && <div className="flex items-center gap-1.5 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></div><span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">{warningText}</span></div>}</div><div><h3 className={`text-3xl lg:text-4xl font-extrabold tabular-nums tracking-tight truncate ${t}`}>{isEmpty || value === null ? '—' : (typeof value === 'number' ? value.toLocaleString('tr-TR') : value)}</h3>{subtitle && <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1 italic uppercase tracking-tighter leading-tight">{subtitle}</p>}</div></div><div className="border-t border-[var(--border-1)] pt-3 relative z-10"><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">KAYNAK: {source}</span></div><div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full ${d} opacity-[0.08] group-hover:opacity-[0.15] transition-opacity blur-2xl`}></div></div>;
};

const LocalFilters = ({ value, onChange, limit, onLimitChange, currentPage, totalPages, onPageChange, branches }: any) => (
  <div className="flex flex-wrap items-center gap-3 bg-[var(--surface-2)] p-2 rounded-2xl border border-[var(--border-1)]">
    <div className="flex items-center gap-2 px-3 border-r border-[var(--border-2)]"><span className="text-[9px] font-black text-[var(--text-muted)] uppercase">BRANŞ:</span><select value={value} onChange={(e) => { onChange(e.target.value); onPageChange(1); }} className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-1)] rounded-xl px-3 py-1.5 text-[10px] font-black outline-none min-w-[140px]"><option value="ALL">Tüm Hastane</option>{branches.map((br:string) => <option key={br} value={br}>{br}</option>)}</select></div>
    <div className="flex items-center gap-2 px-3"><span className="text-[9px] font-black text-[var(--text-muted)] uppercase">GÖSTER:</span><select value={limit} onChange={(e) => { const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); onLimitChange(val); onPageChange(1); }} className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-1)] rounded-xl px-3 py-1.5 text-[10px] font-black outline-none"><option value={12}>12</option><option value={25}>25</option><option value={50}>50</option><option value="ALL">Tümü</option></select></div>
    {limit !== 'ALL' && totalPages > 1 && <div className="flex items-center gap-2 border-l border-[var(--border-2)] pl-3 pr-1"><button onClick={() => onPageChange((p:number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-[var(--surface-hover)] text-[var(--text-2)] rounded-lg disabled:opacity-30"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg></button><span className="text-[9px] font-black text-[var(--text-muted)] min-w-[50px] text-center uppercase">SAYFA {currentPage} / {totalPages}</span><button onClick={() => onPageChange((p:number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 hover:bg-[var(--surface-hover)] text-[var(--text-2)] rounded-lg disabled:opacity-30"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg></button></div>}
  </div>
);

const TooltipCard = ({ name, branch, metrics, footerLabel, footer, footerColor = "text-blue-400" }: any) => (
  <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-[var(--glass-border-light)] space-y-4 min-w-[240px]"><div><p className="font-black text-[var(--text-1)] uppercase text-xs leading-normal">{name}</p><p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{branch}</p></div><div className="space-y-1.5 border-t border-[var(--border-1)] pt-3">{metrics.map((m:any, i:number) => <div key={i} className={`flex justify-between items-center gap-8`}><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{m.label}:</span><span className={`text-xs font-black ${m.color}`}>{m.val}</span></div>)}<div className="flex justify-between items-center gap-8 pt-1.5 mt-1.5 border-t border-[var(--border-2)]"><span className="text-[11px] font-black text-[var(--text-2)] uppercase">{footerLabel}:</span><span className={`text-sm font-black ${footerColor}`}>{footer}</span></div></div></div>
);

const EmptyState = () => <div className="bg-[var(--surface-2)] border-2 border-dashed border-[var(--border-2)] p-24 rounded-[40px] text-center"><p className="text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-lg italic">Dönem seçimi bekleniyor</p></div>;
const NoResults = ({text}:any) => <div className="bg-amber-500/10 border-2 border-dashed border-amber-500/30 p-24 rounded-[40px] text-center"><p className="text-amber-400 font-black uppercase tracking-tight">KAYIT BULUNAMADI</p><p className="text-amber-500/80 font-bold mt-2 italic">{text || 'Filtrelere uygun hekim bulunamadı.'}</p></div>;

const DoctorDetailModal = ({
  doctor,
  onClose,
  versions,
  changeAnalysisPhysCompare,
  detailedScheduleData,
  periodMonth,
  periodYear,
  periodHospital,
  muayeneByPeriod,
  ameliyatByPeriod
}: {
  doctor: any;
  onClose: () => void;
  versions: Record<string, Record<string, ScheduleVersion>>;
  changeAnalysisPhysCompare: any[];
  detailedScheduleData: DetailedScheduleData[];
  periodMonth: string;
  periodYear: number;
  periodHospital: string;
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  ameliyatByPeriod: Record<string, Record<string, number>>;
}) => {
  const normName = normalizeDoctorName(doctor.doctorName);
  const periodKey = periodHospital ? `${periodHospital}-${getPeriodKey(periodYear, periodMonth)}` : getPeriodKey(periodYear, periodMonth);

  const docSchedules = useMemo(() => {
    return detailedScheduleData.filter(d =>
      normalizeDoctorName(d.doctorName) === normName &&
      d.month === periodMonth &&
      d.year === periodYear
    ).sort((a, b) => {
      const parseDate = (s: string) => {
        const [d, m, y] = s.split('.');
        return new Date(parseInt(y), parseInt(m)-1, parseInt(d)).getTime();
      };
      return parseDate(a.startDate) - parseDate(b.startDate);
    });
  }, [detailedScheduleData, normName, periodMonth, periodYear]);

  const muayeneMetrics = muayeneByPeriod[periodKey]?.[normName] || { mhrs: 0, ayaktan: 0, toplam: 0 };
  const plannedCapacity = docSchedules.reduce((acc, curr) => acc + (curr.capacity || 0), 0);
  const usageRate = plannedCapacity > 0 ? (muayeneMetrics.toplam / plannedCapacity) * 100 : null;
  const diff = plannedCapacity > 0 ? (muayeneMetrics.toplam - plannedCapacity) : null;

  const activitySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    const dailyMap: Record<string, { AM?: string, PM?: string }> = {};
    const getTimeMins = (t: string) => { const p = t.split(':'); return parseInt(p[0])*60 + parseInt(p[1]); };

    docSchedules.forEach(s => {
      const start = getTimeMins(s.startTime);
      const end = start + (s.duration || 0);
      const act = s.action.trim().toLocaleUpperCase('tr-TR');
      if (!dailyMap[s.startDate]) dailyMap[s.startDate] = {};
      const overlap = (s1:number, e1:number, s2:number, e2:number) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
      if (Number(overlap(start, end, 8*60, 12*60)) >= 30) dailyMap[s.startDate].AM = act;
      if (Number(overlap(start, end, 13*60, 17*60)) >= 30) dailyMap[s.startDate].PM = act;
    });

    Object.values(dailyMap).forEach(day => {
      if (day.AM) counts[day.AM] = (counts[day.AM] || 0) + 0.5;
      if (day.PM) counts[day.PM] = (counts[day.PM] || 0) + 0.5;
    });
    return counts;
  }, [docSchedules]);

  // Değişim Analizleri modülündeki phys_compare'dan ilgili hekimi bul
  const physicianChangeData = useMemo(() => {
    if (!changeAnalysisPhysCompare || changeAnalysisPhysCompare.length === 0) return null;

    // Hekim ismini normalize edip karşılaştır
    const matchingPhys = changeAnalysisPhysCompare.find(p =>
      normalizeDoctorName(p.name) === normName
    );

    return matchingPhys || null;
  }, [changeAnalysisPhysCompare, normName]);

  // Modal açıkken arka plan scrollunu engelle
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-[1200px] max-h-[90vh] bg-[var(--glass-bg)] backdrop-blur-xl rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-[var(--glass-border)]">
        <div className="p-10 border-b border-[var(--border-1)] flex justify-between items-start bg-[var(--surface-2)]">
          <div>
            <h3 className="text-3xl font-black uppercase text-[var(--text-1)] tracking-tight">{doctor.doctorName}</h3>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">{doctor.branchName}</p>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-2)]"></div>
              <p className="text-sm font-black text-indigo-400 uppercase tracking-widest">{periodMonth} {periodYear}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-[var(--surface-3)] border border-[var(--border-2)] rounded-full hover:bg-[var(--surface-hover)] transition-all shadow-sm group">
            <svg className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--text-1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Kapasite Kullanım Özeti
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-[32px] p-8">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">RANDEVU KAPASİTESİ</p>
                <h5 className="text-4xl font-black text-indigo-400">{plannedCapacity.toLocaleString('tr-TR')}</h5>
                <p className="text-[11px] font-bold text-indigo-500/70 mt-2">DÖNEMLİK TOPLAM SLOT</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-[32px] p-8">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">GERÇEKLEŞEN MUAYENE</p>
                <h5 className="text-4xl font-black text-emerald-400">{muayeneMetrics.toplam.toLocaleString('tr-TR')}</h5>
                <p className="text-[11px] font-bold text-emerald-500/70 mt-2">
                  MHRS: {muayeneMetrics.mhrs} • AYAKTAN: {muayeneMetrics.ayaktan}
                </p>
              </div>
              <div className={`rounded-[32px] p-8 border ${usageRate !== null && (usageRate as number) < 100 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${usageRate !== null && (usageRate as number) < 100 ? 'text-rose-400' : 'text-blue-400'}`}>KAPASİTE VERİMLİLİĞİ</p>
                <h5 className={`text-4xl font-black ${usageRate !== null && (usageRate as number) < 100 ? 'text-rose-400' : 'text-blue-400'}`}>
                  {usageRate !== null ? `%${usageRate.toFixed(1).replace('.', ',')}` : '—'}
                </h5>
                <p className={`text-[11px] font-bold mt-2 ${usageRate !== null && (usageRate as number) < 100 ? 'text-rose-500/70' : 'text-blue-500/70'}`}>
                  FARK: {diff !== null ? (diff >= 0 ? `+${diff}` : diff) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              Aylık Faaliyet Analiz Raporu
            </h4>
            <div className="bg-[var(--surface-2)] rounded-[40px] border border-[var(--border-1)] overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-[var(--border-1)]">
                {Object.entries(activitySummary).length > 0 ? Object.entries(activitySummary).map(([act, days]) => (
                  <div key={act} className="p-6 flex flex-col items-center justify-center text-center hover:bg-[var(--surface-hover)] transition-colors">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-2 line-clamp-1 h-3">{act}</p>
                    <p className="text-2xl font-black text-[var(--text-1)]">{days.toString().replace('.', ',')}</p>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase mt-1">GÜN</p>
                  </div>
                )) : (
                  <div className="col-span-full p-12 text-center text-[var(--text-muted)] font-black uppercase italic tracking-widest">Cetvel kaydı bulunamadı</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              Değişim Analizleri
            </h4>
            {physicianChangeData ? (
              <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
                {/* Özet Kartları */}
                <div className="p-6 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                      İLK CETVEL → SON CETVEL
                    </p>
                    <span className={`px-4 py-1.5 rounded-full font-black text-[11px] border ${physicianChangeData.capacity_delta >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                      {physicianChangeData.capacity_delta > 0 ? '+' : ''}{physicianChangeData.capacity_delta} SLOT
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--surface-1)] rounded-2xl p-4 text-center border border-[var(--border-1)]">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">ESKİ KAPASİTE</p>
                      <p className="text-2xl font-black text-[var(--text-1)]">{physicianChangeData.baseline_capacity}</p>
                    </div>
                    <div className="bg-[var(--surface-1)] rounded-2xl p-4 text-center border border-[var(--border-1)]">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">YENİ KAPASİTE</p>
                      <p className="text-2xl font-black text-[var(--text-1)]">{physicianChangeData.updated_capacity}</p>
                    </div>
                    <div className={`rounded-2xl p-4 text-center border ${physicianChangeData.capacity_delta >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                      <p className={`text-[9px] font-black uppercase mb-1 ${physicianChangeData.capacity_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>FARK</p>
                      <p className={`text-2xl font-black ${physicianChangeData.capacity_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {physicianChangeData.capacity_delta > 0 ? '+' : ''}{physicianChangeData.capacity_delta}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aksiyon Değişimleri */}
                {physicianChangeData.action_deltas && Object.keys(physicianChangeData.action_deltas).length > 0 && (
                  <div className="p-6 border-b border-[var(--border-1)]">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">AKSİYON DEĞİŞİMLERİ</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(physicianChangeData.action_deltas)
                        .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
                        .map(([act, delta]) => (
                          <span key={act} className={`text-[10px] font-black px-3 py-1.5 rounded-lg border ${Number(delta) > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                            {act} {Number(delta) > 0 ? '+' : ''}{String(delta).replace('.', ',')} G
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Aksiyon Kıyas Tablosu */}
                {physicianChangeData.baseline_action_days && physicianChangeData.updated_action_days && (
                  <div className="p-6">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                      Aksiyon Kıyas Tablosu
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b-2 border-[var(--border-1)]">
                            <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest">Aksiyon</th>
                            <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Eski Gün</th>
                            <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Yeni Gün</th>
                            <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Fark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-1)]">
                          {Array.from(new Set([...Object.keys(physicianChangeData.baseline_action_days || {}), ...Object.keys(physicianChangeData.updated_action_days || {})])).sort().map(act => {
                            const oldD = physicianChangeData.baseline_action_days?.[act] || 0;
                            const newD = physicianChangeData.updated_action_days?.[act] || 0;
                            const actionDiff = newD - oldD;
                            if (oldD === 0 && newD === 0) return null;
                            return (
                              <tr key={act} className="hover:bg-[var(--surface-hover)] transition-colors">
                                <td className="py-3 text-[11px] font-bold text-[var(--text-1)] uppercase">{act}</td>
                                <td className="py-3 text-[11px] font-black text-[var(--text-muted)] text-center">{String(oldD).replace('.', ',')} G</td>
                                <td className="py-3 text-[11px] font-black text-[var(--text-1)] text-center">{String(newD).replace('.', ',')} G</td>
                                <td className="py-3 text-center">
                                  <span className={`text-[11px] font-black ${actionDiff > 0 ? 'text-emerald-400' : actionDiff < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>
                                    {actionDiff > 0 ? '+' : ''}{String(actionDiff).replace('.', ',')} G
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Oturum Detayları */}
                {(physicianChangeData.bPhys?.rawRows || physicianChangeData.uPhys?.rawRows) && (
                  <div className="p-6 border-t border-[var(--border-1)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-[var(--surface-1)] p-6 rounded-[24px] border border-[var(--border-1)]">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mb-4 tracking-widest">ESKİ OTURUMLAR (İLK CETVEL)</p>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar border border-[var(--border-1)] rounded-xl">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-[var(--surface-2)] sticky top-0"><tr><th className="p-2">TARİH</th><th className="p-2">AKSİYON</th><th className="p-2 text-center">KAP</th></tr></thead>
                            <tbody className="divide-y divide-[var(--border-1)]">
                              {physicianChangeData.bPhys?.rawRows?.map((r: any, rowIdx: number) => (
                                <tr key={rowIdx} className="hover:bg-[var(--surface-hover)]">
                                  <td className="p-2 font-bold text-[var(--text-1)]">{r.startDate}</td>
                                  <td className="p-2 uppercase text-[var(--text-muted)]">{r.action}</td>
                                  <td className="p-2 text-center font-black text-[var(--text-1)]">{r.capacity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="bg-[var(--surface-1)] p-6 rounded-[24px] border border-rose-500/30">
                        <p className="text-[10px] font-black text-rose-400 uppercase mb-4 tracking-widest">YENİ OTURUMLAR (SON CETVEL)</p>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar border border-rose-500/20 rounded-xl">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-rose-500/10 sticky top-0"><tr><th className="p-2">TARİH</th><th className="p-2">AKSİYON</th><th className="p-2 text-center">KAP</th></tr></thead>
                            <tbody className="divide-y divide-rose-500/10">
                              {physicianChangeData.uPhys?.rawRows?.map((r: any, rowIdx: number) => (
                                <tr key={rowIdx} className="hover:bg-rose-500/5">
                                  <td className="p-2 font-bold text-[var(--text-1)]">{r.startDate}</td>
                                  <td className="p-2 uppercase text-[var(--text-muted)]">{r.action}</td>
                                  <td className="p-2 text-center font-black text-[var(--text-1)]">{r.capacity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--surface-2)] border-2 border-dashed border-[var(--border-2)] rounded-[40px] p-16 text-center">
                <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-sm">
                  Bu hekim için değişim verisi bulunmamaktadır.
                </p>
                <p className="text-[var(--text-muted)] text-xs mt-2 italic">
                  Değişim Analizleri modülünden veri yüklendiğinde burada görünecektir.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 border-t border-[var(--border-1)] bg-[var(--surface-2)] flex justify-end gap-4">
          <button
            onClick={onClose}
            className="bg-[var(--surface-1)] text-[var(--text-1)] border border-[var(--border-2)] px-12 py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-[var(--surface-hover)] transition-all active:scale-95"
          >
            KAPAT
          </button>
        </div>
      </div>
    </div>
  );
};

export default EfficiencyAnalysis;