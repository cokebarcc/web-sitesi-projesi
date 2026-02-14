
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line } from 'recharts';
import { AppointmentData, HBYSData } from '../types';
import { MONTHS, YEARS } from '../constants';
import DataFilterPanel from './common/DataFilterPanel';

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
        fill="#64748b"
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
  const [selectedYears, setSelectedYears] = useState<number[]>([2025]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([12]); // 12 = Aralık
  const [appliedYears, setAppliedYears] = useState<number[]>([2025]);
  const [appliedMonths, setAppliedMonths] = useState<number[]>([12]);

  // Uygulanmış filtreler için string formatı
  const selectedMonth = appliedMonths.length > 0 ? MONTHS[appliedMonths[0] - 1] : '';
  const selectedYear = appliedYears.length > 0 ? appliedYears[0] : 0;

  // Mevcut yıllar
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    appointmentData.forEach(d => years.add(d.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [appointmentData]);

  // Seçili yıllara göre mevcut aylar
  const availableMonths = useMemo(() => {
    if (selectedYears.length === 0) return [];
    const months = new Set<number>();
    appointmentData
      .filter(d => selectedYears.includes(d.year))
      .forEach(d => {
        const monthIndex = MONTHS.indexOf(d.month) + 1;
        if (monthIndex > 0) months.add(monthIndex);
      });
    return Array.from(months).sort((a, b) => a - b);
  }, [appointmentData, selectedYears]);

  const handleApply = () => {
    setAppliedYears([...selectedYears]);
    setAppliedMonths([...selectedMonths]);
  };

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\./g, '');
  };

  const filteredAppointments = useMemo(() =>
    appointmentData.filter(d => {
      const monthIndex = MONTHS.indexOf(d.month) + 1;
      return appliedMonths.includes(monthIndex) &&
        appliedYears.includes(d.year) &&
        (!selectedBranch || d.specialty === selectedBranch);
    }),
    [appointmentData, appliedMonths, appliedYears, selectedBranch]
  );

  const filteredHbys = useMemo(() =>
    hbysData.filter(d => {
      const monthIndex = MONTHS.indexOf(d.month) + 1;
      return appliedMonths.includes(monthIndex) &&
        appliedYears.includes(d.year) &&
        (!selectedBranch || d.specialty === selectedBranch);
    }),
    [hbysData, appliedMonths, appliedYears, selectedBranch]
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
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-20 rounded-[40px] border-2 border-dashed border-[var(--border-2)] text-center">
        <h3 className="text-2xl font-black text-[var(--text-1)] tracking-tight italic">Analiz İçin Veri Bekleniyor</h3>
        <p className="text-[var(--text-muted)] mt-2 max-w-sm mx-auto">Lütfen önce Cetveller modülünden plânlanmış çalışma verilerini yükleyiniz.</p>
      </div>
    );
  }

  // Dönem açıklaması için metin
  const periodText = useMemo(() => {
    if (appliedMonths.length === 0 || appliedYears.length === 0) return 'Dönem seçilmedi';
    const monthNames = appliedMonths.map(m => MONTHS[m - 1]).join(', ');
    const yearNames = appliedYears.join(', ');
    return `${monthNames} ${yearNames}`;
  }, [appliedMonths, appliedYears]);

  return (
    <div className="space-y-6 pb-20">
      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Veri Filtreleme"
        showYearFilter={true}
        selectedYears={selectedYears}
        availableYears={availableYears.length > 0 ? availableYears : YEARS}
        onYearsChange={setSelectedYears}
        showMonthFilter={true}
        selectedMonths={selectedMonths}
        availableMonths={availableMonths}
        onMonthsChange={setSelectedMonths}
        showApplyButton={true}
        onApply={handleApply}
        applyDisabled={selectedYears.length === 0 || selectedMonths.length === 0}
        selectionCount={appliedMonths.length * appliedYears.length}
        selectionLabel="dönem seçili"
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-1)] tracking-tight flex items-center gap-3">
             <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
             {selectedBranch ? `${selectedBranch} Analiz Raporu` : 'Tüm Hastane Analiz Raporu'}
          </h2>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
            {periodText} DÖNEMİ • {capacityUsageData.length} HEKİM TAKİBİ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="PLANLANAN MHRS" value={totalCapacity} color="blue" subtitle={`${selectedMonth} ${selectedYear} Toplam`} />
        <StatCard title="GERÇEKLEŞEN MUAYENE" value={totalActualExams} color="amber" subtitle={`Hastane Verimliliği: %${totalCapacity > 0 ? Math.round((totalActualExams/totalCapacity)*100) : 0}`} />
        <StatCard title="PLAN. AMELİYAT GÜN" value={totalSurgeryDays} color="purple" subtitle="Tahsis Edilen Blok Günler" />
        <StatCard title="TOPLAM ABC VAKA" value={totalSurgeryABC} color="emerald" subtitle={`Cerrahi Ort: ${branchSurgeryAverage.toFixed(1)} vaka/gün`} />
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[40px] shadow-xl border border-[var(--glass-border)] h-[700px]">
         <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
           <h4 className="text-xl font-black text-[var(--text-1)] uppercase">Kapasite Kullanım Analizi</h4>
           <div className="flex items-center gap-4 flex-wrap justify-center">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#e11d48] rounded"></div><span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Kapasite Altı</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#f59e0b] rounded"></div><span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Beklenen</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#059669] rounded"></div><span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Kapasite Üstü</span></div>
           </div>
         </div>
         <ResponsiveContainer width="100%" height="90%">
           <BarChart data={capacityUsageData} margin={{ bottom: 140 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
             <XAxis
               dataKey="name"
               interval={0}
               height={140}
               tick={<CustomizedAxisTick />}
             />
             <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
             <Tooltip
                cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
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
                      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-[var(--glass-border-light)]">
                        <p className="font-black text-[var(--text-1)] mb-1">{label}</p>
                        <p className="text-[9px] font-black status-info uppercase mb-3">{data.specialty}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[var(--text-muted)]">Plan: <span className="text-[var(--text-1)]">{data.PlanMuayene}</span></p>
                          <p className="text-xs font-bold text-[var(--text-muted)]">Fiili: <span className="text-[var(--text-1)]">{data.GercekMuayene}</span></p>
                          <p className="text-xs font-black status-success mt-2">Verim: %{data.UsageRatePercent}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
             />
             <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8'}} />
             <Bar name="Kapasite" dataKey="PlanMuayene" fill="#475569" radius={[6, 6, 0, 0]} barSize={20} />
             <Bar name="Muayene" dataKey="GercekMuayene" radius={[6, 6, 0, 0]} barSize={20}>
                {capacityUsageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCapacityColor(entry.UsageRate)} />
                ))}
             </Bar>
           </BarChart>
         </ResponsiveContainer>
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[40px] shadow-xl border border-[var(--glass-border)] h-[750px]">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h4 className="text-xl font-black text-[var(--text-1)] uppercase tracking-tight">Cerrahi Verimlilik Matrisi</h4>
            <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">Kurum Ortalaması: {branchSurgeryAverage.toFixed(1)} Vaka/Gün</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#3b82f6] rounded"></div><span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Plan Dışı Giriş</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ef4444] rounded"></div><span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Ortalama Altı</span></div>
             <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Performans Kıyas</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart data={surgeryEfficiencyData} margin={{ bottom: 140 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              interval={0}
              height={140}
              tick={<CustomizedAxisTick />}
            />
            <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <Tooltip
              cursor={{fill: 'rgba(16, 185, 129, 0.1)'}}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-[var(--glass-border-light)]">
                      <p className="font-black text-[var(--text-1)] mb-1">{label}</p>
                      <p className="text-[9px] font-black status-success uppercase mb-3">{data.specialty}</p>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-[var(--text-muted)]">Plan (Gün): <span className="text-[var(--text-1)]">{data.PlanSurgeryDays}</span></p>
                        <p className="text-xs font-bold text-[var(--text-muted)]">Vaka (Adet): <span className="text-[var(--text-1)]">{data.ActualSurgeryABC}</span></p>
                        <p className="text-xs font-black text-rose-400 mt-2">Günlük Ort: {data.SurgeryEfficiency}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8'}} />
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
    if (c === 'blue') return 'status-info';
    if (c === 'amber') return 'status-warning';
    if (c === 'purple') return 'status-accent';
    if (c === 'emerald') return 'status-success';
    return 'text-[var(--text-1)]';
  };
  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-[var(--glass-border)]">
      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className={`text-3xl font-black ${getLabelColor(color)}`}>{value.toLocaleString('tr-TR')}</h3>
      <p className="text-[10px] font-bold text-[var(--text-muted)] mt-2">{subtitle}</p>
    </div>
  );
};

export default Dashboard;
