/**
 * GÖREN Başhekimlik (BH) Tablosu
 *
 * Excel benzeri profesyonel tablo tasarımı - Dark tema
 */

import React from 'react';

interface BHTableRow {
  sira: number;
  gostergeAdi: string;
  birim: string;
  a: number | string | null;
  b: number | string | null;
  donemIci: number | string | null;
  trRolOrtalama: number | string | null;
  donemIciPuan: number | string | null;
  maxPuan: number;
  muaf: number | string | null;
}

interface GorenBHTableProps {
  data: BHTableRow[];
  totalGP: number;
  isLoading?: boolean;
}

export const GorenBHTable: React.FC<GorenBHTableProps> = ({
  data,
  totalGP,
  isLoading = false
}) => {
  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-lg border border-[var(--glass-border)] overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-5 bg-gray-600/30 rounded w-64 mb-4" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="flex gap-4 py-3 border-b border-[var(--glass-border)]">
              <div className="h-4 bg-gray-600/20 rounded w-8" />
              <div className="h-4 bg-gray-600/20 rounded flex-1" />
              <div className="h-4 bg-gray-600/20 rounded w-20" />
              <div className="h-4 bg-gray-600/20 rounded w-20" />
              <div className="h-4 bg-gray-600/20 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Değeri formatla
  const formatValue = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      return val.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    }
    return String(val);
  };

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-lg border border-[var(--glass-border)] overflow-hidden">
      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Başlık */}
          <thead>
            <tr className="bg-[#4472C4] text-white">
              <th className="px-3 py-3 text-center text-base font-medium border-r border-[#3563b5] w-12">#</th>
              <th className="px-4 py-3 text-left text-base font-medium border-r border-[#3563b5]">Gösterge Adı</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-32 whitespace-nowrap">Birim</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-28">A</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-28">B</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-28 whitespace-nowrap">Dönem İçi</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-32 whitespace-nowrap">TR Rol Ort.</th>
              <th className="px-4 py-3 text-center text-base font-medium border-r border-[#3563b5] w-32 whitespace-nowrap">Dönem İçi Puan</th>
              <th className="px-4 py-3 text-center text-base font-medium w-20">Muaf</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-[var(--text-muted)]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">Veri yüklenmedi</span>
                    <span className="text-xs text-[var(--text-muted)]/70">Excel dosyası yükleyerek başlayın</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const hasData = typeof row.donemIciPuan === 'number';
                const puan = hasData ? (row.donemIciPuan as number) : null;
                const maxPuan = row.maxPuan || 4;

                // Puan badge rengi
                const getPuanBadge = () => {
                  if (!hasData) return null;

                  const isFullScore = puan === maxPuan;
                  const isZero = puan === 0;

                  if (isFullScore) {
                    return (
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded bg-emerald-500 text-white text-sm font-medium">
                        {puan}
                      </span>
                    );
                  } else if (isZero) {
                    return (
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded bg-red-500 text-white text-sm font-medium">
                        {puan}
                      </span>
                    );
                  } else {
                    return (
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded bg-orange-400 text-white text-sm font-medium">
                        {puan}
                      </span>
                    );
                  }
                };

                // Muaf badge
                const getMuafBadge = () => {
                  if (!row.muaf && row.muaf !== 0) return '';
                  const val = typeof row.muaf === 'number' ? row.muaf : 0;
                  if (val === 0) {
                    return (
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded bg-gray-500 text-white text-sm font-medium">
                        {val}
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded bg-violet-500 text-white text-sm font-medium">
                      {val}
                    </span>
                  );
                };

                return (
                  <tr
                    key={row.sira}
                    className={`border-b border-[var(--glass-border)] hover:bg-[var(--bg-2)]/50 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-[var(--bg-1)]/30'
                    }`}
                  >
                    {/* Sıra */}
                    <td className="px-3 py-3 text-center border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{row.sira}</span>
                    </td>

                    {/* Gösterge Adı */}
                    <td className="px-4 py-3 border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{row.gostergeAdi}</span>
                    </td>

                    {/* Birim */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)] whitespace-nowrap">
                      <span className="text-base text-[var(--text-1)]">{row.birim || '-'}</span>
                    </td>

                    {/* A */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{formatValue(row.a)}</span>
                    </td>

                    {/* B */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{formatValue(row.b)}</span>
                    </td>

                    {/* Dönem İçi */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{formatValue(row.donemIci)}</span>
                    </td>

                    {/* TR Rol Ortalama */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)]">
                      <span className="text-base text-[var(--text-1)]">{formatValue(row.trRolOrtalama)}</span>
                    </td>

                    {/* Dönem İçi Puan */}
                    <td className="px-4 py-3 text-center border-r border-[var(--glass-border)]">
                      {getPuanBadge()}
                    </td>

                    {/* Muaf */}
                    <td className="px-4 py-3 text-center">
                      {getMuafBadge()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Toplam Satırı */}
          {data.length > 0 && (
            <tfoot>
              <tr className="bg-[#4472C4] text-white font-medium">
                <td colSpan={7} className="px-4 py-3 text-right border-r border-[#3563b5]">
                  <span className="text-base">TOPLAM PUAN</span>
                </td>
                <td className="px-4 py-3 text-center border-r border-[#3563b5]">
                  <span className="text-lg font-bold">
                    {Math.round(totalGP)}
                  </span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default GorenBHTable;
