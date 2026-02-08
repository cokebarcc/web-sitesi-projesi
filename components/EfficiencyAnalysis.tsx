import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, Line, LabelList } from 'recharts';
import { DetailedScheduleData, MuayeneMetrics, ScheduleVersion, ProcessedPhysicianSummary } from '../types';
import { MONTHS, YEARS } from '../constants';
import { getPeriodKey, normalizeDoctorName } from '../utils/formatters';
import DataFilterPanel from './common/DataFilterPanel';
import pptxgen from 'pptxgenjs';

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
const EXCLUDED_DAY_COUNT_ACTIONS = ["SONUÇ/KONTROL MUAYENE", "SONUÇ/KONTROL MUAYENESİ"];
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

  const [actionDaysBranchFilter, setActionDaysBranchFilter] = useState<string>(overrideBranch || 'ALL');

  const [hoursBranchFilter, setHoursBranchFilter] = useState<string>(overrideBranch || 'ALL');
  const [hoursViewLimit, setHoursViewLimit] = useState<number | 'ALL'>(12);
  const [hoursCurrentPage, setHoursCurrentPage] = useState(1);

  const [selectedDoctorForDetail, setSelectedDoctorForDetail] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  // Filtre değişimlerinde sayfalamayı sıfırla
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      setCurrentPage(1);
      setSurgCurrentPage(1);
      setHoursCurrentPage(1);
      setChartBranchFilter(selectedBranch);
      setSurgBranchFilter(selectedBranch);
      setDistBranchFilter(selectedBranch);
      setActionDaysBranchFilter(selectedBranch);
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

  const { stats, fullChartData, fullSurgeryChartData, fullSurgHoursChartData, eligibleSurgicalBranches, distributionChartData, actionDaysChartData, branchActionChangeData, doctorActionChangeData } = useMemo(() => {
    if (!isPeriodSelected) return { stats: { totalCapacityCount: 0, totalExamsCount: 0, totalMhrsExamsCount: 0, totalSurgeryDays: 0, totalAbcSurgeriesCount: 0, totalScheduledSurgeryHours: 0, hasSchedule: false, hasMuayene: false, hasAmeliyat: false, rowCount: 0 }, fullChartData: [], fullSurgeryChartData: [], fullSurgHoursChartData: [], eligibleSurgicalBranches: [], distributionChartData: [], actionDaysChartData: [], branchActionChangeData: [] as any[], doctorActionChangeData: [] as any[] };
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

    // Hastane geneli aksiyon gün dağılımı (AM/PM yarım gün esaslı)
    const getTimeMinsLocal = (t: string) => { const p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
    const getOverlapLocal = (s1: number, e1: number, s2: number, e2: number) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    const calcActionDayTotals = (schedules: DetailedScheduleData[]): Record<string, number> => {
      const daily: Record<string, { AM: Record<string, { mins: number, firstStart: number }>, PM: Record<string, { mins: number, firstStart: number }> }> = {};
      schedules.forEach(item => {
        const act = item.action.trim().toLocaleUpperCase('tr-TR');
        if (EXCLUDED_SCHEDULE_ACTION_LABELS.includes(act)) return;
        if (EXCLUDED_DAY_COUNT_ACTIONS.some(ex => act.includes(ex))) return;
        const key = `${item.doctorName}|${item.startDate}`;
        const rowStart = getTimeMinsLocal(item.startTime);
        const rowEnd = rowStart + (item.duration || 0);
        if (!daily[key]) daily[key] = { AM: {}, PM: {} };
        const amOv = getOverlapLocal(rowStart, rowEnd, 8 * 60, 12 * 60);
        if (amOv > 0) {
          if (!daily[key].AM[act]) daily[key].AM[act] = { mins: 0, firstStart: Infinity };
          daily[key].AM[act].mins += amOv;
          daily[key].AM[act].firstStart = Math.min(daily[key].AM[act].firstStart, rowStart);
        }
        const pmOv = getOverlapLocal(rowStart, rowEnd, 13 * 60, 17 * 60);
        if (pmOv > 0) {
          if (!daily[key].PM[act]) daily[key].PM[act] = { mins: 0, firstStart: Infinity };
          daily[key].PM[act].mins += pmOv;
          daily[key].PM[act].firstStart = Math.min(daily[key].PM[act].firstStart, rowStart);
        }
      });
      const totals: Record<string, number> = {};
      Object.values(daily).forEach(sessions => {
        let amWinner = ""; let amMax = -1; let amEarliest = Infinity;
        Object.entries(sessions.AM).forEach(([act, s]) => {
          if (s.mins >= 30) {
            if (s.mins > amMax) { amMax = s.mins; amWinner = act; amEarliest = s.firstStart; }
            else if (s.mins === amMax && s.firstStart < amEarliest) { amWinner = act; amEarliest = s.firstStart; }
          }
        });
        let pmWinner = ""; let pmMax = -1; let pmEarliest = Infinity;
        Object.entries(sessions.PM).forEach(([act, s]) => {
          if (s.mins >= 30) {
            if (s.mins > pmMax) { pmMax = s.mins; pmWinner = act; pmEarliest = s.firstStart; }
            else if (s.mins === pmMax && s.firstStart < pmEarliest) { pmWinner = act; pmEarliest = s.firstStart; }
          }
        });
        if (amWinner) totals[amWinner] = (totals[amWinner] || 0) + 0.5;
        if (pmWinner) totals[pmWinner] = (totals[pmWinner] || 0) + 0.5;
      });
      return totals;
    };
    const adFilteredSchedules = actionDaysBranchFilter === 'ALL' ? periodSchedules : periodSchedules.filter(s => s.specialty === actionDaysBranchFilter);
    const actionDayTotals = calcActionDayTotals(adFilteredSchedules);

    // Bir önceki ayın verilerini hesapla (karşılaştırma için)
    const monthIdx = MONTHS.indexOf(selectedMonth);
    const prevMonthName = monthIdx > 0 ? MONTHS[monthIdx - 1] : MONTHS[11];
    const prevYear = monthIdx > 0 ? Number(selectedYear) : Number(selectedYear) - 1;
    const prevPeriodSchedules = detailedScheduleData.filter(d => d.month === prevMonthName && d.year === prevYear);
    const prevAdFiltered = actionDaysBranchFilter === 'ALL' ? prevPeriodSchedules : prevPeriodSchedules.filter(s => s.specialty === actionDaysBranchFilter);
    const prevActionDayTotals = prevAdFiltered.length > 0 ? calcActionDayTotals(prevAdFiltered) : null;

    const allActions = new Set([...Object.keys(actionDayTotals), ...(prevActionDayTotals ? Object.keys(prevActionDayTotals) : [])]);
    const SIGNIFICANT_CHANGE_THRESHOLD = 0.25; // %25 değişim = önemli
    const actionDaysChartData = Array.from(allActions)
      .filter(action => actionDayTotals[action] > 0)
      .map(action => {
        const days = actionDayTotals[action] || 0;
        const prevDays = prevActionDayTotals ? (prevActionDayTotals[action] || 0) : null;
        const delta = prevDays !== null ? days - prevDays : null;
        const deltaPct = prevDays !== null && prevDays > 0 ? (days - prevDays) / prevDays : (prevDays !== null && prevDays === 0 && days > 0 ? 1 : null);
        const isSignificant = deltaPct !== null && Math.abs(deltaPct) >= SIGNIFICANT_CHANGE_THRESHOLD && Math.abs(delta!) >= 3;
        return { action, days, prevDays, delta, deltaPct, isSignificant, color: getActionColor(action) };
      })
      .sort((a, b) => b.days - a.days);

    // === BRANŞ BAZLI AKSİYON DEĞİŞİM TABLOSU ===
    const branchGroupedCurrent: Record<string, DetailedScheduleData[]> = {};
    const adSchedulesForBranch = actionDaysBranchFilter === 'ALL' ? periodSchedules : periodSchedules.filter(s => s.specialty === actionDaysBranchFilter);
    adSchedulesForBranch.forEach(s => {
      const br = s.specialty || 'Bilinmiyor';
      if (!branchGroupedCurrent[br]) branchGroupedCurrent[br] = [];
      branchGroupedCurrent[br].push(s);
    });
    const branchGroupedPrev: Record<string, DetailedScheduleData[]> = {};
    const prevAdSchedulesForBranch = actionDaysBranchFilter === 'ALL' ? prevPeriodSchedules : prevPeriodSchedules.filter(s => s.specialty === actionDaysBranchFilter);
    prevAdSchedulesForBranch.forEach(s => {
      const br = s.specialty || 'Bilinmiyor';
      if (!branchGroupedPrev[br]) branchGroupedPrev[br] = [];
      branchGroupedPrev[br].push(s);
    });
    const allBranchNames = new Set([...Object.keys(branchGroupedCurrent), ...Object.keys(branchGroupedPrev)]);
    const branchActionChangeData = Array.from(allBranchNames).sort((a, b) => a.localeCompare(b, 'tr-TR')).map(branch => {
      const curTotals = branchGroupedCurrent[branch] ? calcActionDayTotals(branchGroupedCurrent[branch]) : {};
      const prevTotals = branchGroupedPrev[branch] ? calcActionDayTotals(branchGroupedPrev[branch]) : {};
      const allActs = new Set([...Object.keys(curTotals), ...Object.keys(prevTotals)]);
      const actions: Record<string, { current: number; prev: number; delta: number }> = {};
      let totalCurrent = 0, totalPrev = 0;
      allActs.forEach(act => {
        const cur = curTotals[act] || 0;
        const prev = prevTotals[act] || 0;
        actions[act] = { current: cur, prev: prev, delta: cur - prev };
        totalCurrent += cur;
        totalPrev += prev;
      });
      return { branch, actions, totalCurrent, totalPrev, totalDelta: totalCurrent - totalPrev };
    }).filter(row => row.totalCurrent > 0 || row.totalPrev > 0);

    // === HEKİM BAZLI AKSİYON DEĞİŞİM TABLOSU ===
    const doctorGroupedCurrent: Record<string, { schedules: DetailedScheduleData[], branch: string }> = {};
    adSchedulesForBranch.forEach(s => {
      const normDoc = normalizeDoctorName(s.doctorName);
      if (!doctorGroupedCurrent[normDoc]) doctorGroupedCurrent[normDoc] = { schedules: [], branch: s.specialty };
      doctorGroupedCurrent[normDoc].schedules.push(s);
    });
    const doctorGroupedPrev: Record<string, { schedules: DetailedScheduleData[], branch: string }> = {};
    prevAdSchedulesForBranch.forEach(s => {
      const normDoc = normalizeDoctorName(s.doctorName);
      if (!doctorGroupedPrev[normDoc]) doctorGroupedPrev[normDoc] = { schedules: [], branch: s.specialty };
      doctorGroupedPrev[normDoc].schedules.push(s);
    });
    const allDoctorNorms = new Set([...Object.keys(doctorGroupedCurrent), ...Object.keys(doctorGroupedPrev)]);
    const doctorActionChangeData = Array.from(allDoctorNorms).map(normDoc => {
      const curData = doctorGroupedCurrent[normDoc];
      const prevData = doctorGroupedPrev[normDoc];
      const docName = curData?.schedules[0]?.doctorName || prevData?.schedules[0]?.doctorName || normDoc;
      const branch = curData?.branch || prevData?.branch || 'Bilinmiyor';
      const curTotals = curData ? calcActionDayTotals(curData.schedules) : {};
      const prevTotals = prevData ? calcActionDayTotals(prevData.schedules) : {};
      const allActs = new Set([...Object.keys(curTotals), ...Object.keys(prevTotals)]);
      const actions: Record<string, { current: number; prev: number; delta: number }> = {};
      let totalCurrent = 0, totalPrev = 0;
      allActs.forEach(act => {
        const cur = curTotals[act] || 0;
        const prev = prevTotals[act] || 0;
        actions[act] = { current: cur, prev: prev, delta: cur - prev };
        totalCurrent += cur;
        totalPrev += prev;
      });
      return { doctorName: docName, branch, actions, totalCurrent, totalPrev, totalDelta: totalCurrent - totalPrev };
    }).filter(row => row.totalCurrent > 0 || row.totalPrev > 0).sort((a, b) => a.branch.localeCompare(b.branch, 'tr-TR') || a.doctorName.localeCompare(b.doctorName, 'tr-TR'));

    return { stats: { totalCapacityCount, totalExamsCount, totalMhrsExamsCount, totalSurgeryDays, totalAbcSurgeriesCount, totalScheduledSurgeryHours, hasSchedule: periodSchedules.length > 0, hasMuayene: !!muayeneMetaByPeriod[periodKey], hasAmeliyat: !!ameliyatMetaByPeriod[periodKey], rowCount: kpiSchedules.length }, fullChartData: [...underGroup, ...noCapGroup, ...overGroup], fullSurgeryChartData: surgeryList.filter(item => surgBranchFilter === 'ALL' || item.branchName === surgBranchFilter).sort((a, b) => b.efficiencyVal - a.efficiencyVal), fullSurgHoursChartData: surgHoursList.filter(item => hoursBranchFilter === 'ALL' || item.branchName === hoursBranchFilter).sort((a, b) => b.avgHoursPerCase - a.avgHoursPerCase), eligibleSurgicalBranches, distributionChartData, actionDaysChartData, branchActionChangeData, doctorActionChangeData };
  }, [detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, muayeneMetaByPeriod, ameliyatMetaByPeriod, selectedMonth, selectedYear, periodKey, isPeriodSelected, selectedBranch, chartBranchFilter, surgBranchFilter, hoursBranchFilter, distBranchFilter, actionDaysBranchFilter]);

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

  // === AKSİYON GÜN DAĞILIMI PPTX EXPORT ===
  const handleExportActionDaysPptx = async () => {
    if (!isPeriodSelected || actionDaysChartData.length === 0) return;
    setIsExportingPptx(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = 'Aksiyon Gün Dağılımı Raporu';
      pptx.author = 'MEDIS';
      pptx.company = 'Şanlıurfa İl Sağlık Müdürlüğü';

      const c = {
        bg: 'f8fafc', primary: '4f46e5', primaryLight: 'eef2ff',
        text: '1e293b', textMuted: '94a3b8', success: '10b981',
        danger: 'ef4444', border: 'e2e8f0', white: 'ffffff',
        dark: '0f172a', headerBg: '1e293b', amber: 'd97706',
      };

      const monthIdx = MONTHS.indexOf(selectedMonth);
      const prevMonthName = monthIdx > 0 ? MONTHS[monthIdx - 1] : MONTHS[11];
      const prevYear = monthIdx > 0 ? Number(selectedYear) : Number(selectedYear) - 1;
      const hasPrevData = branchActionChangeData.some(r => r.totalPrev > 0);

      const formatDay = (v: number): string => v === 0 ? '-' : (v % 1 === 0 ? String(v) : v.toFixed(1)).replace('.', ',');
      const formatDelta = (v: number): string => v === 0 ? '' : `(${v > 0 ? '+' : ''}${formatDay(v)})`;

      const hOpts = (align: 'left' | 'center' = 'center'): pptxgen.TextPropsOptions => ({
        bold: true as const, fontSize: 11, color: c.white,
        fill: { color: c.headerBg }, align, fontFace: 'Arial',
      });

      // Hücre içinde değer + delta'yı farklı renkte gösteren TextProps dizisi üret
      const cellWithDelta = (cur: number, delta: number, rowBg: string, isBold = false): pptxgen.TableCell => {
        if (cur === 0 && delta === 0) return { text: '-', options: { fontSize: 11, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } };
        const deltaColor = delta > 0 ? c.success : delta < 0 ? c.danger : c.textMuted;
        if (delta === 0) return { text: formatDay(cur), options: { fontSize: 11, bold: isBold, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: isBold ? c.primary : c.text } };
        return {
          text: [
            { text: formatDay(cur), options: { fontSize: 11, bold: isBold, fontFace: 'Arial', color: isBold ? c.primary : c.text } },
            { text: ` ${formatDelta(delta)}`, options: { fontSize: 11, bold: true, fontFace: 'Arial', color: deltaColor } },
          ],
          options: { align: 'center' as const, fill: { color: rowBg }, valign: 'middle' },
        };
      };

      // ── SLAYT 1: KAPAK ──
      const s1 = pptx.addSlide();
      s1.background = { color: c.dark };
      s1.addShape((pptx as any).shapes.RECTANGLE, { x: 8, y: 0, w: 5.33, h: 0.15, fill: { color: c.primary } });
      s1.addShape((pptx as any).shapes.RECTANGLE, { x: 1, y: 3.6, w: 4, h: 0.06, fill: { color: c.primary } });
      s1.addText('MHRS', { x: 1, y: 1.2, w: 11, h: 0.6, fontSize: 16, fontFace: 'Arial', bold: true, color: c.primary });
      s1.addText('AKSİYON GÜN DAĞILIMI', { x: 1, y: 1.9, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });
      s1.addText('RAPORU', { x: 1, y: 2.7, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });
      s1.addText(selectedHospital, { x: 1, y: 3.9, w: 11, h: 0.5, fontSize: 18, fontFace: 'Arial', color: c.textMuted });
      s1.addText(`${selectedMonth} ${selectedYear}`, { x: 1, y: 4.4, w: 11, h: 0.4, fontSize: 14, fontFace: 'Arial', color: '64748b' });
      if (actionDaysBranchFilter !== 'ALL') {
        s1.addText(`Branş: ${actionDaysBranchFilter}`, { x: 1, y: 4.9, w: 11, h: 0.4, fontSize: 12, fontFace: 'Arial', color: c.primary });
      }

      // ── SLAYT 2: AKSİYON GÜN DAĞILIMI ÖZET TABLOSU ──
      if (actionDaysChartData.length > 0) {
        const s2 = pptx.addSlide();
        s2.background = { color: c.bg };
        s2.addText('AKSİYON GÜN DAĞILIMI', { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 18, fontFace: 'Arial', bold: true, color: c.text });
        s2.addShape((pptx as any).shapes.RECTANGLE, { x: 0.5, y: 0.65, w: 2, h: 0.04, fill: { color: c.primary } });
        s2.addText(`${selectedHospital} • ${selectedMonth} ${selectedYear}${actionDaysBranchFilter !== 'ALL' ? ` • ${actionDaysBranchFilter}` : ''}`, { x: 4, y: 0.2, w: 8.8, h: 0.45, fontSize: 11, fontFace: 'Arial', color: c.textMuted, align: 'right' });
        if (hasPrevData) s2.addText(`Karşılaştırma: ${prevMonthName} ${prevYear} → ${selectedMonth} ${selectedYear}`, { x: 0.5, y: 0.6, w: 8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: c.amber });

        const adHeader: pptxgen.TableRow = [
          { text: 'AKSİYON', options: hOpts('left') },
          { text: 'BU AY (GÜN)', options: hOpts() },
          ...(hasPrevData ? [
            { text: 'ÖNCEKİ AY (GÜN)', options: hOpts() },
            { text: 'DEĞİŞİM', options: hOpts() },
            { text: 'DEĞİŞİM %', options: hOpts() },
          ] : []),
        ];

        const adRows: pptxgen.TableRow[] = actionDaysChartData.map((item, idx) => {
          const rowBg = idx % 2 === 0 ? 'f1f5f9' : c.white;
          const deltaColor = (item.delta || 0) > 0 ? c.success : (item.delta || 0) < 0 ? c.danger : c.text;
          return [
            { text: item.action, options: { fontSize: 11, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: formatDay(item.days), options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.primary } },
            ...(hasPrevData ? [
              { text: item.prevDays !== null ? formatDay(item.prevDays) : '-', options: { fontSize: 11, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
              { text: item.delta !== null ? formatDelta(item.delta) : '-', options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: deltaColor } },
              { text: item.deltaPct !== null ? `${item.deltaPct > 0 ? '+' : ''}${(item.deltaPct * 100).toFixed(0)}%` : '-', options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: deltaColor } },
            ] : []),
          ];
        });

        // Toplam satırı
        const totalCur = actionDaysChartData.map(d => d.days).reduce((a, b) => a + b, 0);
        const totalPrev = hasPrevData ? actionDaysChartData.map(d => d.prevDays || 0).reduce((a, b) => a + b, 0) : 0;
        const totalDeltaVal = totalCur - totalPrev;
        const totalDeltaColor = totalDeltaVal > 0 ? c.success : totalDeltaVal < 0 ? c.danger : c.text;
        const totalRow: pptxgen.TableRow = [
          { text: 'TOPLAM', options: { fontSize: 11, bold: true, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: c.primary } },
          { text: formatDay(totalCur), options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: c.primary } },
          ...(hasPrevData ? [
            { text: formatDay(totalPrev), options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: c.textMuted } },
            { text: formatDelta(totalDeltaVal), options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: totalDeltaColor } },
            { text: totalPrev > 0 ? `${totalDeltaVal > 0 ? '+' : ''}${((totalDeltaVal / totalPrev) * 100).toFixed(0)}%` : '-', options: { fontSize: 11, bold: true, align: 'center' as const, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: totalDeltaColor } },
          ] : []),
        ];
        adRows.push(totalRow);

        const adColW = hasPrevData ? [4.5, 2.0, 2.0, 2.0, 2.23] : [7.0, 5.73];
        const adTableY = hasPrevData ? 0.95 : 0.8;
        const adAvailH = 7.5 - adTableY - 0.15;
        const adRowH = 0.35;
        const adPerPage = Math.floor((adAvailH - adRowH) / adRowH); // header hariç satır sayısı

        if (adRows.length <= adPerPage) {
          s2.addTable([adHeader, ...adRows], {
            x: 0.3, y: adTableY, w: 12.73, colW: adColW,
            border: { type: 'solid', pt: 0.5, color: c.border }, rowH: adRowH,
          });
        } else {
          // Sayfalama: özet tablosu bile taşabilir
          const adPageCount = Math.ceil(adRows.length / adPerPage);
          // İlk sayfa zaten eklendi (s2), geri kalanlar için yeni slayt ekle
          for (let ap = 0; ap < adPageCount; ap++) {
            const slide = ap === 0 ? s2 : pptx.addSlide();
            if (ap > 0) {
              slide.background = { color: c.bg };
              slide.addText('AKSİYON GÜN DAĞILIMI', { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 18, fontFace: 'Arial', bold: true, color: c.text });
              slide.addShape((pptx as any).shapes.RECTANGLE, { x: 0.5, y: 0.65, w: 2, h: 0.04, fill: { color: c.primary } });
              slide.addText(`Sayfa ${ap + 1}/${adPageCount}`, { x: 10, y: 0.2, w: 2.8, h: 0.45, fontSize: 11, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });
            }
            const sliceRows = adRows.slice(ap * adPerPage, (ap + 1) * adPerPage);
            slide.addTable([adHeader, ...sliceRows], {
              x: 0.3, y: ap === 0 ? adTableY : 0.8, w: 12.73, colW: adColW,
              border: { type: 'solid', pt: 0.5, color: c.border }, rowH: adRowH,
            });
          }
        }
      }

      // ── SLAYT 3: BRANŞ BAZLI GENEL TABLO ──
      if (branchActionChangeData.length > 0) {
        const allBranchActs = Array.from(new Set(branchActionChangeData.flatMap(r => Object.keys(r.actions)))).sort((a, b) => {
          const ta = branchActionChangeData.map(r => r.actions[a]?.current || 0).reduce((x, y) => x + y, 0);
          const tb = branchActionChangeData.map(r => r.actions[b]?.current || 0).reduce((x, y) => x + y, 0);
          return tb - ta;
        });

        // Aksiyon sütun sayısını delta gösterimle uyumlu şekilde sınırla
        const maxActCols = hasPrevData ? 6 : 8;
        const visibleActs = allBranchActs.slice(0, maxActCols);
        const tableStartY = hasPrevData ? 0.95 : 0.8;
        const availableH = 7.5 - tableStartY - 0.15; // slayt yüksekliği - üst - alt boşluk
        const rowH = 0.35;
        const perPage = Math.floor((availableH - rowH) / rowH); // header dahil
        const pageCount = Math.ceil(branchActionChangeData.length / perPage);

        for (let page = 0; page < pageCount; page++) {
          const sB = pptx.addSlide();
          sB.background = { color: c.bg };
          sB.addText('BRANŞ BAZLI AKSİYON DEĞİŞİM TABLOSU', { x: 0.5, y: 0.15, w: 9, h: 0.4, fontSize: 16, fontFace: 'Arial', bold: true, color: c.text });
          sB.addShape((pptx as any).shapes.RECTANGLE, { x: 0.5, y: 0.55, w: 2, h: 0.04, fill: { color: c.primary } });
          if (hasPrevData) sB.addText(`Karşılaştırma: ${prevMonthName} ${prevYear} → ${selectedMonth} ${selectedYear}`, { x: 0.5, y: 0.6, w: 8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: c.amber });
          if (pageCount > 1) sB.addText(`Sayfa ${page + 1}/${pageCount}`, { x: 10, y: 0.15, w: 2.8, h: 0.4, fontSize: 11, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });

          const headerRow: pptxgen.TableRow = [
            { text: 'BRANŞ', options: hOpts('left') },
            ...visibleActs.map(act => ({ text: act.length > 12 ? act.substring(0, 10) + '…' : act, options: hOpts() })),
            { text: 'TOPLAM', options: hOpts() },
          ];

          const brSlice = branchActionChangeData.slice(page * perPage, (page + 1) * perPage);
          const dataRows: pptxgen.TableRow[] = brSlice.map((row, idx) => {
            const rowBg = idx % 2 === 0 ? 'f1f5f9' : c.white;
            return [
              { text: row.branch, options: { fontSize: 11, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
              ...visibleActs.map(act => {
                const cell = row.actions[act];
                const cur = cell?.current || 0;
                const delta = hasPrevData ? (cell?.delta || 0) : 0;
                return cellWithDelta(cur, delta, rowBg);
              }),
              cellWithDelta(row.totalCurrent, hasPrevData ? row.totalDelta : 0, rowBg, true),
            ];
          });

          const brColW = 2.6;
          const totColW = 1.5;
          const actColW = (12.73 - brColW - totColW) / visibleActs.length;
          sB.addTable([headerRow, ...dataRows], {
            x: 0.3, y: tableStartY, w: 12.73,
            colW: [brColW, ...visibleActs.map(() => actColW), totColW],
            border: { type: 'solid', pt: 0.5, color: c.border },
            rowH,
          });
        }
      }

      // ── SLAYT 4+: HER BRANŞ İÇİN AYRI SAYFA ──
      if (branchActionChangeData.length > 0) {
        branchActionChangeData.forEach(branchRow => {
          const branchDoctors = doctorActionChangeData.filter(d => d.branch === branchRow.branch);
          if (branchDoctors.length === 0) return;

          const branchActionsSet = new Set<string>();
          (Object.entries(branchRow.actions) as [string, { current: number; prev: number; delta: number }][]).forEach(([act, v]) => { if (v.current > 0 || v.prev > 0) branchActionsSet.add(act); });
          branchDoctors.forEach(doc => {
            (Object.entries(doc.actions) as [string, { current: number; prev: number; delta: number }][]).forEach(([act, v]) => { if (v.current > 0 || v.prev > 0) branchActionsSet.add(act); });
          });
          const branchActs = Array.from(branchActionsSet).sort((a, b) => {
            const ta = branchDoctors.map(r => r.actions[a]?.current || 0).reduce((x, y) => x + y, 0);
            const tb = branchDoctors.map(r => r.actions[b]?.current || 0).reduce((x, y) => x + y, 0);
            return tb - ta;
          });

          const maxActCols = hasPrevData ? 6 : 8;
          const visActs = branchActs.slice(0, maxActCols);
          const tableStartY = hasPrevData ? 0.95 : 0.8;
          const availableH = 7.5 - tableStartY - 0.15;
          const rowH = 0.35;
          // Son sayfada +1 özet satırı olacağı için hesapla
          const perPage = Math.floor((availableH - rowH) / rowH) - 1; // header + 1 özet satırı pay
          const pageCount = Math.ceil(branchDoctors.length / perPage);

          for (let page = 0; page < pageCount; page++) {
            const sD = pptx.addSlide();
            sD.background = { color: c.bg };
            sD.addText(branchRow.branch.toLocaleUpperCase('tr-TR'), { x: 0.5, y: 0.15, w: 9, h: 0.4, fontSize: 16, fontFace: 'Arial', bold: true, color: c.text });
            sD.addShape((pptx as any).shapes.RECTANGLE, { x: 0.5, y: 0.55, w: 2, h: 0.04, fill: { color: c.primary } });
            if (hasPrevData) sD.addText(`Karşılaştırma: ${prevMonthName} ${prevYear} → ${selectedMonth} ${selectedYear}`, { x: 0.5, y: 0.6, w: 8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: c.amber });
            sD.addText(`Hekim Sayısı: ${branchDoctors.length}`, { x: 9, y: 0.15, w: 3.8, h: 0.25, fontSize: 11, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });
            if (pageCount > 1) sD.addText(`Sayfa ${page + 1}/${pageCount}`, { x: 10, y: 0.4, w: 2.8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: c.textMuted, align: 'right' });

            const headerRow: pptxgen.TableRow = [
              { text: 'HEKİM', options: hOpts('left') },
              ...visActs.map(act => ({ text: act.length > 12 ? act.substring(0, 10) + '…' : act, options: hOpts() })),
              { text: 'TOPLAM', options: hOpts() },
            ];

            const docSlice = branchDoctors.slice(page * perPage, (page + 1) * perPage);
            const dataRows: pptxgen.TableRow[] = docSlice.map((doc, idx) => {
              const rowBg = idx % 2 === 0 ? 'f1f5f9' : c.white;
              return [
                { text: doc.doctorName, options: { fontSize: 11, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
                ...visActs.map(act => {
                  const cell = doc.actions[act];
                  const cur = cell?.current || 0;
                  const delta = hasPrevData ? (cell?.delta || 0) : 0;
                  return cellWithDelta(cur, delta, rowBg);
                }),
                cellWithDelta(doc.totalCurrent, hasPrevData ? doc.totalDelta : 0, rowBg, true),
              ];
            });

            // Branş özet satırı (son sayfanın sonuna ekle)
            if (page === pageCount - 1) {
              const summaryRow: pptxgen.TableRow = [
                { text: 'BRANŞ TOPLAMI', options: { fontSize: 11, bold: true, fill: { color: 'e0e7ff' }, fontFace: 'Arial', color: c.primary } },
                ...visActs.map(act => {
                  const total = branchDoctors.reduce((s, d) => s + (d.actions[act]?.current || 0), 0);
                  const totalDelta = hasPrevData ? branchDoctors.reduce((s, d) => s + (d.actions[act]?.delta || 0), 0) : 0;
                  return cellWithDelta(total, totalDelta, 'e0e7ff', true);
                }),
                cellWithDelta(branchRow.totalCurrent, hasPrevData ? branchRow.totalDelta : 0, 'e0e7ff', true),
              ];
              dataRows.push(summaryRow);
            }

            const docColW = 2.6;
            const totColW2 = 1.5;
            const actColW2 = (12.73 - docColW - totColW2) / visActs.length;
            sD.addTable([headerRow, ...dataRows], {
              x: 0.3, y: tableStartY, w: 12.73,
              colW: [docColW, ...visActs.map(() => actColW2), totColW2],
              border: { type: 'solid', pt: 0.5, color: c.border },
              rowH,
            });
          }
        });
      }

      const safeHospital = selectedHospital.replace(/[^a-zA-Z0-9]/g, '_');
      const safeMonth = selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
      const safeBranch = actionDaysBranchFilter !== 'ALL' ? `_${actionDaysBranchFilter.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      await pptx.writeFile({ fileName: `Aksiyon_Gun_Dagilimi_${safeHospital}_${safeMonth}_${selectedYear}${safeBranch}.pptx` });
    } catch (err) {
      console.error('PPTX export hatası:', err);
      alert('Sunum oluşturulurken hata oluştu');
    } finally {
      setIsExportingPptx(false);
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

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div><h3 className="text-xl font-black text-[var(--text-1)] uppercase">AKSİYON GÜN DAĞILIMI</h3><p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Hastane genelinde aksiyonların toplam gün sayısı (AM/PM yarım gün esaslı)</p></div>
          {isPeriodSelected && (
            <div className="flex flex-wrap items-center gap-3 bg-[var(--surface-2)] p-2 rounded-2xl border border-[var(--border-1)]">
              <div className="flex items-center gap-2 px-3"><span className="text-[9px] font-black text-[var(--text-muted)] uppercase">BRANŞ:</span><select value={actionDaysBranchFilter} onChange={(e) => setActionDaysBranchFilter(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-1)] rounded-xl px-3 py-1.5 text-[10px] font-black outline-none min-w-[140px]"><option value="ALL">Tüm Hastane</option>{availableBranches.map((br:string) => <option key={br} value={br}>{br}</option>)}</select></div>
              <div className="border-l border-[var(--border-2)] pl-3">
                <button onClick={handleExportActionDaysPptx} disabled={isExportingPptx || actionDaysChartData.length === 0} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 shadow-sm">
                  {isExportingPptx ? (
                    <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>OLUŞTURULUYOR...</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>PPTX İNDİR</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        {!isPeriodSelected ? <EmptyState /> : actionDaysChartData.length === 0 ? <NoResults text="Seçili filtrelere uygun aksiyon bulunamadı." /> : <>
          <ActionDaysChart data={actionDaysChartData} hasPrevData={actionDaysChartData.some(d => d.prevDays !== null)} />
          {branchActionChangeData.length > 0 && (() => {
            const allBranchActions = Array.from(new Set(branchActionChangeData.flatMap(r => Object.keys(r.actions)))).sort((a, b) => {
              const totalA = branchActionChangeData.map(r => r.actions[a]?.current || 0).reduce((x, y) => x + y, 0);
              const totalB = branchActionChangeData.map(r => r.actions[b]?.current || 0).reduce((x, y) => x + y, 0);
              return totalB - totalA;
            });
            const hasPrev = branchActionChangeData.some(r => r.totalPrev > 0);
            return <ActionChangeTable title="BRANŞ BAZLI AKSİYON DEĞİŞİM TABLOSU" subtitle={`Branş bazında aksiyon gün dağılımı${hasPrev ? ' ve bir önceki ayla karşılaştırma' : ''}`} rows={branchActionChangeData} labelKey="branch" hasPrevData={hasPrev} allActions={allBranchActions} />;
          })()}
          {doctorActionChangeData.length > 0 && (() => {
            const allDoctorActions = Array.from(new Set(doctorActionChangeData.flatMap(r => Object.keys(r.actions)))).sort((a, b) => {
              const totalA = doctorActionChangeData.map(r => r.actions[a]?.current || 0).reduce((x, y) => x + y, 0);
              const totalB = doctorActionChangeData.map(r => r.actions[b]?.current || 0).reduce((x, y) => x + y, 0);
              return totalB - totalA;
            });
            const hasPrev = doctorActionChangeData.some(r => r.totalPrev > 0);
            return <ActionChangeTable title="HEKİM BAZLI AKSİYON DEĞİŞİM TABLOSU" subtitle={`Hekim bazında aksiyon gün dağılımı${hasPrev ? ' ve bir önceki ayla karşılaştırma' : ''}`} rows={doctorActionChangeData} labelKey="doctorName" hasPrevData={hasPrev} allActions={allDoctorActions} />;
          })()}
        </>}
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

export const CapacityUsageChart = ({ data, onClick }: any) => {
  const count = data.length;
  // Cerrahi Verimlilik ile aynı: barSize=25, barGap=8 (≤12 hekim)
  // Hekim arttıkça container'a sığması için dinamik küçült
  const barSize = count <= 12 ? 25 : count <= 25 ? 18 : count <= 40 ? 12 : count <= 60 ? 8 : 5;
  const barGap = count <= 12 ? 8 : count <= 25 ? 6 : count <= 40 ? 4 : 2;

  return (
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
    <div className="h-[90%]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }} barGap={barGap} barCategoryGap="20%">
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
          <Bar name="Randevu Kapasitesi" dataKey="capacity" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={barSize} onClick={(d) => onClick?.(d)} className="cursor-pointer" />
          <Bar name="Toplam Muayene" dataKey="totalExam" radius={[4, 4, 0, 0]} barSize={barSize} onClick={(d) => onClick?.(d)} className="cursor-pointer">
            {data.map((e: any, cellIdx: number) => <Cell key={`cell-${cellIdx}`} fill={e.status==='UNDER'?'#ef4444':e.status==='NO_CAP'?'#64748b':'#10b981'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
  );
};

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

export const ActionDaysChart = ({ data, hasPrevData }: { data: { action: string; days: number; prevDays: number | null; delta: number | null; deltaPct: number | null; isSignificant: boolean; color: string }[]; hasPrevData: boolean }) => {
  const count = data.length;
  const barSize = count <= 8 ? 40 : count <= 14 ? 28 : count <= 20 ? 20 : 14;

  const CustomBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const isSignificant = payload?.isSignificant;
    const days = payload?.days;
    const label = days !== undefined ? String(days % 1 === 0 ? days : days.toFixed(1)).replace('.', ',') : '';
    return (
      <g>
        {isSignificant && (
          <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="#ef4444">
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2s" repeatCount="indefinite" />
          </rect>
        )}
        <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={payload?.color || '#6366f1'} />
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={800}>{label}</text>
      </g>
    );
  };

  return (
    <div className="bg-[var(--surface-2)] p-8 rounded-[20px] border border-[var(--border-1)] h-[550px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-wide">Aksiyon Gün Dağılımı</h3>
        <div className="flex items-center gap-4">
          {hasPrevData && <>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500 action-days-pulse-legend"></div><span className="text-[9px] font-black text-[var(--text-muted)] uppercase whitespace-nowrap">Önemli Değişim</span></div>
          </>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }} barGap={8}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="action" interval={0} tick={<CustomizedXAxisTick />} axisLine={false} tickLine={false} height={100} />
          <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
          <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const d = payload[0].payload;
              const metrics: any[] = [{ label: 'Bu Ay', val: `${formatMetric(d.days)} gün`, color: 'text-indigo-400' }];
              if (d.prevDays !== null) metrics.push({ label: 'Önceki Ay', val: `${formatMetric(d.prevDays)} gün`, color: 'text-slate-400' });
              return <TooltipCard name={d.action} branch="" metrics={metrics}
                footerLabel={d.delta !== null ? "Değişim" : "Toplam"}
                footer={d.delta !== null ? `${d.delta > 0 ? '+' : ''}${formatMetric(d.delta)} gün (${d.deltaPct !== null ? `${d.deltaPct > 0 ? '+' : ''}${(d.deltaPct * 100).toFixed(0)}%` : '—'})` : `${formatMetric(d.days)} gün`}
                footerColor={d.delta !== null ? (d.delta > 0 ? 'text-emerald-400' : d.delta < 0 ? 'text-rose-400' : 'text-slate-400') : 'text-indigo-400'} />;
            }
            return null;
          }} />
          <Bar dataKey="days" barSize={barSize} shape={<CustomBar />} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

type ActionChangeRow = { actions: Record<string, { current: number; prev: number; delta: number }>; totalCurrent: number; totalPrev: number; totalDelta: number };
const fmtDay = (v: number): string => v === 0 ? '-' : (v % 1 === 0 ? String(v) : v.toFixed(1)).replace('.', ',');
const fmtDelta = (v: number): string => v === 0 ? '-' : `${v > 0 ? '+' : ''}${fmtDay(v)}`;

const ActionChangeTable = ({ title, subtitle, rows, labelKey, hasPrevData, allActions }: {
  title: string; subtitle: string;
  rows: (ActionChangeRow & { [key: string]: any })[];
  labelKey: string; hasPrevData: boolean;
  allActions: string[];
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleRow = (idx: number) => setExpandedRows(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });

  if (rows.length === 0) return null;

  return (
    <div className="bg-[var(--surface-2)] p-6 rounded-[20px] border border-[var(--border-1)] mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-black text-[var(--text-1)] uppercase tracking-wide">{title}</h4>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {hasPrevData && <>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Artış</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Azalış</span></div>
          </>}
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-[var(--border-1)]">
              <th className="py-3 px-3 text-[9px] font-black text-[var(--text-2)] uppercase tracking-widest sticky left-0 bg-[var(--surface-2)] z-10 min-w-[160px]">
                {labelKey === 'branch' ? 'BRANŞ' : 'HEKİM'}
              </th>
              {labelKey === 'doctorName' && <th className="py-3 px-2 text-[9px] font-black text-[var(--text-2)] uppercase tracking-widest min-w-[120px]">BRANŞ</th>}
              {allActions.map(act => (
                <th key={act} className="py-3 px-2 text-[9px] font-black text-[var(--text-2)] uppercase tracking-widest text-center min-w-[80px]">
                  <span className="block truncate max-w-[80px]" title={act}>{act.length > 12 ? act.substring(0, 10) + '…' : act}</span>
                </th>
              ))}
              <th className="py-3 px-3 text-[9px] font-black text-[var(--text-2)] uppercase tracking-widest text-center min-w-[80px] bg-[var(--surface-2)]">TOPLAM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-1)]">
            {rows.map((row, idx) => {
              const isExpanded = expandedRows.has(idx);
              const label = row[labelKey] || '';
              return (
                <React.Fragment key={idx}>
                  <tr className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group" onClick={() => hasPrevData && toggleRow(idx)}>
                    <td className="py-2.5 px-3 sticky left-0 bg-[var(--surface-2)] group-hover:bg-[var(--surface-hover)] z-10">
                      <div className="flex items-center gap-2">
                        {hasPrevData && (
                          <svg className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                        )}
                        <span className="text-[10px] font-black text-[var(--text-1)] uppercase truncate" title={label}>{label}</span>
                      </div>
                    </td>
                    {labelKey === 'doctorName' && <td className="py-2.5 px-2 text-[9px] font-bold text-[var(--text-muted)] uppercase">{row.branch}</td>}
                    {allActions.map(act => {
                      const cell = row.actions[act];
                      const val = cell?.current || 0;
                      const delta = cell?.delta || 0;
                      return (
                        <td key={act} className="py-2.5 px-2 text-center">
                          <span className="text-[10px] font-black text-[var(--text-1)]">{fmtDay(val)}</span>
                          {hasPrevData && delta !== 0 && (
                            <span className={`block text-[8px] font-black ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtDelta(delta)}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center bg-[var(--surface-2)] group-hover:bg-[var(--surface-hover)]">
                      <span className="text-[10px] font-black text-indigo-400">{fmtDay(row.totalCurrent)}</span>
                      {hasPrevData && row.totalDelta !== 0 && (
                        <span className={`block text-[8px] font-black ${row.totalDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtDelta(row.totalDelta)}</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasPrevData && (
                    <tr className="bg-[var(--surface-1)]">
                      <td className="py-2 px-3 sticky left-0 bg-[var(--surface-1)] z-10">
                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase pl-5 italic">↳ Önceki Ay</span>
                      </td>
                      {labelKey === 'doctorName' && <td className="py-2 px-2"></td>}
                      {allActions.map(act => {
                        const cell = row.actions[act];
                        const prev = cell?.prev || 0;
                        return (
                          <td key={act} className="py-2 px-2 text-center">
                            <span className="text-[9px] font-bold text-[var(--text-muted)]">{fmtDay(prev)}</span>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center bg-[var(--surface-1)]">
                        <span className="text-[9px] font-bold text-[var(--text-muted)]">{fmtDay(row.totalPrev)}</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--border-1)] bg-[var(--surface-2)]">
                <td className="py-3 px-3 sticky left-0 bg-[var(--surface-2)] z-10 text-[10px] font-black text-[var(--text-1)] uppercase" colSpan={labelKey === 'doctorName' ? 2 : 1}>TOPLAM</td>
                {allActions.map(act => {
                  const total = rows.reduce((s, r) => s + (r.actions[act]?.current || 0), 0);
                  const totalDelta = rows.reduce((s, r) => s + (r.actions[act]?.delta || 0), 0);
                  return (
                    <td key={act} className="py-3 px-2 text-center">
                      <span className="text-[10px] font-black text-[var(--text-1)]">{fmtDay(total)}</span>
                      {hasPrevData && totalDelta !== 0 && (
                        <span className={`block text-[8px] font-black ${totalDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtDelta(totalDelta)}</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-center">
                  <span className="text-[10px] font-black text-indigo-400">{fmtDay(rows.reduce((s, r) => s + r.totalCurrent, 0))}</span>
                  {hasPrevData && (
                    <span className={`block text-[8px] font-black ${rows.reduce((s, r) => s + r.totalDelta, 0) > 0 ? 'text-emerald-400' : rows.reduce((s, r) => s + r.totalDelta, 0) < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>{fmtDelta(rows.reduce((s, r) => s + r.totalDelta, 0))}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

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
    const dailyMap: Record<string, {
      AM: Record<string, { mins: number, firstStart: number }>,
      PM: Record<string, { mins: number, firstStart: number }>
    }> = {};
    const getTimeMins = (t: string) => { const p = t.split(':'); return parseInt(p[0])*60 + parseInt(p[1]); };
    const getOverlap = (s1:number, e1:number, s2:number, e2:number) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    const MIN_SESSION_THRESHOLD = 30;

    docSchedules.forEach(s => {
      const start = getTimeMins(s.startTime);
      const end = start + (s.duration || 0);
      const act = s.action.trim().toLocaleUpperCase('tr-TR');
      // Gün hesabından muaf aksiyonları atla (sadece kapasiteleri sayılır)
      if (EXCLUDED_DAY_COUNT_ACTIONS.some(ex => act.includes(ex))) return;
      if (!dailyMap[s.startDate]) dailyMap[s.startDate] = { AM: {}, PM: {} };

      const amOverlap = getOverlap(start, end, 8*60, 12*60);
      if (amOverlap > 0) {
        if (!dailyMap[s.startDate].AM[act]) dailyMap[s.startDate].AM[act] = { mins: 0, firstStart: Infinity };
        dailyMap[s.startDate].AM[act].mins += amOverlap;
        dailyMap[s.startDate].AM[act].firstStart = Math.min(dailyMap[s.startDate].AM[act].firstStart, start);
      }
      const pmOverlap = getOverlap(start, end, 13*60, 17*60);
      if (pmOverlap > 0) {
        if (!dailyMap[s.startDate].PM[act]) dailyMap[s.startDate].PM[act] = { mins: 0, firstStart: Infinity };
        dailyMap[s.startDate].PM[act].mins += pmOverlap;
        dailyMap[s.startDate].PM[act].firstStart = Math.min(dailyMap[s.startDate].PM[act].firstStart, start);
      }
    });

    Object.values(dailyMap).forEach(day => {
      // AM oturumunda en çok dakika kaplayan aksiyonu seç (eşitlikte erken başlayan kazanır)
      let amWinner = ""; let amMaxMins = -1; let amEarliest = Infinity;
      Object.entries(day.AM).forEach(([act, stats]) => {
        if (stats.mins >= MIN_SESSION_THRESHOLD) {
          if (stats.mins > amMaxMins) { amMaxMins = stats.mins; amWinner = act; amEarliest = stats.firstStart; }
          else if (stats.mins === amMaxMins && stats.firstStart < amEarliest) { amWinner = act; amEarliest = stats.firstStart; }
        }
      });
      // PM oturumunda en çok dakika kaplayan aksiyonu seç
      let pmWinner = ""; let pmMaxMins = -1; let pmEarliest = Infinity;
      Object.entries(day.PM).forEach(([act, stats]) => {
        if (stats.mins >= MIN_SESSION_THRESHOLD) {
          if (stats.mins > pmMaxMins) { pmMaxMins = stats.mins; pmWinner = act; pmEarliest = stats.firstStart; }
          else if (stats.mins === pmMaxMins && stats.firstStart < pmEarliest) { pmWinner = act; pmEarliest = stats.firstStart; }
        }
      });
      if (amWinner) counts[amWinner] = (counts[amWinner] || 0) + 0.5;
      if (pmWinner) counts[pmWinner] = (counts[pmWinner] || 0) + 0.5;
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