/**
 * GÖREN Başhekimlik (BH) Tablosu
 *
 * Excel formatını birebir yansıtan özel tablo bileşeni.
 * Sütunlar: Sıra | Gösterge Adı | Birim | A | B | Dönem İçi | TR Rol Ortalama | Dönem İçi Puan | Muaf
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
  muaf: number | string | null;
}

interface GorenBHTableProps {
  /** Tablo verileri */
  data: BHTableRow[];
  /** Toplam puan */
  totalGP: number;
  /** Yükleme durumu */
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
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-48 mb-4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 py-3 border-b border-[var(--glass-border)]">
              <div className="h-4 bg-gray-200 rounded w-8" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Değeri formatla
  const formatValue = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'number') {
      // Büyük sayılar için binlik ayraç
      return val.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    }
    return String(val);
  };

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-1)]">
            Başhekimlik Performans Göstergeleri
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {data.length} gösterge yüklendi
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)]">Toplam Dönem İçi Puan</p>
          <p className="text-2xl font-black text-indigo-400">
            {totalGP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-2)]">
              <th className="px-3 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-12">
                Sıra
              </th>
              <th className="px-3 py-3 text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider min-w-[250px]">
                Gösterge Adı
              </th>
              <th className="px-3 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-28">
                Birim
              </th>
              <th className="px-3 py-3 text-right text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-24">
                A
              </th>
              <th className="px-3 py-3 text-right text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-24">
                B
              </th>
              <th className="px-3 py-3 text-right text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-24">
                Dönem İçi
              </th>
              <th className="px-3 py-3 text-right text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-28">
                TR Rol Ortalama
              </th>
              <th className="px-3 py-3 text-center text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-28 bg-indigo-500/10">
                Dönem İçi Puan
              </th>
              <th className="px-3 py-3 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-16">
                Muaf
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  Henüz veri yüklenmedi. Excel dosyası yükleyin.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                // donemIciPuan değerine göre renk belirleme
                // number (0 dahil): veri var → renk kodlu
                // null veya "-": veri yok → gri
                const hasData = typeof row.donemIciPuan === 'number';
                const puan = hasData ? row.donemIciPuan : null;

                const puanClass = !hasData ? 'text-gray-400' :         // Veri yok - gri
                                  puan! >= 4 ? 'text-emerald-400' :    // Yüksek puan - yeşil
                                  puan! >= 2 ? 'text-amber-400' :      // Orta puan - sarı
                                  puan! > 0 ? 'text-orange-400' :      // Düşük puan - turuncu
                                  'text-rose-400';                     // 0 puan - kırmızı

                return (
                  <tr
                    key={row.sira}
                    className={`border-b border-[var(--glass-border)] hover:bg-[var(--bg-2)] transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-[var(--bg-1)]/30'
                    }`}
                  >
                    {/* Sıra */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-bold text-indigo-400">
                        {row.sira}
                      </span>
                    </td>

                    {/* Gösterge Adı */}
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-[var(--text-1)]">
                        {row.gostergeAdi}
                      </span>
                    </td>

                    {/* Birim */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs text-[var(--text-muted)]">
                        {row.birim}
                      </span>
                    </td>

                    {/* A */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm text-[var(--text-2)] font-mono">
                        {formatValue(row.a)}
                      </span>
                    </td>

                    {/* B */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm text-[var(--text-2)] font-mono">
                        {formatValue(row.b)}
                      </span>
                    </td>

                    {/* Dönem İçi */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm text-[var(--text-1)] font-medium">
                        {formatValue(row.donemIci)}
                      </span>
                    </td>

                    {/* TR Rol Ortalama */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm text-[var(--text-muted)]">
                        {formatValue(row.trRolOrtalama)}
                      </span>
                    </td>

                    {/* Dönem İçi Puan */}
                    <td className="px-3 py-2.5 text-center bg-indigo-500/5">
                      <span className={`text-sm font-bold ${puanClass}`}>
                        {formatValue(row.donemIciPuan)}
                      </span>
                    </td>

                    {/* Muaf */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatValue(row.muaf)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Toplam Satırı */}
          {data.length > 0 && (
            <tfoot>
              <tr className="bg-indigo-500/10 border-t-2 border-indigo-500/30">
                <td colSpan={7} className="px-3 py-3 text-right">
                  <span className="text-sm font-bold text-[var(--text-1)]">
                    TOPLAM
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-lg font-black text-indigo-400">
                    {totalGP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default GorenBHTable;
