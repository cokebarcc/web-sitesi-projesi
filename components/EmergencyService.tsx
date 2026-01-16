import React, { useState, useRef, useEffect } from 'react';
import { uploadGreenAreaFile, loadGreenAreaData, getAvailableGreenAreaDates, GreenAreaData } from '../src/services/greenAreaStorage';
import html2canvas from 'html2canvas';

interface EmergencyServiceProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
}

// Hastane kısa adları mapping
const hospitalShortNames: Record<string, string> = {
  'Şanlıurfa Birecik Devlet Hastanesi': 'Birecik DH',
  'Şanlıurfa Bozova Devlet Hastanesi': 'Bozova DH',
  'Şanlıurfa Halfeti İlçe Hastanesi': 'Halfeti DH',
  'Şanlıurfa Hilvan Devlet Hastanesi': 'Hilvan DH',
  'Şanlıurfa Suruç Devlet Hastanesi': 'Suruç DH',
  'Şanlıurfa Harran Devlet Hastanesi': 'Harran DH',
  'Şanlıurfa Ceylanpınar Devlet Hastanesi': 'Ceylanpınar DH',
  'Şanlıurfa Siverek Devlet Hastanesi': 'Siverek DH',
  'Şanlıurfa Akçakale Devlet Hastanesi': 'Akçakale DH',
  'Şanlıurfa Balıklıgöl Devlet Hastanesi': 'Balıklıgöl DH',
  'Şanlıurfa Viranşehir Devlet Hastanesi': 'Viranşehir DH',
  'Şanlıurfa Sağlık Bilimleri Üniversitesi Mehmet Akif İnan EAH': 'Şanlıurfa EAH',
  'Şanlıurfa Eğitim ve Araştırma Hastanesi': 'Mehmet Akif İnan EAH',
};

const getShortName = (fullName: string): string => {
  return hospitalShortNames[fullName] || fullName.replace('Şanlıurfa ', '').replace(' Devlet Hastanesi', ' DH');
};

// Progress bar rengi belirleme - %60 altı kırmızı, %60 ve üzeri yeşil
const getProgressColor = (rate: number): string => {
  if (rate >= 60) return 'bg-emerald-500';
  return 'bg-red-500';
};

const getTextColor = (rate: number): string => {
  if (rate >= 60) return 'text-emerald-600';
  return 'text-red-600';
};

// Hastane sıralama - öncelikli hastaneler
const priorityHospitals = [
  'Şanlıurfa EAH',
  'Mehmet Akif İnan EAH',
  'Balıklıgöl DH'
];

const sortHospitals = (data: GreenAreaData[]): GreenAreaData[] => {
  return [...data].sort((a, b) => {
    const aShort = getShortName(a.hospitalName);
    const bShort = getShortName(b.hospitalName);

    const aIndex = priorityHospitals.indexOf(aShort);
    const bIndex = priorityHospitals.indexOf(bShort);

    // Her ikisi de öncelikli listede
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Sadece a öncelikli
    if (aIndex !== -1) return -1;
    // Sadece b öncelikli
    if (bIndex !== -1) return 1;
    // İkisi de öncelikli değil - alfabetik sırala
    return aShort.localeCompare(bShort, 'tr-TR');
  });
};

