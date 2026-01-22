/**
 * GÖREN Detay Paneli
 *
 * Seçili göstergenin formül, eşik ve notlarını gösterir.
 * Manuel veri girişi ve düzenleme imkanı sağlar.
 */

import React, { useState, useEffect } from 'react';
import {
  IndicatorDefinition,
  IndicatorResult,
  ParameterValues
} from '../types/goren.types';

interface GorenDetailPanelProps {
  /** Gösterge tanımı */
  definition: IndicatorDefinition | null;
  /** Hesaplama sonucu */
  result: IndicatorResult | null;
  /** Panel açık mı */
  isOpen: boolean;
  /** Kapatma callback'i */
  onClose: () => void;
  /** Parametre değişikliği callback'i */
  onParameterChange: (code: string, values: ParameterValues) => void;
  /** Readonly mod */
  readonly?: boolean;
}

export const GorenDetailPanel: React.FC<GorenDetailPanelProps> = ({
  definition,
  result,
  isOpen,
  onClose,
  onParameterChange,
  readonly = false
}) => {
  const [editValues, setEditValues] = useState<ParameterValues>({});
  const [isDirty, setIsDirty] = useState(false);

  // Result değiştiğinde edit değerlerini güncelle
  useEffect(() => {
    if (result) {
      setEditValues(result.parameterValues);
      setIsDirty(false);
    }
  }, [result]);

  // Panel kapalıysa render etme
  if (!isOpen || !definition) {
    return null;
  }

  // Parametre değerini güncelle
  const handleValueChange = (key: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value.replace(',', '.'));
    const newValues = { ...editValues, [key]: numValue };
    setEditValues(newValues);
    setIsDirty(true);
  };

  // Değişiklikleri kaydet
  const handleSave = () => {
    onParameterChange(definition.code, editValues);
    setIsDirty(false);
  };

  // Sıfırla
  const handleReset = () => {
    if (result) {
      setEditValues(result.parameterValues);
      setIsDirty(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--bg-1)] border-l border-[var(--glass-border)] shadow-2xl z-50 overflow-y-auto">
        {/* Başlık */}
        <div className="sticky top-0 bg-[var(--bg-1)] px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-mono text-indigo-400 font-bold">
              {definition.code}
            </p>
            <h3 className="text-lg font-bold text-[var(--text-1)] mt-1">
              {definition.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Özet Bilgiler */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--glass-bg)] rounded-2xl p-4 border border-[var(--glass-border)]">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Maks Puan</p>
              <p className="text-xl font-black text-purple-400 mt-1">{definition.maxPoints}</p>
            </div>
            <div className="bg-[var(--glass-bg)] rounded-2xl p-4 border border-[var(--glass-border)]">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">GD</p>
              <p className="text-xl font-black text-[var(--text-1)] mt-1">
                {result?.gdFormatted || '-'}
              </p>
            </div>
            <div className="bg-[var(--glass-bg)] rounded-2xl p-4 border border-[var(--glass-border)]">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">GP</p>
              <p className={`text-xl font-black mt-1 ${
                result?.status === 'success'
                  ? result.gp >= definition.maxPoints * 0.7
                    ? 'text-emerald-400'
                    : result.gp >= definition.maxPoints * 0.4
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  : 'text-[var(--text-muted)]'
              }`}>
                {result?.status === 'success' ? result.gp : '-'}
              </p>
            </div>
          </div>

          {/* Formül */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-1)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Formül
            </h4>
            <div className="bg-[var(--bg-2)] rounded-xl p-4 font-mono text-sm">
              <p className="text-indigo-400">
                <span className="text-[var(--text-muted)]">GD = </span>
                {definition.gdFormula}
              </p>
              {definition.gpFormula && (
                <p className="text-emerald-400 mt-2">
                  <span className="text-[var(--text-muted)]">GP = </span>
                  {definition.gpFormula}
                </p>
              )}
            </div>
          </div>

          {/* Parametre Girişi */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-1)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Parametreler
            </h4>
            <div className="space-y-4">
              {definition.parameters.map((param) => (
                <div key={param.key}>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    <span className="font-bold text-indigo-400">{param.key}</span>
                    {' - '}
                    {param.label}
                    {param.required && <span className="text-rose-400 ml-1">*</span>}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editValues[param.key] ?? ''}
                    onChange={(e) => handleValueChange(param.key, e.target.value)}
                    disabled={readonly}
                    placeholder={param.description || `${param.key} değerini girin`}
                    className={`w-full px-4 py-3 bg-[var(--bg-2)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-1)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      readonly ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                  {param.description && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {param.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Kaydet/Sıfırla Butonları */}
            {!readonly && isDirty && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Hesapla
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-[var(--bg-3)] hover:bg-[var(--bg-2)] text-[var(--text-2)] text-sm font-medium rounded-xl transition-colors"
                >
                  Sıfırla
                </button>
              </div>
            )}
          </div>

          {/* Puanlama Kuralları */}
          {definition.gpRules.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[var(--text-1)] mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Puanlama Eşikleri
              </h4>
              <div className="bg-[var(--bg-2)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--bg-3)]">
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-[var(--text-muted)] uppercase">
                        Koşul
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-[var(--text-muted)] uppercase">
                        Puan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {definition.gpRules.map((rule, idx) => {
                      const isMatched = result?.matchedRule === rule;
                      return (
                        <tr
                          key={idx}
                          className={`border-t border-[var(--glass-border)] ${
                            isMatched ? 'bg-indigo-500/10' : ''
                          }`}
                        >
                          <td className="px-4 py-2">
                            <span className={`text-sm ${isMatched ? 'text-indigo-400 font-bold' : 'text-[var(--text-2)]'}`}>
                              {rule.condition}
                            </span>
                            {isMatched && (
                              <span className="ml-2 text-[10px] text-indigo-400">← Aktif</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`text-sm font-bold ${
                              rule.points >= definition.maxPoints * 0.7
                                ? 'text-emerald-400'
                                : rule.points >= definition.maxPoints * 0.4
                                  ? 'text-amber-400'
                                  : rule.points > 0
                                    ? 'text-orange-400'
                                    : 'text-rose-400'
                            }`}>
                              {rule.points}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notlar ve Kaynak */}
          <div className="space-y-4">
            {definition.notes && (
              <div>
                <h4 className="text-sm font-bold text-[var(--text-1)] mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Notlar
                </h4>
                <p className="text-sm text-[var(--text-2)] bg-[var(--bg-2)] rounded-xl p-4">
                  {definition.notes}
                </p>
              </div>
            )}

            {definition.source && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Kaynak: <span className="font-medium">{definition.source}</span></span>
                {definition.hbysCalculable !== undefined && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    definition.hbysCalculable
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {definition.hbysCalculable ? 'HBYS Hesaplayabilir' : 'Manuel Giriş'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Durum Mesajı */}
          {result?.statusMessage && (
            <div className={`p-4 rounded-xl ${
              result.status === 'error'
                ? 'bg-rose-500/10 border border-rose-500/20'
                : 'bg-amber-500/10 border border-amber-500/20'
            }`}>
              <p className={`text-sm ${
                result.status === 'error' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {result.statusMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GorenDetailPanel;
