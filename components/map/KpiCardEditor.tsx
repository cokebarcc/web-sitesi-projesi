import React, { useState, useEffect } from 'react';
import type { KpiCardData, KpiIconName } from '../../src/services/kpiCardStorage';

/** ── İkon kütüphanesi ── */
const ICON_OPTIONS: { name: KpiIconName; label: string }[] = [
  { name: 'calendar', label: 'Takvim' },
  { name: 'users', label: 'Kullanıcılar' },
  { name: 'hospital', label: 'Hastane' },
  { name: 'chart', label: 'Grafik' },
  { name: 'heart', label: 'Kalp' },
  { name: 'clipboard', label: 'Pano' },
  { name: 'clock', label: 'Saat' },
  { name: 'star', label: 'Yıldız' },
  { name: 'shield', label: 'Kalkan' },
  { name: 'activity', label: 'Aktivite' },
  { name: 'truck', label: 'Ambulans' },
  { name: 'phone', label: 'Telefon' },
  { name: 'document', label: 'Belge' },
  { name: 'home', label: 'Ev' },
];

export function renderKpiIcon(name: KpiIconName, className = 'w-5 h-5') {
  const props = { className, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', strokeWidth: 1.5 };
  switch (name) {
    case 'calendar':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
    case 'users':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
    case 'hospital':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>;
    case 'chart':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
    case 'heart':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>;
    case 'clipboard':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H10.5a2.25 2.25 0 00-2.15 1.586m0 0a48.11 48.11 0 013.478-.397m7.5.648c.297.066.577.149.839.247" /></svg>;
    case 'clock':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'star':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>;
    case 'shield':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
    case 'activity':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
    case 'truck':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0h-2.25m0 0v-.375c0-.621.504-1.125 1.125-1.125H14.25M9.75 6.75h.008v.008H9.75V6.75z" /></svg>;
    case 'phone':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>;
    case 'document':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
    case 'home':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>;
    default:
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
  }
}

interface KpiCardEditorProps {
  cards: KpiCardData[];
  isDark: boolean;
  /** Otomatik veri kaynağına bağlı kart ID'leri — bu kartlar düzenlenemez */
  autoCardIds?: Set<string>;
  onSave: (cards: KpiCardData[]) => void;
  onClose: () => void;
}

const KpiCardEditor: React.FC<KpiCardEditorProps> = ({ cards, isDark, autoCardIds, onSave, onClose }) => {
  // İlk açılışta kartları kopyala — sonraki Firestore güncellemeleri local state'i ezmesin
  const [editCards, setEditCards] = useState<KpiCardData[]>(() => {
    const editable = cards.filter(c => !autoCardIds?.has(c.id));
    return JSON.parse(JSON.stringify(editable));
  });

  const updateCard = (idx: number, field: keyof KpiCardData, value: string) => {
    setEditCards(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addCard = () => {
    setEditCards(prev => [
      ...prev,
      {
        id: 'kpi-' + Date.now().toString(36),
        title: 'Yeni Kart',
        value: '0',
        subtitle: 'Açıklama',
        icon: 'chart' as KpiIconName,
        order: prev.length,
      },
    ]);
  };

  const removeCard = (idx: number) => {
    setEditCards(prev => prev.filter((_, i) => i !== idx));
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= editCards.length) return;
    setEditCards(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  };

  const handleSave = () => {
    // Düzenlenebilir kartları + otomatik kartları birleştir
    const autoCards = cards.filter(c => autoCardIds?.has(c.id));
    const allCards = [...editCards.map((c, i) => ({ ...c, order: i })), ...autoCards];
    onSave(allCards.sort((a, b) => a.order - b.order));
  };

  const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-slate-800/80 border-white/10 text-white placeholder-slate-500 focus:border-sky-500/50'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500'
  }`;

  const labelCls = `text-[10px] font-semibold uppercase tracking-wider mb-1 block ${
    isDark ? 'text-slate-400' : 'text-slate-500'
  }`;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isDark
            ? 'bg-[#0f1729] border-white/10'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
          isDark ? 'border-white/[0.06]' : 'border-slate-100'
        }`}>
          <div>
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              KPI Kartları Düzenle
            </h2>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Kart içeriklerini, ikonlarını ve sıralamasını değiştirin
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {editCards.map((card, idx) => (
            <div
              key={card.id}
              className={`rounded-xl border p-4 ${
                isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Kart {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveCard(idx, -1)}
                    disabled={idx === 0}
                    className={`p-1 rounded transition-colors disabled:opacity-30 ${
                      isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                    }`}
                    title="Yukarı taşı"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveCard(idx, 1)}
                    disabled={idx === editCards.length - 1}
                    className={`p-1 rounded transition-colors disabled:opacity-30 ${
                      isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                    }`}
                    title="Aşağı taşı"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {editCards.length > 1 && (
                    <button
                      onClick={() => removeCard(idx)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Kartı sil"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Başlık</label>
                  <input
                    className={inputCls}
                    value={card.title}
                    onChange={(e) => updateCard(idx, 'title', e.target.value)}
                    placeholder="Kart başlığı"
                  />
                </div>
                <div>
                  <label className={labelCls}>Değer</label>
                  <input
                    className={inputCls}
                    value={card.value}
                    onChange={(e) => updateCard(idx, 'value', e.target.value)}
                    placeholder="Sayı veya metin"
                  />
                </div>
                <div>
                  <label className={labelCls}>Alt Yazı</label>
                  <input
                    className={inputCls}
                    value={card.subtitle}
                    onChange={(e) => updateCard(idx, 'subtitle', e.target.value)}
                    placeholder="Açıklama"
                  />
                </div>
                <div>
                  <label className={labelCls}>İkon</label>
                  <select
                    className={inputCls}
                    value={card.icon}
                    onChange={(e) => updateCard(idx, 'icon', e.target.value)}
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.name} value={opt.name}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Icon preview */}
              <div className={`mt-3 flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>Önizleme:</span>
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/[0.05]' : 'bg-black/[0.03]'}`}>
                  {renderKpiIcon(card.icon, 'w-4 h-4')}
                </div>
                <span className="font-semibold">{card.value}</span>
                <span>{card.title}</span>
              </div>
            </div>
          ))}

          {/* Yeni kart ekle */}
          {editCards.length < 6 && (
            <button
              onClick={addCard}
              className={`w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors ${
                isDark
                  ? 'border-white/10 text-slate-400 hover:border-sky-500/30 hover:text-sky-400'
                  : 'border-slate-200 text-slate-400 hover:border-sky-400 hover:text-sky-600'
              }`}
            >
              + Yeni Kart Ekle
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0 ${
          isDark ? 'border-white/[0.06]' : 'border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? 'text-slate-400 hover:bg-white/[0.06]'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-sm"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};

export default KpiCardEditor;
