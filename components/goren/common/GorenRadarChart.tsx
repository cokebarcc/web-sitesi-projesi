/**
 * GÖREN Radar (Örümcek Ağı) Grafiği
 *
 * Tüm GÖREN modülleri için göstergeleri kategorilerde gruplandırarak
 * radar grafiği şeklinde gösteren bileşen.
 * İki kurum karşılaştırma özelliği destekler.
 *
 * Modül bazlı kategoriler:
 * - BH: Memnuniyet, Poliklinik/Acil, Doğum/Sezaryen, İlaç/Reçete, Yatak/YB, Ameliyathane, Görüntüleme, Finansal, İdari
 * - ILCESM: Memnuniyet, Aşılama, Kronik Hastalık Takibi, Kanser Taraması, Anne-Bebek Sağlığı, Birinci Basamak, Tütün Denetimi, İlaç/Reçete
 * - ADSH: Memnuniyet, Randevu/Veri, Tedavi Kalitesi, Protez/Yer Tutucu, İdari, Finansal
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BHTableRow, loadGorenBHData } from '../../../src/services/gorenStorage';
import { InstitutionType } from '../types/goren.types';

interface GorenRadarChartProps {
  data: BHTableRow[];
  isLoading?: boolean;
  currentInstitutionId?: string;
  currentInstitutionName?: string;
  year?: number;
  month?: number;
  moduleType?: InstitutionType;
  /** Karşılaştırma için kurum listesi */
  compareInstitutions?: { id: string; name: string }[];
}

// Kategori tipi
interface CategoryDef {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  indicators: number[];
}

// BH Kategorileri - 38 gösterge, 9 kategori
const BH_CATEGORIES: CategoryDef[] = [
  {
    id: 'memnuniyet',
    name: 'Memnuniyet',
    shortName: 'Memnuniyet',
    icon: '😊',
    color: '#06b6d4',
    indicators: [1, 2]
  },
  {
    id: 'poliklinik-acil',
    name: 'Poliklinik ve Acil',
    shortName: 'Poliklinik',
    icon: '🏥',
    color: '#8b5cf6',
    indicators: [3, 4, 5]
  },
  {
    id: 'dogum-sezaryen',
    name: 'Doğum ve Sezaryen',
    shortName: 'Doğum',
    icon: '👶',
    color: '#ec4899',
    indicators: [6, 8, 9]
  },
  {
    id: 'ilac-recete',
    name: 'İlaç ve Reçete',
    shortName: 'İlaç/Reçete',
    icon: '💊',
    color: '#10b981',
    indicators: [7, 10, 11, 12]
  },
  {
    id: 'yatak-yogun-bakim',
    name: 'Yatak ve Yoğun Bakım',
    shortName: 'Yatak/YB',
    icon: '🛏️',
    color: '#f59e0b',
    indicators: [14, 15, 16, 17]
  },
  {
    id: 'ameliyathane',
    name: 'Ameliyathane ve Cerrahi',
    shortName: 'Ameliyathane',
    icon: '⚕️',
    color: '#ef4444',
    indicators: [18, 19, 20, 36]
  },
  {
    id: 'goruntuleme',
    name: 'Görüntüleme',
    shortName: 'Görüntüleme',
    icon: '🔬',
    color: '#3b82f6',
    indicators: [21, 22, 23, 24, 25, 26, 27, 28]
  },
  {
    id: 'finansal',
    name: 'Finansal',
    shortName: 'Finansal',
    icon: '💰',
    color: '#22c55e',
    indicators: [13, 29, 30, 32, 33, 34, 35]
  },
  {
    id: 'idari',
    name: 'İdari',
    shortName: 'İdari',
    icon: '📋',
    color: '#6366f1',
    indicators: [31, 37, 38]
  }
];

