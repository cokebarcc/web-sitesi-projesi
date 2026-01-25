/**
 * GÖREN Başhekimlik (BH) Tablosu
 *
 * Excel benzeri profesyonel tablo tasarımı - Dark tema
 * Satıra tıklayınca genişleyen hesaplama detayı
 */

import React, { useState } from 'react';
import { BH_INDICATOR_DETAILS } from '../../../src/config/goren/bhIndicatorDetails';
import { getAppendixData, AppendixData } from '../../../src/config/goren/bhAppendixData';

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

// EK Modal Bileşeni
const AppendixModal: React.FC<{
  appendix: AppendixData | null;
  onClose: () => void;
}> = ({ appendix, onClose }) => {
  if (!appendix) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[80vh] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">{appendix.title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* İçerik */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {appendix.content}
          </pre>
        </div>
      </div>
    </div>
  );
};

export const GorenBHTable: React.FC<GorenBHTableProps> = ({
  data,
  totalGP,
  isLoading = false
}) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeAppendix, setActiveAppendix] = useState<AppendixData | null>(null);

  // EK butonuna tıklama
  const handleAppendixClick = (appendixId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const data = getAppendixData(appendixId);
    if (data) {
      setActiveAppendix(data);
    }
  };

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

  // Satıra tıklama
  const handleRowClick = (sira: number) => {
    setExpandedRow(expandedRow === sira ? null : sira);
  };

  return (
    <>
      {/* EK Modal */}
      <AppendixModal
        appendix={activeAppendix}
        onClose={() => setActiveAppendix(null)}
      />

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
                const isExpanded = expandedRow === row.sira;
                const indicatorDetail = BH_INDICATOR_DETAILS[row.sira];

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
                  <React.Fragment key={row.sira}>
                    {/* Ana Satır */}
                    <tr
                      onClick={() => handleRowClick(row.sira)}
                      className={`border-b border-[var(--glass-border)] hover:bg-[var(--bg-2)]/50 transition-colors cursor-pointer ${
                        idx % 2 === 0 ? '' : 'bg-[var(--bg-1)]/30'
                      } ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                    >
                      {/* Sıra */}
                      <td className="px-3 py-3 text-center border-r border-[var(--glass-border)]">
                        <div className="flex items-center justify-center gap-1">
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-base text-[var(--text-1)]">{row.sira}</span>
                        </div>
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

                    {/* Genişletilmiş Detay Satırı */}
                    {isExpanded && indicatorDetail && (
                      <tr className="bg-slate-800/50">
                        <td colSpan={9} className="p-0">
                          <div className="p-6 border-l-4 border-indigo-500">
                            {/* Başlık */}
                            <div className="flex items-start justify-between mb-6">
                              <div>
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                  <span className="text-indigo-400">{indicatorDetail.code}</span>
                                  <span>—</span>
                                  <span>{indicatorDetail.name}</span>
                                </h4>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                  <span>Birim: <span className="text-slate-300">{indicatorDetail.unit}</span></span>
                                  <span>•</span>
                                  <span>Kaynak: <span className="text-slate-300">{indicatorDetail.source}</span></span>
                                  <span>•</span>
                                  <span>HBYS Hesaplayabilir: <span className={indicatorDetail.hbysCalculable ? 'text-emerald-400' : 'text-rose-400'}>{indicatorDetail.hbysCalculable ? 'Evet' : 'Hayır'}</span></span>
                                  <span>•</span>
                                  <span>Maksimum Puan: <span className="text-amber-400 font-bold">{indicatorDetail.maxPoints}</span></span>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">Kabul Tarihi: {indicatorDetail.acceptedDate}</span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Parametreler */}
                              <div className="space-y-4">
                                {indicatorDetail.parameters.map((param, pIdx) => (
                                  <div key={pIdx} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-lg">
                                        {param.key}
                                      </span>
                                      <span className="text-white font-semibold">{param.name}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mb-2">
                                      <span className="text-slate-500">Tanım: </span>
                                      {param.description}
                                    </p>
                                    <p className="text-slate-400 text-sm">
                                      <span className="text-slate-500">Hesaplama: </span>
                                      {param.calculation}
                                    </p>
                                  </div>
                                ))}

                                {/* Gösterge Değeri Formülü */}
                                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
                                  <h5 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Gösterge Değeri (GD)
                                  </h5>
                                  <p className="text-white font-mono text-lg bg-slate-900/50 rounded-lg px-4 py-2 inline-block">
                                    {indicatorDetail.gdFormula}
                                  </p>
                                  {indicatorDetail.gdDescription && (
                                    <p className="text-emerald-300/70 text-sm mt-2 italic">
                                      {indicatorDetail.gdDescription}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Puanlama Tablosu */}
                              <div>
                                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                                  <h5 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                    Puanlama (GP)
                                  </h5>
                                  <div className="space-y-2">
                                    {indicatorDetail.scoringRules.map((rule, rIdx) => (
                                      <div
                                        key={rIdx}
                                        className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-2"
                                      >
                                        <span className="text-slate-300 text-sm font-mono">{rule.condition}</span>
                                        <span className={`font-bold text-lg px-3 py-1 rounded ${
                                          rule.points === indicatorDetail.maxPoints
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : rule.points === 0
                                              ? 'bg-rose-500/20 text-rose-400'
                                              : 'bg-amber-500/20 text-amber-400'
                                        }`}>
                                          GP = {rule.points}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Notlar */}
                                {indicatorDetail.notes && (
                                  <div className="mt-4 bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                                    <h5 className="text-slate-400 font-semibold mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Not
                                    </h5>
                                    <p className="text-slate-400 text-sm">{indicatorDetail.notes}</p>
                                  </div>
                                )}

                                {/* EK Referansları */}
                                {indicatorDetail.appendix && indicatorDetail.appendix.length > 0 && (
                                  <div className="mt-4 bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/30">
                                    <h5 className="text-indigo-400 font-semibold mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Ekler
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {indicatorDetail.appendix.map((ekId) => (
                                        <button
                                          key={ekId}
                                          onClick={(e) => handleAppendixClick(ekId, e)}
                                          className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          {ekId}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
    </>
  );
};

export default GorenBHTable;
