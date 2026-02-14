import React, { useState, useEffect } from 'react';
import type { InstitutionMarker, InstitutionType } from '../../src/data/sanliurfaDistricts';
import { INSTITUTION_STYLES } from '../../src/data/sanliurfaDistricts';

const TYPE_OPTIONS: { value: InstitutionType; label: string }[] = [
  { value: 'ISM',       label: 'Il Saglik Mudurlugu' },
  { value: 'HASTANE',   label: 'Kamu Hastanesi' },
  { value: 'OZEL',      label: 'Ozel Hastane' },
  { value: 'UNIVERSITE',label: 'Universite Hastanesi' },
  { value: 'SEHIR',     label: 'Sehir Hastanesi' },
  { value: 'ILCE_SM',   label: 'Ilce Saglik Mudurlugu' },
  { value: 'ADSH',      label: 'ADSH / ADSM' },
];

interface PinEditorPanelProps {
  theme: 'dark' | 'light';
  marker: Partial<InstitutionMarker> | null; // null = yeni pin, dolu = düzenleme
  onSave: (marker: Omit<InstitutionMarker, 'id'> & { id?: string }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const PinEditorPanel: React.FC<PinEditorPanelProps> = ({
  theme,
  marker,
  onSave,
  onDelete,
  onCancel,
}) => {
  const isDark = theme === 'dark';
  const isEditing = !!marker?.id;

  const [name, setName] = useState(marker?.name || '');
  const [type, setType] = useState<InstitutionType>(marker?.type || 'HASTANE');

  useEffect(() => {
    setName(marker?.name || '');
    setType(marker?.type || 'HASTANE');
  }, [marker]);

  const handleSave = () => {
    if (!name.trim() || !marker?.lat || !marker?.lng) return;
    onSave({
      ...(marker?.id ? { id: marker.id } : {}),
      name: name.trim(),
      type,
      lat: marker.lat,
      lng: marker.lng,
    });
  };

  const selectedStyle = INSTITUTION_STYLES[type];

  return (
    <div className={`p-4 rounded-xl border ${
      isDark
        ? 'bg-[#0f1729]/95 border-white/10 backdrop-blur-sm'
        : 'bg-white/95 border-slate-200 backdrop-blur-sm'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {isEditing ? 'Pin Duzenle' : 'Yeni Pin Ekle'}
        </h3>
        <button
          onClick={onCancel}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Koordinat */}
      <div className={`text-[10px] font-mono mb-3 px-2 py-1.5 rounded-lg ${
        isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'
      }`}>
        {marker?.lat?.toFixed(6)}°N, {marker?.lng?.toFixed(6)}°E
      </div>

      {/* Kurum Tipi */}
      <div className="mb-3">
        <label className={`text-[10px] font-semibold uppercase tracking-wider block mb-1.5 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Kurum Tipi
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPE_OPTIONS.map((opt) => {
            const style = INSTITUTION_STYLES[opt.value];
            const isSelected = type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                  isSelected
                    ? 'border-current'
                    : isDark
                      ? 'border-white/5 hover:border-white/15'
                      : 'border-slate-100 hover:border-slate-300'
                }`}
                style={{
                  color: isSelected ? style.bg : isDark ? '#94a3b8' : '#64748b',
                  backgroundColor: isSelected ? `${style.bg}15` : 'transparent',
                }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: style.bg }}
                >
                  {style.label}
                </div>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kurum Adı */}
      <div className="mb-4">
        <label className={`text-[10px] font-semibold uppercase tracking-wider block mb-1.5 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Kurum Adi
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ornek: Sanliurfa EAH"
          className={`w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
            isDark
              ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500/50'
              : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
          }`}
        />
      </div>

      {/* Önizleme */}
      <div className={`flex items-center gap-2 mb-4 p-2 rounded-lg ${
        isDark ? 'bg-white/5' : 'bg-slate-50'
      }`}>
        <div
          className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
          style={{
            width: selectedStyle.size,
            height: selectedStyle.size,
            backgroundColor: selectedStyle.bg,
            fontSize: type === 'ISM' || type === 'ILCE_SM' ? 9 : selectedStyle.size >= 32 ? 13 : 11,
          }}
        >
          {selectedStyle.label}
        </div>
        <span className={`text-xs truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {name || 'Kurum adi girilmedi'}
        </span>
      </div>

      {/* Butonlar */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: '#3b82f6' }}
        >
          {isEditing ? 'Guncelle' : 'Kaydet'}
        </button>
        {isEditing && onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 transition-all border border-red-500/20 hover:bg-red-500/10"
          >
            Sil
          </button>
        )}
        <button
          onClick={onCancel}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            isDark
              ? 'text-slate-400 hover:bg-white/5'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          Iptal
        </button>
      </div>
    </div>
  );
};

export default PinEditorPanel;
