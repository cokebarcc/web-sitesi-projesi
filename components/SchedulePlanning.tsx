import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MONTHS, HOSPITALS } from '../constants';
import { DetailedScheduleData } from '../types';
import SearchableSelect, { SelectOption } from './common/SearchableSelect';

interface SchedulePlanningProps {
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  selectedBranch?: string;
  detailedScheduleData: DetailedScheduleData[];
}

// Period filter type
interface PeriodFilter {
  year: number | null;
  month: string | null;
}

// Capacity data type
interface CapacityData {
  totalCapacity: number;
  doctorCount: number;
  isLoading: boolean;
  error: string | null;
  requestKey: string | null;
}

// Convert HOSPITALS array to SelectOption array
const HOSPITAL_OPTIONS: SelectOption[] = HOSPITALS.map(h => ({
  value: h,
  label: h
}));

// Year options
const YEAR_OPTIONS: SelectOption[] = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

// Month options
const MONTH_OPTIONS: SelectOption[] = MONTHS.map(m => ({
  value: m,
  label: m
}));

// Cache for capacity calculations
const capacityCache = new Map<string, { totalCapacity: number; doctorCount: number }>();

// Hospital Select Component
const HospitalSelect: React.FC<{
  value: string | null;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <SearchableSelect
    options={HOSPITAL_OPTIONS}
    value={value}
    onChange={onChange}
    placeholder="Hastane seçiniz"
    className="w-[280px] mx-auto"
  />
);

// Branch Select Component
const BranchSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}> = ({ value, onChange, options }) => (
  <SearchableSelect
    options={options}
    value={value}
    onChange={onChange}
    placeholder="Branş seçiniz"
    className="w-[280px] mx-auto"
  />
);

