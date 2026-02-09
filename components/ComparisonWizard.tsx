import React, { useState, useMemo, useCallback } from 'react';
import { HOSPITALS, MONTHS } from '../constants';
import { DetailedScheduleData, MuayeneMetrics } from '../types';

interface ComparisonWizardProps {
  theme?: 'dark' | 'light';
  selectedHospital: string;
}

interface PeriodSelection {
  hospital: string;
  year: number;
  month: number;
}

interface PeriodData {
  scheduleData: DetailedScheduleData[];
  uniquePhysicians: number;
  totalCapacity: number;
  actionDist: Record<string, number>;
  totalMhrs: number;
  totalAyaktan: number;
  totalMuayene: number;
  totalAmeliyat: number;
  hasData: boolean;
}

const emptyPeriodData: PeriodData = {
  scheduleData: [],
  uniquePhysicians: 0,
  totalCapacity: 0,
  actionDist: {},
  totalMhrs: 0,
  totalAyaktan: 0,
  totalMuayene: 0,
  totalAmeliyat: 0,
  hasData: false,
};

type ComparisonMetric = 'capacity' | 'physicians' | 'actions' | 'muayene' | 'ameliyat';

const YEARS = [2024, 2025, 2026, 2027];

const ComparisonWizard: React.FC<ComparisonWizardProps> = ({
  theme = 'dark',
  selectedHospital,
}) => {
  const isDark = theme === 'dark';
  const [step, setStep] = useState(1);
  const [periodA, setPeriodA] = useState<PeriodSelection>({
    hospital: selectedHospital || '',
    year: 2025,
    month: 1,
  });
  const [periodB, setPeriodB] = useState<PeriodSelection>({
    hospital: selectedHospital || '',
    year: 2025,
    month: 2,
  });
  const [selectedMetrics, setSelectedMetrics] = useState<ComparisonMetric[]>(['capacity', 'physicians', 'muayene']);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataA, setDataA] = useState<PeriodData>(emptyPeriodData);
  const [dataB, setDataB] = useState<PeriodData>(emptyPeriodData);
  const [loadError, setLoadError] = useState<string | null>(null);

  const allMetrics: { key: ComparisonMetric; label: string; icon: string }[] = [
    { key: 'capacity', label: 'Kapasite', icon: '📊' },
    { key: 'physicians', label: 'Hekim Sayısı', icon: '👨‍⚕️' },
    { key: 'actions', label: 'Aksiyon Dağılımı', icon: '📋' },
    { key: 'muayene', label: 'Muayene Verileri', icon: '🏥' },
    { key: 'ameliyat', label: 'Ameliyat Verileri', icon: '🔬' },
  ];

  const toggleMetric = useCallback((metric: ComparisonMetric) => {
    setSelectedMetrics(prev =>
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  }, []);

  // Load data from Firebase for a single period
  const loadPeriodFromFirebase = async (period: PeriodSelection): Promise<PeriodData> => {
    const monthName = MONTHS[period.month - 1];

    // Load detailed schedule data
    const { loadAllDetailedScheduleData } = await import('../src/services/detailedScheduleStorage');
    const scheduleData = await loadAllDetailedScheduleData(period.hospital, monthName, period.year);

    // Unique physicians & capacity
    const uniquePhysicians = new Set(scheduleData.map(d => d.doctorName));
    const totalCapacity = scheduleData.reduce((sum, d) => sum + (d.capacity || 0), 0);

    // Action distribution
    const actionDist: Record<string, number> = {};
    scheduleData.forEach(d => {
      const action = d.action || 'Diğer';
      actionDist[action] = (actionDist[action] || 0) + 1;
    });

    // Load muayene data
    const { loadAllMuayeneData, loadAllAmeliyatData } = await import('../src/services/physicianDataStorage');
    const muayeneResult = await loadAllMuayeneData(period.hospital, monthName, period.year);
    let totalMhrs = 0, totalAyaktan = 0, totalMuayene = 0;
    // muayeneResult is keyed as "hospital-year-MM" -> doctor -> metrics
    Object.values(muayeneResult).forEach(doctorMap => {
      Object.values(doctorMap).forEach(metrics => {
        totalMhrs += metrics.mhrs;
        totalAyaktan += metrics.ayaktan;
        totalMuayene += metrics.toplam;
      });
    });

    // Load ameliyat data
    const ameliyatResult = await loadAllAmeliyatData(period.hospital, monthName, period.year);
    let totalAmeliyat = 0;
    Object.values(ameliyatResult).forEach(doctorMap => {
      Object.values(doctorMap).forEach(val => {
        totalAmeliyat += val;
      });
    });

    const hasData = scheduleData.length > 0 || totalMuayene > 0 || totalAmeliyat > 0;

    return {
      scheduleData,
      uniquePhysicians: uniquePhysicians.size,
      totalCapacity,
      actionDist,
      totalMhrs,
      totalAyaktan,
      totalMuayene,
      totalAmeliyat,
      hasData,
    };
  };

  // Load both periods from Firebase
  const loadComparisonData = async () => {
    setIsLoadingData(true);
    setLoadError(null);
    try {
      const [resultA, resultB] = await Promise.all([
        loadPeriodFromFirebase(periodA),
        loadPeriodFromFirebase(periodB),
      ]);
      setDataA(resultA);
      setDataB(resultB);
      if (!resultA.hasData && !resultB.hasData) {
        setLoadError('Seçili dönemler için Firebase\'de veri bulunamadı.');
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      setLoadError('Veri yüklenirken hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const getDelta = (a: number, b: number) => {
    if (a === 0 && b === 0) return { value: 0, percent: 0 };
    const value = b - a;
    const percent = a > 0 ? ((b - a) / a) * 100 : b > 0 ? 100 : 0;
    return { value, percent };
  };

  const formatDelta = (delta: { value: number; percent: number }) => {
    const sign = delta.value > 0 ? '+' : '';
    return {
      text: `${sign}${delta.value.toLocaleString('tr-TR')}`,
      percentText: `${sign}${delta.percent.toFixed(1)}%`,
      color: delta.value > 0 ? 'text-emerald-400' : delta.value < 0 ? 'text-red-400' : 'text-slate-400',
      bgColor: delta.value > 0 ? 'bg-emerald-500/10' : delta.value < 0 ? 'bg-red-500/10' : 'bg-slate-500/10',
    };
  };

  // All unique actions across both periods
  const allActions = useMemo(() => {
    const actions = new Set<string>();
    Object.keys(dataA.actionDist).forEach(a => actions.add(a));
    Object.keys(dataB.actionDist).forEach(a => actions.add(a));
    return Array.from(actions).sort();
  }, [dataA, dataB]);

  const canProceed = () => {
    if (step === 1) return periodA.hospital && periodB.hospital;
    if (step === 2) return selectedMetrics.length > 0;
    return true;
  };

  // Handle step transition - load data when going to step 3
  const handleNext = async () => {
    if (!canProceed()) return;
    if (step === 2) {
      await loadComparisonData();
      setStep(3);
    } else {
      setStep(step + 1);
    }
  };

  const selectClass = `w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${
    isDark
      ? 'bg-[#0f1729]/80 text-white border border-[#2d4163]/40 focus:border-[#5b9cff]/50'
      : 'bg-white text-slate-800 border border-slate-200 focus:border-blue-400'
  }`;

  const renderPeriodSelector = (label: string, period: PeriodSelection, setPeriod: (p: PeriodSelection) => void, color: string) => (
    <div className={`flex-1 rounded-2xl p-5 border ${
      isDark ? 'bg-[#131d33]/60 border-[#2d4163]/30' : 'bg-white/80 border-slate-200/60'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</h4>
      </div>
      <div className="space-y-3">
        <div>
          <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hastane</label>
          <select
            value={period.hospital}
            onChange={e => setPeriod({ ...period, hospital: e.target.value })}
            className={selectClass}
          >
            <option value="">Seçiniz...</option>
            {HOSPITALS.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Yıl</label>
            <select
              value={period.year}
              onChange={e => setPeriod({ ...period, year: parseInt(e.target.value) })}
              className={selectClass}
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ay</label>
            <select
              value={period.month}
              onChange={e => setPeriod({ ...period, month: parseInt(e.target.value) })}
              className={selectClass}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderComparisonRow = (label: string, valueA: number, valueB: number, unit?: string) => {
    const delta = getDelta(valueA, valueB);
    const fmt = formatDelta(delta);
    return (
      <div key={label} className={`flex items-center justify-between py-3 px-4 rounded-xl ${
        isDark ? 'bg-[#0f1729]/40' : 'bg-slate-50/80'
      }`}>
        <span className={`text-sm font-medium w-1/4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
        <span className={`text-sm font-semibold w-1/5 text-center ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
          {valueA.toLocaleString('tr-TR')}{unit || ''}
        </span>
        <div className={`flex items-center justify-center gap-1 w-1/5 px-2 py-1 rounded-lg ${fmt.bgColor}`}>
          <span className={`text-xs font-bold ${fmt.color}`}>{fmt.text}</span>
          <span className={`text-[10px] ${fmt.color} opacity-70`}>({fmt.percentText})</span>
        </div>
        <span className={`text-sm font-semibold w-1/5 text-center ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
          {valueB.toLocaleString('tr-TR')}{unit || ''}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Veri Karşılaştırma
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          İki farklı dönemi karşılaştırarak değişimleri analiz edin
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s < step && setStep(s)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s === step
                  ? 'bg-[#5b9cff] text-white shadow-lg shadow-[#5b9cff]/30'
                  : s < step
                    ? isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer' : 'bg-emerald-100 text-emerald-600 cursor-pointer'
                    : isDark ? 'bg-[#1e2d4a]/50 text-slate-500 border border-[#2d4163]/30' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s < step ? '✓' : s}
            </button>
            <span className={`text-xs font-medium ${
              s === step ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-500' : 'text-slate-400')
            }`}>
              {s === 1 ? 'Dönem Seçimi' : s === 2 ? 'Metrikler' : 'Sonuçlar'}
            </span>
            {s < 3 && (
              <div className={`w-12 h-0.5 ${s < step ? 'bg-emerald-500/40' : isDark ? 'bg-[#2d4163]/30' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Period Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex gap-4">
            {renderPeriodSelector('Dönem A (Referans)', periodA, setPeriodA, 'bg-blue-500')}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isDark ? 'bg-[#1e2d4a] border border-[#2d4163]/40' : 'bg-slate-100 border border-slate-200'
              }`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
            {renderPeriodSelector('Dönem B (Karşılaştırma)', periodB, setPeriodB, 'bg-amber-500')}
          </div>

          {/* Quick Swap Button */}
          <div className="flex justify-center">
            <button
              onClick={() => { const tmp = { ...periodA }; setPeriodA({ ...periodB }); setPeriodB(tmp); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                isDark
                  ? 'bg-[#1e2d4a]/50 text-slate-400 hover:text-white hover:bg-[#1e2d4a] border border-[#2d4163]/30'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Dönemleri Değiştir
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Metric Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Karşılaştırmak istediğiniz metrikleri seçin:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allMetrics.map(metric => {
              const isSelected = selectedMetrics.includes(metric.key);
              return (
                <button
                  key={metric.key}
                  onClick={() => toggleMetric(metric.key)}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                    isSelected
                      ? isDark
                        ? 'bg-[#5b9cff]/10 border-[#5b9cff]/30 text-white'
                        : 'bg-blue-50 border-blue-300 text-blue-800'
                      : isDark
                        ? 'bg-[#131d33]/60 border-[#2d4163]/20 text-slate-400 hover:border-[#2d4163]/40'
                        : 'bg-white/80 border-slate-200/60 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{metric.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${isSelected ? (isDark ? 'text-white' : 'text-blue-800') : ''}`}>{metric.label}</p>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 ml-auto text-[#5b9cff]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingData && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex gap-1.5 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#5b9cff] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#38bdf8] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#5b9cff] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Firebase'den veriler yükleniyor...
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {periodA.hospital} ve {periodB.hospital} verileri karşılaştırılıyor
          </p>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && !isLoadingData && (
        <div className="space-y-6">
          {/* Period Labels */}
          <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${
            isDark ? 'bg-[#131d33]/80 border border-[#2d4163]/30' : 'bg-slate-50 border border-slate-200/60'
          }`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Metrik</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                {periodA.hospital} - {MONTHS[periodA.month - 1]} {periodA.year}
              </span>
            </div>
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fark</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className={`text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                {periodB.hospital} - {MONTHS[periodB.month - 1]} {periodB.year}
              </span>
            </div>
          </div>

          {/* Error or No Data Warning */}
          {(loadError || (!dataA.hasData && !dataB.hasData)) && (
            <div className={`text-center py-12 rounded-2xl border ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-slate-50 border-slate-200/40'
            }`}>
              <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {loadError || 'Seçili dönemler için veri bulunamadı'}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Lütfen veri yüklü dönemleri seçin veya önce MHRS modülünden veri yükleyin
              </p>
            </div>
          )}

          {/* Capacity Metrics */}
          {selectedMetrics.includes('capacity') && (dataA.hasData || dataB.hasData) && (
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-white/80 border-slate-200/40'
            }`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Kapasite</h3>
              </div>
              <div className="p-4 space-y-2">
                {renderComparisonRow('Toplam Kapasite', dataA.totalCapacity, dataB.totalCapacity)}
                {renderComparisonRow('Kayıt Sayısı', dataA.scheduleData.length, dataB.scheduleData.length)}
              </div>
            </div>
          )}

          {/* Physician Metrics */}
          {selectedMetrics.includes('physicians') && (dataA.hasData || dataB.hasData) && (
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-white/80 border-slate-200/40'
            }`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Hekim Bilgileri</h3>
              </div>
              <div className="p-4 space-y-2">
                {renderComparisonRow('Hekim Sayısı', dataA.uniquePhysicians, dataB.uniquePhysicians)}
              </div>
            </div>
          )}

          {/* Action Distribution */}
          {selectedMetrics.includes('actions') && allActions.length > 0 && (
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-white/80 border-slate-200/40'
            }`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Aksiyon Dağılımı</h3>
              </div>
              <div className="p-4 space-y-2">
                {allActions.map(action => (
                  renderComparisonRow(
                    action,
                    dataA.actionDist[action] || 0,
                    dataB.actionDist[action] || 0
                  )
                ))}
              </div>
            </div>
          )}

          {/* Muayene Metrics */}
          {selectedMetrics.includes('muayene') && (dataA.hasData || dataB.hasData) && (
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-white/80 border-slate-200/40'
            }`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Muayene Verileri</h3>
              </div>
              <div className="p-4 space-y-2">
                {renderComparisonRow('MHRS Muayene', dataA.totalMhrs, dataB.totalMhrs)}
                {renderComparisonRow('Ayaktan Muayene', dataA.totalAyaktan, dataB.totalAyaktan)}
                {renderComparisonRow('Toplam Muayene', dataA.totalMuayene, dataB.totalMuayene)}
              </div>
            </div>
          )}

          {/* Ameliyat Metrics */}
          {selectedMetrics.includes('ameliyat') && (dataA.hasData || dataB.hasData) && (
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#131d33]/40 border-[#2d4163]/20' : 'bg-white/80 border-slate-200/40'
            }`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Ameliyat Verileri</h3>
              </div>
              <div className="p-4 space-y-2">
                {renderComparisonRow('Toplam Ameliyat', dataA.totalAmeliyat, dataB.totalAmeliyat)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            disabled={isLoadingData}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isDark
                ? 'bg-[#1e2d4a]/50 text-slate-300 hover:bg-[#1e2d4a] border border-[#2d4163]/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Geri
          </button>
        ) : <div />}
        {step < 3 && (
          <button
            onClick={handleNext}
            disabled={!canProceed() || isLoadingData}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              canProceed() && !isLoadingData
                ? 'bg-[#5b9cff] text-white hover:bg-[#4388f5] shadow-lg shadow-[#5b9cff]/20'
                : isDark ? 'bg-[#1e2d4a]/30 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {step === 2 ? 'Karşılaştır' : 'Devam'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {step === 3 && !isLoadingData && (
          <button
            onClick={() => { setStep(1); setDataA(emptyPeriodData); setDataB(emptyPeriodData); setLoadError(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isDark
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Yeni Karşılaştırma
          </button>
        )}
      </div>
    </div>
  );
};

export default ComparisonWizard;