const EmergencyService: React.FC<EmergencyServiceProps> = ({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GreenAreaData[] | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Load available dates on mount
  useEffect(() => {
    loadAvailableDates();
  }, []);

  const loadAvailableDates = async () => {
    const dates = await getAvailableGreenAreaDates();
    setAvailableDates(dates);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadGreenAreaFile(file, selectedDate, 'user');
      if (result.success && result.data) {
        setData(result.data);
        showToast(`${result.recordCount} hastane verisi yüklendi`, 'success');
        await loadAvailableDates();
      } else {
        showToast(result.error || 'Yükleme hatası', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Yükleme hatası', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      const loadedData = await loadGreenAreaData(selectedDate);
      if (loadedData) {
        setData(loadedData);
        showToast(`${loadedData.length} hastane verisi yüklendi`, 'success');
      } else {
        showToast('Bu tarih için veri bulunamadı', 'error');
        setData(null);
      }
    } catch (error: any) {
      showToast(error.message || 'Veri yükleme hatası', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!cardsContainerRef.current) return;

    try {
      const canvas = await html2canvas(cardsContainerRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `yesil-alan-oranlari-${selectedDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('PNG indirildi', 'success');
    } catch (error) {
      showToast('PNG indirme hatası', 'error');
    }
  };

  // İl geneli hesapla
  const ilGeneli = data ? {
    hospitalName: 'ŞANLIURFA İL GENELİ',
    greenAreaCount: data.reduce((sum, d) => sum + d.greenAreaCount, 0),
    totalCount: data.reduce((sum, d) => sum + d.totalCount, 0),
    greenAreaRate: 0
  } : null;

  if (ilGeneli) {
    ilGeneli.greenAreaRate = ilGeneli.totalCount > 0 ? (ilGeneli.greenAreaCount / ilGeneli.totalCount) * 100 : 0;
  }

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
          <h1 className="text-2xl font-bold text-slate-800">Yeşil Alan Oranları</h1>
          <p className="text-slate-500 mt-1">Acil servise başvuran hastaların yeşil alan oranları</p>
        </div>
      </div>

      {/* Date Selection & Upload */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-600">Tarih Seçin</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Available Dates Dropdown */}
          {availableDates.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-600">Kayıtlı Tarihler</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Tarih seçin...</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Load Button */}
          <button
            onClick={handleLoadData}
            disabled={isLoading || !selectedDate}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Yükleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Uygula
              </>
            )}
          </button>

          {/* Divider */}
          <div className="h-10 w-px bg-slate-200"></div>

          {/* Upload Button */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-600">Excel Yükle</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !selectedDate}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Excel Yükle
                </>
              )}
            </button>
          </div>

          {/* Download PNG Button */}
          {data && (
            <>
              <div className="h-10 w-px bg-slate-200"></div>
              <button
                onClick={handleDownloadPng}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                PNG İndir
              </button>
            </>
          )}
        </div>

        {/* Excel format info */}
        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500">
            <span className="font-semibold">Excel Formatı:</span> Kurum Adı | Yeşil Alan Muayene Sayısı | Toplam Muayene Sayısı
          </p>
        </div>
      </div>

      {/* No Data Message */}
      {!data && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Veri Yüklenmedi</h2>
            <p className="text-slate-500 max-w-md">
              Yukarıdan tarih seçip "Uygula" butonuna tıklayarak mevcut veriyi yükleyebilir
              veya yeni bir Excel dosyası yükleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Cards Container */}
      {data && (
        <div ref={cardsContainerRef} className="bg-slate-50 p-8 rounded-2xl">
          {/* Header for PNG */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Acil Servis Yeşil Alan Oranları</h2>
                <p className="text-slate-500">Şanlıurfa İl Sağlık Müdürlüğü</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">{formatDate(selectedDate)}</p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* İl Geneli Card - First and Larger */}
            {ilGeneli && (
              <HospitalCard
                data={ilGeneli}
                isIlGeneli={true}
              />
            )}

            {/* Hospital Cards - Özel sıralama */}
            {sortHospitals(data).map((hospital, index) => (
              <HospitalCard
                key={index}
                data={hospital}
                isIlGeneli={false}
              />
            ))}
          </div>

          {/* Footer with formula */}
          <div className="mt-8 pt-4 border-t border-slate-200">
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600 font-medium">
                Yeşil Alan Oranı Hesaplama Formülü: <span className="text-emerald-600">Yeşil Alan Hasta Sayısı / Acil Servise Başvuran Toplam Hasta Sayısı X 100</span>
              </p>
              {ilGeneli && (
                <p className="text-sm text-slate-500 mt-2">
                  Yeşil Alan Oranı Hesaplama Formülü: <span className="font-semibold">{ilGeneli.greenAreaCount.toLocaleString('tr-TR')} / {ilGeneli.totalCount.toLocaleString('tr-TR')} x 100 = %{ilGeneli.greenAreaRate.toFixed(1)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hospital Card Component
interface HospitalCardProps {
  data: GreenAreaData;
  isIlGeneli: boolean;
}

const HospitalCard: React.FC<HospitalCardProps> = ({ data, isIlGeneli }) => {
  const shortName = isIlGeneli ? data.hospitalName : getShortName(data.hospitalName);
  const progressColor = getProgressColor(data.greenAreaRate);
  const textColor = getTextColor(data.greenAreaRate);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 ${isIlGeneli ? 'col-span-1 md:col-span-2 lg:col-span-1 ring-2 ring-emerald-500/20' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIlGeneli ? 'bg-emerald-100' : 'bg-slate-100'}`}>
          <svg className={`w-5 h-5 ${isIlGeneli ? 'text-emerald-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className={`font-bold ${isIlGeneli ? 'text-emerald-800' : 'text-slate-800'}`}>{shortName}</h3>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Toplam Hasta</span>
          <span className="font-bold text-slate-800">{data.totalCount.toLocaleString('tr-TR')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Yeşil Alan</span>
          <span className="font-bold text-slate-800">{data.greenAreaCount.toLocaleString('tr-TR')}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Yeşil Alan Oranı</span>
          <span className={`font-bold text-lg ${textColor}`}>%{data.greenAreaRate.toFixed(1)}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(data.greenAreaRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default EmergencyService;
