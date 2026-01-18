import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface DateRange {
  start: string | null; // YYYY-MM-DD
  end: string | null;   // YYYY-MM-DD
}

interface DateRangeCalendarProps {
  label: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  availableDates: string[]; // YYYY-MM-DD formatında müsait tarihler
  activeYear: number | null;
  activeMonth: number | null; // 1-12
  disabled?: boolean;
  placeholder?: string;
}

const MONTH_NAMES = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTH_NAMES_SHORT = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  label,
  value,
  onChange,
  availableDates,
  activeYear,
  activeMonth,
  disabled = false,
  placeholder = 'Tarih aralığı seçiniz...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState<number>(activeYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(activeMonth || new Date().getMonth() + 1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aktif yıl/ay değişince takvim görünümünü güncelle
  useEffect(() => {
    if (activeYear && activeMonth) {
      setViewYear(activeYear);
      setViewMonth(activeMonth);
    }
  }, [activeYear, activeMonth]);

  // Dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoverDate(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Müsait tarihler set'i
  const availableDatesSet = useMemo(() => new Set(availableDates), [availableDates]);

  // Seçili aralıktaki tarihler
  const getSelectedDates = (): Set<string> => {
    if (!value.start) return new Set();
    if (!value.end) return new Set([value.start]);

    const dates = new Set<string>();
    const start = new Date(value.start);
    const end = new Date(value.end);
    const current = new Date(Math.min(start.getTime(), end.getTime()));
    const endDate = new Date(Math.max(start.getTime(), end.getTime()));

    while (current <= endDate) {
      dates.add(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // Hover aralığındaki tarihler (seçim sırasında)
  const getHoverRange = (): Set<string> => {
    if (!value.start || value.end || !hoverDate) return new Set();

    const dates = new Set<string>();
    const start = new Date(value.start);
    const hover = new Date(hoverDate);
    const min = new Date(Math.min(start.getTime(), hover.getTime()));
    const max = new Date(Math.max(start.getTime(), hover.getTime()));

    while (min <= max) {
      dates.add(min.toISOString().split('T')[0]);
      min.setDate(min.getDate() + 1);
    }

    return dates;
  };

  const selectedDates = getSelectedDates();
  const hoverRange = getHoverRange();

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

    if (!availableDatesSet.has(dateStr)) return;

    if (!value.start || value.end) {
      // Yeni aralık başlat
      onChange({ start: dateStr, end: null });
    } else {
      // Bitiş tarihi seç
      const start = new Date(value.start);
      const end = new Date(dateStr);

      if (end < start) {
        onChange({ start: dateStr, end: value.start });
      } else {
        onChange({ start: value.start, end: dateStr });
      }
    }
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

  // Temizle
  const clearSelection = () => {
    onChange({ start: null, end: null });
    setHoverDate(null);
  };

  // Görüntü metni
  const getDisplayText = () => {
    if (!value.start) return placeholder;

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth() + 1]}`;
    };

    if (!value.end) {
      return `${formatDate(value.start)} - ...`;
    }

    return `${formatDate(value.start)} – ${formatDate(value.end)}`;
  };

  // Seçili gün sayısı
  const getSelectedDayCount = () => {
    if (!value.start || !value.end) return 0;
    const start = new Date(value.start);
    const end = new Date(value.end);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
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

  const isDisabled = disabled || !activeYear || !activeMonth;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-slate-400">{label}</label>
      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className={`
            w-full min-w-[200px] px-3 py-2.5 text-left rounded-xl border transition-all
            flex items-center justify-between gap-2
            ${isDisabled
              ? 'bg-slate-700/30 border-slate-600 cursor-not-allowed opacity-60'
              : isOpen
                ? 'bg-slate-700/50 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
            }
          `}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm truncate ${value.start ? 'text-white font-medium' : 'text-slate-400'}`}>
              {getDisplayText()}
            </span>
          </div>
          {value.start && !isDisabled && (
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
          <div className="absolute z-50 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-4 min-w-[300px]">
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
                const isAvailable = availableDatesSet.has(dateStr);
                const isSelected = selectedDates.has(dateStr);
                const isInHoverRange = hoverRange.has(dateStr);
                const isStart = value.start === dateStr;
                const isEnd = value.end === dateStr;
                const isToday = dateStr === new Date().toISOString().split('T')[0];

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    onMouseEnter={() => isAvailable && setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                    disabled={!isAvailable}
                    className={`
                      h-9 w-full rounded-lg text-sm font-medium transition-all relative
                      ${!isAvailable
                        ? 'text-slate-600 cursor-not-allowed'
                        : isStart || isEnd
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : isSelected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isInHoverRange
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isToday
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-700'
                      }
                    `}
                  >
                    {day}
                    {isToday && !isSelected && !isStart && !isEnd && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {value.start && value.end ? (
                  <span className="text-emerald-400 font-medium">{getSelectedDayCount()} gün seçili</span>
                ) : value.start ? (
                  <span>Bitiş tarihi seçin</span>
                ) : (
                  <span>Başlangıç tarihi seçin</span>
                )}
              </div>
              {value.start && (
                <button
                  type="button"
                  onClick={clearSelection}
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

export default DateRangeCalendar;
