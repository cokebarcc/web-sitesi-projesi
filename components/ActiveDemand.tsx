import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  uploadActiveDemandFile,
  getDemandSummary,
  getAvailableDateParts,
  getAvailableActiveDemandDates,
  getActiveDemandFiles
} from '../src/services/activeDemandStorage';
import { DemandSummary, BranchDemand } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import { HOSPITALS } from '../constants';

interface ActiveDemandProps {
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  canUpload?: boolean;
}

const MONTH_NAMES = ['', 'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];

// Hastane kisa adlari mapping
const hospitalShortNames: Record<string, string> = {
  'Sanliurfa Birecik Devlet Hastanesi': 'Birecik DH',
  'Sanliurfa Bozova Devlet Hastanesi': 'Bozova DH',
  'Sanliurfa Halfeti Ilce Hastanesi': 'Halfeti DH',
  'Sanliurfa Hilvan Devlet Hastanesi': 'Hilvan DH',
  'Sanliurfa Suruc Devlet Hastanesi': 'Suruc DH',
  'Sanliurfa Harran Devlet Hastanesi': 'Harran DH',
  'Sanliurfa Ceylanpinar Devlet Hastanesi': 'Ceylanpinar DH',
  'Sanliurfa Siverek Devlet Hastanesi': 'Siverek DH',
  'Sanliurfa Akcakale Devlet Hastanesi': 'Akcakale DH',
  'Sanliurfa Balikligol Devlet Hastanesi': 'Balikligol DH',
  'Sanliurfa Viransehir Devlet Hastanesi': 'Viransehir DH',
  'Sanliurfa Saglik Bilimleri Universitesi Mehmet Akif Inan EAH': 'Sanliurfa EAH',
  'Sanliurfa Egitim ve Arastirma Hastanesi': 'Mehmet Akif Inan EAH',
};

const getShortName = (fullName: string): string => {
  return hospitalShortNames[fullName] || fullName.replace('Sanliurfa ', '').replace(' Devlet Hastanesi', ' DH');
};

// Grafik renkleri
const CHART_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
];

