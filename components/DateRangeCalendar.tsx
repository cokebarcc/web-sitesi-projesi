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
      <label className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{label}</label>
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
              ? 'cursor-not-allowed opacity-60'
              : isOpen
                ? 'ring-2 ring-emerald-500/20'
                : ''
            }
          `}
          style={{
            background: isDisabled ? 'var(--surface-3)' : 'var(--surface-2)',
            borderColor: isOpen && !isDisabled ? 'var(--color-emerald-500, #10b981)' : 'var(--border-2)',
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm truncate ${value.start ? 'font-medium' : ''}`} style={{ color: value.start ? 'var(--text-1)' : 'var(--text-3)' }}>
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
              className="p-0.5 rounded transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-3)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Calendar Popover */}
        {isOpen && (
          <div className="absolute left-0 bottom-full z-50 mb-1 border rounded-xl shadow-lg p-4 min-w-[300px] max-h-[400px] overflow-y-auto" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            {/* Header - Ay/Yıl Navigasyonu */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="font-semibold" style={{ color: 'var(--text-1)' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Gün İsimleri */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(day => (
                <div key={day} className="text-center text-xs font-medium py-1" style={{ color: 'var(--text-3)' }}>
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
                    disabled={!isAvailable}
                    className={`
                      h-9 w-full rounded-lg text-sm font-medium transition-all relative
                      ${!isAvailable
                        ? 'cursor-not-allowed'
                        : isStart || isEnd
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : isSelected
                            ? 'bg-emerald-500/20 status-success'
                            : isInHoverRange
                              ? 'bg-emerald-500/10 status-success'
                              : isToday
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : ''
                      }
                    `}
                    style={
                      !isAvailable
                        ? { color: 'var(--border-2)' }
                        : isStart || isEnd || isSelected || isInHoverRange || isToday
                          ? undefined
                          : { color: 'var(--text-2)' }
                    }
                    onMouseEnter={e => {
                      if (isAvailable) {
                        setHoverDate(dateStr);
                        if (!isStart && !isEnd && !isSelected && !isInHoverRange && !isToday) {
                          e.currentTarget.style.background = 'var(--surface-hover)';
                        }
                      }
                    }}
                    onMouseLeave={e => {
                      setHoverDate(null);
                      if (!isStart && !isEnd && !isSelected && !isInHoverRange && !isToday) {
                        e.currentTarget.style.background = '';
                      }
                    }}
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
            <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-2)' }}>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                {value.start && value.end ? (
                  <span className="status-success font-medium">{getSelectedDayCount()} gün seçili</span>
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
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
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
