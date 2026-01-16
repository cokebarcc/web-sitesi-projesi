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
  emptyMessage = 'Seçenek bulunamadı'
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
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  }, [selectedValues, onChange]);

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
      return <span className="text-slate-400">{placeholder}</span>;
    }

    const selectedOptions = options.filter(o => selectedValues.includes(o.value));
    const displayedOptions = selectedOptions.slice(0, maxDisplayItems);
    const remainingCount = selectedOptions.length - maxDisplayItems;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {displayedOptions.map(opt => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium"
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleOption(opt.value);
              }}
              className="hover:text-emerald-900 focus:outline-none"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full min-w-[180px] px-3 py-2.5 text-left rounded-xl border transition-all
            flex items-center justify-between gap-2
            ${disabled
              ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
              : isOpen
                ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex-1 min-w-0 truncate text-sm">
            {renderSelectedDisplay()}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
            className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
            role="listbox"
            aria-multiselectable="true"
          >
            {/* Search Input */}
            {showSearch && options.length > 5 && (
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Select All / Clear All */}
            {filteredOptions.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Tümünü Seç
                </button>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Temizle
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div
              ref={listRef}
              className="max-h-[240px] overflow-y-auto"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">
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
                        ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}
                        ${isFocused ? 'bg-slate-100' : ''}
                        ${!isSelected && !isFocused ? 'hover:bg-slate-50' : ''}
                      `}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className={`
                        w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                        ${isSelected
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300'
                        }
                      `}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
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
