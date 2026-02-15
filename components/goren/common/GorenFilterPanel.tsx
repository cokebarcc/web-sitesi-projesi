/**
 * GÖREN Filtre Paneli
 *
 * Kurum türü, kurum seçimi, yıl ve ay filtreleri
 * Hekim Verileri modülüyle aynı modern tasarım
 */

import React, { useMemo } from 'react';
import {
  InstitutionType,
  InstitutionOption,
  GorenFilterState
} from '../types/goren.types';
import {
  INSTITUTION_TYPE_LABELS,
  getActiveInstitutionTypes,
  INDICATOR_COUNTS
} from '../../../src/config/goren';
import MultiSelectDropdown, { DropdownOption } from '../../MultiSelectDropdown';

interface GorenFilterPanelProps {
  /** Mevcut filtre durumu */
  filterState: GorenFilterState;
  /** Filtre değişikliği callback'i */
  onFilterChange: (newState: Partial<GorenFilterState>) => void;
  /** Uygula butonu callback'i */
  onApply: () => void;
  /** Şablon indir callback'i */
  onDownloadTemplate: () => void;
  /** Dışa aktar callback'i */
  onExport: () => void;
  /** Dosya yükle callback'i */
  onUploadFile: (file: File) => void;
  /** Kullanılabilir kurumlar */
  availableInstitutions: InstitutionOption[];
  /** Yükleme durumu */
  isLoading?: boolean;
  /** Dosya yükleme yetkisi */
  canUpload?: boolean;
  /** Dışa aktarılacak veri var mı */
  hasData?: boolean;
  /** Kurum türü filtresini göster */
  showInstitutionTypeFilter?: boolean;
}

// Ay isimleri
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Yıl seçenekleri (son 5 yıl)
const YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - i
);

export const GorenFilterPanel: React.FC<GorenFilterPanelProps> = ({
  filterState,
  onFilterChange,
  onApply,
  onDownloadTemplate,
  onExport,
  onUploadFile,
  availableInstitutions,
  isLoading = false,
  canUpload = true,
  hasData = false,
  showInstitutionTypeFilter = true
}) => {
  // Aktif kurum türleri
  const activeTypes = useMemo(() => getActiveInstitutionTypes(), []);

  // Seçili kurum türüne göre filtrelenmiş kurumlar
  const filteredInstitutions = useMemo(() => {
    const filtered = availableInstitutions.filter(
      inst => inst.type === filterState.institutionType
    );
    return filtered.length > 0 ? filtered : availableInstitutions;
  }, [availableInstitutions, filterState.institutionType]);

  // Seçili kurum türü için gösterge sayısı
  const indicatorCount = INDICATOR_COUNTS[filterState.institutionType] || 0;

  // Dropdown seçenekleri
  const institutionTypeOptions: DropdownOption[] = activeTypes.map(type => ({
    value: type,
    label: INSTITUTION_TYPE_LABELS[type]
  }));

  const institutionOptions: DropdownOption[] = filteredInstitutions.map(inst => ({
    value: inst.id,
    label: inst.name
  }));

  const yearOptions: DropdownOption[] = YEARS.map(y => ({
    value: y,
    label: String(y)
  }));

  const monthOptions: DropdownOption[] = MONTHS.map((m, idx) => ({
    value: idx + 1,
    label: m
  }));

  // Dosya yükleme handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="g-filter-panel sticky-filter-panel rounded-[20px] backdrop-blur-xl">
      {/* Tek Satır: Filtreler + Butonlar + Excel Yükle */}
      <div className="flex flex-wrap gap-2 items-end">
        {/* Kurum Türü */}
        {showInstitutionTypeFilter && (
          <MultiSelectDropdown
            label="Kurum Türü"
            options={institutionTypeOptions}
            selectedValues={filterState.institutionType ? [filterState.institutionType] : []}
            onChange={(values) => {
              const newType = values.length > 0 ? values[0] as InstitutionType : 'ILSM';
              onFilterChange({
                institutionType: newType,
                institutionId: '',
                institutionName: ''
              });
            }}
            placeholder="Kurum Türü Seçin"
            showSearch={false}
            compact={true}
            singleSelect={true}
          />
        )}

        {/* Kurum Seçimi */}
        <MultiSelectDropdown
          label="Kurum"
          options={institutionOptions}
          selectedValues={filterState.institutionId ? [filterState.institutionId] : []}
          onChange={(values) => {
            const selectedId = values.length > 0 ? String(values[0]) : '';
            const selected = filteredInstitutions.find(i => i.id === selectedId);
            onFilterChange({
              institutionId: selectedId,
              institutionName: selected?.name || ''
            });
          }}
          placeholder="Kurum Seçiniz..."
          disabled={filteredInstitutions.length === 0}
          emptyMessage="Kurum bulunamadı"
          showSearch={filteredInstitutions.length > 5}
          compact={true}
          singleSelect={true}
        />

        {/* Yıl */}
        <MultiSelectDropdown
          label="Yıl"
          options={yearOptions}
          selectedValues={filterState.year ? [filterState.year] : []}
          onChange={(values) => {
            const newYear = values.length > 0 ? Number(values[0]) : new Date().getFullYear();
            onFilterChange({ year: newYear });
          }}
          placeholder="Yıl Seçin"
          showSearch={false}
          compact={true}
          singleSelect={true}
        />

        {/* Ay */}
        <MultiSelectDropdown
          label="Ay"
          options={monthOptions}
          selectedValues={filterState.month ? [filterState.month] : []}
          onChange={(values) => {
            const newMonth = values.length > 0 ? Number(values[0]) : new Date().getMonth() + 1;
            onFilterChange({ month: newMonth });
          }}
          placeholder="Ay Seçin"
          showSearch={false}
          compact={true}
          singleSelect={true}
        />

        {/* Uygula Butonu */}
        <button
          onClick={onApply}
          disabled={isLoading || !filterState.institutionId}
          className="g-btn g-btn-primary rounded-full"
          style={{ height: '38px', background: 'var(--g-success)', borderColor: 'var(--g-success)' }}
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

        {/* Şablon İndir */}
        <button
          onClick={onDownloadTemplate}
          className="g-btn g-btn-secondary rounded-full"
          style={{ height: '38px' }}
          title="Veri giriş şablonu indir"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Şablon
        </button>

        {/* Dışa Aktar */}
        {hasData && (
          <button
            onClick={onExport}
            className="g-btn rounded-full"
            style={{ height: '38px', background: 'var(--g-info)', color: '#fff', borderColor: 'var(--g-info)' }}
            title="Sonuçları Excel olarak indir"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
        )}

        {/* Ayırıcı çizgi */}
        {canUpload && filterState.institutionId && (
          <div style={{ width: '1px', height: '28px', background: 'var(--g-border)', margin: '0 4px', alignSelf: 'center' }}></div>
        )}

        {/* Excel Dosyası Yükle — aynı satırda */}
        {canUpload && filterState.institutionId && (
          <label className="g-btn g-btn-secondary rounded-full cursor-pointer" style={{ height: '38px', color: 'var(--g-accent-text)', borderColor: 'var(--g-accent)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Excel Yükle
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}

        {/* Sağ taraf - Gösterge bilgisi */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="g-badge" style={{ background: 'var(--g-success-light)', color: 'var(--g-success-text)', border: '1px solid var(--g-success)', padding: '4px 12px', fontWeight: 700 }}>
            {INSTITUTION_TYPE_LABELS[filterState.institutionType]} • {indicatorCount} Gösterge
          </span>
        </div>
      </div>
    </div>
  );
};

export default GorenFilterPanel;
