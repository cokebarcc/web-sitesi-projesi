/**
 * Tek Tarih Seçici Bileşeni
 *
 * DateRangeCalendar ile aynı modern görünüme sahip,
 * tek tarih seçimi için tasarlanmış bileşen.
 */

import React, { useState, useRef, useEffect } from 'react';

interface SingleDatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD formatında
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTH_NAMES_SHORT = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Tarih seçiniz...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Başlangıç görünümü - seçili tarih veya bugün
  const getInitialView = () => {
    if (value) {
      const d = new Date(value);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  };

  const [viewYear, setViewYear] = useState<number>(getInitialView().year);
  const [viewMonth, setViewMonth] = useState<number>(getInitialView().month);

  // Dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Değer değişince görünümü güncelle
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth() + 1);
    }
  }, [value]);

  // Takvim günlerini oluştur
  const generateCalendarDays = () => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const daysInMonth = lastDay.getDate();

    // Pazartesi = 0, Pazar = 6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: (number | null)[] = [];

    // Önceki ayın günleri
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Bu ayın günleri
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Tarih tıklama
  const handleDateClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  // Ay değiştir
  const changeMonth = (delta: number) => {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;

    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }

    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  // Bugüne git
  const goToToday = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    onChange(dateStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setIsOpen(false);
  };

  // Temizle
  const clearSelection = () => {
    onChange('');
  };

  // Görüntü metni
  const getDisplayText = () => {
    if (!value) return placeholder;

    const d = new Date(value);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth() + 1]} ${d.getFullYear()}`;
  };

  // Klavye navigasyonu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Enter':
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        }
        break;
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-slate-400">{label}</label>
      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full min-w-[200px] px-3 py-2.5 text-left rounded-xl border transition-all
            flex items-center justify-between gap-2
            ${disabled
              ? 'bg-slate-700/30 border-slate-600 cursor-not-allowed opacity-60'
              : isOpen
                ? 'bg-slate-700/50 border-orange-500 ring-2 ring-orange-500/20'
                : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
            }
          `}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm truncate ${value ? 'text-white font-medium' : 'text-slate-400'}`}>
              {getDisplayText()}
            </span>
          </div>
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              className="p-0.5 hover:bg-slate-600 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400 hover:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Calendar Popover */}
        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-4 min-w-[300px]">
            {/* Header - Ay/Yıl Navigasyonu */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="font-semibold text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Gün İsimleri */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(day => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Günler */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-9" />;
                }

                const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === dateStr;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    className={`
                      h-9 w-full rounded-lg text-sm font-medium transition-all relative
                      ${isSelected
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : isToday
                          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-700'
                      }
                    `}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium"
              >
                Bugün
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    clearSelection();
                    setIsOpen(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleDatePicker;
