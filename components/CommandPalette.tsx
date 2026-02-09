import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ViewType } from '../types';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  view: ViewType;
  keywords: string[];
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
  hasModuleAccess: (module: string) => boolean;
}

const ALL_COMMANDS: CommandItem[] = [
  // Ana
  { id: 'welcome', label: 'Ana Sayfa', category: 'Genel', view: 'welcome', keywords: ['ana', 'sayfa', 'home', 'başlangıç'] },

  // MHRS
  { id: 'detailed-schedule', label: 'Detaylı Cetveller', category: 'MHRS', view: 'detailed-schedule', keywords: ['cetvel', 'detay', 'schedule', 'mhrs', 'veri', 'yükle'] },
  { id: 'physician-data', label: 'Hekim Verileri', category: 'MHRS', view: 'physician-data', keywords: ['hekim', 'doktor', 'muayene', 'physician', 'data'] },
  { id: 'change-analysis', label: 'Değişim Analizleri', category: 'MHRS', view: 'change-analysis', keywords: ['değişim', 'analiz', 'change', 'karşılaştırma', 'fark'] },
  { id: 'efficiency-analysis', label: 'Verimlilik Analizleri', category: 'MHRS', view: 'efficiency-analysis', keywords: ['verimlilik', 'efficiency', 'performans', 'analiz'] },
  { id: 'active-demand', label: 'Aktif Talep', category: 'MHRS', view: 'active-demand', keywords: ['aktif', 'talep', 'demand', 'randevu'] },
  { id: 'ai-cetvel', label: 'AI Cetvel Planlama', category: 'MHRS', view: 'ai-cetvel-planlama', keywords: ['ai', 'yapay', 'zeka', 'cetvel', 'planlama', 'otomatik'] },

  // Acil Servis
  { id: 'emergency', label: 'Yeşil Alan Oranları', category: 'Acil Servis', view: 'emergency-service', keywords: ['acil', 'yeşil', 'alan', 'oran', 'emergency'] },

  // GÖREN
  { id: 'goren-ilsm', label: 'GÖREN - İl Sağlık Müdürlüğü', category: 'GÖREN Performans', view: 'goren-ilsm', keywords: ['gören', 'il', 'sağlık', 'müdürlük'] },
  { id: 'goren-ilcesm', label: 'GÖREN - İlçe Sağlık Müdürlüğü', category: 'GÖREN Performans', view: 'goren-ilcesm', keywords: ['gören', 'ilçe', 'sağlık'] },
  { id: 'goren-bh', label: 'GÖREN - Başhekimlik', category: 'GÖREN Performans', view: 'goren-bh', keywords: ['gören', 'başhekim', 'hekim'] },
  { id: 'goren-adsh', label: 'GÖREN - ADSH', category: 'GÖREN Performans', view: 'goren-adsh', keywords: ['gören', 'adsh', 'diş'] },
  { id: 'goren-ash', label: 'GÖREN - Acil Sağlık', category: 'GÖREN Performans', view: 'goren-ash', keywords: ['gören', 'acil', 'sağlık'] },

  // Finansal
  { id: 'service-analysis', label: 'Hizmet Girişim Analizi', category: 'Finansal', view: 'service-analysis', keywords: ['hizmet', 'girişim', 'analiz', 'sut', 'finansal'] },
  { id: 'etik-kurul', label: 'Etik Kurul', category: 'Finansal', view: 'etik-kurul', keywords: ['etik', 'kurul', 'komisyon'] },
  { id: 'hekim-islem', label: 'Hekim İşlem Listesi', category: 'Finansal', view: 'hekim-islem-listesi', keywords: ['hekim', 'işlem', 'liste'] },
  { id: 'sut-mevzuati', label: 'SUT Mevzuatı', category: 'Finansal', view: 'sut-mevzuati', keywords: ['sut', 'mevzuat', 'tıbbi'] },

  // Hazırlama
  { id: 'analysis-module', label: 'Analiz Modülü', category: 'Hazırlama', view: 'analysis-module', keywords: ['analiz', 'modül'] },
  { id: 'schedule-planning', label: 'Cetvel Planlama', category: 'Hazırlama', view: 'schedule-planning', keywords: ['cetvel', 'planlama', 'schedule'] },
  { id: 'presentation', label: 'Sunum Oluştur', category: 'Hazırlama', view: 'presentation', keywords: ['sunum', 'rapor', 'pptx', 'pdf', 'word'] },

  // Destek
  { id: 'ai-chatbot', label: 'AI Asistan', category: 'Destek', view: 'ai-chatbot', keywords: ['ai', 'chat', 'asistan', 'sohbet', 'yapay', 'zeka'] },
  { id: 'goren', label: 'GÖREN Başarı', category: 'Destek', view: 'goren', keywords: ['gören', 'başarı'] },
  { id: 'pdf-viewer', label: 'PDF Yükle', category: 'Destek', view: 'pdf-viewer', keywords: ['pdf', 'dosya', 'yükle', 'oku'] },
  { id: 'comparison-wizard', label: 'Veri Karşılaştırma', category: 'Destek', view: 'comparison-wizard', keywords: ['karşılaştır', 'compare', 'wizard', 'fark', 'delta', 'dönem'] }
];

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  hasModuleAccess
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS;

    const q = query.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
    return ALL_COMMANDS.filter(cmd => {
      const label = cmd.label.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
      const category = cmd.category.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
      const keywords = cmd.keywords.join(' ').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');

      return label.includes(q) || category.includes(q) || keywords.includes(q);
    });
  }, [query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onNavigate(filteredCommands[selectedIndex].view);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onNavigate, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden border border-[#2d4163]/40 shadow-2xl shadow-black/50"
        style={{ background: 'rgba(15, 23, 41, 0.95)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-5 border-b border-[#2d4163]/30">
          <svg className="w-5 h-5 text-[#556a85] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Modül ara veya komut yaz..."
            className="flex-1 bg-transparent text-[#e8edf5] placeholder-[#556a85] px-4 py-4 outline-none text-sm"
          />
          <kbd className="px-2 py-1 rounded-md bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[#556a85] text-[10px] font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
          {filteredCommands.length === 0 && (
            <div className="py-8 text-center text-[#556a85] text-sm">
              Sonuç bulunamadı
            </div>
          )}

          {Object.entries(groupedCommands).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#556a85]">
                {category}
              </div>
              {items.map((item) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-index={currentIndex}
                    onClick={() => {
                      onNavigate(item.view);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150
                      ${isSelected
                        ? 'bg-[#5b9cff]/10 text-white'
                        : 'text-[#a8b8d0] hover:bg-[#1e2d48]/50'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#5b9cff]/20 text-[#5b9cff]' : 'bg-[#1e2d48]/60 text-[#556a85]'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.label}</div>
                    </div>
                    {isSelected && (
                      <kbd className="px-1.5 py-0.5 rounded bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[#556a85] text-[9px] font-mono">
                        Enter
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#2d4163]/30 flex items-center justify-between text-[#3d5170] text-[10px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[8px] font-mono">↑↓</kbd>
              Gezin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[8px] font-mono">Enter</kbd>
              Aç
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[8px] font-mono">Esc</kbd>
              Kapat
            </span>
          </div>
          <span>{filteredCommands.length} sonuç</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
