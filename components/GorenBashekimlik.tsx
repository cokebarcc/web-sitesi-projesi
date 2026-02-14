
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface CityScore {
  city: string;
  totalScore: number;
  achievementRate: number;
  indicatorScores: { [key: string]: number };
  rank?: number;
}

interface IndicatorMeta {
  code: string;
  maxPossible: number;
  average: number;
}

const GorenBashekimlik: React.FC = () => {
  const [cityResults, setCityResults] = useState<CityScore[]>([]);
  const [indicatorMeta, setIndicatorMeta] = useState<IndicatorMeta[]>([]);
  const [activeTab, setActiveTab] = useState<'ranking' | 'comparison'>('ranking');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsLoading(true);
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (rawData.length < 2) throw new Error("Yetersiz veri");

        const headers = rawData[0].map(h => String(h || ""));
        const rows = rawData.slice(1);

        // Gösterge bazlı analiz (Maksimum ve Ortalama hesabı)
        const meta: IndicatorMeta[] = headers.slice(1).map((code, idx) => {
          const colIdx = idx + 1;
          const values = rows.map(r => {
            const val = parseFloat(String(r[colIdx]).replace(',', '.')) || 0;
            return val;
          });
          const maxVal = Math.max(...values);
          const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
          return { code, maxPossible: maxVal || 3, average: avgVal };
        });
        setIndicatorMeta(meta);

        const totalPotential = meta.reduce((acc, curr) => acc + curr.maxPossible, 0);

        // İl bazlı hesaplamalar
        const results: CityScore[] = rows.map(row => {
          const cityName = String(row[0]).trim().toLocaleUpperCase('tr-TR');
          if (!cityName || cityName === "0" || cityName === "UNDEFINED") return null;

          const scores: { [key: string]: number } = {};
          let cityTotal = 0;

          headers.slice(1).forEach((code, idx) => {
            const val = parseFloat(String(row[idx + 1]).replace(',', '.')) || 0;
            scores[code] = val;
            cityTotal += val;
          });

          return {
            city: cityName,
            totalScore: parseFloat(cityTotal.toFixed(2)),
            achievementRate: totalPotential > 0 ? Math.round((cityTotal / totalPotential) * 100) : 0,
            indicatorScores: scores
          };
        }).filter((r): r is CityScore => r !== null);

        const sortedResults = results.sort((a, b) => b.totalScore - a.totalScore)
          .map((item, index) => ({ ...item, rank: index + 1 }));

        setCityResults(sortedResults);
        if (sortedResults.length > 0) setSelectedCityName(sortedResults[0].city);

      } catch (err) {
        alert("Excel dosyası işlenirken hata oluştu. Lütfen illerin satırda, göstergelerin sütunda olduğu formatı kullanın.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const selectedCity = useMemo(() => 
    cityResults.find(c => c.city === selectedCityName), 
    [cityResults, selectedCityName]
  );

  const radarData = useMemo(() => {
    if (!selectedCity) return [];
    return indicatorMeta.slice(0, 8).map(m => ({
      subject: m.code,
      A: selectedCity.indicatorScores[m.code] || 0,
      Full: m.maxPossible,
      Avg: m.average
    }));
  }, [selectedCity, indicatorMeta]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Üst Panel: Başlık ve Yükleme */}
      <div className="bg-white p-10 rounded-[48px] shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6" style={{ borderColor: 'var(--border-2)' }}>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase" style={{ color: 'var(--text-1)' }}>GÖREN Başarı Sıralaması</h2>
          <p className="font-bold uppercase text-[10px] tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>İller Arası Stratejik Performans Kıyaslama</p>
        </div>
        <label className="text-white px-10 py-5 rounded-3xl font-black text-xs shadow-xl cursor-pointer transition-all active:scale-95 flex items-center gap-3" style={{ background: 'var(--bg-app)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          MATRİS EXCEL YÜKLE
          <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </label>
      </div>

      {cityResults.length > 0 ? (
        <div className="space-y-12">
          {/* Podyum: İlk 3 İl */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <PodiumCard rank={2} data={cityResults[1]} color="" cardStyle={{ background: 'var(--surface-2)', color: 'var(--text-2)' }} />
            <PodiumCard rank={1} data={cityResults[0]} color="bg-amber-100 text-amber-700" isWinner />
            <PodiumCard rank={3} data={cityResults[2]} color="bg-rose-50 text-rose-700" />
          </div>

          {/* Ana İçerik Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sol: Liderlik Tablosu */}
            <div className="lg:col-span-7 bg-white rounded-[48px] shadow-xl border overflow-hidden" style={{ borderColor: 'var(--border-2)' }}>
              <div className="p-8 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-3)' }}>
                <h3 className="text-xl font-black uppercase" style={{ color: 'var(--text-1)' }}>Tüm İller Sıralaması</h3>
                <span className="text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest" style={{ background: 'var(--bg-app)' }}>{cityResults.length} İL ANALİZ EDİLDİ</span>
              </div>
              <div className="overflow-y-auto max-h-[700px] custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-3)' }}>
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>SIRA</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>İL ADI</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>TOPLAM PUAN</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>BAŞARI %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-2)' }}>
                    {cityResults.map((res) => (
                      <tr
                        key={res.city}
                        onClick={() => setSelectedCityName(res.city)}
                        className={`cursor-pointer transition-all ${selectedCityName === res.city ? 'bg-blue-50/50' : ''}`}
                        onMouseEnter={(e) => { if (selectedCityName !== res.city) e.currentTarget.style.background = 'var(--surface-3)' }}
                        onMouseLeave={(e) => { if (selectedCityName !== res.city) e.currentTarget.style.background = '' }}
                      >
                        <td className="px-8 py-5 text-center">
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                            style={res.rank! <= 3
                              ? { background: 'var(--bg-app)', color: '#fff' }
                              : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                          >
                            {res.rank}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-black uppercase text-sm" style={{ color: 'var(--text-1)' }}>{res.city}</p>
                        </td>
                        <td className="px-8 py-5 text-center font-bold" style={{ color: 'var(--text-2)' }}>{res.totalScore}</td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                             <span className={`text-xs font-black ${res.achievementRate >= 80 ? 'text-emerald-600' : res.achievementRate >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                               %{res.achievementRate}
                             </span>
                             <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                <div className={`h-full ${res.achievementRate >= 80 ? 'bg-emerald-500' : res.achievementRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${res.achievementRate}%` }}></div>
                             </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sağ: Detaylı Analiz Kartı */}
            <div className="lg:col-span-5 space-y-8">
              {selectedCity ? (
                <div className="p-12 rounded-[56px] shadow-2xl relative overflow-hidden sticky top-10" style={{ background: 'var(--bg-app)', color: 'var(--text-1)' }}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">İL PERFORMANS KARNESİ</p>
                        <h3 className="text-4xl font-black tracking-tighter uppercase">{selectedCity.city}</h3>
                      </div>
                      <div className="bg-white/10 px-6 py-4 rounded-3xl border border-white/10 text-center">
                        <p className="text-[10px] font-black uppercase mb-1" style={{ color: 'var(--text-3)' }}>GENEL SIRA</p>
                        <p className="text-3xl font-black" style={{ color: 'var(--text-1)' }}>#{selectedCity.rank}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-12">
                       <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-3)' }}>TOPLAM PUAN</p>
                          <p className="text-3xl font-black text-emerald-400">{selectedCity.totalScore}</p>
                       </div>
                       <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-[9px] font-black uppercase mb-2" style={{ color: 'var(--text-3)' }}>BAŞARI ORANI</p>
                          <p className="text-3xl font-black text-amber-400">%{selectedCity.achievementRate}</p>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <h4 className="text-xs font-black uppercase tracking-widest border-b border-white/10 pb-4" style={{ color: 'var(--text-3)' }}>GÖSTERGE BAZLI KIYASLAMA</h4>
                       <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                              <PolarGrid stroke="#334155" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                              <PolarRadiusAxis angle={30} domain={[0, 3]} tick={false} axisLine={false} />
                              <Radar name={selectedCity.city} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                              <Radar name="Türkiye Ort." dataKey="Avg" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                            </RadarChart>
                          </ResponsiveContainer>
                       </div>
                       <div className="flex justify-center gap-6 mt-4">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-blue-500 rounded"></div>
                             <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-3)' }}>İL PUANI</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-amber-500 rounded opacity-50"></div>
                             <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-3)' }}>TR ORTALAMASI</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-20 rounded-[48px] border-2 border-dashed text-center" style={{ borderColor: 'var(--border-2)' }}>
                  <p className="font-bold italic" style={{ color: 'var(--text-3)' }}>Detaylı analiz için sıralamadan bir il seçiniz.</p>
                </div>
              )}
            </div>
          </div>

          {/* Görsel Kıyaslama Grafiği */}
          <div className="bg-white p-12 rounded-[56px] shadow-xl border" style={{ borderColor: 'var(--border-2)' }}>
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black uppercase" style={{ color: 'var(--text-1)' }}>İL BAZLI GENEL BAŞARI DAĞILIMI</h3>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                      <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>YÜKSEK BAŞARI</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-rose-500 rounded"></div>
                      <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>GELİŞTİRİLMELİ</span>
                   </div>
                </div>
             </div>
             <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={cityResults.slice(0, 30)} margin={{ bottom: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="city" angle={-45} textAnchor="end" fontSize={10} fontWeight={900} interval={0} tick={{fill: '#475569'}} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                      />
                      <Bar name="Toplam Puan" dataKey="totalScore" radius={[10, 10, 0, 0]} barSize={40}>
                        {cityResults.slice(0, 30).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.achievementRate >= 80 ? '#10b981' : entry.achievementRate >= 60 ? '#6366f1' : '#ef4444'} />
                        ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-32 rounded-[56px] border-2 border-dashed text-center flex flex-col items-center gap-8" style={{ borderColor: 'var(--border-2)' }}>
           <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Matris Verisi Bekleniyor</h4>
             <p className="font-medium max-w-md mx-auto mt-2 italic" style={{ color: 'var(--text-3)' }}>Görselde paylaştığınız; İllerin satırlarda, göstergelerin sütunlarda olduğu Excel tablosunu yükleyiniz.</p>
           </div>
        </div>
      )}
    </div>
  );
};

const PodiumCard = ({ rank, data, color, cardStyle, isWinner }: { rank: number; data: CityScore; color: string; cardStyle?: React.CSSProperties; isWinner?: boolean }) => {
  if (!data) return null;
  return (
    <div className={`relative flex flex-col items-center p-8 rounded-[48px] shadow-lg border transition-all hover:scale-105 ${isWinner ? 'scale-110 ring-4 ring-amber-400/30' : ''} ${color}`} style={cardStyle}>
       <div
         className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl mb-4 shadow-inner ${isWinner ? 'bg-amber-400 text-white' : 'bg-white'}`}
         style={!isWinner ? { color: 'var(--text-3)' } : undefined}
       >
          {rank}
       </div>
       <h4 className="text-xl font-black uppercase mb-1">{data.city}</h4>
       <p className="text-[10px] font-black uppercase opacity-60 mb-4 tracking-widest">SIRALAMA: {rank}</p>
       <div className="text-center">
          <p className="text-2xl font-black leading-none">{data.totalScore}</p>
          <p className="text-[9px] font-black opacity-50 uppercase mt-1">TOPLAM PUAN</p>
       </div>
       <div className="mt-6 bg-white/50 px-6 py-2 rounded-full">
          <span className="text-xs font-black">%{data.achievementRate} BAŞARI</span>
       </div>
       {isWinner && (
         <div className="absolute -top-4 -right-4 bg-amber-400 text-white p-3 rounded-2xl shadow-xl animate-bounce">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
         </div>
       )}
    </div>
  );
};

export default GorenBashekimlik;
