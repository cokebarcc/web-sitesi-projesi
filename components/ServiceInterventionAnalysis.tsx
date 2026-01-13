
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SUTServiceData } from '../types';

interface ServiceInterventionAnalysisProps {
  sutData: SUTServiceData[];
  onImportSUT: (files: FileList | null) => void;
  aiAnalysis: string | null;
  setAiAnalysis: (a: string | null) => void;
}

type SortKey = 'hospital' | 'name' | 'count' | 'avg' | 'percentage' | 'ratio';
type SortDirection = 'asc' | 'desc';

const ServiceInterventionAnalysis: React.FC<ServiceInterventionAnalysisProps> = ({ sutData, onImportSUT, aiAnalysis, setAiAnalysis }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  
  // Tablo kontrol eyaletleri
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection }>({ key: 'percentage', direction: 'desc' });
  const [filterText, setFilterText] = useState('');

  const hospitalList = useMemo(() => {
    if (sutData.length === 0) return [];
    return Object.keys(sutData[0].hospitalValues).filter(h => 
      !h.toLocaleLowerCase('tr-TR').includes('toplam')
    );
  }, [sutData]);

  useMemo(() => {
    if (hospitalList.length > 0 && !selectedHospital) {
      setSelectedHospital(hospitalList[0]);
    }
  }, [hospitalList]);

  // Risk Analizi Hesaplaması
  const riskyProceduresRaw = useMemo(() => {
    if (sutData.length === 0 || hospitalList.length === 0) return [];
    
    const risks: any[] = [];
    sutData.forEach(item => {
      const counts = hospitalList.map(h => item.hospitalValues[h] || 0);
      const total = counts.reduce((a, b) => a + b, 0);
      const avg = total / hospitalList.length;

      hospitalList.forEach(hName => {
        const val = item.hospitalValues[hName] || 0;
        if (val > 20 && val > avg * 2.5 && !hName.toLocaleLowerCase('tr-TR').includes('toplam')) {
          risks.push({
            hospital: hName,
            code: item.sutCode,
            name: item.procedureName,
            count: val,
            avg: parseFloat(avg.toFixed(1)),
            ratio: parseFloat((val / (avg || 1)).toFixed(1)),
            percentage: total > 0 ? parseFloat(((val / total) * 100).toFixed(1)) : 0
          });
        }
      });
    });
    return risks;
  }, [sutData, hospitalList]);

  // Filtreleme ve Sıralama Uygulanmış Veri
  const filteredAndSortedRisks = useMemo(() => {
    let result = [...riskyProceduresRaw];

    // Filtreleme
    if (filterText) {
      const lowerFilter = filterText.toLocaleLowerCase('tr-TR');
      result = result.filter(item => 
        item.hospital.toLocaleLowerCase('tr-TR').includes(lowerFilter) ||
        item.name.toLocaleLowerCase('tr-TR').includes(lowerFilter) ||
        item.code.toLocaleLowerCase('tr-TR').includes(lowerFilter)
      );
    }

    // Sıralama
    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [riskyProceduresRaw, sortConfig, filterText]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const hospitalComparisonData = useMemo(() => {
    if (sutData.length === 0 || hospitalList.length === 0) return [];
    return hospitalList.map(hName => {
      const totalVolume = sutData.reduce((sum, item) => sum + (item.hospitalValues[hName] || 0), 0);
      return { name: hName, volume: totalVolume };
    }).sort((a, b) => b.volume - a.volume);
  }, [sutData, hospitalList]);

  const topProceduresData = useMemo(() => {
    if (!selectedHospital || sutData.length === 0) return [];
    return sutData
      .map(item => ({
        code: item.sutCode,
        name: item.procedureName,
        value: item.hospitalValues[selectedHospital] || 0
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [sutData, selectedHospital]);

  const runAiAnalysis = async () => {
    if (sutData.length === 0) return;
    setIsAnalyzing(true);
    
    const procedureAnalysis = sutData.slice(0, 30).map(item => {
      const counts = hospitalList.map(h => item.hospitalValues[h] || 0);
      const total = counts.reduce((a, b) => a + b, 0);
      const avg = total / hospitalList.length;
      
      const hospitalShares = hospitalList.map(h => ({
        hospital: h,
        count: item.hospitalValues[h] || 0,
        percentage: total > 0 ? (((item.hospitalValues[h] || 0) / total) * 100).toFixed(1) + '%' : '0%',
        vsAvg: avg > 0 ? ((item.hospitalValues[h] || 0) / avg).toFixed(1) + 'x' : '0x'
      })).filter(h => h.count > 0);

      return {
        code: item.sutCode,
        name: item.procedureName,
        avgCount: avg.toFixed(1),
        shares: hospitalShares
      };
    }).filter(p => p.shares.length > 0);

    try {
      // AI functionality has been disabled
      setAiAnalysis("AI analiz özelliği devre dışı bırakıldı. Lütfen manuel olarak risk tablolarını inceleyin.");
    } catch (err) {
      console.error(err);
      setAiAnalysis("AI özelliği devre dışı.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImportSUT(e.target.files);
    e.target.value = '';
  };

  if (sutData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-700">
        <div className="bg-white p-20 rounded-[48px] border-2 border-dashed border-slate-200 text-center max-w-2xl shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">Hizmet Girişim SUT Analizörü</h3>
          <p className="text-slate-500 mb-8 font-medium leading-relaxed">Hastanelerin SUT kodlu girişimsel faaliyetlerini karşılaştırmak için Excel dosyasını yükleyiniz.</p>
          <label className="inline-flex items-center gap-3 bg-blue-600 text-white px-10 py-5 rounded-3xl font-black shadow-xl hover:bg-blue-700 cursor-pointer transition-all active:scale-95">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            SUT VERİSİ YÜKLE
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Hizmet Girişim Analizi (SUT)</h2>
          <p className="text-slate-500 font-medium">Hastaneler arası karşılaştırmalı risk ve performans matrisi</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-xs font-black text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50 transition-all">
            YENİ VERİ YÜKLE
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
          </label>
          <button 
            onClick={runAiAnalysis}
            disabled={isAnalyzing}
            className="bg-rose-600 text-white px-8 py-4 rounded-3xl font-black shadow-xl hover:bg-rose-700 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            )}
            {aiAnalysis ? 'ANALİZİ YENİLE' : 'SUT RİSK ANALİZİ BAŞLAT'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight uppercase">Hastaneler Arası Toplam Hacim</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hospitalComparisonData} layout="vertical" margin={{ left: 80, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} fontSize={10} fontWeight={800} tick={{fill: '#475569'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="volume" radius={[0, 10, 10, 0]} barSize={25} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">İşlem Bazlı Yoğunluk</h3>
            <select value={selectedHospital} onChange={(e) => setSelectedHospital(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-blue-600 outline-none">
              {hospitalList.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProceduresData} margin={{ bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="code" angle={-45} textAnchor="end" fontSize={9} fontWeight={900} tick={{fill: '#64748b'}} interval={0} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {aiAnalysis && (
        <div className="bg-slate-900 text-white p-12 rounded-[56px] shadow-2xl animate-in slide-in-from-top-10 duration-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
          <div className="flex items-center gap-5 mb-10 relative z-10">
             <div className="w-14 h-14 bg-rose-600 rounded-3xl flex items-center justify-center font-black text-xl shadow-xl border border-rose-400/30">AI</div>
             <h3 className="text-2xl font-black tracking-tight">Hizmet Girişim Stratejik Risk Raporu</h3>
          </div>
          <div className="prose prose-invert max-w-none relative z-10">
            {aiAnalysis.split('\n').map((line, lineIdx) => {
              const currentLine = line || '';
              const isDanger = currentLine.toLowerCase().includes('dikkat') || currentLine.toLowerCase().includes('kritik') || currentLine.toLowerCase().includes('risk');
              return (
                <div key={lineIdx} className={`mb-4 flex gap-4 ${isDanger ? 'bg-rose-500/10 p-5 rounded-2xl border border-rose-500/20' : ''}`}>
                   {currentLine.trim() && <span className={isDanger ? "text-rose-400 mt-1" : "text-indigo-400 mt-1"}>●</span>}
                   <p className={`text-base leading-relaxed font-medium ${isDanger ? 'text-rose-50' : 'text-slate-300'}`}>{currentLine.replace(/^\*+/, '').trim()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gelişmiş Riskli İşlemler Tablosu */}
      <div className="bg-white p-10 rounded-[48px] shadow-xl border-2 border-rose-50 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
           <div>
             <div className="flex items-center gap-3 mb-1">
               <div className="w-3 h-8 bg-rose-600 rounded-full"></div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Risk Grubundaki İşlemler</h3>
             </div>
             <p className="text-slate-500 text-sm font-medium">Ortalamanın 2.5 katından fazla olan anomaliler (Filtrelenebilir ve Sıralanabilir)</p>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
             <div className="relative">
               <input 
                 type="text" 
                 placeholder="Hastane veya İşlem Ara..." 
                 className="bg-slate-50 border border-slate-200 rounded-2xl px-12 py-3 text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 w-full sm:w-64"
                 value={filterText}
                 onChange={(e) => setFilterText(e.target.value)}
               />
               <svg className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <div className="bg-rose-50 text-rose-700 px-6 py-3 rounded-2xl text-xs font-black uppercase border border-rose-100 flex items-center justify-center whitespace-nowrap">
               {filteredAndSortedRisks.length} KAYIT LİSTELENDİ
             </div>
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <SortableHeader label="HASTANE" sortKey="hospital" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="İŞLEM ADI" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="SAYI" sortKey="count" currentSort={sortConfig} center onSort={handleSort} />
                <SortableHeader label="ORTALAMA" sortKey="avg" currentSort={sortConfig} center onSort={handleSort} />
                <SortableHeader label="İL PAYI (%)" sortKey="percentage" currentSort={sortConfig} center onSort={handleSort} highlight />
                <SortableHeader label="KAT / SAPMA" sortKey="ratio" currentSort={sortConfig} center onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAndSortedRisks.length > 0 ? filteredAndSortedRisks.map((item, idx) => (
                <tr key={idx} className="hover:bg-rose-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="text-slate-900 font-black text-xs uppercase">{item.hospital}</span>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-slate-900 font-bold text-sm leading-tight group-hover:text-rose-600 transition-colors uppercase">{item.name}</p>
                    <span className="text-[10px] text-slate-400 font-black tracking-widest">{item.code}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-lg font-black text-slate-900">{item.count.toLocaleString('tr-TR')}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-sm font-bold text-slate-400">{item.avg}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-black text-rose-600">%{item.percentage}</span>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full transition-all duration-700" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black border border-rose-200">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                       {item.ratio}x
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <p className="text-slate-300 font-black uppercase tracking-[0.2em]">Kayıt bulunamadı.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Sıralanabilir Başlık Bileşeni
const SortableHeader = ({ label, sortKey, currentSort, onSort, center, highlight }: { 
  label: string, 
  sortKey: SortKey, 
  currentSort: { key: SortKey, direction: SortDirection }, 
  onSort: (key: SortKey) => void,
  center?: boolean,
  highlight?: boolean
}) => {
  const isActive = currentSort.key === sortKey;
  
  return (
    <th 
      className={`px-8 py-5 cursor-pointer select-none group/header ${center ? 'text-center' : 'text-left'} transition-colors hover:bg-slate-100/50`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`inline-flex items-center gap-2 ${center ? 'justify-center' : ''} ${highlight ? 'text-rose-600' : 'text-slate-400'}`}>
        <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
        <div className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-50'}`}>
          {isActive && currentSort.direction === 'asc' ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>
    </th>
  );
};

export default ServiceInterventionAnalysis;