// ILCESM Kategorileri - 13 gösterge (sıra: 1,2,3,4,8,10,11,12,13,14,15,16,17), 8 kategori
const ILCESM_CATEGORIES: CategoryDef[] = [
  {
    id: 'memnuniyet',
    name: 'Memnuniyet',
    shortName: 'Memnuniyet',
    icon: '😊',
    color: '#06b6d4',
    indicators: [1, 2]
  },
  {
    id: 'asilama',
    name: 'Aşılama',
    shortName: 'Aşılama',
    icon: '💉',
    color: '#8b5cf6',
    indicators: [3, 4]
  },
  {
    id: 'kronik-hastalik',
    name: 'Kronik Hastalık Takibi',
    shortName: 'HYP Takip',
    icon: '🩺',
    color: '#ec4899',
    indicators: [8]
  },
  {
    id: 'kanser-taramasi',
    name: 'Kanser Taraması',
    shortName: 'Kanser Tar.',
    icon: '🔬',
    color: '#3b82f6',
    indicators: [10, 11]
  },
  {
    id: 'anne-bebek',
    name: 'Anne-Bebek Sağlığı',
    shortName: 'Anne/Bebek',
    icon: '👶',
    color: '#f59e0b',
    indicators: [12]
  },
  {
    id: 'birinci-basamak',
    name: 'Birinci Basamak Erişim',
    shortName: '1.Basamak',
    icon: '🏥',
    color: '#10b981',
    indicators: [13, 15]
  },
  {
    id: 'tutun-denetim',
    name: 'Tütün Denetimi',
    shortName: 'Tütün Den.',
    icon: '🚭',
    color: '#ef4444',
    indicators: [14]
  },
  {
    id: 'ilac-recete',
    name: 'İlaç ve Reçete',
    shortName: 'İlaç/Reçete',
    icon: '💊',
    color: '#22c55e',
    indicators: [16, 17]
  }
];

// ADSH Kategorileri - 14 gösterge, 6 kategori
const ADSH_CATEGORIES: CategoryDef[] = [
  {
    id: 'memnuniyet',
    name: 'Memnuniyet',
    shortName: 'Memnuniyet',
    icon: '😊',
    color: '#06b6d4',
    indicators: [1, 2]
  },
  {
    id: 'randevu-veri',
    name: 'Randevu ve Veri',
    shortName: 'Randevu/Veri',
    icon: '📊',
    color: '#8b5cf6',
    indicators: [3, 4, 5]
  },
  {
    id: 'tedavi-kalitesi',
    name: 'Tedavi Kalitesi',
    shortName: 'Tedavi Kal.',
    icon: '🦷',
    color: '#ec4899',
    indicators: [6, 7, 8]
  },
  {
    id: 'protez-yer-tutucu',
    name: 'Protez ve Yer Tutucu',
    shortName: 'Protez/YT',
    icon: '🔧',
    color: '#f59e0b',
    indicators: [9, 10, 11]
  },
  {
    id: 'finansal',
    name: 'Finansal',
    shortName: 'Finansal',
    icon: '💰',
    color: '#22c55e',
    indicators: [12, 13, 14]
  }
];

// Modül tipine göre kategori döndür
const getCategoriesForModule = (moduleType?: InstitutionType): CategoryDef[] => {
  switch (moduleType) {
    case 'ILCESM': return ILCESM_CATEGORIES;
    case 'ADSH': return ADSH_CATEGORIES;
    case 'BH':
    default: return BH_CATEGORIES;
  }
};

// Modül tipine göre toplam gösterge sayısını döndür
const getIndicatorCountForModule = (moduleType?: InstitutionType): number => {
  const categories = getCategoriesForModule(moduleType);
  return categories.reduce((sum, cat) => sum + cat.indicators.length, 0);
};

// Modül tipine göre toplam kategori sayısını döndür
const getCategoryCountForModule = (moduleType?: InstitutionType): number => {
  return getCategoriesForModule(moduleType).length;
};

interface IndicatorDetail {
  name: string;
  score: number;
  maxScore: number;
  normalized: number;
}

interface CategoryDetail {
  category: string;
  fullName: string;
  icon: string;
  color: string;
  score: number;
  compareScore?: number;
  indicatorCount: number;
  totalIndicators: number;
  details: IndicatorDetail[];
  compareDetails?: IndicatorDetail[];
}