const ActiveDemand: React.FC<ActiveDemandProps> = ({
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  canUpload = false,
}) => {
  // Upload icin state'ler
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadHospitalId, setUploadHospitalId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtre state'leri
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Record<number, number[]>>({});
  const [availableDays, setAvailableDays] = useState<Record<string, number[]>>({});
  const [allDates, setAllDates] = useState<string[]>([]);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Veri state'leri
  const [summary, setSummary] = useState<DemandSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // PDF export ref
  const contentRef = useRef<HTMLDivElement>(null);

  // Mevcut tarihleri yukle
  useEffect(() => {
    loadDateParts();
  }, []);

  const loadDateParts = async () => {
    const parts = await getAvailableDateParts();
    setAvailableYears(parts.years);
    setAvailableMonths(parts.monthsByYear);
    setAvailableDays(parts.daysByYearMonth);

    const dates = await getAvailableActiveDemandDates();
    setAllDates(dates);
  };

  // Toast gosterimi
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Secili tarihi olustur
  const getSelectedDate = (): string | null => {
    if (!selectedYear || !selectedMonth || !selectedDay) return null;
    const month = String(selectedMonth).padStart(2, '0');
    const day = String(selectedDay).padStart(2, '0');
    return `${selectedYear}-${month}-${day}`;
  };

  // Veri yukle
  const handleLoadData = async () => {
    const date = getSelectedDate();
    if (!date) {
      showToast('Lutfen tam bir tarih secin', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const data = await getDemandSummary(date);
      if (data) {
        setSummary(data);
        showToast(`${data.totalHospitals} hastane verisi yuklendi`, 'success');
      } else {
        setSummary(null);
        showToast('Secilen tarih icin veri bulunamadi', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Veri yukleme hatasi', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Dosya yukleme
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadHospitalId) {
      showToast('Lutfen hastane secin', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const hospitalName = HOSPITALS.find(h => h.includes(uploadHospitalId)) || uploadHospitalId;
      const result = await uploadActiveDemandFile(file, uploadHospitalId, hospitalName, uploadDate, 'user');

      if (result.success) {
        showToast(`${result.totalDemand} talep verisi yuklendi`, 'success');
        await loadDateParts();
      } else {
        showToast(result.error || 'Yukleme hatasi', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Yukleme hatasi', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // PDF export
  const handleExportPdf = async () => {
    if (!contentRef.current || !summary) return;

    try {
      const date = getSelectedDate();
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Baslik
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('T.C.', 105, 20, { align: 'center' });
      pdf.text('SANLIURFA IL SAGLIK MUDURLUGU', 105, 28, { align: 'center' });
      pdf.text('MEDIS Koordinasyon Birimi', 105, 36, { align: 'center' });

      pdf.setFontSize(14);
      pdf.text('BILGI NOTU', 105, 50, { align: 'center' });

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Tarih: ${date}`, 20, 65);

      // Ozet bilgiler
      pdf.setFont('helvetica', 'bold');
      pdf.text('ILIMIZ GENELI AKTIF TALEP DURUMU', 20, 80);

      pdf.setFont('helvetica', 'normal');
      pdf.text(`Toplam Aktif Talep: ${summary.totalProvinceDemand}`, 20, 90);
      pdf.text(`Veri Giren Hastane Sayisi: ${summary.totalHospitals}`, 20, 98);

      // Brans bazli tablo
      let yPos = 115;
      pdf.setFont('helvetica', 'bold');
      pdf.text('BRANS BAZLI DAGILIM:', 20, yPos);
      yPos += 10;

      // Tablo basligi
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, yPos, 80, 8, 'F');
      pdf.rect(100, yPos, 40, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text('Brans Adi', 25, yPos + 6);
      pdf.text('Talep Sayisi', 105, yPos + 6);
      yPos += 8;

      // Brans satirlari
      pdf.setFont('helvetica', 'normal');
      summary.branchTotals.slice(0, 15).forEach((branch, index) => {
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(20, yPos, 120, 7, 'F');
        }
        pdf.text(branch.branchName.substring(0, 35), 25, yPos + 5);
        pdf.text(String(branch.demandCount), 115, yPos + 5);
        yPos += 7;
      });

      // Hastane bazli tablo (yeni sayfa)
      pdf.addPage();
      yPos = 20;

      pdf.setFont('helvetica', 'bold');
      pdf.text('HASTANE BAZLI DAGILIM:', 20, yPos);
      yPos += 10;

      // Tablo basligi
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, yPos, 100, 8, 'F');
      pdf.rect(120, yPos, 40, 8, 'F');
      pdf.text('Hastane Adi', 25, yPos + 6);
      pdf.text('Toplam Talep', 125, yPos + 6);
      yPos += 8;

      // Hastane satirlari
      pdf.setFont('helvetica', 'normal');
      summary.hospitalSummaries.forEach((hospital, index) => {
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(20, yPos, 140, 7, 'F');
        }
        const shortName = getShortName(hospital.hospitalName);
        pdf.text(shortName.substring(0, 45), 25, yPos + 5);
        pdf.text(String(hospital.totalDemand), 135, yPos + 5);
        yPos += 7;

        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
      });

      pdf.save(`aktif-talep-raporu-${date}.pdf`);
      showToast('PDF indirildi', 'success');
    } catch (error) {
      console.error('PDF hatasi:', error);
      showToast('PDF indirme hatasi', 'error');
    }
  };

  // Dropdown options
  const yearOptions: DropdownOption[] = useMemo(() =>
    availableYears.map(year => ({ value: year, label: String(year) })),
    [availableYears]
  );

  const monthOptions: DropdownOption[] = useMemo(() => {
    if (!selectedYear || !availableMonths[selectedYear]) return [];
    return availableMonths[selectedYear].map(month => ({ value: month, label: MONTH_NAMES[month] }));
  }, [selectedYear, availableMonths]);

  const dayOptions: DropdownOption[] = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    const key = `${selectedYear}-${selectedMonth}`;
    const days = availableDays[key] || [];
    return days.map(day => ({ value: day, label: String(day) }));
  }, [selectedYear, selectedMonth, availableDays]);

  const hospitalOptions: DropdownOption[] = useMemo(() =>
    HOSPITALS.map(h => ({ value: h, label: getShortName(h) })).sort((a, b) => a.label.localeCompare(b.label, 'tr-TR')),
    []
  );

  // Tarih formatla
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Aktif Talep Analizi</h1>
          <p className="text-slate-400 mt-1">Hastanelerin brans bazli aktif talep verileri</p>
        </div>
        {summary && (
          <button
            onClick={handleExportPdf}
            className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF Indir
          </button>
        )}
      </div>

      {/* Veri Yukleme Bolumu - Sadece yukleme izni varsa goster */}
      {canUpload && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Veri Yukleme</h3>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Hastane Secimi */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Hastane</label>
              <select
                value={uploadHospitalId}
                onChange={(e) => setUploadHospitalId(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[200px]"
              >
                <option value="">Hastane secin...</option>
                {hospitalOptions.map(opt => (
                  <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Yukleme icin Tarih Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Yukleme Tarihi</label>
              <input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            {/* Upload Button */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Excel Dosyasi</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !uploadDate || !uploadHospitalId}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Yukleniyor...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Excel Yukle
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Excel format info */}
          <div className="mt-4 p-4 bg-slate-700/30 rounded-xl">
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Excel Formati:</span> Brans/Klinik Adi | Talep Sayisi
            </p>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Veri Filtreleme</h3>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Yil Secimi */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Yil</label>
            <select
              value={selectedYear || ''}
              onChange={(e) => {
                setSelectedYear(e.target.value ? Number(e.target.value) : null);
                setSelectedMonth(null);
                setSelectedDay(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[120px]"
            >
              <option value="">Yil secin...</option>
              {yearOptions.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Ay Secimi */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Ay</label>
            <select
              value={selectedMonth || ''}
              onChange={(e) => {
                setSelectedMonth(e.target.value ? Number(e.target.value) : null);
                setSelectedDay(null);
              }}
              disabled={!selectedYear}
              className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[140px] disabled:opacity-50"
            >
              <option value="">Ay secin...</option>
              {monthOptions.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Gun Secimi */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Gun</label>
            <select
              value={selectedDay || ''}
              onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedMonth}
              className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[100px] disabled:opacity-50"
            >
              <option value="">Gun secin...</option>
              {dayOptions.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Uygula Butonu */}
          <button
            onClick={handleLoadData}
            disabled={isLoading || !getSelectedDate()}
            className="px-6 py-2.5 h-[42px] bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Yukleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Uygula
              </>
            )}
          </button>
        </div>
      </div>

      {/* Veri Yok Mesaji */}
      {!summary && (
        <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Veri Yuklenmedi</h2>
            <p className="text-slate-400 max-w-md">
              Yukaridan tarih secip "Uygula" butonuna tiklayarak mevcut veriyi yukleyebilir
              veya yeni bir Excel dosyasi yukleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Veri Gosterimi */}
      {summary && (
        <div ref={contentRef} className="space-y-6">
          {/* KPI Kartlari */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Toplam Talep */}
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-2xl border border-orange-500/30 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-500/30 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Il Toplam Talep</p>
                  <p className="text-3xl font-bold text-orange-400">{summary.totalProvinceDemand.toLocaleString('tr-TR')}</p>
                </div>
              </div>
            </div>

            {/* Hastane Sayisi */}
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl border border-blue-500/30 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500/30 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Veri Giren Hastane</p>
                  <p className="text-3xl font-bold text-blue-400">{summary.totalHospitals}</p>
                </div>
              </div>
            </div>

            {/* En Yuksek Brans */}
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-2xl border border-purple-500/30 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-500/30 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-400">En Yuksek Talep</p>
                  <p className="text-lg font-bold text-purple-400 truncate max-w-[180px]">
                    {summary.branchTotals[0]?.branchName || '-'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {summary.branchTotals[0]?.demandCount.toLocaleString('tr-TR') || 0} talep
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Brans Bazli Grafik */}
          <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Brans Bazli Talep Dagilimi</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.branchTotals.slice(0, 15)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="branchName"
                    stroke="#9ca3af"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Talep']}
                  />
                  <Bar dataKey="demandCount" radius={[0, 4, 4, 0]}>
                    {summary.branchTotals.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hastane Bazli Tablo */}
          <div className="bg-slate-800/50 rounded-2xl shadow-sm border border-slate-700/60 overflow-hidden">
            <div className="p-6 border-b border-slate-700/60">
              <h3 className="text-lg font-semibold text-white">Hastane Bazli Talep Tablosu</h3>
              <p className="text-sm text-slate-400 mt-1">Tarih: {formatDate(getSelectedDate())}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-700/30">
                    <th className="sticky left-0 bg-slate-700/50 px-4 py-3 text-left text-sm font-semibold text-slate-300 z-10">
                      Hastane
                    </th>
                    {/* Dinamik brans sutunlari */}
                    {summary.branchTotals.slice(0, 10).map((branch, idx) => (
                      <th key={idx} className="px-3 py-3 text-center text-xs font-semibold text-slate-300 whitespace-nowrap min-w-[80px]">
                        {branch.branchName.length > 15 ? branch.branchName.substring(0, 15) + '...' : branch.branchName}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-sm font-semibold text-orange-400">
                      Toplam
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.hospitalSummaries.map((hospital, idx) => {
                    // Hastane icin brans bazli talepleri map'le
                    const branchMap: Record<string, number> = {};
                    hospital.branches.forEach(b => {
                      branchMap[b.branchName] = b.demandCount;
                    });

                    return (
                      <tr key={idx} className={`border-t border-slate-700/30 ${idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/40'} hover:bg-slate-700/30 transition-colors`}>
                        <td className="sticky left-0 bg-slate-800/80 px-4 py-3 text-sm font-medium text-white z-10 whitespace-nowrap">
                          {getShortName(hospital.hospitalName)}
                        </td>
                        {summary.branchTotals.slice(0, 10).map((branch, bIdx) => (
                          <td key={bIdx} className="px-3 py-3 text-center text-sm text-slate-300">
                            {branchMap[branch.branchName] || '-'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center text-sm font-bold text-orange-400">
                          {hospital.totalDemand.toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Il Toplami */}
                <tfoot>
                  <tr className="bg-orange-500/20 border-t-2 border-orange-500/50">
                    <td className="sticky left-0 bg-orange-500/30 px-4 py-3 text-sm font-bold text-orange-300 z-10">
                      IL TOPLAMI
                    </td>
                    {summary.branchTotals.slice(0, 10).map((branch, idx) => (
                      <td key={idx} className="px-3 py-3 text-center text-sm font-bold text-orange-300">
                        {branch.demandCount.toLocaleString('tr-TR')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-lg font-bold text-orange-400">
                      {summary.totalProvinceDemand.toLocaleString('tr-TR')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveDemand;
