import React from 'react';
import { ComplianceResult, RuleMasterEntry, IhlalDetay, CakisanIslem } from '../src/types/complianceTypes';
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
  UYGUN: { label: 'UYGUN', color: 'status-success', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  UYGUNSUZ: { label: 'UYGUNSUZ', color: 'status-danger', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  MANUEL_INCELEME: { label: 'MANUEL İNCELEME', color: 'status-warning', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
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
      <div className="relative border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-2)' }}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${status.bg}`} style={{ borderColor: 'var(--border-2)' }}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-xs font-black ${status.color} ${status.bg} border ${status.border}`}>
              {status.label}
            </span>
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>{row.gilKodu}</h3>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>{row.gilAdi}</p>
            </div>
          </div>
          <button onClick={onClose} className="transition-colors p-1" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar-modal">

          {/* İşlem Bilgileri */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
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
                // Dinamik ekstra alanlar
                ...Object.entries(row)
                  .filter(([key]) => !['tarih','saat','uzmanlik','doktor','drTipi','gilKodu','gilAdi','miktar','puan','toplamPuan','fiyat','tutar','hastaTc','adiSoyadi','islemNo','disNumarasi'].includes(key))
                  .map(([key, value]) => ({ label: key, value: String(value ?? '') })),
              ].map(item => (
                <div key={item.label} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-2)' }}>{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Eşleşme & Güven */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Eşleşme Bilgileri
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Eşleşme</p>
                <p className={`text-sm font-bold mt-0.5 ${result.eslesmeDurumu === 'ESLESTI' ? 'status-success' : 'status-danger'}`}>
                  {result.eslesmeDurumu === 'ESLESTI' ? 'Eşleşti' : 'Eşleşemedi'}
                </p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Güven</p>
                <p className={`text-sm font-bold mt-0.5 ${
                  result.eslesme_guveni === 'Yüksek' ? 'status-success' :
                  result.eslesme_guveni === 'Orta' ? 'status-warning' : 'status-danger'
                }`}>
                  {result.eslesme_guveni}
                </p>
                {result.guvenNedeni && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{result.guvenNedeni}</p>
                )}
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Kaynak</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-2)' }}>
                  {kural?.kaynak || '—'}
                </p>
              </div>
            </div>
          </section>

          {/* Puan Karşılaştırması */}
          {kural && kural.islem_puani > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Puan Karşılaştırması
              </h4>
              {(() => {
                const gilPuan = kural.gil_puani ?? kural.islem_puani;
                const puanFark = row.puan - gilPuan;
                return (
                  <div className="rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Puan</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>Hastane Hekim Puanı:</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>{formatNumber(row.puan)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>GİL Puanı:</span>
                      <span className="font-mono" style={{ color: 'var(--text-2)' }}>{formatNumber(gilPuan)}</span>
                    </div>
                    {puanFark !== 0 && (
                      <div className="flex justify-between text-sm mt-1 pt-1 border-t" style={{ borderColor: 'var(--border-2)' }}>
                        <span style={{ color: 'var(--text-3)' }}>Fark:</span>
                        <span className={`font-mono font-bold ${puanFark > 0 ? 'status-warning' : 'status-success'}`}>
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
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                İhlaller ({result.ihlaller.length})
              </h4>
              <div className="space-y-2">
                {result.ihlaller.map((ihlal, idx) => (
                  <div key={idx} className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        {ihlal.ihlal_kodu}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                        {kuralTipiLabels[ihlal.kural_tipi] || ihlal.kural_tipi}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>{ihlal.ihlal_aciklamasi}</p>
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
                            <span className="text-[9px] shrink-0 ml-auto" style={{ color: 'var(--text-muted)' }}>%{Math.round(matchingRule.confidence * 100)}</span>
                          )}
                        </div>
                      ) : null;
                    })()}
                    {ihlal.referans_kural_metni && (
                      <div className="mt-2 pt-2 border-t border-red-500/10">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Referans Kural Metni</p>
                          {ihlal.kaynak && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              {ihlal.kaynak}
                            </span>
                          )}
                          {ihlal.fromSectionHeader && (
                            <span className="text-[9px] font-medium border px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                              Bölüm Başlığı
                            </span>
                          )}
                        </div>
                        <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>{'"'}{ihlal.referans_kural_metni}{'"'}</p>
                      </div>
                    )}
                    {/* Çakışan İşlemler */}
                    {ihlal.cakisanIslemler && ihlal.cakisanIslemler.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-red-500/10">
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">
                          {ihlal.kural_tipi === 'BIRLIKTE_YAPILAMAZ' ? 'Çakışan İşlemler' : 'İlgili İşlemler'} ({ihlal.cakisanIslemler.length})
                        </p>
                        <div className="space-y-1.5">
                          {ihlal.cakisanIslemler.map((ci, ciIdx) => (
                            <div key={ciIdx} className="bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-orange-300 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                  {ci.gilKodu}
                                </span>
                                <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-3)' }}>
                                  {ci.gilAdi}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px]">
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Tarih:</span>
                                  <span className="font-medium" style={{ color: 'var(--text-2)' }}>{ci.tarih}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Saat:</span>
                                  <span className="font-medium" style={{ color: 'var(--text-2)' }}>{ci.saat || '—'}</span>
                                </div>
                                <div className="flex justify-between col-span-2">
                                  <span style={{ color: 'var(--text-muted)' }}>Hekim:</span>
                                  <span className="font-medium truncate ml-1" style={{ color: 'var(--text-2)' }}>{ci.doktor || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Branş:</span>
                                  <span className="font-medium truncate ml-1" style={{ color: 'var(--text-2)' }}>{ci.uzmanlik || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Puan:</span>
                                  <span className="font-mono font-medium" style={{ color: 'var(--text-2)' }}>{formatNumber(ci.puan)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Tutar:</span>
                                  <span className="font-mono font-medium" style={{ color: 'var(--text-2)' }}>{formatNumber(ci.tutar)} ₺</span>
                                </div>
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--text-muted)' }}>Miktar:</span>
                                  <span className="font-mono font-medium" style={{ color: 'var(--text-2)' }}>{ci.miktar}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
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
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Mevzuat Açıklaması (Ham Metin)
              </h4>
              <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-3)' }}>{kural.aciklama_raw}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border-2)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
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
