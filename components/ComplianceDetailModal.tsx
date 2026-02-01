import React from 'react';
import { ComplianceResult, RuleMasterEntry, IhlalDetay } from '../src/types/complianceTypes';
import { IslemSatiriLike } from '../src/services/complianceEngine';

interface ComplianceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: IslemSatiriLike | null;
  result: ComplianceResult | null;
}

function formatNumber(val: number, decimals = 2): string {
  if (val === 0) return '0';
  return val.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  UYGUN: { label: 'UYGUN', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  UYGUNSUZ: { label: 'UYGUNSUZ', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  MANUEL_INCELEME: { label: 'MANUEL İNCELEME', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const kuralTipiLabels: Record<string, string> = {
  BASAMAK_KISITI: 'Basamak Kısıtı',
  BRANS_KISITI: 'Branş Kısıtı',
  TANI_KOSULU: 'Tanı Koşulu',
  BIRLIKTE_YAPILAMAZ: 'Birlikte Yapılamaz',
  SIKLIK_LIMIT: 'Sıklık Limiti',
  DIS_TEDAVI: 'Diş Tedavi',
  GENEL_ACIKLAMA: 'Genel Açıklama',
};

const ComplianceDetailModal: React.FC<ComplianceDetailModalProps> = ({ isOpen, onClose, row, result }) => {
  if (!isOpen || !row || !result) return null;

  const status = statusConfig[result.uygunluk_durumu] || statusConfig.UYGUN;
  const kural = result.eslesen_kural;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-slate-700/40 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-700/30 flex items-center justify-between ${status.bg}`}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-xs font-black ${status.color} ${status.bg} border ${status.border}`}>
              {status.label}
            </span>
            <div>
              <h3 className="text-white font-bold text-lg">{row.gilKodu}</h3>
              <p className="text-slate-400 text-sm">{row.gilAdi}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar-modal">

          {/* İşlem Bilgileri */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              İşlem Bilgileri
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Tarih', value: row.tarih },
                { label: 'Saat', value: row.saat },
                { label: 'Uzmanlık', value: row.uzmanlik },
                { label: 'Doktor', value: row.doktor },
                { label: 'Dr.Tipi', value: row.drTipi },
                { label: 'Miktar', value: String(row.miktar) },
                { label: 'Puan', value: formatNumber(row.puan) },
                { label: 'Tutar', value: `${formatNumber(row.tutar)} ₺` },
                { label: 'Hasta TC', value: row.hastaTc },
                { label: 'Adı Soyadı', value: row.adiSoyadi },
                { label: 'İşlem No', value: row.islemNo },
                { label: 'Diş No', value: row.disNumarasi || '—' },
              ].map(item => (
                <div key={item.label} className="bg-slate-800/40 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-slate-200 font-medium mt-0.5">{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Eşleşme & Güven */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Eşleşme Bilgileri
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Eşleşme</p>
                <p className={`text-sm font-bold mt-0.5 ${result.eslesmeDurumu === 'ESLESTI' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.eslesmeDurumu === 'ESLESTI' ? 'Eşleşti' : 'Eşleşemedi'}
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Güven</p>
                <p className={`text-sm font-bold mt-0.5 ${
                  result.eslesme_guveni === 'Yüksek' ? 'text-emerald-400' :
                  result.eslesme_guveni === 'Orta' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {result.eslesme_guveni}
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kaynak</p>
                <p className="text-sm text-slate-200 font-bold mt-0.5">
                  {kural?.kaynak || '—'}
                </p>
              </div>
            </div>
          </section>

          {/* Puan Karşılaştırması */}
          {kural && kural.islem_puani > 0 && (
            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Puan Karşılaştırması
              </h4>
              {(() => {
                const gilPuan = kural.gil_puani ?? kural.islem_puani;
                const puanFark = row.puan - gilPuan;
                return (
                  <div className="bg-slate-800/40 rounded-lg px-4 py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Puan</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Hastane Hekim Puanı:</span>
                      <span className="text-white font-mono font-bold">{formatNumber(row.puan)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">GİL Puanı:</span>
                      <span className="text-slate-300 font-mono">{formatNumber(gilPuan)}</span>
                    </div>
                    {puanFark !== 0 && (
                      <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-700/30">
                        <span className="text-slate-400">Fark:</span>
                        <span className={`font-mono font-bold ${puanFark > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {puanFark > 0 ? '+' : ''}{formatNumber(puanFark)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {/* İhlaller */}
          {result.ihlaller.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                İhlaller ({result.ihlaller.length})
              </h4>
              <div className="space-y-2">
                {result.ihlaller.map((ihlal, idx) => (
                  <div key={idx} className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        {ihlal.ihlal_kodu}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {kuralTipiLabels[ihlal.kural_tipi] || ihlal.kural_tipi}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{ihlal.ihlal_aciklamasi}</p>
                    {/* AI ile çıkarılan kural bilgisi */}
                    {(() => {
                      const matchingRule = kural?.parsed_rules.find(r => r.type === ihlal.kural_tipi);
                      return matchingRule?.extractionMethod === 'ai' ? (
                        <div className="mt-2 flex items-start gap-2">
                          <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded shrink-0">AI</span>
                          {matchingRule.aiExplanation && (
                            <p className="text-[11px] text-blue-300/70">{matchingRule.aiExplanation}</p>
                          )}
                          {matchingRule.confidence != null && (
                            <span className="text-[9px] text-slate-500 shrink-0 ml-auto">%{Math.round(matchingRule.confidence * 100)}</span>
                          )}
                        </div>
                      ) : null;
                    })()}
                    {ihlal.referans_kural_metni && (
                      <div className="mt-2 pt-2 border-t border-red-500/10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Referans Kural Metni</p>
                        <p className="text-xs text-slate-400 italic">{'"'}{ihlal.referans_kural_metni}{'"'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bölüm Başlığı (Miras) */}
          {kural?.section_header && (
            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Bölüm Başlığı Kuralı
              </h4>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-300 leading-relaxed whitespace-pre-wrap">{kural.section_header}</p>
              </div>
            </section>
          )}

          {/* Mevzuat Açıklaması */}
          {kural?.aciklama_raw && (
            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Mevzuat Açıklaması (Ham Metin)
              </h4>
              <div className="bg-slate-800/40 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{kural.aciklama_raw}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
          >
            Kapat
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar-modal::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-modal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-modal::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .custom-scrollbar-modal::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default ComplianceDetailModal;
