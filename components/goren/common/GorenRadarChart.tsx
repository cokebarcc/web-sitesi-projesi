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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
  const [radarDropdownPos, setRadarDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const radarTriggerRef = useRef<HTMLButtonElement>(null);
  const radarDropdownRef = useRef<HTMLDivElement>(null);

  const updateRadarDropdownPos = useCallback(() => {
    if (radarTriggerRef.current) {
      const rect = radarTriggerRef.current.getBoundingClientRect();
      setRadarDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  useEffect(() => {
    if (isDropdownOpen) updateRadarDropdownPos();
  }, [isDropdownOpen, updateRadarDropdownPos]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handle = () => updateRadarDropdownPos();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [isDropdownOpen, updateRadarDropdownPos]);

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
      <div className="g-section-card p-6" style={{ overflow: 'visible' }}>
        <div className="h-[500px] flex items-center justify-center">
          <div className="flex items-center gap-3" style={{ color: 'var(--g-text-tertiary)' }}>
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
      <div className="g-section-card p-6" style={{ overflow: 'visible' }}>
        <div className="h-[500px] flex flex-col items-center justify-center" style={{ color: 'var(--g-text-tertiary)' }}>
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
    <div className="g-section-card p-6" style={{ overflow: 'visible' }}>
      {/* Başlık ve Karşılaştırma Filtresi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="g-title-section flex items-center gap-2">
            <span>🕸️</span>
            Gösterge Dağılım Haritası
          </h3>
          <p className="g-text-small mt-1">
            {getCategoryCountForModule(moduleType)} kategori, {getIndicatorCountForModule(moduleType)} gösterge - Ağırlıklandırılmış performans analizi
          </p>
        </div>

        {/* Karşılaştırma Filtresi - Modern Dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap" style={{ color: 'var(--g-text-tertiary)' }}>Karşılaştır:</label>
            <button
              ref={radarTriggerRef}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 min-w-[220px] hover:border-emerald-500/50 transition-all group"
              style={{ backgroundColor: 'var(--g-surface-raised)', border: '1px solid var(--g-border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-raised)'; }}
            >
              <div className="flex items-center gap-2">
                {compareHospitalName ? (
                  <>
                    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: 'var(--g-text)' }}>{compareHospitalName}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" style={{ color: 'var(--g-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm" style={{ color: 'var(--g-text-tertiary)' }}>Kurum seçin...</span>
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
                    className="p-0.5 rounded transition-colors"
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--g-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--g-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && ReactDOM.createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setSearchQuery('');
                }}
              />
              {/* Dropdown Content */}
              <div ref={radarDropdownRef} className="fixed w-72 backdrop-blur-xl rounded-xl shadow-2xl z-[9999] overflow-hidden" style={{ backgroundColor: 'var(--g-surface-raised)', border: '1px solid var(--g-border)', top: radarDropdownPos.top, right: radarDropdownPos.right }}>
                {/* Search Input */}
                <div className="p-3" style={{ borderBottom: '1px solid var(--g-border)' }}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--g-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Kurum ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                      style={{ backgroundColor: 'var(--g-surface)', border: '1px solid var(--g-border)', color: 'var(--g-text)' }}
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
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
                          }`}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <svg className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : ''}`} style={!isSelected ? { color: 'var(--g-text-muted)' } : undefined} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className={`text-sm ${isSelected ? 'text-emerald-400 font-medium' : ''}`} style={!isSelected ? { color: 'var(--g-text-secondary)' } : undefined}>
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
                    <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--g-text-muted)' }}>
                      Kurum bulunamadı
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* Skor Kartları */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--g-text-muted)' }}>{currentInstitutionName || 'Mevcut Kurum'}</p>
          <p className="text-3xl font-black text-emerald-400">%{Math.round(overallScore)}</p>
        </div>
        {compareOverallScore !== null && (
          <>
            <div className="text-2xl" style={{ color: 'var(--g-text-muted)' }}>vs</div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--g-text-muted)' }}>{compareHospitalName}</p>
              <p className="text-3xl font-black text-orange-400">%{Math.round(compareOverallScore)}</p>
            </div>
          </>
        )}
      </div>

      {/* Grafik */}
      <div className="h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={combinedData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity={0.7} />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
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
                  <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{value}</span>
                )}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Detay Açıklama */}
      <p className="text-center text-xs mt-2" style={{ color: 'var(--g-text-muted)' }}>
        Detay için aşağıdaki kartlara veya grafikteki noktalara tıklayın
      </p>

      {/* Kategori Kartları */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {combinedData.map((item, idx) => {
          const scoreColor = item.score >= 70 ? 'text-emerald-400'
            : item.score >= 50 ? 'text-amber-400'
            : item.score >= 30 ? 'text-orange-400'
            : 'text-rose-400';
          const barColor = item.score >= 70 ? '#10b981'
            : item.score >= 50 ? '#fbbf24'
            : item.score >= 30 ? '#f97316'
            : '#f43f5e';

          return (
            <div
              key={idx}
              onClick={() => setSelectedCategory(item)}
              className={`rounded-xl p-3 border transition-all cursor-pointer ${
                item.score < 30 ? 'border-rose-500/30'
                : item.score < 50 ? 'border-orange-500/30'
                : item.score < 70 ? 'border-amber-500/30'
                : ''
              }`}
              style={{
                backgroundColor: 'var(--g-surface)',
                ...(item.score >= 70 ? { borderColor: 'var(--g-border)' } : {})
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-raised)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface)'; }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs truncate" style={{ color: 'var(--g-text-tertiary)' }}>{item.category}</span>
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
                <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                  {item.indicatorCount}/{item.totalIndicators}
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 h-1 rounded-full overflow-hidden relative" style={{ backgroundColor: 'var(--g-border)' }}>
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
      <div className="mt-4 pt-4 flex items-center justify-between text-xs text-[var(--g-text-muted)]" style={{ borderTop: '1px solid var(--g-border)' }}>
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

      {/* Kategori Detay Modal - Portal ile document.body'ye render edilir */}
      {selectedCategory && ReactDOM.createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(30,41,59,0.7) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)',
              borderRadius: '24px',
              border: '1px solid rgba(148,163,184,0.2)',
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Gradient accent bar */}
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)',
              padding: '24px 28px',
              borderRadius: '24px 24px 0 0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Dekoratif ışık efekti */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />
              <div className="flex items-center justify-between" style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center gap-4">
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    {selectedCategory.icon}
                  </div>
                  <div>
                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{selectedCategory.fullName}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '2px' }}>{selectedCategory.indicatorCount}/{selectedCategory.totalIndicators} gösterge hesaplandı</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                >
                  <svg className="w-5 h-5" style={{ color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Kategori Skoru - Premium card */}
            <div className="flex items-center justify-between" style={{
              padding: '20px 28px',
              background: 'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)',
              borderBottom: '1px solid rgba(226,232,240,0.6)'
            }}>
              <span style={{ color: '#64748b', fontWeight: 600, fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Kategori Skoru</span>
              <div className="flex items-center gap-3">
                <span style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  background: selectedCategory.score >= 70
                    ? 'linear-gradient(135deg, #059669, #10b981)'
                    : selectedCategory.score >= 50
                    ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                    : selectedCategory.score >= 30
                    ? 'linear-gradient(135deg, #ea580c, #f97316)'
                    : 'linear-gradient(135deg, #dc2626, #f43f5e)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  %{selectedCategory.score}
                </span>
                {selectedCategory.compareScore !== undefined && (
                  <>
                    <span style={{ color: '#cbd5e1', fontSize: '20px' }}>vs</span>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #ea580c, #f97316)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>
                      %{selectedCategory.compareScore}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Göstergeler Listesi */}
            <div className="overflow-y-auto" style={{ padding: '20px 28px', maxHeight: 'calc(80vh - 220px)' }}>
              {/* Kurum başlıkları - karşılaştırma varsa göster */}
              {selectedCategory.compareDetails && selectedCategory.compareDetails.length > 0 && (
                <div className="flex items-center justify-end gap-5 mb-5 pr-1">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #059669, #10b981)' }} />
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{currentInstitutionName || 'Mevcut'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #ea580c, #f97316)' }} />
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{compareHospitalName}</span>
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

                    const ratio = detail.maxScore > 0 ? detail.score / detail.maxScore : 0;
                    const badgeGradient = ratio >= 1 ? 'linear-gradient(135deg, #059669, #10b981)'
                      : ratio >= 0.7 ? 'linear-gradient(135deg, #10b981, #34d399)'
                      : ratio >= 0.4 ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                      : ratio > 0 ? 'linear-gradient(135deg, #ea580c, #f97316)'
                      : 'linear-gradient(135deg, #dc2626, #ef4444)';

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '16px 20px',
                          borderRadius: '16px',
                          background: '#fff',
                          border: '1px solid rgba(226,232,240,0.7)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                          e.currentTarget.style.borderColor = 'rgba(226,232,240,0.7)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ fontSize: '14px', lineHeight: 1.5, flex: 1, color: '#334155', fontWeight: 500 }}>
                            {detail.name}
                          </span>
                          <div className="flex items-center gap-3">
                            {/* Ana kurum puanı - Premium gradient badge */}
                            <div className="flex flex-col items-center gap-1.5">
                              <span
                                style={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  padding: '6px 14px',
                                  borderRadius: '10px',
                                  background: badgeGradient,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                  letterSpacing: '0.02em'
                                }}
                              >
                                {detail.score}/{detail.maxScore}
                              </span>
                            </div>

                            {/* Karşılaştırma kurumu puanı */}
                            {compareDetail && (() => {
                              const cRatio = compareDetail.maxScore > 0 ? compareDetail.score / compareDetail.maxScore : 0;
                              const cGradient = cRatio >= 1 ? 'linear-gradient(135deg, #ea580c, #f97316)'
                                : cRatio >= 0.7 ? 'linear-gradient(135deg, #f97316, #fb923c)'
                                : cRatio >= 0.4 ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                                : cRatio > 0 ? 'linear-gradient(135deg, #ca8a04, #eab308)'
                                : 'linear-gradient(135deg, #dc2626, #ef4444)';
                              return (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span
                                    style={{
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: '13px',
                                      padding: '6px 14px',
                                      borderRadius: '10px',
                                      background: cGradient,
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                      letterSpacing: '0.02em'
                                    }}
                                  >
                                    {compareDetail.score}/{compareDetail.maxScore}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* İlerleme çubuğu */}
                        {!compareDetail && (
                          <div className="flex items-center gap-3" style={{ marginTop: '12px' }}>
                            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${detail.normalized}%`,
                                  height: '100%',
                                  borderRadius: '3px',
                                  background: badgeGradient,
                                  transition: 'width 0.5s ease'
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', minWidth: '40px', textAlign: 'right' as const }}>
                              %{Math.round(detail.normalized)}
                            </span>
                          </div>
                        )}

                        {/* Karşılaştırma çubukları */}
                        {compareDetail && (
                          <div style={{ marginTop: '12px' }}>
                            <div className="flex items-center gap-3">
                              <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${detail.normalized}%`,
                                    height: '100%',
                                    borderRadius: '3px',
                                    background: 'linear-gradient(135deg, #059669, #10b981)',
                                    transition: 'width 0.5s ease'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', minWidth: '40px', textAlign: 'right' as const }}>%{Math.round(detail.normalized)}</span>
                            </div>
                            <div className="flex items-center gap-3" style={{ marginTop: '6px' }}>
                              <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${compareDetail.normalized}%`,
                                    height: '100%',
                                    borderRadius: '3px',
                                    background: 'linear-gradient(135deg, #ea580c, #f97316)',
                                    transition: 'width 0.5s ease'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#f97316', minWidth: '40px', textAlign: 'right' as const }}>%{Math.round(compareDetail.normalized)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center" style={{ padding: '40px 0' }}>
                  <svg className="w-12 h-12 mx-auto mb-3" style={{ color: '#cbd5e1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>Bu kategoride hesaplanmış gösterge yok</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GorenRadarChart;