// Veriyi kategori skorlarına dönüştür
const calculateCategoryScores = (data: BHTableRow[], moduleType?: InstitutionType) => {
  const categories = getCategoriesForModule(moduleType);
  const dataMap = new Map<number, BHTableRow>();
  data.forEach(row => {
    dataMap.set(row.sira, row);
  });

  return categories.map(category => {
    let totalWeightedScore = 0;
    let validIndicatorCount = 0;
    const indicatorDetails: { name: string; score: number; maxScore: number; normalized: number }[] = [];

    category.indicators.forEach(sira => {
      const row = dataMap.get(sira);
      if (row) {
        const puan = typeof row.donemIciPuan === 'number' ? row.donemIciPuan : parseFloat(String(row.donemIciPuan));
        const maxPuan = row.maxPuan || 4;

        if (!isNaN(puan)) {
          const normalizedScore = (puan / maxPuan) * 100;
          totalWeightedScore += normalizedScore;
          validIndicatorCount++;

          indicatorDetails.push({
            name: row.gostergeAdi,
            score: puan,
            maxScore: maxPuan,
            normalized: normalizedScore
          });
        }
      }
    });

    const categoryScore = validIndicatorCount > 0
      ? totalWeightedScore / validIndicatorCount
      : 0;

    return {
      category: category.shortName,
      fullName: category.name,
      icon: category.icon,
      color: category.color,
      score: Math.round(categoryScore * 10) / 10,
      indicatorCount: validIndicatorCount,
      totalIndicators: category.indicators.length,
      details: indicatorDetails
    };
  });
};

