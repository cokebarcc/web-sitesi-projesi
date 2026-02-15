
import React, { useState, useEffect } from 'react';
import { analyzeScheduleWithAI, getSpecificOptimizations } from '../services/geminiService';
import { AppointmentData, HBYSData, AISuggestion } from '../types';

interface AISuggestionsProps {
  data: AppointmentData[];
  hbysData: HBYSData[];
  report: string;
  setReport: (r: string) => void;
  suggestions: AISuggestion[];
  setSuggestions: (s: AISuggestion[]) => void;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({ data, hbysData, report, setReport, suggestions, setSuggestions }) => {
  const [loading, setLoading] = useState<boolean>(false);

  const fetchData = async (force: boolean = false) => {
    // AI functionality has been disabled
    if ((data.length === 0 && hbysData.length === 0) || (report && !force)) {
      return;
    }

    setLoading(true);
    try {
      setReport('AI analiz özelliği devre dışı bırakıldı.');
      setSuggestions([]);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [data, hbysData]);

  if (data.length === 0 && hbysData.length === 0) {
    return (
      <div className="p-20 rounded-[40px] border-2 border-dashed text-center" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
        <h3 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>AI Stratejik Analiz</h3>
        <p className="mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>Verimlilik ve kapasite analizi için lütfen Cetvel (Plan) ve HBYS (Gerçekleşen) verilerini yükleyiniz.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-600/10 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <div className="text-center">
          <p className="font-black text-lg uppercase tracking-tighter" style={{ color: 'var(--text-1)' }}>AI Çapraz Veri Analizi Yapılıyor...</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Ameliyat Verimliliği, Kapasite Boşlukları ve Plan Hataları sorgulanıyor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20">
      {/* Yönetici Özeti Bölümü */}
      <div className="bg-white p-10 rounded-[48px] border shadow-xl relative overflow-hidden group" style={{ borderColor: 'var(--border-2)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-3xl shadow-xl" style={{ background: 'var(--bg-app)' }}>
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>Stratejik Performans Raporu</h2>
              <p className="text-emerald-600 text-xs font-black uppercase tracking-[0.2em] mt-1">Cetvel vs. Gerçekleşen Çapraz Analiz</p>
            </div>
          </div>
          <button 
            onClick={() => fetchData(true)}
            className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            YENİDEN ANALİZ ET
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
          <div className="lg:col-span-8 p-8 rounded-[32px] border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b pb-4" style={{ color: 'var(--text-3)' }}>Yönetici Özeti ve Kritik Tespitler</h3>
            <div className="prose max-w-none prose-p:font-medium prose-p:leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {report ? report.split('\n').map((line, lineIdx) => (
                <div key={lineIdx} className={`flex gap-3 mb-4 last:mb-0 ${line.includes('!') || line.toLowerCase().includes('kritik') ? 'bg-rose-50/50 p-3 rounded-xl border border-rose-100' : ''}`}>
                  {line && line.trim() && <span className="text-emerald-500 mt-1 shrink-0">●</span>}
                  <p className="text-sm md:text-base">{line.replace(/^\*+/, '').trim()}</p>
                </div>
              )) : (
                <p className="italic" style={{ color: 'var(--text-3)' }}>Analiz raporu henüz oluşturulmadı.</p>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Analiz Kapsamı</h3>
            <AnalysisTag label="Verimlilik (80-60-40)" active={true} />
            <AnalysisTag label="Kapasite Boşluk Analizi" active={true} />
            <AnalysisTag label="Plan Dışı Cerrahi Potansiyel" active={true} />
            <AnalysisTag label="Kaynak Optimizasyonu" active={true} />
            
            <div className="mt-8 p-6 rounded-[32px]" style={{ background: 'var(--bg-app)', color: 'var(--text-1)' }}>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">AI NOTU</p>
              <p className="text-xs font-medium italic leading-relaxed">"Analiz sonuçları, cetvel planlarındaki aksiyonların HBYS'deki çıktıları ile doğrudan kıyaslanması sonucu üretilmiştir."</p>
            </div>
          </div>
        </div>
      </div>

      {/* Optimizasyon Kartları Bölümü */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {suggestions.map((sug, idx) => {
          const cat = (sug.category || '').toLowerCase();
          return (
            <div key={idx} className={`bg-white p-8 rounded-[40px] shadow-xl border-2 transition-all hover:scale-[1.02] group ${
              cat.includes('verimlilik') ? 'border-amber-50 hover:border-amber-200' :
              cat.includes('kapasite') ? 'border-rose-50 hover:border-rose-200' :
              cat.includes('cerrahi') ? 'border-emerald-50 hover:border-emerald-200' : ''
            }`} style={!cat.includes('verimlilik') && !cat.includes('kapasite') && !cat.includes('cerrahi') ? { borderColor: 'var(--border-2)' } : undefined}>
              <div className="flex justify-between items-start mb-6">
                <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                  sug.priority === 'High' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 
                  sug.priority === 'Medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                }`}>
                  {sug.priority} ÖNCELİK
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-2)' }}>{sug.category}</span>
              </div>
              <h4 className="text-xl font-black mb-4 tracking-tight group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-1)' }}>{sug.title}</h4>
              <div className="p-5 rounded-2xl border" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
                 <p className="text-sm leading-relaxed font-bold" style={{ color: 'var(--text-2)' }}>{sug.description}</p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest cursor-pointer hover:gap-3 transition-all">
                DETAYLI ANALİZİ GÖR 
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AnalysisTag = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${active ? 'border-emerald-100 text-emerald-700 shadow-sm' : 'opacity-50'}`}
    style={active ? { background: 'var(--surface-1)' } : { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--text-3)' }}
  >
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : ''}`} style={!active ? { background: 'var(--border-2)' } : undefined}></div>
    <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
  </div>
);

export default AISuggestions;
