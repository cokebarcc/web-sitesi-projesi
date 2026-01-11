
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line } from 'recharts';
import { AppointmentData, HBYSData } from '../types';
import { MONTHS, YEARS } from '../constants';

interface DashboardProps {
  selectedBranch: string | null;
  appointmentData: AppointmentData[];
  hbysData: HBYSData[];
}

const CustomizedAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={4} 
        textAnchor="end" 
        fill="#475569" 
        fontSize={10} 
        fontWeight={800} 
        transform="rotate(-90)"
      >
        {payload.value}
      </text>
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ selectedBranch, appointmentData, hbysData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Aralık');
  const [selectedYear, setSelectedYear] = useState<number>(2025);

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\./g, '');
  };

  const filteredAppointments = useMemo(() => 
    appointmentData.filter(d => 
      d.month === selectedMonth && 
      d.year === selectedYear &&
      (!selectedBranch || d.specialty === selectedBranch)
    ),
    [appointmentData, selectedMonth, selectedYear, selectedBranch]
  );

  const filteredHbys = useMemo(() => 
    hbysData.filter(d => 
      d.month === selectedMonth && 
      d.year === selectedYear &&
      (!selectedBranch || d.specialty === selectedBranch)
    ),
    [hbysData, selectedMonth, selectedYear, selectedBranch]
  );

  const doctorList = useMemo(() => {
    // Branş seçili değilse tüm hekimleri, seçiliyse zaten filteredAppointments içinde sadece o branş var
    const docs = Array.from(new Set(
      filteredAppointments.map(a => `${a.doctorName}|${a.specialty}`)
    )).map((id: string) => {
      // Fix: Added explicit type annotation (id: string) to resolve the 'unknown' type error for split()
      const [name, specialty] = id.split('|');
      return { name, specialty };
    });

    return docs.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  }, [filteredAppointments]);

  const baseData = useMemo(() => {
    return doctorList.map(doc => {
      const normalizedName = normalizeStr(doc.name);
      
      const docAppts = filteredAppointments.filter(a => normalizeStr(a.doctorName) === normalizedName);
      const docHbysRecords = filteredHbys.filter(h => normalizeStr(h.doctorName) === normalizedName);
      
      const planCapacity = docAppts.reduce((acc, curr) => acc + (curr.totalSlots || 0), 0);
      const actualExams = docHbysRecords.reduce((acc, curr) => acc + (curr.totalExams || 0), 0);
      
      const planSurgeryDays = docAppts.filter(a => normalizeStr(a.actionType).includes('ameliyat')).reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
      const actualSurgeryABC = docHbysRecords.reduce((acc, curr) => acc + (curr.surgeryABC || 0), 0);
      
      const usageRate = planCapacity > 0 ? (actualExams / planCapacity) : 0;
      const surgeryEfficiency = planSurgeryDays > 0 ? (actualSurgeryABC / planSurgeryDays) : 0;

      return {
        name: doc.name,
        specialty: doc.specialty,
        PlanMuayene: planCapacity,
        GercekMuayene: actualExams,
        UsageRate: usageRate,
        UsageRatePercent: Math.round(usageRate * 100),
        PlanSurgeryDays: planSurgeryDays,
        ActualSurgeryABC: actualSurgeryABC,
        SurgeryEfficiency: parseFloat(surgeryEfficiency.toFixed(2))
      };
    });
  }, [doctorList, filteredAppointments, filteredHbys]);

  const capacityUsageData = useMemo(() => {
    return baseData
      .filter(d => d.PlanMuayene > 0)
      .sort((a, b) => a.UsageRate - b.UsageRate);
  }, [baseData]);

  const surgeryEfficiencyData = useMemo(() => {
    return baseData
      .filter(d => d.PlanSurgeryDays > 0 || d.ActualSurgeryABC > 0)
      .sort((a, b) => b.SurgeryEfficiency - a.SurgeryEfficiency);
  }, [baseData]);

  const totalCapacity = capacityUsageData.reduce((acc, curr) => acc + curr.PlanMuayene, 0);
  const totalActualExams = capacityUsageData.reduce((acc, curr) => acc + curr.GercekMuayene, 0);
  const totalSurgeryDays = surgeryEfficiencyData.reduce((acc, curr) => acc + curr.PlanSurgeryDays, 0);
  const totalSurgeryABC = surgeryEfficiencyData.reduce((acc, curr) => acc + curr.ActualSurgeryABC, 0);

  const getCapacityColor = (rate: number) => {
    if (rate < 1.0) return '#e11d48'; 
    if (rate >= 1.20) return '#059669'; 
    return '#f59e0b'; 
  };

  const branchSurgeryAverage = useMemo(() => {
    return totalSurgeryDays > 0 ? totalSurgeryABC / totalSurgeryDays : 0;
  }, [totalSurgeryABC, totalSurgeryDays]);

  // Eğer hiç veri yoksa gösterilecek boş ekran
  if (appointmentData.length === 0) {
    return (
      <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-200 text-center">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">Analiz İçin Veri Bekleniyor</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">Lütfen önce Cetveller modülünden plânlanmış çalışma verilerini yükleyiniz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
             {selectedBranch ? `${selectedBranch} Analiz Raporu` : 'Tüm Hastane Analiz Raporu'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {selectedMonth} {selectedYear} DÖNEMİ • {capacityUsageData.length} HEKİM TAKİBİ
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
           <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 rounded-xl text-[10px] font-black bg-slate-50 outline-none">
             {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
           </select>
           <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-3 py-2 rounded-xl text-[10px] font-black bg-slate-900 text-white outline-none">
             {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="PLANLANAN MHRS" value={totalCapacity} color="blue" subtitle={`${selectedMonth} ${selectedYear} Toplam`} />
        <StatCard title="GERÇEKLEŞEN MUAYENE" value={totalActualExams} color="amber" subtitle={`Hastane Verimliliği: %${totalCapacity > 0 ? Math.round((totalActualExams/totalCapacity)*100) : 0}`} />
        <StatCard title="PLAN. AMELİYAT GÜN" value={totalSurgeryDays} color="purple" subtitle="Tahsis Edilen Blok Günler" />
        <StatCard title="TOPLAM ABC VAKA" value={totalSurgeryABC} color="emerald" subtitle={`Cerrahi Ort: ${branchSurgeryAverage.toFixed(1)} vaka/gün`} />
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 h-[700px]">
         <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
           <h4 className="text-xl font-black text-slate-900 uppercase">Kapasite Kullanım Analizi</h4>
           <div className="flex items-center gap-4 flex-wrap justify-center">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#e11d48] rounded"></div><span className="text-[10px] font-black uppercase text-slate-400">Kapasite Altı</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#f59e0b] rounded"></div><span className="text-[10px] font-black uppercase text-slate-400">Beklenen</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#059669] rounded"></div><span className="text-[10px] font-black uppercase text-slate-400">Kapasite Üstü</span></div>
           </div>
         </div>
         <ResponsiveContainer width="100%" height="90%">
           <BarChart data={capacityUsageData} margin={{ bottom: 140 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
             <XAxis 
               dataKey="name" 
               interval={0} 
               height={140}
               tick={<CustomizedAxisTick />} 
             />
             <YAxis fontSize={10} axisLine={false} tickLine={false} />
             <Tooltip 
                cursor={{fill: '#f8fafc'}} 
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                labelStyle={{ fontWeight: '900', marginBottom: '5px' }}
                formatter={(value: any, name: string, props: any) => {
                  const info = [value];
                  if (name === "PlanMuayene") info.push(" (Cetvel)");
                  if (name === "GercekMuayene") info.push(" (Fiili)");
                  return [value, name === "PlanMuayene" ? "Cetvel Kapasitesi" : "Gerçekleşen Muayene"];
                }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100">
                        <p className="font-black text-slate-900 mb-1">{label}</p>
                        <p className="text-[9px] font-black text-blue-600 uppercase mb-3">{data.specialty}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-500">Plan: <span className="text-slate-900">{data.PlanMuayene}</span></p>
                          <p className="text-xs font-bold text-slate-500">Fiili: <span className="text-slate-900">{data.GercekMuayene}</span></p>
                          <p className="text-xs font-black text-emerald-600 mt-2">Verim: %{data.UsageRatePercent}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
             />
             <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold'}} />
             <Bar name="Kapasite" dataKey="PlanMuayene" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={20} />
             <Bar name="Muayene" dataKey="GercekMuayene" radius={[6, 6, 0, 0]} barSize={20}>
                {capacityUsageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCapacityColor(entry.UsageRate)} />
                ))}
             </Bar>
           </BarChart>
         </ResponsiveContainer>
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-emerald-50 h-[750px]">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cerrahi Verimlilik Matrisi</h4>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Kurum Ortalaması: {branchSurgeryAverage.toFixed(1)} Vaka/Gün</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#3b82f6] rounded"></div><span className="text-[10px] font-black uppercase text-slate-400">Plan Dışı Giriş</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ef4444] rounded"></div><span className="text-[10px] font-black uppercase text-slate-400">Ortalama Altı</span></div>
             <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Performans Kıyas</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart data={surgeryEfficiencyData} margin={{ bottom: 140 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              interval={0} 
              height={140}
              tick={<CustomizedAxisTick />} 
            />
            <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{fill: '#f0fdf4'}} 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100">
                      <p className="font-black text-slate-900 mb-1">{label}</p>
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-3">{data.specialty}</p>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-500">Plan (Gün): <span className="text-slate-900">{data.PlanSurgeryDays}</span></p>
                        <p className="text-xs font-bold text-slate-500">Vaka (Adet): <span className="text-slate-900">{data.ActualSurgeryABC}</span></p>
                        <p className="text-xs font-black text-rose-600 mt-2">Günlük Ort: {data.SurgeryEfficiency}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold'}} />
            <Bar yAxisId="left" name="Ameliyat Günü (Plan)" dataKey="PlanSurgeryDays" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={15} />
            <Bar yAxisId="left" name="Ameliyat Sayısı (Vaka)" dataKey="ActualSurgeryABC" radius={[4, 4, 0, 0]} barSize={15}>
              {surgeryEfficiencyData.map((entry, index) => {
                const isUnplanned = entry.PlanSurgeryDays === 0 && entry.ActualSurgeryABC > 0;
                const isBelowAverage = entry.SurgeryEfficiency < branchSurgeryAverage;
                
                let barColor = '#10b981'; 
                if (isUnplanned) barColor = '#3b82f6'; 
                else if (isBelowAverage) barColor = '#ef4444'; 
                
                return <Cell key={`cell-surg-${index}`} fill={barColor} />;
              })}
            </Bar>
            <Line 
              yAxisId="right" 
              name="Verimlilik (Vaka/Gün)" 
              type="monotone" 
              dataKey="SurgeryEfficiency" 
              stroke="#ef4444" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#ef4444' }} 
              activeDot={{ r: 6 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, subtitle }: any) => {
  const getLabelColor = (c: string) => {
    if (c === 'blue') return 'text-blue-600';
    if (c === 'amber') return 'text-amber-600';
    if (c === 'purple') return 'text-purple-600';
    if (c === 'emerald') return 'text-emerald-600';
    return 'text-slate-900';
  };
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className={`text-3xl font-black ${getLabelColor(color)}`}>{value.toLocaleString('tr-TR')}</h3>
      <p className="text-[10px] font-bold text-slate-400 mt-2">{subtitle}</p>
    </div>
  );
};

export default Dashboard;
