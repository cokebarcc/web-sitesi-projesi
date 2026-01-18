import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface DropdownOption {
  value: string | number;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: DropdownOption[];
  selectedValues: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxDisplayItems?: number;
  showSearch?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  singleSelect?: boolean; // Tek seçim modu
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Seçiniz...',
  disabled = false,
  maxDisplayItems = 2,
  showSearch = true,
  emptyMessage = 'Seçenek bulunamadı',
  compact = false,
  singleSelect = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtrelenmiş seçenekler
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Açıldığında arama kutusuna fokusla
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Seçim toggle
  const toggleOption = useCallback((value: string | number) => {
    if (singleSelect) {
      // Tek seçim modunda: seçili olanı tekrar tıklarsa temizle, değilse yeni değeri seç
      if (selectedValues.includes(value)) {
        onChange([]);
      } else {
        onChange([value]);
      }
      setIsOpen(false); // Tek seçimde otomatik kapat
      setSearchTerm('');
      setFocusedIndex(-1);
    } else {
      // Çoklu seçim modu
      if (selectedValues.includes(value)) {
        onChange(selectedValues.filter(v => v !== value));
      } else {
        onChange([...selectedValues, value]);
      }
    }
  }, [selectedValues, onChange, singleSelect]);

  // Tümünü seç / kaldır
  const selectAll = () => {
    const allValues = filteredOptions.map(o => o.value);
    onChange(allValues);
  };

  const clearAll = () => {
    onChange([]);
  };

  // Klavye navigasyonu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          toggleOption(filteredOptions[focusedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
        }
        break;
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        } else if (focusedIndex >= 0 && focusedIndex < filteredOptions.length && !showSearch) {
          e.preventDefault();
          toggleOption(filteredOptions[focusedIndex].value);
        }
        break;
    }
  };

  // Fokus edilen öğeyi görünür yap
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  // Seçili değerlerin görüntülenmesi
  const renderSelectedDisplay = () => {
    if (selectedValues.length === 0) {
      return <span className="text-[var(--text-placeholder)]">{placeholder}</span>;
    }

    const selectedOptions = options.filter(o => selectedValues.includes(o.value));

    // Tek seçim modunda sadece metin göster
    if (singleSelect) {
      return (
        <span className="text-[var(--text-1)] truncate">
          {selectedOptions[0]?.label || placeholder}
        </span>
      );
    }

    // Çoklu seçim modunda badge'ler göster
    const displayedOptions = selectedOptions.slice(0, maxDisplayItems);
    const remainingCount = selectedOptions.length - maxDisplayItems;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {displayedOptions.map(opt => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium border border-emerald-500/30"
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleOption(opt.value);
              }}
              className="hover:text-emerald-100 focus:outline-none"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 bg-[var(--surface-3)] text-[var(--text-2)] rounded text-xs font-medium border border-[var(--border-1)]">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`} ref={containerRef}>
      <label className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-[var(--text-3)]`}>{label}</label>
      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full ${compact ? 'min-w-[140px] px-3 py-2 rounded-lg h-[38px]' : 'min-w-[180px] px-3 py-2.5 rounded-xl'} text-left border transition-all
            flex items-center justify-between gap-2
            ${disabled
              ? 'bg-[var(--surface-2)] border-[var(--border-1)] cursor-not-allowed opacity-60'
              : isOpen
                ? 'bg-[var(--input-bg)] border-blue-500/50 ring-2 ring-blue-500/20'
                : 'bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--input-border-hover)]'
            }
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex-1 min-w-0 truncate text-sm text-[var(--text-1)]">
            {renderSelectedDisplay()}
          </div>
          <svg
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute z-[9999] mt-1 w-full min-w-[220px] bg-[#0f172a] border border-[var(--glass-border-light)] rounded-xl shadow-2xl overflow-hidden"
            role="listbox"
            aria-multiselectable="true"
          >
            {/* Search Input */}
            {showSearch && options.length > 5 && (
              <div className="p-2 border-b border-slate-700/50 bg-[#0f172a]">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setFocusedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ara..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[#1e293b] border border-slate-600/50 rounded-lg text-[var(--text-1)] placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                </div>
              </div>
            )}

            {/* Select All / Clear All - Sadece çoklu seçimde göster */}
            {!singleSelect && filteredOptions.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-[#1e293b]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Tümünü Seç
                </button>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-2)] font-medium"
                  >
                    Temizle
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div
              ref={listRef}
              className="max-h-[240px] overflow-y-auto bg-[#0f172a]"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center bg-[#0f172a]">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = selectedValues.includes(option.value);
                  const isFocused = focusedIndex === index;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOption(option.value)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors
                        ${isSelected ? 'bg-emerald-600/30 text-emerald-300' : 'text-[var(--text-2)] bg-[#0f172a]'}
                        ${isFocused ? 'bg-slate-700/50' : ''}
                        ${!isSelected && !isFocused ? 'hover:bg-slate-700/50' : ''}
                      `}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className={`
                        w-4 h-4 ${singleSelect ? 'rounded-full' : 'rounded'} border flex items-center justify-center flex-shrink-0 transition-colors
                        ${isSelected
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-[var(--border-2)]'
                        }
                      `}>
                        {isSelected && (
                          singleSelect ? (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          ) : (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )
                        )}
                      </div>
                      <span className="truncate font-medium">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSelectDropdown;
