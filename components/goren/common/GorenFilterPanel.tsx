/**
 * GÖREN Filtre Paneli
 *
 * Kurum türü, kurum seçimi, yıl ve ay filtreleri
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
  getIndicatorsByCategory,
  INDICATOR_COUNTS
} from '../../../src/config/goren';

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
  canUpload = false,
  hasData = false
}) => {
  // Aktif kurum türleri
  const activeTypes = useMemo(() => getActiveInstitutionTypes(), []);

  // Seçili kurum türüne göre filtrelenmiş kurumlar
  const filteredInstitutions = useMemo(() => {
    return availableInstitutions.filter(
      inst => inst.type === filterState.institutionType
    );
  }, [availableInstitutions, filterState.institutionType]);

  // Seçili kurum türü için gösterge sayısı
  const indicatorCount = INDICATOR_COUNTS[filterState.institutionType] || 0;

  // Dosya yükleme handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      // Input'u sıfırla (aynı dosyayı tekrar seçebilmek için)
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-6 mb-6">
      {/* Başlık ve Bilgi */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-1)]">
            GÖREN Performans Hesaplama
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {INSTITUTION_TYPE_LABELS[filterState.institutionType]} • {indicatorCount} Gösterge
          </p>
        </div>

        {/* Şablon ve Export Butonları */}
        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--text-2)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] rounded-xl transition-colors"
            title="Veri giriş şablonu indir"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Şablon İndir
          </button>

          {hasData && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
              title="Sonuçları Excel olarak indir"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Dışa Aktar
            </button>
          )}
        </div>
      </div>

      {/* Filtre Satırı */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Kurum Türü */}
        <div className="md:col-span-1">
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Kurum Türü
          </label>
          <select
            value={filterState.institutionType}
            onChange={(e) => onFilterChange({
              institutionType: e.target.value as InstitutionType,
              institutionId: '',
              institutionName: ''
            })}
            className="w-full px-4 py-3 bg-[var(--bg-2)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {activeTypes.map(type => (
              <option key={type} value={type}>
                {INSTITUTION_TYPE_LABELS[type]}
              </option>
            ))}
            {/* Henüz aktif olmayan türler (disabled) */}
            {(['ILCESM', 'BH', 'ADSH', 'ASH'] as InstitutionType[])
              .filter(type => !activeTypes.includes(type))
              .map(type => (
                <option key={type} value={type} disabled>
                  {INSTITUTION_TYPE_LABELS[type]} (Yakında)
                </option>
              ))
            }
          </select>
        </div>

        {/* Kurum Seçimi */}
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Kurum
          </label>
          <select
            value={filterState.institutionId}
            onChange={(e) => {
              const selected = filteredInstitutions.find(i => i.id === e.target.value);
              onFilterChange({
                institutionId: e.target.value,
                institutionName: selected?.name || ''
              });
            }}
            className="w-full px-4 py-3 bg-[var(--bg-2)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Kurum Seçin</option>
            {filteredInstitutions.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>

        {/* Yıl */}
        <div className="md:col-span-1">
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Yıl
          </label>
          <select
            value={filterState.year}
            onChange={(e) => onFilterChange({ year: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-[var(--bg-2)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Ay */}
        <div className="md:col-span-1">
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Ay
          </label>
          <select
            value={filterState.month}
            onChange={(e) => onFilterChange({ month: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-[var(--bg-2)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MONTHS.map((month, idx) => (
              <option key={idx} value={idx + 1}>{month}</option>
            ))}
          </select>
        </div>

        {/* Uygula Butonu */}
        <div className="md:col-span-1 flex items-end">
          <button
            onClick={onApply}
            disabled={isLoading || !filterState.institutionId}
            className={`w-full px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              isLoading || !filterState.institutionId
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Yükleniyor
              </span>
            ) : (
              'Uygula'
            )}
          </button>
        </div>
      </div>

      {/* Dosya Yükleme Alanı */}
      {canUpload && filterState.institutionId && (
        <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Excel Dosyası Yükle
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <span className="text-xs text-[var(--text-muted)]">
              Şablon formatında Excel dosyası yükleyerek verileri otomatik doldurun
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GorenFilterPanel;
