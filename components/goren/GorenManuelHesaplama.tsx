/**
 * GÖREN Manuel Hesaplama Modülü
 *
 * Tüm kurum türleri için manuel veri girişi ve hesaplama
 * - İl Sağlık Müdürlüğü (ILSM)
 * - İlçe Sağlık Müdürlüğü (ILCESM)
 * - Başhekimlik (BH)
 * - ADSH
 * - Acil Sağlık Hizmetleri (ASH)
 */

import React, { useState, useMemo } from 'react';
import {
  InstitutionType,
  ParameterValues,
  IndicatorDefinition,
  IndicatorResult,
  CalculationSummary
} from './types/goren.types';
import {
  INSTITUTION_TYPE_LABELS,
  getIndicatorsByCategory,
  INDICATOR_COUNTS
} from '../../src/config/goren';
import { GorenDataEntry } from './common/GorenDataEntry';
import GorenSummaryCards from './common/GorenSummaryCards';
import GorenIndicatorTable from './common/GorenIndicatorTable';
import MultiSelectDropdown, { DropdownOption } from '../MultiSelectDropdown';

// Ay isimleri
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Yıl seçenekleri
const YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - i
);

// Tüm kurum türleri
const ALL_INSTITUTION_TYPES: InstitutionType[] = ['ILSM', 'ILCESM', 'BH', 'ADSH', 'ASH'];

export const GorenManuelHesaplama: React.FC = () => {
  // State
  const [institutionType, setInstitutionType] = useState<InstitutionType>('ILSM');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [parameterValues, setParameterValues] = useState<Record<string, ParameterValues>>({});
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Seçili kurum türüne göre göstergeler
  const definitions = useMemo(() => {
    return getIndicatorsByCategory(institutionType);
  }, [institutionType]);

  // Gösterge sayısı
  const indicatorCount = INDICATOR_COUNTS[institutionType] || 0;

  // Dropdown seçenekleri
  const institutionTypeOptions: DropdownOption[] = ALL_INSTITUTION_TYPES.map(type => ({
    value: type,
    label: INSTITUTION_TYPE_LABELS[type]
  }));

  const yearOptions: DropdownOption[] = YEARS.map(y => ({
    value: y,
    label: String(y)
  }));

  const monthOptions: DropdownOption[] = MONTHS.map((m, idx) => ({
    value: idx + 1,
    label: m
  }));

  // Kurum türü değiştiğinde parametreleri sıfırla
  const handleInstitutionTypeChange = (newType: InstitutionType) => {
    setInstitutionType(newType);
    setParameterValues({});
    setResults([]);
    setSummary(null);
  };

  // Hesaplama fonksiyonu
  const handleCalculateAll = async () => {
    setIsCalculating(true);

    try {
      // Tamamlanmış göstergeleri hesapla
      const calculatedResults: any[] = [];
      let totalAchieved = 0;
      let totalMax = 0;
      let completed = 0;
      let missing = 0;

      definitions.forEach((def: any) => {
        const values = parameterValues[def.code] || {};
        const requiredParams = def.parameters.filter((p: any) => p.required);
        const allRequiredFilled = requiredParams.every(
          (p: any) => values[p.key] !== null && values[p.key] !== undefined
        );

        if (allRequiredFilled) {
          // Hesapla
          const achieved = typeof def.calculate === 'function' ? def.calculate(values) : 0;
          const max = def.maxScore ?? def.maxPoints ?? 0;
          const percentage = max > 0 ? (achieved / max) * 100 : 0;

          calculatedResults.push({
            code: def.code,
            name: def.name,
            category: def.category,
            achieved,
            max,
            percentage,
            parameters: values,
            status: (achieved >= max ? 'achieved' : achieved > 0 ? 'partial' : 'not_achieved') as any
          });

          totalAchieved += achieved;
          totalMax += max;
          completed++;
        } else {
          missing++;
        }
      });

      setResults(calculatedResults);

      // Özet hesapla
      const overallPercentage = totalMax > 0 ? (totalAchieved / totalMax) * 100 : 0;
      setSummary({
        totalAchieved,
        totalMax,
        overallPercentage,
        completedIndicators: completed,
        missingIndicators: missing,
        achievedCount: calculatedResults.filter((r: any) => r.status === 'achieved').length,
        partialCount: calculatedResults.filter((r: any) => r.status === 'partial').length,
        notAchievedCount: calculatedResults.filter((r: any) => r.status === 'not_achieved').length
      });

      setNotification({
        type: 'success',
        message: `${completed} gösterge hesaplandı. Toplam Puan: ${totalAchieved.toFixed(2)} / ${totalMax}`
      });

      setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      console.error('Hesaplama hatası:', error);
      setNotification({
        type: 'error',
        message: 'Hesaplama sırasında bir hata oluştu'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">
            GÖREN Manuel Hesaplama
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Kurum türü seçerek manuel veri girişi yapın ve performans puanlarını hesaplayın
          </p>
        </div>
      </div>

      {/* Bildirim */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' :
          notification.type === 'error' ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300' :
          'bg-blue-500/20 border border-blue-500/30 text-blue-300'
        }`}>
          {notification.type === 'success' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {notification.type === 'error' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Filtre Paneli */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-2xl shadow-lg border border-[var(--glass-border)] p-5 relative z-[100]">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Kurum Türü */}
          <MultiSelectDropdown
            label="Kurum Türü"
            options={institutionTypeOptions}
            selectedValues={[institutionType]}
            onChange={(values) => {
              if (values.length > 0) {
                handleInstitutionTypeChange(values[0] as InstitutionType);
              }
            }}
            placeholder="Kurum Türü Seçin"
            showSearch={false}
            compact={true}
            singleSelect={true}
          />

          {/* Yıl */}
          <MultiSelectDropdown
            label="Yıl"
            options={yearOptions}
            selectedValues={[year]}
            onChange={(values) => {
              if (values.length > 0) {
                setYear(Number(values[0]));
              }
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
            selectedValues={[month]}
            onChange={(values) => {
              if (values.length > 0) {
                setMonth(Number(values[0]));
              }
            }}
            placeholder="Ay Seçin"
            showSearch={false}
            compact={true}
            singleSelect={true}
          />

          {/* Sağ taraf - Gösterge bilgisi */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-emerald-400 font-medium bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30">
              {INSTITUTION_TYPE_LABELS[institutionType]} • {indicatorCount} Gösterge
            </span>
          </div>
        </div>
      </div>

      {/* Sonuç Özeti */}
      {summary && (
        <GorenSummaryCards summary={summary} />
      )}

      {/* Manuel Veri Girişi */}
      <GorenDataEntry
        definitions={definitions}
        currentValues={parameterValues}
        onValuesChange={setParameterValues}
        onCalculateAll={handleCalculateAll}
        isLoading={isCalculating}
      />

      {/* Sonuç Tablosu */}
      {results.length > 0 && (
        <GorenIndicatorTable
          results={results as any}
          definitions={definitions as any}
          onRowClick={(code: string) => {
            console.log('Gösterge detayı:', code);
          }}
        />
      )}
    </div>
  );
};

export default GorenManuelHesaplama;