export const GorenRadarChart: React.FC<GorenRadarChartProps> = ({
  data,
  isLoading = false,
  currentInstitutionId,
  currentInstitutionName,
  year,
  month,
  moduleType = 'BH',
  compareInstitutions = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetail | null>(null);
  const [compareHospitalId, setCompareHospitalId] = useState<string>('');
  const [compareHospitalName, setCompareHospitalName] = useState<string>('');
  const [compareData, setCompareData] = useState<BHTableRow[]>([]);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrelenmiş kurum listesi (modül tipine göre dinamik)
  const filteredInstitutions = useMemo(() => {
    return compareInstitutions
      .filter(inst => inst.id !== currentInstitutionId)
      .filter(inst => searchQuery === '' || inst.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [compareInstitutions, currentInstitutionId, searchQuery]);

  // Karşılaştırma kurumu değiştiğinde veri yükle
  useEffect(() => {
    const loadCompareData = async () => {
      if (!compareHospitalId || !year || !month) {
        setCompareData([]);
        return;
      }

      setIsLoadingCompare(true);
      try {
        const bhData = await loadGorenBHData(compareHospitalId, year, month);
        if (bhData && bhData.bhTableRows) {
          setCompareData(bhData.bhTableRows);
        } else {
          setCompareData([]);
        }
      } catch (error) {
        console.error('Karşılaştırma verisi yükleme hatası:', error);
        setCompareData([]);
      } finally {
        setIsLoadingCompare(false);
      }
    };

    loadCompareData();
  }, [compareHospitalId, year, month]);

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-6">
        <div className="h-[500px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Grafik yükleniyor...</span>
          </div>
        </div>
      </div>
    );
  }

  // Veri yoksa
  if (!data || data.length === 0) {
    return (
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-6">
        <div className="h-[500px] flex flex-col items-center justify-center text-[var(--text-muted)]">
          <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">Gösterge verisi bulunamadı</p>
        </div>
      </div>
    );
  }

  // Ana veri için kategori skorları
  const radarData = calculateCategoryScores(data, moduleType);

  // Karşılaştırma verisi için kategori skorları
  const compareRadarData = compareData.length > 0 ? calculateCategoryScores(compareData, moduleType) : null;

  // Birleştirilmiş grafik verisi
  const combinedData = radarData.map((item, idx) => ({
    ...item,
    compareScore: compareRadarData ? compareRadarData[idx].score : undefined,
    compareDetails: compareRadarData ? compareRadarData[idx].details : undefined
  }));

  // Genel ortalama hesapla
  const overallScore = radarData.reduce((sum, d) => sum + d.score, 0) / radarData.length;
  const compareOverallScore = compareRadarData
    ? compareRadarData.reduce((sum, d) => sum + d.score, 0) / compareRadarData.length
    : null;

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-6">
      {/* Başlık ve Karşılaştırma Filtresi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🕸️</span>
            Gösterge Dağılım Haritası
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {getCategoryCountForModule(moduleType)} kategori, {getIndicatorCountForModule(moduleType)} gösterge - Ağırlıklandırılmış performans analizi
          </p>
        </div>

        {/* Karşılaştırma Filtresi - Modern Dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Karşılaştır:</label>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between gap-3 bg-slate-800/70 border border-slate-600/50 rounded-xl px-4 py-2.5 min-w-[220px] hover:border-emerald-500/50 hover:bg-slate-700/50 transition-all group"
            >
              <div className="flex items-center gap-2">
                {compareHospitalName ? (
                  <>
                    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm text-white font-medium">{compareHospitalName}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm text-slate-400">Kurum seçin...</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLoadingCompare && (
                  <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {compareHospitalName && !isLoadingCompare && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareHospitalId('');
                      setCompareHospitalName('');
                    }}
                    className="p-0.5 hover:bg-slate-600 rounded transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setSearchQuery('');
                }}
              />
              {/* Dropdown Content */}
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Search Input */}
                <div className="p-3 border-b border-slate-700/50">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Kurum ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Kurum Listesi */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredInstitutions.length > 0 ? (
                    filteredInstitutions.map(inst => {
                      const isSelected = inst.id === compareHospitalId;

                      return (
                        <button
                          key={inst.id}
                          onClick={() => {
                            setCompareHospitalId(inst.id);
                            setCompareHospitalName(inst.name);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors ${
                            isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
                          }`}
                        >
                          <svg className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className={`text-sm ${isSelected ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}>
                            {inst.name}
                          </span>
                          {isSelected && (
                            <svg className="w-4 h-4 text-emerald-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-center text-slate-500 text-sm">
                      Kurum bulunamadı
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Skor Kartları */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentInstitutionName || 'Mevcut Kurum'}</p>
          <p className="text-3xl font-black text-emerald-400">%{Math.round(overallScore)}</p>
        </div>
        {compareOverallScore !== null && (
          <>
            <div className="text-slate-600 text-2xl">vs</div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{compareHospitalName}</p>
              <p className="text-3xl font-black text-orange-400">%{Math.round(compareOverallScore)}</p>
            </div>
          </>
        )}
      </div>

      {/* Grafik */}
      <div className="h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={combinedData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#334155" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickCount={6}
              axisLine={false}
            />

            {/* Karşılaştırma kurumu (varsa) - Turuncu */}
            {compareRadarData && (
              <Radar
                name={compareHospitalName}
                dataKey="compareScore"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{
                  r: 5,
                  fill: '#f97316',
                  stroke: '#fff',
                  strokeWidth: 1
                }}
              />
            )}

            {/* Ana kurum - Yeşil */}
            <Radar
              name={currentInstitutionName || 'Mevcut Kurum'}
              dataKey="score"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.35}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={`dot-${payload.category}`}
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedCategory(payload)}
                  />
                );
              }}
            />

            {/* Referans çizgisi - %65 */}
            <Radar
              name="Hedef (%65)"
              dataKey={() => 65}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              fill="none"
              strokeWidth={2}
              dot={false}
            />

            {compareRadarData && (
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value: string) => (
                  <span className="text-slate-300 text-xs">{value}</span>
                )}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Detay Açıklama */}
      <p className="text-center text-xs text-slate-500 mt-2">
        Detay için aşağıdaki kartlara veya grafikteki noktalara tıklayın
      </p>

      {/* Kategori Kartları */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {combinedData.map((item, idx) => {
          const isLowScore = item.score < 50;
          const scoreColor = isLowScore ? 'text-rose-400' : 'text-emerald-400';
          const barColor = isLowScore ? '#f43f5e' : '#10b981';

          return (
            <div
              key={idx}
              onClick={() => setSelectedCategory(item)}
              className={`bg-slate-800/30 rounded-xl p-3 border hover:border-slate-500/50 hover:bg-slate-700/30 transition-all cursor-pointer ${
                isLowScore ? 'border-rose-500/30' : 'border-slate-700/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs text-slate-400 truncate">{item.category}</span>
              </div>
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${scoreColor}`}>
                    %{item.score}
                  </span>
                  {item.compareScore !== undefined && (
                    <span className={`text-sm font-medium ${item.compareScore < 50 ? 'text-rose-400' : 'text-orange-400'}`}>
                      vs %{item.compareScore}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {item.indicatorCount}/{item.totalIndicators}
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 h-1 bg-slate-700/50 rounded-full overflow-hidden relative">
                <div
                  className="absolute h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.score}%`,
                    backgroundColor: barColor
                  }}
                />
              {item.compareScore !== undefined && (
                <div
                  className="absolute h-full rounded-full transition-all duration-500 opacity-60"
                  style={{
                    width: `${item.compareScore}%`,
                    backgroundColor: item.compareScore < 50 ? '#f43f5e' : '#f97316',
                    top: 0
                  }}
                />
              )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt bilgi */}
      <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>{currentInstitutionName || 'Mevcut Kurum'}</span>
          </div>
          {compareRadarData && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>{compareHospitalName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500" />
            <span>Hedef (%65)</span>
          </div>
        </div>
        <span className="opacity-70">
          Tüm göstergeler eşit ağırlıklandırılmıştır
        </span>
      </div>

      {/* Kategori Detay Modal */}
      {selectedCategory && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedCategory.icon}</span>
                <div>
                  <h3 className="text-white font-bold text-lg">{selectedCategory.fullName}</h3>
                  <p className="text-slate-400 text-sm">{selectedCategory.indicatorCount}/{selectedCategory.totalIndicators} gösterge hesaplandı</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Kategori Skoru */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800/50">
              <span className="text-slate-300 text-base font-medium">Kategori Skoru:</span>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-emerald-400">
                  %{selectedCategory.score}
                </span>
                {selectedCategory.compareScore !== undefined && (
                  <>
                    <span className="text-slate-500">vs</span>
                    <span className="text-2xl font-bold text-orange-400">
                      %{selectedCategory.compareScore}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Göstergeler Listesi */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              {/* Kurum başlıkları - karşılaştırma varsa göster */}
              {selectedCategory.compareDetails && selectedCategory.compareDetails.length > 0 && (
                <div className="flex items-center justify-end gap-4 mb-4 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-xs text-slate-400">{currentInstitutionName || 'Mevcut'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-orange-500" />
                    <span className="text-xs text-slate-400">{compareHospitalName}</span>
                  </div>
                </div>
              )}

              {selectedCategory.details.length > 0 ? (
                <div className="space-y-3">
                  {selectedCategory.details.map((detail, idx) => {
                    // Karşılaştırma kurumunun aynı göstergesi
                    const compareDetail = selectedCategory.compareDetails?.find(
                      cd => cd.name === detail.name
                    );

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-slate-200 text-sm leading-relaxed flex-1">
                            {detail.name}
                          </span>
                          <div className="flex items-center gap-3">
                            {/* Ana kurum puanı - Yeşil tonları */}
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className="text-white font-bold text-sm px-3 py-1.5 rounded-lg"
                                style={{
                                  backgroundColor:
                                    detail.score === detail.maxScore
                                      ? 'rgb(16, 185, 129)' // Yeşil - tam puan
                                      : detail.score > 0
                                        ? 'rgb(52, 211, 153)' // Açık yeşil - kısmi puan
                                        : 'rgb(239, 68, 68)' // Kırmızı - sıfır puan
                                }}
                              >
                                {detail.score}/{detail.maxScore}
                              </span>
                            </div>

                            {/* Karşılaştırma kurumu puanı - Turuncu tonları */}
                            {compareDetail && (
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className="text-white font-bold text-sm px-3 py-1.5 rounded-lg"
                                  style={{
                                    backgroundColor:
                                      compareDetail.score === compareDetail.maxScore
                                        ? 'rgb(249, 115, 22)' // Turuncu - tam puan
                                        : compareDetail.score > 0
                                          ? 'rgb(251, 146, 60)' // Açık turuncu - kısmi puan
                                          : 'rgb(239, 68, 68)' // Kırmızı - sıfır puan
                                  }}
                                >
                                  {compareDetail.score}/{compareDetail.maxScore}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Karşılaştırma çubuğu */}
                        {compareDetail && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                              <div
                                className="absolute h-full rounded-full"
                                style={{
                                  width: `${detail.normalized}%`,
                                  backgroundColor: '#10b981'
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-emerald-400 w-10 text-right">%{Math.round(detail.normalized)}</span>
                          </div>
                        )}
                        {compareDetail && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                              <div
                                className="absolute h-full rounded-full"
                                style={{
                                  width: `${compareDetail.normalized}%`,
                                  backgroundColor: '#f97316'
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-orange-400 w-10 text-right">%{Math.round(compareDetail.normalized)}</span>
                          </div>
                        )}

                        {/* Karşılaştırma yoksa sadece yüzde göster */}
                        {!compareDetail && (
                          <div className="mt-2 text-right">
                            <span className="text-slate-500 text-xs">
                              %{Math.round(detail.normalized)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">Bu kategoride hesaplanmış gösterge yok</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GorenRadarChart;
