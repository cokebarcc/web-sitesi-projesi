
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DetailedScheduleData,
  PresentationSlide,
  PresentationWidget,
  PresentationTarget,
  MuayeneMetrics,
  ScheduleVersion,
  PresentationWidgetState
} from '../types';
import { MONTHS, YEARS } from '../constants';
import { CapacityUsageChart, SurgicalEfficiencyChart, SurgHoursChart } from './EfficiencyAnalysis';
import DetailedSchedule from './DetailedSchedule';
import PhysicianData from './PhysicianData';
import AnalysisModule from './AnalysisModule';
import { normalizeDoctorName, getPeriodKey } from '../utils/formatters';

// Capacity Chart Widget Component
interface CapacityChartWidgetProps {
  detailedScheduleData: DetailedScheduleData[];
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  month: string;
  year: number;
  branch: string;
  isPresentation?: boolean;
}

const CapacityChartWidget: React.FC<CapacityChartWidgetProps> = ({
  detailedScheduleData,
  muayeneByPeriod,
  month,
  year,
  branch: initialBranch,
  isPresentation = false
}) => {
  const [branchFilter, setBranchFilter] = useState<string>(initialBranch);
  const [viewLimit, setViewLimit] = useState<number | 'ALL'>(isPresentation ? 50 : 12);
  const [currentPage, setCurrentPage] = useState(1);

  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    detailedScheduleData
      .filter(d => d.month === month && d.year === year)
      .forEach(d => {
        if (d.specialty && d.specialty !== 'Bilinmiyor') {
          branches.add(d.specialty);
        }
      });
    return Array.from(branches).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [detailedScheduleData, month, year]);

  const fullChartData = useMemo(() => {
    const periodSchedules = detailedScheduleData.filter(d => d.month === month && d.year === year);
    const periodKey = getPeriodKey(year, month);
    const rawMuayeneData = muayeneByPeriod[periodKey] || {};

    const physicianMap = new Map<string, { name: string, branch: string, capacity: number }>();
    periodSchedules.forEach(s => {
      const norm = normalizeDoctorName(s.doctorName);
      if (!physicianMap.has(norm)) {
        physicianMap.set(norm, { name: s.doctorName, branch: s.specialty, capacity: 0 });
      }
      physicianMap.get(norm)!.capacity += (s.capacity || 0);
    });

    const capacityList = Array.from(physicianMap.entries()).map(([normName, base]) => {
      const metrics = rawMuayeneData[normName] || { mhrs: 0, ayaktan: 0, toplam: 0 };
      const total = metrics.toplam || 0;
      const cap = base.capacity || 0;
      let status = "NORMAL";
      let diffPct = 0;

      if (cap > 0) {
        diffPct = (total - cap) / cap;
        if (total < cap) status = "UNDER";
        else status = "OVER";
      } else {
        status = total > 0 ? "NO_CAP" : "BOTH_ZERO";
      }

      return {
        doctorName: base.name,
        branchName: base.branch,
        capacity: cap,
        totalExam: total,
        performanceDiff: total - cap,
        diffPct,
        status,
        usageRatePct: cap > 0 ? (total / cap) * 100 : null
      };
    }).filter(item => {
      const isBothZero = item.capacity <= 0 && item.totalExam <= 0;
      const branchMatch = branchFilter === 'ALL' || item.branchName === branchFilter;
      return !isBothZero && branchMatch && !!item.doctorName;
    });

    const underGroup = capacityList.filter(d => d.status === "UNDER").sort((a, b) => a.diffPct - b.diffPct);
    const noCapGroup = capacityList.filter(d => d.status === "NO_CAP").sort((a, b) => b.totalExam - a.totalExam);
    const overGroup = capacityList.filter(d => d.status === "OVER" || (d.capacity > 0 && d.totalExam === d.capacity)).sort((a, b) => a.diffPct - b.diffPct);

    return [...underGroup, ...noCapGroup, ...overGroup];
  }, [detailedScheduleData, muayeneByPeriod, month, year, branchFilter]);

  const paginatedChartData = useMemo(() => {
    if (viewLimit === 'ALL') return fullChartData;
    const startIndex = (currentPage - 1) * viewLimit;
    return fullChartData.slice(startIndex, startIndex + viewLimit);
  }, [fullChartData, viewLimit, currentPage]);

  const totalPages = viewLimit === 'ALL' ? 1 : Math.ceil(fullChartData.length / (Number(viewLimit) || 1));

  return (
    <div className="h-full w-full bg-white p-8 flex flex-col">
      <div className="flex flex-col items-center mb-6 gap-4">
        <h3 className="text-2xl font-black uppercase">{month} {year} KAPASİTE KULLANIM GRAFİĞİ</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-slate-500 uppercase">Branş:</label>
            <select
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
              className="border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-indigo-500"
            >
              <option value="ALL">Tüm Branşlar</option>
              {availableBranches.map(br => <option key={br} value={br}>{br}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-slate-500 uppercase">Göster:</label>
            <select
              value={viewLimit}
              onChange={(e) => { setViewLimit(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); }}
              className="border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-indigo-500"
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="50">50</option>
              <option value="ALL">Tümü</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <CapacityUsageChart data={paginatedChartData} />
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
          >
            Önceki
          </button>
          <span className="text-sm font-bold text-slate-600">
            Sayfa {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
};

interface PresentationModuleProps {
  detailedScheduleData: DetailedScheduleData[];
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  ameliyatByPeriod: Record<string, Record<string, number>>;
  versions: Record<string, Record<string, ScheduleVersion>>;
  selectedHospital: string;
  slides: PresentationSlide[];
  setSlides: React.Dispatch<React.SetStateAction<PresentationSlide[]>>;
}

const WIDGET_LIBRARY: { type: PresentationTarget; label: string; icon: string; category: string }[] = [
  { type: 'COVER_SLIDE', label: 'Kapak Slaydı', icon: '📄', category: 'Genel' },
  { type: 'KPI_SUMMARY', label: 'KPI Özeti', icon: '📊', category: 'Genel' },
  { type: 'CAPACITY_CHART', label: 'Kapasite Kullanım Grafiği', icon: '📈', category: 'Verimlilik' },
  { type: 'DETAILED_SUMMARY', label: 'Detaylı Cetvel', icon: '📋', category: 'Cetvel' },
];

const PresentationModule: React.FC<PresentationModuleProps> = ({
  detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, versions, selectedHospital, slides, setSlides
}) => {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showWidgetGallery, setShowWidgetGallery] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<number | null>(null);

  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const startPresentation = () => {
    setIsPresenting(true);
    setCurrentSlideIndex(0);
  };

  const exitPresentation = () => {
    setIsPresenting(false);
  };

  useEffect(() => {
    if (isPresenting) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === ' ') setCurrentSlideIndex(p => Math.min(p + 1, slides.length - 1));
        else if (e.key === 'ArrowLeft') setCurrentSlideIndex(p => Math.max(p - 1, 0));
        else if (e.key === 'Escape') exitPresentation();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = 'unset'; };
    }
  }, [isPresenting, slides.length]);

  const removeSlide = (id: string) => {
    setSlides(slides.filter(s => s.id !== id));
    if (activeSlideId === id) setActiveSlideId(null);
  };

  const addWidgetToSlide = (slideId: string, widgetType: PresentationTarget) => {
    const newWidget: PresentationWidget = {
      id: `w-${Date.now()}-${Math.random()}`,
      type: widgetType,
      mode: 'SNAPSHOT',
      snapshotState: {
        month: currentMonth,
        year: currentYear,
        branch: 'ALL',
        viewLimit: 10
      }
    };
    setSlides(slides.map(s => s.id === slideId ? { ...s, widgets: [...s.widgets, newWidget] } : s));
    setShowWidgetGallery(false);
  };

  const removeWidget = (slideId: string, widgetId: string) => {
    setSlides(slides.map(s => s.id === slideId ? { ...s, widgets: s.widgets.filter(w => w.id !== widgetId) } : s));
  };

  const updateWidgetState = (slideId: string, widgetId: string, newState: Partial<PresentationWidgetState>) => {
    setSlides(slides.map(s =>
      s.id === slideId
        ? { ...s, widgets: s.widgets.map(w => w.id === widgetId ? { ...w, snapshotState: { ...w.snapshotState, ...newState } } : w) }
        : s
    ));
  };

  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    detailedScheduleData.forEach(d => branches.add(d.specialty));
    return ['ALL', ...Array.from(branches).filter(b => b && b !== 'Bilinmiyor').sort()];
  }, [detailedScheduleData]);

  const WidgetMirror: React.FC<{ widget: PresentationWidget, isPresentation?: boolean, slideId?: string }> = ({ widget, isPresentation = false, slideId }) => {
    const state = useMemo(() =>
      widget.snapshotState || { month: currentMonth, year: currentYear, branch: 'ALL' }
    , [widget.snapshotState, currentMonth, currentYear]);

    const isEditing = editingWidgetId === widget.id;

    const widgetContent = useMemo(() => {
      switch (widget.type) {
        case 'COVER_SLIDE':
          return (
            <div className="w-full h-full bg-white flex flex-col items-center relative overflow-hidden">
              <div className="w-full relative" style={{ height: '30%' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-[#1e3a5f] to-[#2d4a6f]"></div>
                <svg className="absolute bottom-0 w-full" viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ height: '80px' }}>
                  <path d="M0,60 Q300,120 600,60 T1200,60 L1200,0 L0,0 Z" fill="#1e3a5f"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                  <h1 className="text-7xl font-black uppercase tracking-tight">MHRS SUNUMU</h1>
                  <h2 className="text-6xl font-black uppercase tracking-wide mt-2">{state.year} {state.month}</h2>
                </div>
              </div>
              <div className="flex-1 w-full flex items-center justify-center relative" style={{ background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)' }}>
                <div className="relative">
                  <img
                    src="/assets/logos/SB Logo.png"
                    alt="T.C. Sağlık Bakanlığı Logo"
                    className="w-80 h-80 object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
              <div className="w-full relative" style={{ height: '30%' }}>
                <svg className="absolute top-0 w-full" viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ height: '80px' }}>
                  <path d="M0,60 Q300,0 600,60 T1200,60 L1200,120 L0,120 Z" fill="#1e3a5f"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-[#2d4a6f] to-[#1e3a5f]"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 space-y-2 pt-12">
                  <h2 className="text-5xl font-black uppercase tracking-tight">T.C. SAĞLIK BAKANLIĞI</h2>
                  <h3 className="text-4xl font-black uppercase tracking-wide">ŞANLIURFA</h3>
                  <p className="text-2xl font-bold uppercase tracking-widest">İL SAĞLIK MÜDÜRLÜĞÜ</p>
                </div>
              </div>
            </div>
          );

        case 'CAPACITY_CHART':
          return <CapacityChartWidget
            detailedScheduleData={detailedScheduleData}
            muayeneByPeriod={muayeneByPeriod}
            month={state.month!}
            year={state.year!}
            branch={state.branch!}
            isPresentation={isPresentation}
          />;

        case 'DETAILED_SUMMARY':
          return (
            <div className="h-full w-full scale-90 origin-top overflow-hidden">
              <DetailedSchedule data={detailedScheduleData} selectedBranch={state.branch!} onImportExcel={() => {}} onDelete={() => {}} onClearAll={() => {}} onRemoveMonth={() => {}} />
            </div>
          );

        case 'KPI_SUMMARY':
          const kpiData = calculateKPIs(detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, state.month!, state.year!, state.branch!);
          const appointmentRateVal = kpiData.totalExamsCount > 0 ? (kpiData.totalMhrsExamsCount / kpiData.totalExamsCount) * 100 : 0;
          const avgHoursPerSurgery = kpiData.totalAbcSurgeriesCount > 0 ? kpiData.totalScheduledSurgeryHours / kpiData.totalAbcSurgeriesCount : 0;

          return (
            <div className="h-full w-full bg-white flex items-center justify-center p-8">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
                <div className="bg-slate-900 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-slate-400 text-xs font-black uppercase mb-2">Toplam Kapasite Sayısı</p>
                  <h4 className="text-5xl font-black">{kpiData.totalCapacityCount.toLocaleString('tr-TR')}</h4>
                </div>
                <div className="bg-indigo-600 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-indigo-200 text-xs font-black uppercase mb-2">Toplam Muayene Sayısı</p>
                  <h4 className="text-5xl font-black">{kpiData.totalExamsCount.toLocaleString('tr-TR')}</h4>
                </div>
                <div className="bg-emerald-600 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-emerald-200 text-xs font-black uppercase mb-2">Randevulu Muayene Oranı</p>
                  <h4 className="text-5xl font-black">{appointmentRateVal.toFixed(1).replace('.', ',')}%</h4>
                </div>
                <div className="bg-purple-600 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-purple-200 text-xs font-black uppercase mb-2">Planlanan Ameliyat Gün</p>
                  <h4 className="text-5xl font-black">{kpiData.totalSurgeryDays.toLocaleString('tr-TR')}</h4>
                </div>
                <div className="bg-rose-600 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-rose-200 text-xs font-black uppercase mb-2">Toplam A+B+C Ameliyat</p>
                  <h4 className="text-5xl font-black">{kpiData.totalAbcSurgeriesCount.toLocaleString('tr-TR')}</h4>
                </div>
                <div className="bg-amber-600 text-white p-8 rounded-[40px] text-center shadow-2xl flex flex-col justify-center">
                  <p className="text-amber-200 text-xs font-black uppercase mb-2">Ameliyat Cetvel Verimi</p>
                  <h4 className="text-4xl font-black">{avgHoursPerSurgery.toFixed(2).replace('.', ',')}</h4>
                  <p className="text-amber-200 text-[10px] font-black uppercase mt-1">SAAT / AMELİYAT</p>
                </div>
              </div>
            </div>
          );

        default:
          return <div className="h-full flex items-center justify-center bg-slate-50"><p className="text-slate-400 font-black uppercase tracking-widest">{widget.type}</p></div>;
      }
    }, [widget.type, state.month, state.year, state.branch, isPresentation]);

    return (
      <div className="relative h-full w-full group">
        <div className="relative h-full w-full" style={{ overflow: 'hidden' }}>
          {widgetContent}

          {!isPresentation && slideId && (
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)}
                className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-all"
                title="Ayarlar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => removeWidget(slideId, widget.id)}
                className="bg-rose-600 text-white p-3 rounded-xl shadow-lg hover:bg-rose-700 transition-all"
                title="Sil"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {isEditing && slideId && !isPresentation && (
            <div
              className="absolute inset-x-0 bottom-0 bg-white border-t-4 border-indigo-600 p-6 shadow-2xl rounded-t-3xl z-20"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-slate-900 uppercase text-sm">Widget Ayarları</h4>
                <button onClick={() => setEditingWidgetId(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Ay</label>
                  <select
                    value={state.month || currentMonth}
                    onChange={(e) => updateWidgetState(slideId, widget.id, { month: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-indigo-500"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Yıl</label>
                  <select
                    value={state.year || currentYear}
                    onChange={(e) => updateWidgetState(slideId, widget.id, { year: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-indigo-500"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Branş</label>
                  <select
                    value={state.branch || 'ALL'}
                    onChange={(e) => updateWidgetState(slideId, widget.id, { branch: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-indigo-500"
                  >
                    {availableBranches.map(b => (
                      <option key={b} value={b}>
                        {b === 'ALL' ? 'Tüm Branşlar' : b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase">Sunum Düzenleyici</h2>
          <p className="text-slate-500 font-bold uppercase text-xs">Modül görünümlerini aynalayarak profesyonel slaytlar oluşturun.</p>
        </div>
        <button onClick={startPresentation} className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">
          <span className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            TAM EKRAN SUNUM
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 no-print">
        <div className="lg:col-span-8">
          {activeSlideId ? (
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center border-b pb-8 mb-8">
                <input
                  value={slides.find(s=>s.id===activeSlideId)?.title}
                  onChange={e => setSlides(slides.map(s => s.id === activeSlideId ? {...s, title: e.target.value} : s))}
                  className="text-2xl font-black uppercase w-full bg-transparent outline-none focus:text-indigo-600"
                  placeholder="Slayt başlığı..."
                />
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setShowWidgetGallery(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-indigo-700 transition-all whitespace-nowrap flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    İÇERİK EKLE
                  </button>
                  <button onClick={() => removeSlide(activeSlideId)} className="text-rose-500 font-black px-6 py-3 hover:bg-rose-50 rounded-xl transition-all">SİL</button>
                </div>
              </div>
              <div
                className="flex-1 bg-slate-900 rounded-[32px] shadow-2xl flex flex-col gap-4 p-4 overflow-y-auto"
                style={{ aspectRatio: '16/9' }}
              >
                {slides.find(s=>s.id===activeSlideId)?.widgets.map(w => (
                  <WidgetMirror key={w.id} widget={w} slideId={activeSlideId} />
                ))}
                {slides.find(s=>s.id===activeSlideId)?.widgets.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-6xl mb-4 opacity-20">📊</div>
                      <p className="text-white/40 font-bold text-lg">Bu slayt boş</p>
                      <p className="text-white/20 font-bold text-sm mt-2">İçerik eklemek için yukarıdaki butonu kullanın</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-20 rounded-[48px] border-2 border-dashed border-slate-200 text-center text-slate-300 font-black text-2xl uppercase">
              DÜZENLEMEK İÇİN SOLDAKİ LİSTEDEN BİR SLAYT SEÇİN
            </div>
          )}
        </div>
        <div className="lg:col-span-4 bg-slate-900 rounded-[48px] p-10 text-white min-h-[600px] flex flex-col">
          <h3 className="text-xl font-black uppercase mb-8 italic">Slayt Akışı</h3>
          <div className="flex-1 space-y-4 overflow-auto custom-scrollbar">
            {slides.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => setActiveSlideId(s.id)}
                className={`p-6 rounded-[28px] border-2 transition-all cursor-pointer ${
                  activeSlideId === s.id
                    ? 'bg-indigo-600 border-indigo-400 shadow-xl scale-105'
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500">{(idx+1).toString().padStart(2,'0')}</span>
                  <span className="text-sm font-black uppercase truncate">{s.title}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const id=`s-${Date.now()}`;
              setSlides([...slides, {id, title:'YENİ SLAYT', widgets:[]}]);
              setActiveSlideId(id);
            }}
            className="mt-8 bg-white text-slate-900 w-full py-5 rounded-[28px] font-black uppercase text-xs hover:bg-slate-100 transition-all"
          >
            + YENİ SLAYT EKLE
          </button>
        </div>
      </div>

      {/* Widget Gallery Modal */}
      {showWidgetGallery && activeSlideId && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setShowWidgetGallery(false);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="p-10 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-black uppercase text-slate-900">Widget Galerisi</h3>
                  <p className="text-slate-500 font-bold mt-1">Slayta eklemek için bir widget seçin</p>
                </div>
                <button
                  onClick={() => setShowWidgetGallery(false)}
                  className="text-slate-400 hover:text-slate-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-10 max-h-[600px] overflow-y-auto custom-scrollbar">
              {['Genel', 'Verimlilik', 'Cetvel'].map(category => (
                <div key={category} className="mb-10">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {WIDGET_LIBRARY.filter(w => w.category === category).map(widget => (
                      <button
                        key={widget.type}
                        onClick={() => addWidgetToSlide(activeSlideId, widget.type)}
                        className="bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-2xl p-6 text-left transition-all hover:scale-105 hover:shadow-lg group"
                      >
                        <div className="text-4xl mb-3">{widget.icon}</div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {widget.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isPresenting && createPortal(
        <div
          ref={presentationRef}
          className="fixed inset-0 w-screen h-screen z-[10000] bg-white flex flex-col overflow-hidden select-none"
          onMouseMove={() => {
            setShowControls(true);
            if(controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
            controlsTimerRef.current=window.setTimeout(()=>setShowControls(false),3000);
          }}
        >
          <div className="flex-1 relative bg-white flex flex-col gap-4 p-4 overflow-y-auto">
            {slides[currentSlideIndex].widgets.map(w => <WidgetMirror key={w.id} widget={w} isPresentation />)}
            <div className={`absolute top-10 right-10 flex gap-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={exitPresentation} className="bg-rose-600 text-white p-5 rounded-2xl shadow-2xl hover:scale-110 transition-all" title="Tam Ekrandan Çık">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className={`absolute inset-x-0 bottom-10 px-20 flex justify-between items-center transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))} className={`bg-slate-900 text-white p-8 rounded-3xl shadow-2xl transition-all ${currentSlideIndex === 0 ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-slate-900/90 text-white px-12 py-5 rounded-full font-black text-2xl tracking-[0.2em]">{currentSlideIndex + 1} / {slides.length}</div>
              <button onClick={() => setCurrentSlideIndex(p => Math.min(slides.length - 1, p + 1))} className={`bg-slate-900 text-white p-8 rounded-3xl shadow-2xl transition-all ${currentSlideIndex === slides.length - 1 ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Helper to calculate KPIs for a specific period
const calculateKPIs = (
  detailedScheduleData: DetailedScheduleData[],
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>,
  ameliyatByPeriod: Record<string, Record<string, number>>,
  month: string,
  year: number,
  branch: string
) => {
  const surgeryActions = ['AMELİYAT', 'AMELİYATTA', 'SURGERY', 'AMELİYATHANE', 'CERRAHİ', 'OPERASYON'];
  const kpiSchedules = detailedScheduleData.filter(d => d.month === month && d.year === year);
  const periodKey = getPeriodKey(year, month);
  const rawMuayeneData = muayeneByPeriod[periodKey] || {};
  const rawAmeliyatData = ameliyatByPeriod[periodKey] || {};

  const physicianMap = new Map<string, { name: string, branch: string }>();
  kpiSchedules.forEach(s => {
    const norm = normalizeDoctorName(s.doctorName);
    if (!physicianMap.has(norm)) {
      physicianMap.set(norm, { name: s.doctorName, branch: s.specialty });
    }
  });

  const totalCapacityCount = kpiSchedules.reduce((acc, curr) => acc + (curr.capacity || 0), 0);

  const distinctSurgeryDays = new Set<string>();
  let totalScheduledSurgeryHours = 0;
  kpiSchedules.forEach(item => {
    const actionNorm = item.action.toLocaleUpperCase('tr-TR');
    if (surgeryActions.some(sa => actionNorm.includes(sa))) {
      distinctSurgeryDays.add(`${item.doctorName}|${item.startDate}`);
      totalScheduledSurgeryHours += (item.duration || 0) / 60;
    }
  });
  const totalSurgeryDays = distinctSurgeryDays.size;

  let totalExamsCount = 0;
  let totalMhrsExamsCount = 0;
  let totalAbcSurgeriesCount = 0;

  (Object.entries(rawMuayeneData) as [string, MuayeneMetrics][]).forEach(([docName, metrics]) => {
    const docBase = physicianMap.get(docName);
    if (docBase && (branch === 'ALL' || docBase.branch === branch)) {
      totalExamsCount += (metrics.toplam || 0);
      totalMhrsExamsCount += (metrics.mhrs || 0);
    }
  });

  (Object.entries(rawAmeliyatData) as [string, number][]).forEach(([docName, count]) => {
    const docBase = physicianMap.get(docName);
    if (docBase && (branch === 'ALL' || docBase.branch === branch)) {
      totalAbcSurgeriesCount += (count || 0);
    }
  });

  return {
    totalCapacityCount,
    totalExamsCount,
    totalMhrsExamsCount,
    totalSurgeryDays,
    totalAbcSurgeriesCount,
    totalScheduledSurgeryHours
  };
};

export default PresentationModule;