// Capacity Summary Bar Component
const CapacitySummaryBar: React.FC<{
  periodLabel: string;
  capacityData: CapacityData;
  periodComplete: boolean;
}> = ({ periodLabel, capacityData, periodComplete }) => {
  if (!periodComplete) {
    return (
      <div className="bg-[var(--surface-2)] border border-[var(--border-1)] rounded-xl p-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]"></div>
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          {periodLabel}: Dönem seçimi bekleniyor
        </span>
      </div>
    );
  }

  if (capacityData.isLoading) {
    return (
      <div className="bg-[var(--surface-2)] border border-[var(--border-1)] rounded-xl p-3 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          {periodLabel}: Kapasite hesaplanıyor...
        </span>
      </div>
    );
  }

  if (capacityData.error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
        <span className="text-xs font-semibold text-rose-400">
          {periodLabel}: {capacityData.error}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
        <span className="text-xs font-semibold text-indigo-300">
          {periodLabel} Toplam Kapasite:
        </span>
        <span className="text-lg font-black text-indigo-400 tabular-nums">
          {capacityData.totalCapacity.toLocaleString('tr-TR')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
          {capacityData.doctorCount} Hekim
        </span>
      </div>
    </div>
  );
};

// Table Header Component (Hastane + Branş bandı with selects)
const SchedulePlanningTableHeader: React.FC<{
  selectedHospital: string | null;
  onHospitalChange: (value: string) => void;
  selectedBranch: string;
  onBranchChange: (value: string) => void;
  branchOptions: SelectOption[];
}> = ({ selectedHospital, onHospitalChange, selectedBranch, onBranchChange, branchOptions }) => (
  <div className="rounded-t-[20px] overflow-visible border border-b-0 border-[var(--border-1)]">
    {/* Hastane Adı Bandı */}
    <div className="bg-[#4a7ab8] py-4 px-6 flex items-center justify-center rounded-t-[20px]">
      <HospitalSelect value={selectedHospital} onChange={onHospitalChange} />
    </div>
    {/* Branş Adı Bandı */}
    <div className="bg-[var(--surface-2)] py-3 px-6 border-t border-[var(--border-1)] flex items-center justify-center relative z-[100]">
      <BranchSelect value={selectedBranch} onChange={onBranchChange} options={branchOptions} />
    </div>
  </div>
);

// Period Filter Block Component
const PeriodFilterBlock: React.FC<{
  label: string;
  period: PeriodFilter;
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: string | null) => void;
  availableYears: number[];
  availableMonths: string[];
}> = ({ label, period, onYearChange, onMonthChange, availableYears, availableMonths }) => {
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      onYearChange(null);
      onMonthChange(null);
    } else {
      onYearChange(parseInt(value));
      onMonthChange(null);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onMonthChange(value === '' ? null : value);
  };

  const isMonthDisabled = period.year === null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {/* Year Select */}
        <select
          value={period.year?.toString() || ''}
          onChange={handleYearChange}
          className="w-[90px] bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-1)] rounded-lg px-2 py-2 text-xs font-semibold outline-none focus:border-[var(--accent)] transition-colors cursor-pointer appearance-none"
          style={{ WebkitAppearance: 'menulist' }}
        >
          <option value="">Yıl</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Month Select */}
        <select
          value={period.month || ''}
          onChange={handleMonthChange}
          disabled={isMonthDisabled}
          className={`w-[110px] bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-colors appearance-none ${
            isMonthDisabled
              ? 'text-[var(--text-muted)] cursor-not-allowed opacity-60'
              : 'text-[var(--text-1)] cursor-pointer focus:border-[var(--accent)]'
          }`}
          style={{ WebkitAppearance: 'menulist' }}
        >
          <option value="">{isMonthDisabled ? 'Önce yıl' : 'Ay seçiniz'}</option>
          {!isMonthDisabled && availableMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Filters Row Component
const SchedulePlanningFiltersRow: React.FC<{
  periodA: PeriodFilter;
  periodB: PeriodFilter;
  onPeriodAChange: (period: PeriodFilter) => void;
  onPeriodBChange: (period: PeriodFilter) => void;
  availableYears: number[];
  availableMonthsA: string[];
  availableMonthsB: string[];
}> = ({ periodA, periodB, onPeriodAChange, onPeriodBChange, availableYears, availableMonthsA, availableMonthsB }) => (
  <div className="grid grid-cols-6 bg-[var(--surface-2)] border-x border-[var(--border-1)]">
    <div className="p-3 border-r border-[var(--border-1)]">
      <PeriodFilterBlock
        label="Dönem 1"
        period={periodA}
        onYearChange={(year) => onPeriodAChange({ year, month: null })}
        onMonthChange={(month) => onPeriodAChange({ ...periodA, month })}
        availableYears={availableYears}
        availableMonths={availableMonthsA}
      />
    </div>

    <div className="p-3 border-r border-[var(--border-1)]">
      <PeriodFilterBlock
        label="Dönem 2"
        period={periodB}
        onYearChange={(year) => onPeriodBChange({ year, month: null })}
        onMonthChange={(month) => onPeriodBChange({ ...periodB, month })}
        availableYears={availableYears}
        availableMonths={availableMonthsB}
      />
    </div>

    <div className="p-4 border-r border-[var(--border-1)] flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--text-1)] text-center leading-tight">Hekim Sayısı</span>
    </div>
    <div className="p-4 border-r border-[var(--border-1)] flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--text-1)] text-center leading-tight">Günlük Açılan<br/>Kapasite</span>
    </div>
    <div className="p-4 border-r border-[var(--border-1)] flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--text-1)] text-center leading-tight">Günlük Açılan<br/>Ortalama<br/>poliklinik sayısı</span>
    </div>
    <div className="p-4 flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--text-1)] text-center leading-tight">Aktif Talep Sayısı</span>
    </div>
  </div>
);

// Table Component
const SchedulePlanningTable: React.FC<{
  periodA: PeriodFilter;
  periodB: PeriodFilter;
  capacityDataA: CapacityData;
  capacityDataB: CapacityData;
}> = ({ periodA, periodB, capacityDataA, capacityDataB }) => {
  const hasDataA = !capacityDataA.isLoading && !capacityDataA.error && capacityDataA.totalCapacity > 0;
  const hasDataB = !capacityDataB.isLoading && !capacityDataB.error && capacityDataB.totalCapacity > 0;

  const rows = hasDataA || hasDataB ? [
    {
      id: 1,
      period1: periodA.month && periodA.year ? `${periodA.month} ${periodA.year}` : '-',
      period2: periodB.month && periodB.year ? `${periodB.month} ${periodB.year}` : '-',
      hekimSayisi: hasDataA ? capacityDataA.doctorCount : '-',
      gunlukKapasite: hasDataA ? Math.round(capacityDataA.totalCapacity / 20) : '-',
      gunlukOrtalama: '-',
      aktifTalep: '-',
    }
  ] : [];

  if (rows.length === 0) {
    return (
      <div className="border-x border-b border-[var(--border-1)] rounded-b-[20px] overflow-hidden">
        <div className="bg-[var(--surface-1)] p-12 text-center">
          <p className="text-[var(--text-muted)] font-medium italic">
            Dönem seçimi yapınız. Kapasite verileri seçilen dönemlere göre hesaplanacaktır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-x border-b border-[var(--border-1)] rounded-b-[20px] overflow-hidden">
      {rows.map((row, index) => (
        <div
          key={row.id}
          className={`grid grid-cols-6 transition-colors hover:bg-[var(--surface-hover)] ${
            index !== rows.length - 1 ? 'border-b border-[var(--border-1)]' : ''
          }`}
        >
          <div className="p-4 border-r border-[var(--border-1)] bg-[var(--surface-1)]">
            <span className="text-sm font-medium text-[var(--text-2)]">{row.period1}</span>
          </div>
          <div className="p-4 border-r border-[var(--border-1)] bg-[var(--surface-1)]">
            <span className="text-sm font-medium text-[var(--text-2)]">{row.period2}</span>
          </div>
          <div className="p-4 border-r border-[var(--border-1)] bg-[var(--surface-1)] text-right">
            <span className="text-sm font-bold text-[var(--text-1)] tabular-nums">
              {typeof row.hekimSayisi === 'number' ? row.hekimSayisi : row.hekimSayisi}
            </span>
          </div>
          <div className="p-4 border-r border-[var(--border-1)] bg-[var(--surface-1)] text-right">
            <span className="text-sm font-bold text-[var(--text-1)] tabular-nums">
              {typeof row.gunlukKapasite === 'number' ? row.gunlukKapasite.toLocaleString('tr-TR') : row.gunlukKapasite}
            </span>
          </div>
          <div className="p-4 border-r border-[var(--border-1)] bg-[var(--surface-1)] text-right">
            <span className="text-sm font-bold text-[var(--text-1)] tabular-nums">{row.gunlukOrtalama}</span>
          </div>
          <div className="p-4 bg-[var(--surface-1)] text-right">
            <span className="text-sm font-bold text-[var(--text-1)] tabular-nums">{row.aktifTalep}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Info Bar Component
const InfoBar: React.FC = () => (
  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-amber-300 font-medium">
        Hastane seçimi yapıldığında son dönem verileri otomatik yüklenir. Branş listesi seçili döneme göre güncellenir.
      </p>
    </div>
  </div>
);

// Helper: Calculate capacity from detailed schedule data
function calculateCapacity(
  data: DetailedScheduleData[],
  hospital: string,
  branch: string,
  year: number,
  month: string
): { totalCapacity: number; doctorCount: number } {
  const cacheKey = `${hospital}-${branch}-${year}-${month}`;

  if (capacityCache.has(cacheKey)) {
    return capacityCache.get(cacheKey)!;
  }

  const filtered = data.filter(d => {
    const matchHospital = d.hospital === hospital;
    const matchYear = d.year === year;
    const matchMonth = d.month === month;
    const matchBranch = branch === 'Tüm Branşlar' || d.specialty === branch;

    return matchHospital && matchYear && matchMonth && matchBranch;
  });

  const totalCapacity = filtered.reduce((sum, d) => sum + (d.capacity || 0), 0);
  const uniqueDoctors = new Set(filtered.map(d => d.doctorName));
  const doctorCount = uniqueDoctors.size;

  const result = { totalCapacity, doctorCount };
  capacityCache.set(cacheKey, result);

  return result;
}

// Helper: Find latest period for hospital
function findLatestPeriod(data: DetailedScheduleData[], hospital: string): { year: number; month: string } | null {
  const hospitalData = data.filter(d => d.hospital === hospital);

  if (hospitalData.length === 0) return null;

  // Get all unique year-month combinations
  const periods = hospitalData.map(d => ({ year: d.year, month: d.month }));

  // Sort by year desc, then by month order desc
  const monthOrder = MONTHS.reduce((acc, m, i) => ({ ...acc, [m]: i }), {} as Record<string, number>);

  periods.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return (monthOrder[b.month] || 0) - (monthOrder[a.month] || 0);
  });

  return periods[0] || null;
}

// Helper: Get available years for hospital
function getAvailableYears(data: DetailedScheduleData[], hospital: string): number[] {
  const hospitalData = data.filter(d => d.hospital === hospital);
  const years = [...new Set(hospitalData.map(d => d.year))];
  return years.sort((a, b) => b - a); // Descending
}

// Helper: Get available months for hospital and year
function getAvailableMonths(data: DetailedScheduleData[], hospital: string, year: number): string[] {
  const filtered = data.filter(d => d.hospital === hospital && d.year === year);
  const months = [...new Set(filtered.map(d => d.month))];

  // Sort by month order
  const monthOrder = MONTHS.reduce((acc, m, i) => ({ ...acc, [m]: i }), {} as Record<string, number>);
  return months.sort((a, b) => (monthOrder[a] || 0) - (monthOrder[b] || 0));
}

// Helper: Get available branches for hospital, year, month
function getAvailableBranches(data: DetailedScheduleData[], hospital: string, year: number | null, month: string | null): SelectOption[] {
  let filtered = data.filter(d => d.hospital === hospital);

  if (year !== null) {
    filtered = filtered.filter(d => d.year === year);
  }

  if (month !== null) {
    filtered = filtered.filter(d => d.month === month);
  }

  const branches = [...new Set(filtered.map(d => d.specialty))].filter(Boolean).sort();

  const options: SelectOption[] = [
    { value: 'Tüm Branşlar', label: 'Tüm Branşlar' },
    ...branches.map(b => ({ value: b, label: b }))
  ];

  return options;
}

// Main Component
const SchedulePlanning: React.FC<SchedulePlanningProps> = ({
  selectedHospital: propSelectedHospital,
  allowedHospitals,
  onHospitalChange: propOnHospitalChange,
  selectedBranch: propSelectedBranch,
  detailedScheduleData
}) => {
  // Local state for filters
  const [localSelectedHospital, setLocalSelectedHospital] = useState<string | null>(propSelectedHospital || null);
  const [localSelectedBranch, setLocalSelectedBranch] = useState<string>('Tüm Branşlar');

  // Period filters state
  const [periodA, setPeriodA] = useState<PeriodFilter>({ year: null, month: null });
  const [periodB, setPeriodB] = useState<PeriodFilter>({ year: null, month: null });

  // Capacity data state
  const [capacityDataA, setCapacityDataA] = useState<CapacityData>({
    totalCapacity: 0,
    doctorCount: 0,
    isLoading: false,
    error: null,
    requestKey: null
  });

  const [capacityDataB, setCapacityDataB] = useState<CapacityData>({
    totalCapacity: 0,
    doctorCount: 0,
    isLoading: false,
    error: null,
    requestKey: null
  });

  // Get available years for selected hospital
  const availableYears = useMemo(() => {
    if (!localSelectedHospital) return [2024, 2025, 2026];
    const years = getAvailableYears(detailedScheduleData, localSelectedHospital);
    return years.length > 0 ? years : [2024, 2025, 2026];
  }, [detailedScheduleData, localSelectedHospital]);

  // Get available months for period A
  const availableMonthsA = useMemo(() => {
    if (!localSelectedHospital || !periodA.year) return MONTHS;
    const months = getAvailableMonths(detailedScheduleData, localSelectedHospital, periodA.year);
    return months.length > 0 ? months : MONTHS;
  }, [detailedScheduleData, localSelectedHospital, periodA.year]);

  // Get available months for period B
  const availableMonthsB = useMemo(() => {
    if (!localSelectedHospital || !periodB.year) return MONTHS;
    const months = getAvailableMonths(detailedScheduleData, localSelectedHospital, periodB.year);
    return months.length > 0 ? months : MONTHS;
  }, [detailedScheduleData, localSelectedHospital, periodB.year]);

  // Get available branches for selected hospital and period
  const branchOptions = useMemo(() => {
    if (!localSelectedHospital) {
      return [{ value: 'Tüm Branşlar', label: 'Tüm Branşlar' }];
    }
    return getAvailableBranches(detailedScheduleData, localSelectedHospital, periodA.year, periodA.month);
  }, [detailedScheduleData, localSelectedHospital, periodA.year, periodA.month]);

  // Effect: When hospital changes, auto-select latest period
  useEffect(() => {
    console.log('🔄 useEffect triggered - Hospital:', localSelectedHospital, 'Data count:', detailedScheduleData.length);

    if (!localSelectedHospital) {
      console.log('⚠️ No hospital selected');
      return;
    }

    if (detailedScheduleData.length === 0) {
      console.log('⚠️ No detailed schedule data available');
      return;
    }

    const latestPeriod = findLatestPeriod(detailedScheduleData, localSelectedHospital);
    console.log('📅 Latest period found:', latestPeriod);

    if (latestPeriod) {
      console.log('✅ Setting Period A to:', latestPeriod);
      setPeriodA({ year: latestPeriod.year, month: latestPeriod.month });

      // Get branches for this period
      const branches = getAvailableBranches(detailedScheduleData, localSelectedHospital, latestPeriod.year, latestPeriod.month);
      console.log('🏷️ Available branches:', branches);
    } else {
      console.log('❌ No period found for hospital:', localSelectedHospital);
      // Reset periods
      setPeriodA({ year: null, month: null });
      setPeriodB({ year: null, month: null });
    }
  }, [localSelectedHospital, detailedScheduleData]);

  // Check if period A selection is complete
  const isPeriodAComplete = useMemo(() => {
    return !!(localSelectedHospital && localSelectedBranch && periodA.year && periodA.month);
  }, [localSelectedHospital, localSelectedBranch, periodA.year, periodA.month]);

  // Check if period B selection is complete
  const isPeriodBComplete = useMemo(() => {
    return !!(localSelectedHospital && localSelectedBranch && periodB.year && periodB.month);
  }, [localSelectedHospital, localSelectedBranch, periodB.year, periodB.month]);

  // Effect: Calculate capacity for Period A
  useEffect(() => {
    if (!isPeriodAComplete) {
      setCapacityDataA({
        totalCapacity: 0,
        doctorCount: 0,
        isLoading: false,
        error: null,
        requestKey: null
      });
      return;
    }

    const requestKey = `${localSelectedHospital}-${localSelectedBranch}-${periodA.year}-${periodA.month}`;

    if (capacityDataA.requestKey === requestKey && !capacityDataA.isLoading) {
      return;
    }

    setCapacityDataA(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      requestKey
    }));

    const timeoutId = setTimeout(() => {
      try {
        const result = calculateCapacity(
          detailedScheduleData,
          localSelectedHospital!,
          localSelectedBranch,
          periodA.year!,
          periodA.month!
        );

        if (result.totalCapacity === 0) {
          setCapacityDataA({
            totalCapacity: 0,
            doctorCount: 0,
            isLoading: false,
            error: 'Seçili dönem için kapasite verisi bulunamadı',
            requestKey
          });
        } else {
          setCapacityDataA({
            totalCapacity: result.totalCapacity,
            doctorCount: result.doctorCount,
            isLoading: false,
            error: null,
            requestKey
          });
        }
      } catch (err) {
        setCapacityDataA({
          totalCapacity: 0,
          doctorCount: 0,
          isLoading: false,
          error: 'Kapasite hesaplanamadı',
          requestKey
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isPeriodAComplete, localSelectedHospital, localSelectedBranch, periodA.year, periodA.month, detailedScheduleData]);

  // Effect: Calculate capacity for Period B
  useEffect(() => {
    if (!isPeriodBComplete) {
      setCapacityDataB({
        totalCapacity: 0,
        doctorCount: 0,
        isLoading: false,
        error: null,
        requestKey: null
      });
      return;
    }

    const requestKey = `${localSelectedHospital}-${localSelectedBranch}-${periodB.year}-${periodB.month}`;

    if (capacityDataB.requestKey === requestKey && !capacityDataB.isLoading) {
      return;
    }

    setCapacityDataB(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      requestKey
    }));

    const timeoutId = setTimeout(() => {
      try {
        const result = calculateCapacity(
          detailedScheduleData,
          localSelectedHospital!,
          localSelectedBranch,
          periodB.year!,
          periodB.month!
        );

        if (result.totalCapacity === 0) {
          setCapacityDataB({
            totalCapacity: 0,
            doctorCount: 0,
            isLoading: false,
            error: 'Seçili dönem için kapasite verisi bulunamadı',
            requestKey
          });
        } else {
          setCapacityDataB({
            totalCapacity: result.totalCapacity,
            doctorCount: result.doctorCount,
            isLoading: false,
            error: null,
            requestKey
          });
        }
      } catch (err) {
        setCapacityDataB({
          totalCapacity: 0,
          doctorCount: 0,
          isLoading: false,
          error: 'Kapasite hesaplanamadı',
          requestKey
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isPeriodBComplete, localSelectedHospital, localSelectedBranch, periodB.year, periodB.month, detailedScheduleData]);

  // Handlers
  const handleHospitalChange = (value: string) => {
    console.log('🏥 Hospital changed to:', value);
    console.log('📊 detailedScheduleData count:', detailedScheduleData.length);
    setLocalSelectedHospital(value);
    setLocalSelectedBranch('Tüm Branşlar');
    // Don't reset periods here - let useEffect handle auto-selection
  };

  const handleBranchChange = (value: string) => {
    setLocalSelectedBranch(value);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Başlık */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-[24px] border border-[var(--glass-border)] shadow-lg">
        <h1 className="text-2xl font-black text-[var(--text-1)] uppercase tracking-tight">
          Cetvel Planlama
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Hekim çalışma cetvellerini planlayın ve optimize edin.
        </p>
      </div>

      {/* Info Bar */}
      <InfoBar />

      {/* Capacity Summary Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CapacitySummaryBar
          periodLabel="Dönem 1"
          capacityData={capacityDataA}
          periodComplete={isPeriodAComplete}
        />
        <CapacitySummaryBar
          periodLabel="Dönem 2"
          capacityData={capacityDataB}
          periodComplete={isPeriodBComplete}
        />
      </div>

      {/* Tablo Container */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-[24px] border border-[var(--glass-border)] shadow-lg">
        <div className="overflow-x-auto overflow-y-visible">
          <div className="min-w-[900px]">
            {/* Tablo Header (Hastane + Branş Selects) */}
            <SchedulePlanningTableHeader
              selectedHospital={localSelectedHospital}
              onHospitalChange={handleHospitalChange}
              selectedBranch={localSelectedBranch}
              onBranchChange={handleBranchChange}
              branchOptions={branchOptions}
            />

            {/* Filtre Satırı */}
            <SchedulePlanningFiltersRow
              periodA={periodA}
              periodB={periodB}
              onPeriodAChange={setPeriodA}
              onPeriodBChange={setPeriodB}
              availableYears={availableYears}
              availableMonthsA={availableMonthsA}
              availableMonthsB={availableMonthsB}
            />

            {/* Tablo Body */}
            <SchedulePlanningTable
              periodA={periodA}
              periodB={periodB}
              capacityDataA={capacityDataA}
              capacityDataB={capacityDataB}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePlanning;
