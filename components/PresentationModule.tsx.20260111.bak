
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
/* Fix: Added getPeriodKey to imports */
import { normalizeDoctorName, getPeriodKey } from '../utils/formatters';

interface PresentationModuleProps {
  detailedScheduleData: DetailedScheduleData[];
  muayeneByPeriod: Record<string, Record<string, MuayeneMetrics>>;
  ameliyatByPeriod: Record<string, Record<string, number>>;
  versions: Record<string, Record<string, ScheduleVersion>>;
  selectedHospital: string;
  slides: PresentationSlide[];
  setSlides: React.Dispatch<React.SetStateAction<PresentationSlide[]>>;
}

const PresentationModule: React.FC<PresentationModuleProps> = ({ 
  detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, versions, selectedHospital, slides, setSlides
}) => {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const presentationRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPresenting) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === ' ') setCurrentSlideIndex(p => Math.min(p + 1, slides.length - 1));
        else if (e.key === 'ArrowLeft') setCurrentSlideIndex(p => Math.max(p - 1, 0));
        else if (e.key === 'Escape') setIsPresenting(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = 'unset'; };
    }
  }, [isPresenting, slides.length]);

  const removeSlide = (id: string) => { setSlides(slides.filter(s => s.id !== id)); if (activeSlideId === id) setActiveSlideId(null); };

  /* Fix: Explicitly typed WidgetMirror as React.FC to handle React-reserved props like 'key' in mappings */
  const WidgetMirror: React.FC<{ widget: PresentationWidget, isPresentation?: boolean }> = ({ widget, isPresentation = false }) => {
    // Determine state: Snapshot vs Live
    const state = widget.mode === 'SNAPSHOT' && widget.snapshotState ? widget.snapshotState : { month: 'Kasım', year: 2025, branch: 'ALL' };

    switch (widget.type) {
      case 'COVER_SLIDE':
        return (
          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-20 text-center">
            <h1 className="text-8xl font-black mb-6 uppercase tracking-tighter">{selectedHospital}</h1>
            <h2 className="text-3xl font-bold text-indigo-400 uppercase tracking-widest">STRATEJİK MHRS ANALİZ SUNUMU</h2>
            <div className="mt-12 px-10 py-4 border-2 border-white/10 rounded-full"><span className="text-xl font-black text-slate-400">{state.month} {state.year} DÖNEMİ</span></div>
          </div>
        );

      case 'CAPACITY_CHART':
        const capData = getEfficiencyData(detailedScheduleData, muayeneByPeriod, state.month!, state.year!, state.branch!);
        return <div className="h-full w-full bg-white p-10 flex flex-col">
          <div className="mb-8 text-center"><h3 className="text-3xl font-black uppercase">{state.month} {state.year} KAPASİTE ANALİZİ</h3></div>
          <div className="flex-1"><CapacityUsageChart data={capData.slice(0, isPresentation ? 30 : 10)} /></div>
        </div>;

      case 'DETAILED_SUMMARY':
        return <div className="h-full w-full scale-90 origin-top overflow-hidden">
          <DetailedSchedule data={detailedScheduleData} selectedBranch={state.branch!} onImportExcel={() => {}} onDelete={() => {}} onClearAll={() => {}} onRemoveMonth={() => {}} />
        </div>;

      case 'ANALYSIS_OVERVIEW':
        return <div className="h-full w-full scale-75 origin-top-left -mt-20 px-20">
          <AnalysisModule appointmentData={[]} hbysData={[]} selectedHospital={selectedHospital} planningProposals={[]} pastChangesInitialData={null} pastChangesFinalData={null} onClearPastChanges={() => {}} />
        </div>;

      case 'KPI_SUMMARY':
        return (
          <div className="grid grid-cols-2 gap-10 p-20 h-full items-center bg-white">
            <div className="bg-slate-900 text-white p-20 rounded-[80px] text-center shadow-2xl">
              <p className="text-slate-400 text-sm font-black uppercase mb-4">HASTANE MHRS KAPASİTESİ</p>
              <h4 className="text-9xl font-black">2.450</h4>
            </div>
            <div className="bg-indigo-600 text-white p-20 rounded-[80px] text-center shadow-2xl">
              <p className="text-indigo-200 text-sm font-black uppercase mb-4">GÜNCEL HEKİM SAYISI</p>
              <h4 className="text-9xl font-black">42</h4>
            </div>
          </div>
        );

      default:
        return <div className="h-full flex items-center justify-center bg-slate-50"><p className="text-slate-400 font-black uppercase tracking-widest">{widget.type} Mirroring...</p></div>;
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div><h2 className="text-3xl font-black text-slate-900 uppercase">Sunum Düzenleyici</h2><p className="text-slate-500 font-bold uppercase text-xs">Modül görünümlerini aynalayarak profesyonel slaytlar oluşturun.</p></div>
        <button onClick={() => { setIsPresenting(true); setCurrentSlideIndex(0); }} className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">SUNUMU BAŞLAT</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 no-print">
        <div className="lg:col-span-8">
          {activeSlideId ? (
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center border-b pb-8 mb-8">
                 <input value={slides.find(s=>s.id===activeSlideId)?.title} onChange={e => setSlides(slides.map(s => s.id === activeSlideId ? {...s, title: e.target.value} : s))} className="text-2xl font-black uppercase w-full bg-transparent outline-none focus:text-indigo-600" />
                 <button onClick={() => removeSlide(activeSlideId)} className="text-rose-500 font-black p-3 hover:bg-rose-50 rounded-xl">SİL</button>
              </div>
              <div className="flex-1 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] overflow-hidden">
                 {slides.find(s=>s.id===activeSlideId)?.widgets.map(w => <WidgetMirror key={w.id} widget={w} />)}
                 {slides.find(s=>s.id===activeSlideId)?.widgets.length === 0 && <div className="h-full flex items-center justify-center p-20 text-center"><p className="text-slate-400 font-bold">Bu slayt boş. Modüllerden "Görünümü Sunuma Ekle" butonu ile içerik ekleyin.</p></div>}
              </div>
            </div>
          ) : <div className="bg-slate-50 p-20 rounded-[48px] border-2 border-dashed border-slate-200 text-center text-slate-300 font-black text-2xl uppercase">DÜZENLEMEK İÇİN SOLDAKİ LİSTEDEN BİR SLAYT SEÇİN</div>}
        </div>
        <div className="lg:col-span-4 bg-slate-900 rounded-[48px] p-10 text-white min-h-[600px] flex flex-col">
           <h3 className="text-xl font-black uppercase mb-8 italic">Slayt Akışı</h3>
           <div className="flex-1 space-y-4 overflow-auto custom-scrollbar">
             {slides.map((s, idx) => (
               <div key={s.id} onClick={() => setActiveSlideId(s.id)} className={`p-6 rounded-[28px] border-2 transition-all cursor-pointer ${activeSlideId === s.id ? 'bg-indigo-600 border-indigo-400 shadow-xl scale-105' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                  <div className="flex items-center gap-4"><span className="text-xs font-black text-slate-500">{(idx+1).toString().padStart(2,'0')}</span><span className="text-sm font-black uppercase truncate">{s.title}</span></div>
               </div>
             ))}
           </div>
           <button onClick={() => { const id=`s-${Date.now()}`; setSlides([...slides, {id, title:'YENİ SLAYT', widgets:[]}]); setActiveSlideId(id); }} className="mt-8 bg-white text-slate-900 w-full py-5 rounded-[28px] font-black uppercase text-xs hover:bg-slate-100 transition-all">+ YENİ SLAYT EKLE</button>
        </div>
      </div>

      {isPresenting && createPortal(
        <div ref={presentationRef} className="fixed inset-0 w-screen h-screen z-[10000] bg-white flex flex-col overflow-hidden select-none" onMouseMove={() => { setShowControls(true); if(controlsTimerRef.current) clearTimeout(controlsTimerRef.current); controlsTimerRef.current=window.setTimeout(()=>setShowControls(false),3000); }}>
           <div className="flex-1 relative bg-white">
             {slides[currentSlideIndex].widgets.map(w => <WidgetMirror key={w.id} widget={w} isPresentation />)}
             <div className={`absolute top-10 right-10 flex gap-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => setIsPresenting(false)} className="bg-rose-600 text-white p-5 rounded-2xl shadow-2xl hover:scale-110 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
             </div>
             <div className={`absolute inset-x-0 bottom-10 px-20 flex justify-between items-center transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))} className={`bg-slate-900 text-white p-8 rounded-3xl shadow-2xl transition-all ${currentSlideIndex === 0 ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7"/></svg></button>
                <div className="bg-slate-900/90 text-white px-12 py-5 rounded-full font-black text-2xl tracking-[0.2em]">{currentSlideIndex + 1} / {slides.length}</div>
                <button onClick={() => setCurrentSlideIndex(p => Math.min(slides.length - 1, p + 1))} className={`bg-slate-900 text-white p-8 rounded-3xl shadow-2xl transition-all ${currentSlideIndex === slides.length - 1 ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"/></svg></button>
             </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Helper to recalculate data for mirroring without duplicating logic
const getEfficiencyData = (detailedScheduleData: any[], muayeneByPeriod: any, month: string, year: number, branch: string) => {
  const periodSchedules = detailedScheduleData.filter(d => d.month === month && d.year === year);
  /* Fix: getPeriodKey is now properly imported */
  const periodKey = getPeriodKey(year, month);
  const rawMuayeneData = muayeneByPeriod[periodKey] || {};
  const physMap = new Map<string, { name: string, branch: string, cap: number }>();
  periodSchedules.forEach(s => { const n = normalizeDoctorName(s.doctorName); if(!physMap.has(n)) physMap.set(n, { name: s.doctorName, branch: s.specialty, cap: 0 }); physMap.get(n)!.cap += (s.capacity || 0); });
  return Array.from(physMap.entries()).map(([norm, b]) => { const m = rawMuayeneData[norm] || { toplam: 0 }; return { doctorName: b.name, branchName: b.branch, capacity: b.cap, totalExam: m.toplam, status: m.toplam < b.cap ? 'UNDER' : 'OVER', usageRatePct: b.cap > 0 ? (m.toplam / b.cap) * 100 : null }; }).filter(i => branch === 'ALL' || i.branchName === branch).sort((a,b) => b.capacity - a.capacity);
};

export default PresentationModule;
