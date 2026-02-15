import React from 'react';
import MultiSelectDropdown, { DropdownOption } from '../MultiSelectDropdown';
import { MONTHS, YEARS } from '../../constants';

interface DataFilterPanelProps {
  title?: string;

  // Hastane filtresi
  showHospitalFilter?: boolean;
  selectedHospital?: string;
  availableHospitals?: string[];
  onHospitalChange?: (hospital: string) => void;

  // Yıl filtresi
  showYearFilter?: boolean;
  selectedYears: number[];
  availableYears?: number[];
  onYearsChange: (years: number[]) => void;

  // Ay filtresi
  showMonthFilter?: boolean;
  selectedMonths: number[];
  availableMonths?: number[];
  onMonthsChange: (months: number[]) => void;

  // Branş filtresi
  showBranchFilter?: boolean;
  selectedBranch?: string | null;
  availableBranches?: string[];
  onBranchChange?: (branch: string | null) => void;

  // Uygula butonu
  showApplyButton?: boolean;
  onApply?: () => void;
  isLoading?: boolean;
  applyDisabled?: boolean;

  // Seçim sayısı göstergesi
  selectionCount?: number;
  selectionLabel?: string;

  // Özel içerik
  customFilters?: React.ReactNode;
}

const DataFilterPanel: React.FC<DataFilterPanelProps> = ({
  title = 'Veri Filtreleme',
  showHospitalFilter = false,
  selectedHospital = '',
  availableHospitals = [],
  onHospitalChange,
  showYearFilter = true,
  selectedYears,
  availableYears = YEARS,
  onYearsChange,
  showMonthFilter = true,
  selectedMonths,
  availableMonths,
  onMonthsChange,
  showBranchFilter = false,
  selectedBranch,
  availableBranches = [],
  onBranchChange,
  showApplyButton = true,
  onApply,
  isLoading = false,
  applyDisabled = false,
  selectionCount,
  selectionLabel = 'seçili',
  customFilters
}) => {
  // Yıl seçenekleri
  const yearOptions: DropdownOption[] = availableYears.map(y => ({
    value: y,
    label: String(y)
  }));

  // Ay seçenekleri - availableMonths varsa sadece onları göster
  const monthOptions: DropdownOption[] = (availableMonths || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map(m => ({
    value: m,
    label: MONTHS[m - 1]
  }));

  // Hastane seçenekleri
  const hospitalOptions: DropdownOption[] = availableHospitals.map(h => ({
    value: h,
    label: h
  }));

  // Branş seçenekleri
  const branchOptions: DropdownOption[] = availableBranches.map(b => ({
    value: b,
    label: b
  }));

  // Temizle işlevi
  const handleClear = () => {
    if (onHospitalChange) onHospitalChange('');
    onYearsChange([]);
    onMonthsChange([]);
    if (onBranchChange) onBranchChange(null);
  };

  const hasSelection = selectedYears.length > 0 || selectedMonths.length > 0 || !!selectedHospital || !!selectedBranch;

  return (
    <div className="sticky-filter-panel bg-[var(--glass-bg)] backdrop-blur-xl rounded-[20px] shadow-[var(--card-shadow)] border border-[var(--glass-border)] p-4 relative z-[100]">
      {/* Tüm Filtreler Tek Satırda */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Hastane Seçimi */}
        {showHospitalFilter && onHospitalChange && (
          <MultiSelectDropdown
            label="Hastane"
            options={hospitalOptions}
            selectedValues={selectedHospital ? [selectedHospital] : []}
            onChange={(values) => onHospitalChange(values.length > 0 ? String(values[0]) : '')}
            placeholder="Hastane Seçiniz..."
            disabled={availableHospitals.length === 0}
            emptyMessage="Hastane bulunamadı"
            showSearch={availableHospitals.length > 5}
            compact={true}
            singleSelect={true}
          />
        )}

        {/* Yıl Seçimi */}
        {showYearFilter && (
          <MultiSelectDropdown
            label="Yıl"
            options={yearOptions}
            selectedValues={selectedYears}
            onChange={(values) => onYearsChange(values as number[])}
            placeholder="Yıl seçiniz..."
            disabled={availableYears.length === 0}
            emptyMessage="Kayıtlı veri yok"
            showSearch={false}
            compact={true}
          />
        )}

        {/* Ay Seçimi */}
        {showMonthFilter && (
          <MultiSelectDropdown
            label="Ay"
            options={monthOptions}
            selectedValues={selectedMonths}
            onChange={(values) => onMonthsChange(values as number[])}
            placeholder="Ay seçiniz..."
            disabled={selectedYears.length === 0}
            emptyMessage={selectedYears.length === 0 ? "Önce yıl seçiniz" : "Seçili yıllarda veri yok"}
            showSearch={false}
            compact={true}
          />
        )}

        {/* Branş Seçimi */}
        {showBranchFilter && onBranchChange && (
          <MultiSelectDropdown
            label="Branş"
            options={branchOptions}
            selectedValues={selectedBranch ? [selectedBranch] : []}
            onChange={(values) => onBranchChange(values.length > 0 ? String(values[0]) : null)}
            placeholder="Tüm Branşlar"
            disabled={availableBranches.length === 0}
            emptyMessage="Branş bulunamadı"
            showSearch={availableBranches.length > 5}
            compact={true}
            singleSelect={true}
          />
        )}

        {/* Uygula Butonu */}
        {showApplyButton && onApply && (
          <button
            onClick={onApply}
            disabled={isLoading || applyDisabled}
            className="px-5 py-2 h-[38px] bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Yükleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Uygula
              </>
            )}
          </button>
        )}

        {/* Özel Filtreler - Aynı satırda devam */}
        {customFilters}

        {/* Seçim sayısı ve Temizle butonu - sağ tarafa */}
        <div className="flex items-center gap-2 ml-auto">
          {selectionCount !== undefined && selectionCount > 0 && (
            <span className="text-xs text-emerald-400 font-medium bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/30">
              {selectionCount} {selectionLabel}
            </span>
          )}
          {hasSelection && (
            <button
              onClick={handleClear}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-1)] font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Temizle
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataFilterPanel;
