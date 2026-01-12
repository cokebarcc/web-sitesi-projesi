import React from 'react';
import { MONTHS, YEARS } from '../../constants';

interface FilterPanelProps {
  // Hastane filtresi (zorunlu)
  selectedHospital: string;
  onHospitalChange: (hospital: string) => void;
  allowedHospitals: string[];

  // Opsiyonel filtreler
  selectedBranch?: string | null;
  onBranchChange?: (branch: string | null) => void;
  branchOptions?: string[];

  selectedMonth?: string;
  onMonthChange?: (month: string) => void;

  selectedYear?: number;
  onYearChange?: (year: number) => void;

  // Apply button callback
  onApply?: () => void;
  showApplyButton?: boolean;

  // Custom content slot
  customFilters?: React.ReactNode;

  // Filter visibility control
  showHospitalFilter?: boolean;
  showBranchFilter?: boolean;
  showMonthFilter?: boolean;
  showYearFilter?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedHospital,
  onHospitalChange,
  allowedHospitals,
  selectedBranch,
  onBranchChange,
  branchOptions = [],
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  onApply,
  showApplyButton = false,
  customFilters,
  showHospitalFilter = true,
  showBranchFilter = false,
  showMonthFilter = false,
  showYearFilter = false
}) => {
  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Hastane Dropdown */}
        {showHospitalFilter && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              HASTANE
            </label>
            <select
              value={selectedHospital}
              onChange={(e) => onHospitalChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black min-w-[240px] outline-none focus:ring-2 ring-blue-500 transition-all"
            >
              {allowedHospitals.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        )}

        {/* Branş Dropdown */}
        {showBranchFilter && onBranchChange && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              BRANŞ
            </label>
            <div className="flex gap-2">
              <select
                value={selectedBranch || ''}
                onChange={(e) => onBranchChange(e.target.value || null)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black min-w-[200px] outline-none focus:ring-2 ring-blue-500 transition-all"
              >
                <option value="">Tüm Branşlar</option>
                {branchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {selectedBranch && (
                <button
                  onClick={() => onBranchChange(null)}
                  className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all"
                  title="Temizle"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ay Dropdown */}
        {showMonthFilter && selectedMonth !== undefined && onMonthChange && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              AY
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black min-w-[140px] outline-none focus:ring-2 ring-blue-500 transition-all"
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Yıl Dropdown */}
        {showYearFilter && selectedYear !== undefined && onYearChange && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              YIL
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black min-w-[120px] outline-none focus:ring-2 ring-blue-500 transition-all"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Custom filters slot */}
        {customFilters && (
          <div className="flex-1 min-w-full md:min-w-0">
            {customFilters}
          </div>
        )}

        {/* Apply Button */}
        {showApplyButton && onApply && (
          <button
            onClick={onApply}
            disabled={!selectedHospital || (!selectedYear && showYearFilter) || (!selectedMonth && showMonthFilter)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center gap-2 uppercase"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>UYGULA</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
