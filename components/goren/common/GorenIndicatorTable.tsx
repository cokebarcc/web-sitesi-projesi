/**
 * GÖREN Gösterge Tablosu
 *
 * Tüm göstergeleri tablo formatında listeler.
 * Satıra tıklandığında detay paneli açılır.
 */

import React, { useState, useMemo } from 'react';
import {
  IndicatorResult,
  IndicatorDefinition,
  StatusIndicator
} from '../types/goren.types';

interface GorenIndicatorTableProps {
  /** Hesaplama sonuçları */
  results: IndicatorResult[];
  /** Gösterge tanımları */
  definitions: IndicatorDefinition[];
  /** Satır tıklama callback'i */
  onRowClick: (code: string) => void;
  /** Seçili gösterge kodu */
  selectedCode?: string;
  /** Yükleme durumu */
  isLoading?: boolean;
}

// Durum badge renkleri
const statusColors: Record<StatusIndicator, { bg: string; text: string; label: string }> = {
  excellent: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Mükemmel' },
  good: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'İyi' },
  average: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Orta' },
  poor: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Zayıf' },
  critical: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'Kritik' },
  unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Eksik' }
};

export const GorenIndicatorTable: React.FC<GorenIndicatorTableProps> = ({
  results,
  definitions,
  onRowClick,
  selectedCode,
  isLoading = false
}) => {
  const [sortField, setSortField] = useState<'code' | 'gp' | 'achievement'>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'incomplete'>('all');

  // Sıralama ve filtreleme
  const sortedResults = useMemo(() => {
    let filtered = [...results];

    // Durum filtresi
    if (filterStatus === 'success') {
      filtered = filtered.filter(r => r.status === 'success');
    } else if (filterStatus === 'incomplete') {
      filtered = filtered.filter(r => r.status !== 'success');
    }

    // Sıralama
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'gp':
          comparison = a.gp - b.gp;
          break;
        case 'achievement':
          comparison = a.achievementPercent - b.achievementPercent;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [results, sortField, sortDirection, filterStatus]);

  // Sıralama değiştir
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-48 mb-4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 py-3 border-b border-[var(--glass-border)]">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
      {/* Başlık ve Filtreler */}
      <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-1)]">
            Gösterge Sonuçları
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {sortedResults.length} / {results.length} gösterge
          </p>
        </div>

        {/* Durum Filtresi */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-3)]'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setFilterStatus('success')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-3)]'
            }`}
          >
            Hesaplanan
          </button>
          <button
            onClick={() => setFilterStatus('incomplete')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'incomplete'
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-3)]'
            }`}
          >
            Eksik
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-2)]">
              <th
                onClick={() => handleSort('code')}
                className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-1)]"
              >
                <span className="flex items-center gap-1">
                  Kod
                  <SortIcon active={sortField === 'code'} direction={sortDirection} />
                </span>
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Gösterge Adı
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                A
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                B
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                GD
              </th>
              <th
                onClick={() => handleSort('gp')}
                className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-1)]"
              >
                <span className="flex items-center justify-center gap-1">
                  GP
                  <SortIcon active={sortField === 'gp'} direction={sortDirection} />
                </span>
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Maks
              </th>
              <th
                onClick={() => handleSort('achievement')}
                className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-1)]"
              >
                <span className="flex items-center justify-center gap-1">
                  Durum
                  <SortIcon active={sortField === 'achievement'} direction={sortDirection} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  {filterStatus !== 'all'
                    ? 'Bu filtreye uygun gösterge bulunamadı.'
                    : 'Henüz hesaplama yapılmadı. Veri girin veya Excel yükleyin.'}
                </td>
              </tr>
            ) : (
              sortedResults.map((result) => {
                const statusStyle = statusColors[result.statusIndicator];
                const isSelected = selectedCode === result.code;

                return (
                  <tr
                    key={result.code}
                    onClick={() => onRowClick(result.code)}
                    className={`border-b border-[var(--glass-border)] cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/10'
                        : 'hover:bg-[var(--bg-2)]'
                    }`}
                  >
                    {/* Kod */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {result.code.replace('SYPG-', '')}
                      </span>
                    </td>

                    {/* Gösterge Adı */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-1)] line-clamp-1">
                        {result.name}
                      </span>
                    </td>

                    {/* A */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-[var(--text-2)]">
                        {result.parameterValues['A'] !== null && result.parameterValues['A'] !== undefined
                          ? result.parameterValues['A'].toLocaleString('tr-TR')
                          : '-'}
                      </span>
                    </td>

                    {/* B */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-[var(--text-2)]">
                        {result.parameterValues['B'] !== null && result.parameterValues['B'] !== undefined
                          ? result.parameterValues['B'].toLocaleString('tr-TR')
                          : '-'}
                      </span>
                    </td>

                    {/* GD */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${
                        result.status === 'success' ? 'text-[var(--text-1)]' : 'text-[var(--text-muted)]'
                      }`}>
                        {result.gdFormatted}
                      </span>
                    </td>

                    {/* GP */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${
                        result.status === 'success'
                          ? result.gp >= result.maxPoints * 0.7
                            ? 'text-emerald-400'
                            : result.gp >= result.maxPoints * 0.4
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          : 'text-[var(--text-muted)]'
                      }`}>
                        {result.status === 'success' ? result.gp : '-'}
                      </span>
                    </td>

                    {/* Maks */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-[var(--text-muted)]">
                        {result.maxPoints}
                      </span>
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                        {result.status === 'success' && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            %{result.achievementPercent}
                          </>
                        )}
                        {result.status !== 'success' && statusStyle.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Alt Bilgi */}
      {sortedResults.length > 0 && (
        <div className="px-6 py-3 border-t border-[var(--glass-border)] bg-[var(--bg-2)]">
          <p className="text-xs text-[var(--text-muted)]">
            Satıra tıklayarak gösterge detaylarını görüntüleyin
          </p>
        </div>
      )}
    </div>
  );
};

// Sıralama ikonu
const SortIcon: React.FC<{ active: boolean; direction: 'asc' | 'desc' }> = ({
  active,
  direction
}) => {
  if (!active) {
    return (
      <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  return direction === 'asc' ? (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
};

export default GorenIndicatorTable;
