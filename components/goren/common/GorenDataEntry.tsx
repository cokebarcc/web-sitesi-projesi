/**
 * GÖREN Manuel Veri Girişi Bileşeni
 *
 * Tüm göstergeler için kompakt parametre giriş formu
 */

import React, { useState } from 'react';
import {
  IndicatorDefinition,
  ParameterValues
} from '../types/goren.types';

interface GorenDataEntryProps {
  /** Gösterge tanımları */
  definitions: IndicatorDefinition[];
  /** Mevcut parametre değerleri */
  currentValues: Record<string, ParameterValues>;
  /** Değişiklik callback'i */
  onValuesChange: (values: Record<string, ParameterValues>) => void;
  /** Tümünü hesapla callback'i */
  onCalculateAll: () => void;
  /** Yükleme durumu */
  isLoading?: boolean;
}

export const GorenDataEntry: React.FC<GorenDataEntryProps> = ({
  definitions,
  currentValues,
  onValuesChange,
  onCalculateAll,
  isLoading = false
}) => {
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  // Parametre değerini güncelle
  const handleValueChange = (code: string, key: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value.replace(',', '.'));
    const currentIndicatorValues = currentValues[code] || {};
    const newValues = {
      ...currentValues,
      [code]: {
        ...currentIndicatorValues,
        [key]: numValue
      }
    };
    onValuesChange(newValues);
  };

  // Tüm değerleri temizle
  const handleClearAll = () => {
    const clearedValues: Record<string, ParameterValues> = {};
    definitions.forEach(def => {
      clearedValues[def.code] = {};
    });
    onValuesChange(clearedValues);
  };

  // Göstergenin dolu olup olmadığını kontrol et
  const isIndicatorComplete = (def: IndicatorDefinition): boolean => {
    const values = currentValues[def.code] || {};
    return def.parameters
      .filter(p => p.required)
      .every(p => values[p.key] !== null && values[p.key] !== undefined);
  };

  // Dolu gösterge sayısı
  const completedCount = definitions.filter(isIndicatorComplete).length;

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-1)]">
            Manuel Veri Girişi
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {completedCount} / {definitions.length} gösterge tamamlandı
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            Tümünü Temizle
          </button>
          <button
            onClick={onCalculateAll}
            disabled={isLoading || completedCount === 0}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              isLoading || completedCount === 0
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isLoading ? 'Hesaplanıyor...' : 'Tümünü Hesapla'}
          </button>
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="px-6 py-2 bg-[var(--bg-2)]">
        <div className="w-full h-2 bg-[var(--bg-3)] rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / definitions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Gösterge Listesi */}
      <div className="divide-y divide-[var(--glass-border)]">
        {definitions.map((def) => {
          const values = currentValues[def.code] || {};
          const isComplete = isIndicatorComplete(def);
          const isExpanded = expandedIndicator === def.code;

          return (
            <div key={def.code} className="bg-[var(--bg-1)]">
              {/* Gösterge Başlığı */}
              <button
                onClick={() => setExpandedIndicator(isExpanded ? null : def.code)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-2)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Durum İkonu */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {isComplete ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </span>

                  <div className="text-left">
                    <p className="text-xs font-mono font-bold text-indigo-400">
                      {def.code.replace('SYPG-', '')}
                    </p>
                    <p className="text-sm text-[var(--text-1)] line-clamp-1">
                      {def.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Kısa Parametre Özeti */}
                  <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {def.parameters.slice(0, 3).map((p) => (
                      <span key={p.key} className={`px-2 py-1 rounded ${
                        values[p.key] !== null && values[p.key] !== undefined
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-[var(--bg-3)]'
                      }`}>
                        {p.key}:{' '}
                        {values[p.key] !== null && values[p.key] !== undefined
                          ? values[p.key]?.toLocaleString('tr-TR')
                          : '-'}
                      </span>
                    ))}
                  </div>

                  {/* Expand İkonu */}
                  <svg
                    className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Genişletilmiş Parametre Girişi */}
              {isExpanded && (
                <div className="px-6 pb-4 pt-2 bg-[var(--bg-2)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {def.parameters.map((param) => (
                      <div key={param.key}>
                        <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                          <span className="font-bold text-indigo-400">{param.key}</span>
                          {param.required && <span className="text-rose-400 ml-1">*</span>}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={values[param.key] ?? ''}
                          onChange={(e) => handleValueChange(def.code, param.key, e.target.value)}
                          placeholder={param.label.length > 30 ? param.label.slice(0, 30) + '...' : param.label}
                          className="w-full px-3 py-2 bg-[var(--bg-1)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-1)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Formül Bilgisi */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                    <span className="font-mono">GD = {def.gdFormula}</span>
                    {def.gpFormula && (
                      <span className="font-mono">GP = {def.gpFormula}</span>
                    )}
                    <span className="ml-auto">Maks: {def.maxPoints} puan</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alt Bilgi */}
      <div className="px-6 py-3 border-t border-[var(--glass-border)] bg-[var(--bg-2)]">
        <p className="text-xs text-[var(--text-muted)]">
          <span className="text-rose-400">*</span> işaretli alanlar zorunludur. Göstergeye tıklayarak detaylı giriş yapabilirsiniz.
        </p>
      </div>
    </div>
  );
};

export default GorenDataEntry;
