/**
 * GÖREN Performans Hesaplama Ana Modülü
 *
 * Tüm GÖREN bileşenlerini orchestrate eden ana modül.
 * Filtre, özet, tablo ve detay panelini yönetir.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  InstitutionType,
  GorenFilterState,
  ParameterValues,
  IndicatorResult,
  CalculationSummary,
  InstitutionOption,
  IndicatorDefinition
} from './types/goren.types';
import {
  getIndicatorsByCategory,
  INSTITUTION_TYPE_LABELS,
  getIndicatorByCode
} from '../../src/config/goren';
import { HOSPITALS } from '../../constants';
import { useGorenCalculator } from '../../src/hooks/useGorenCalculator';
import {
  uploadGorenDataFile,
  saveGorenCalculation,
  downloadGorenTemplate,
  exportGorenResultsToExcel,
  parseGorenExcel,
  BHTableRow,
  saveGorenBHData,
  loadGorenBHData,
  saveTrRolOrtalamasi,
  loadTrRolOrtalamasi,
  loadBHHistoryData,
  BHHistoryData
} from '../../src/services/gorenStorage';

// Premium design system
import './goren-premium.css';

// Alt bileşenler
import GorenFilterPanel from './common/GorenFilterPanel';
import GorenSummaryCards from './common/GorenSummaryCards';
import GorenIndicatorTable from './common/GorenIndicatorTable';
import GorenDetailPanel from './common/GorenDetailPanel';
// GorenDataEntry artık Manuel Hesaplama modülünde kullanılıyor
import GorenBHTable from './common/GorenBHTable';
import GorenHistoryChart from './common/GorenHistoryChart';
import GorenRadarChart from './common/GorenRadarChart';
import GorenRecommendations from './common/GorenRecommendations';
import GorenHospitalRanking from './common/GorenHospitalRanking';
import { generateRecommendations, generateGenericRecommendations } from '../../utils/gorenRecommendations';

// BHTableRow artık gorenStorage'dan import ediliyor

interface GorenModuleProps {
  /** Modül türü (ILSM, ILCESM, BH, ADSH, ASH) */
  moduleType: InstitutionType;
  /** Kullanıcı email */
  userEmail: string;
  /** Yükleme yetkisi */
  canUpload?: boolean;
  /** Mevcut hastane/kurum listesi */
  availableInstitutions?: InstitutionOption[];
  /** Admin mi? */
  isAdmin?: boolean;
}

// Ay isimleri
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/**
 * Eşit ağırlıklı başarı oranı hesapla.
 * Her gösterge eşit değerlendirilir: gösterge başarı yüzdesi (GP/maxPoints*100) ortalaması.
 * Muaf göstergeler hesaptan hariç tutulur.
 */
function calculateEqualWeightAchievementRate(rows: BHTableRow[]): number {
  // Muaf olmayan tüm göstergeler dahil (puanı boş olanlar 0 olarak sayılır)
  const eligibleRows = rows.filter(r => r.muaf !== 1);
  if (eligibleRows.length === 0) return 0;

  const totalPercent = eligibleRows.reduce((sum, r) => {
    const maxP = r.maxPuan || 4;
    const gp = typeof r.donemIciPuan === 'number' ? r.donemIciPuan : 0;
    return sum + (maxP > 0 ? (gp / maxP) * 100 : 0);
  }, 0);

  return totalPercent / eligibleRows.length;
}

export const GorenModule: React.FC<GorenModuleProps> = ({
  moduleType,
  userEmail,
  canUpload = true,
  availableInstitutions = [],
  isAdmin = false
}) => {
  // Hesaplama hook'u
  const {
    calculateIndicator,
    calculateAllIndicators,
    calculateSummary,
    createInstitutionResult
  } = useGorenCalculator();

  // Gösterge tanımları
  const definitions = useMemo(
    () => getIndicatorsByCategory(moduleType),
    [moduleType]
  );

  // State
  const [filterState, setFilterState] = useState<GorenFilterState>({
    institutionType: moduleType,
    institutionId: '',
    institutionName: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  const [parameterValues, setParameterValues] = useState<Record<string, ParameterValues>>({});
  const [results, setResults] = useState<IndicatorResult[]>([]);
  const [summary, setSummary] = useState<CalculationSummary | null>(null);
  const [selectedIndicatorCode, setSelectedIndicatorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // BH için doğrudan GP değerleri (Excel'den okunan)
  const [directGPValues, setDirectGPValues] = useState<Record<string, number>>({});
  const [totalDirectGP, setTotalDirectGP] = useState<number | null>(null);
  const [indicatorNamesFromExcel, setIndicatorNamesFromExcel] = useState<Record<string, string>>({});

  // BH için Excel'den birebir tablo satırları
  const [bhTableData, setBhTableData] = useState<BHTableRow[]>([]);

  // Muaf gösterge sayısı
  const [muafCount, setMuafCount] = useState<number>(0);

  // TR Rol Ortalaması (her hastane/ay için farklı)
  const [trRolOrtalamasi, setTrRolOrtalamasi] = useState<number | null>(null);

  // Geçmiş performans verileri (grafik için)
  const [historyData, setHistoryData] = useState<BHHistoryData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Uygula butonuna basıldı mı? (Sıralama vb. bileşenler buna bağlı)
  const [isApplied, setIsApplied] = useState(false);

  // moduleType değiştiğinde filtre state'ini güncelle
  useEffect(() => {
    setFilterState(prev => ({
      ...prev,
      institutionType: moduleType
    }));
    // Sonuçları sıfırla
    setResults([]);
    setSummary(null);
    setParameterValues({});
    setDirectGPValues({});
    setTotalDirectGP(null);
    setIndicatorNamesFromExcel({});
    setBhTableData([]);
    setMuafCount(0);
    setIsApplied(false);
  }, [moduleType]);

  // Bildirim göster
  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Filtre değişikliği
  const handleFilterChange = useCallback((newState: Partial<GorenFilterState>) => {
    setFilterState(prev => ({ ...prev, ...newState }));
  }, []);

  // Uygula - Kayıtlı veriyi yükle
  const handleApply = useCallback(async () => {
    if (!filterState.institutionId) {
      showNotification('error', 'Lütfen bir kurum seçin');
      return;
    }

    setIsLoading(true);
    setIsApplied(true);
    try {
      // TR Rol Ortalaması'nı yükle
      const trRolValue = await loadTrRolOrtalamasi(
        filterState.institutionId,
        filterState.year,
        filterState.month
      );
      setTrRolOrtalamasi(trRolValue);

      // Tüm modüller için veri yükleme (Excel'den birebir)
      const bhData = await loadGorenBHData(
        filterState.institutionId,
        filterState.year,
        filterState.month
      );

      if (bhData && bhData.bhTableRows && bhData.bhTableRows.length > 0) {
        setBhTableData(bhData.bhTableRows);
        setTotalDirectGP(bhData.totalGP);
        setMuafCount(bhData.muafCount);

        // Summary oluştur
        const maxPossibleGP = definitions.reduce((sum, d) => sum + d.maxPoints, 0);
        const completedCount = bhData.bhTableRows.filter(r => typeof r.donemIciPuan === 'number').length;

        setSummary({
          totalGP: bhData.totalGP,
          maxPossibleGP,
          achievementRate: calculateEqualWeightAchievementRate(bhData.bhTableRows),
          completedIndicators: completedCount,
          totalIndicators: definitions.length,
          incompleteIndicators: definitions.length - completedCount,
          topIndicators: [],
          bottomIndicators: []
        });

        showNotification('success', `${MONTHS[filterState.month - 1]} ${filterState.year} verileri yüklendi. Toplam Puan: ${bhData.totalGP}`);
      } else {
        setBhTableData([]);
        setTotalDirectGP(null);
        setMuafCount(0);
        setSummary(null);
        setResults([]);
        showNotification('info', 'Bu dönem için kayıtlı veri bulunamadı. Excel dosyası yükleyebilirsiniz.');
      }

      // Geçmiş verileri yükle (grafik için) - arka planda
      setIsLoadingHistory(true);
      loadBHHistoryData(
        filterState.institutionId,
        filterState.year,
        filterState.month,
        12, // Son 12 ay
        moduleType
      ).then(history => {
        setHistoryData(history);
        setIsLoadingHistory(false);
      }).catch(err => {
        console.error('[GÖREN Module] Geçmiş veri yükleme hatası:', err);
        setIsLoadingHistory(false);
      });
    } catch (error) {
      console.error('[GÖREN Module] Yükleme hatası:', error);
      showNotification('error', 'Veriler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [filterState, moduleType, definitions, showNotification]);

  // TR Rol Ortalaması değişikliği (sadece admin)
  const handleTrRolOrtalamasiChange = useCallback(async (value: number) => {
    if (!filterState.institutionId) {
      showNotification('error', 'Lütfen önce bir kurum seçin');
      return;
    }

    try {
      const result = await saveTrRolOrtalamasi(
        filterState.institutionId,
        filterState.year,
        filterState.month,
        value,
        userEmail
      );

      if (result.success) {
        setTrRolOrtalamasi(value);
        showNotification('success', 'TR Rol Ortalaması güncellendi');
      } else {
        showNotification('error', result.error || 'Kaydetme hatası');
      }
    } catch (error) {
      console.error('[GÖREN Module] TR Rol Ortalaması kaydetme hatası:', error);
      showNotification('error', 'TR Rol Ortalaması kaydedilemedi');
    }
  }, [filterState, userEmail, showNotification]);

  // Şablon indir
  const handleDownloadTemplate = useCallback(() => {
    downloadGorenTemplate(definitions, moduleType);
    showNotification('success', 'Şablon dosyası indirildi');
  }, [definitions, moduleType, showNotification]);

  // Sonuçları dışa aktar
  const handleExport = useCallback(() => {
    if (!summary || results.length === 0) {
      showNotification('error', 'Dışa aktarılacak veri bulunamadı');
      return;
    }

    const institutionResult = createInstitutionResult(
      filterState.institutionId,
      filterState.institutionName,
      moduleType,
      filterState.year,
      filterState.month,
      results,
      userEmail
    );

    exportGorenResultsToExcel(institutionResult);
    showNotification('success', 'Sonuçlar Excel olarak indirildi');
  }, [summary, results, filterState, moduleType, userEmail, createInstitutionResult, showNotification]);

  // Dosya yükle - Firebase olmadan local parse
  const handleUploadFile = useCallback(async (file: File) => {
    if (!filterState.institutionId) {
      showNotification('error', 'Lütfen önce bir kurum seçin');
      return;
    }

    setIsLoading(true);
    try {
      // Dosyayı local olarak parse et (Firebase'e yüklemeden)
      const arrayBuffer = await file.arrayBuffer();
      const result = parseGorenExcel(arrayBuffer, moduleType);

      if (result.success && result.data) {
        setParameterValues(result.data);

        // Tüm modüller için doğrudan GP değerlerini kaydet
        if (result.directGP) {
          setDirectGPValues(result.directGP);
          setTotalDirectGP(result.totalGP || 0);
          if (result.indicatorNames) {
            setIndicatorNamesFromExcel(result.indicatorNames);
          }

          // BH için Excel'den birebir tablo satırlarını kaydet
          if (result.bhTableRows && result.bhTableRows.length > 0) {
            setBhTableData(result.bhTableRows);
          }

          // Tüm modüller için özel sonuç oluştur - Excel'den okunan GP değerlerini kullan
          // bhTableRows'dan donemIciPuan değerini kontrol et
          const codePrefix: Record<InstitutionType, string> = {
            'BH': 'SYPG-BH',
            'ILSM': 'SYPG-İLSM',
            'ILCESM': 'SYPG-İLÇESM',
            'ADSH': 'SYPG-ADSH',
            'ASH': 'SYPG-ASH'
          };
          const bhTableRowsMap = new Map<string, BHTableRow>();
          if (result.bhTableRows) {
            for (const row of result.bhTableRows) {
              const code = `${codePrefix[moduleType]}-${row.sira}`;
              bhTableRowsMap.set(code, row);
            }
          }

          const bhResults: IndicatorResult[] = definitions.map(def => {
            const code = def.code;
            const tableRow = bhTableRowsMap.get(code);
            const params = result.data?.[code] || {};
            const indicatorName = result.indicatorNames?.[code] || def.name;

            // donemIciPuan değerini kontrol et
            // null veya "-" ise: veri yok (insufficient_data)
            // number ise (0 dahil): veri var (success veya zero)
            const donemIciPuan = tableRow?.donemIciPuan;
            const hasData = typeof donemIciPuan === 'number';
            const gpValue = hasData ? donemIciPuan : 0;

            // GD değerini hesapla (varsa)
            let gd: number | null = null;
            let gdFormatted = '-';
            if (params['GD'] !== undefined) {
              gd = params['GD'] as number;
              gdFormatted = def.unit === 'percentage' ? `%${gd.toFixed(1)}` : gd.toFixed(2);
            } else if (params['A'] !== undefined && params['B'] !== undefined && params['B'] !== 0) {
              gd = (params['A'] as number) / (params['B'] as number);
              if (def.gdFormula.includes('* 100')) {
                gd = gd * 100;
              }
              gdFormatted = def.unit === 'percentage' ? `%${gd.toFixed(1)}` : gd.toFixed(2);
            }

            // Status belirleme:
            // - hasData && gpValue > 0: success (yeşil)
            // - hasData && gpValue === 0: zero (kırmızı - 0 puan almış)
            // - !hasData: insufficient_data (gri - veri yok)
            const status = hasData ? 'success' : 'insufficient_data';

            return {
              code,
              name: indicatorName,
              parameterValues: params,
              gd,
              gdFormatted,
              gp: gpValue,
              maxPoints: def.maxPoints,
              status,
              statusIndicator: !hasData ? 'unknown' :
                              gpValue >= def.maxPoints * 0.8 ? 'excellent' :
                              gpValue >= def.maxPoints * 0.6 ? 'good' :
                              gpValue >= def.maxPoints * 0.4 ? 'average' :
                              gpValue > 0 ? 'poor' : 'zero',
              achievementPercent: def.maxPoints > 0 ? (gpValue / def.maxPoints) * 100 : 0
            } as IndicatorResult;
          });

          setResults(bhResults);

          // Özet hesapla - hasData olanları say (0 dahil)
          const completedResults = bhResults.filter(r => r.status === 'success');

          // Muaf ağırlıklandırma hesaplaması
          // Muaf olan göstergelerin puanları diğerlerine dağıtılacak
          let muafTotalMaxPuan = 0; // Muaf göstergelerin toplam max puanı
          let nonMuafTotalMaxPuan = 0; // Muaf olmayan göstergelerin toplam max puanı
          let nonMuafTotalPuan = 0; // Muaf olmayan göstergelerin aldığı toplam puan

          if (result.bhTableRows) {
            for (const row of result.bhTableRows) {
              const isMuaf = row.muaf === 1;
              const maxPuan = row.maxPuan || 4;
              const puan = typeof row.donemIciPuan === 'number' ? row.donemIciPuan : 0;

              if (isMuaf) {
                muafTotalMaxPuan += maxPuan;
              } else {
                nonMuafTotalMaxPuan += maxPuan;
                nonMuafTotalPuan += puan;
              }
            }
          }

          // Ağırlıklandırılmış toplam puan hesapla
          // Formül: (Muaf olmayan puan / Muaf olmayan maxPuan) × Toplam maxPuan
          const totalMaxPuan = muafTotalMaxPuan + nonMuafTotalMaxPuan;
          let weightedTotalGP: number;

          if (nonMuafTotalMaxPuan > 0 && muafTotalMaxPuan > 0) {
            // Muaf gösterge varsa ağırlıklandır
            weightedTotalGP = (nonMuafTotalPuan / nonMuafTotalMaxPuan) * totalMaxPuan;
          } else {
            // Muaf gösterge yoksa orijinal toplam
            weightedTotalGP = result.totalGP || 0;
          }

          // State'e ağırlıklandırılmış toplamı kaydet (yuvarlanmış)
          const roundedWeightedTotalGP = Math.round(weightedTotalGP);
          setTotalDirectGP(roundedWeightedTotalGP);

          const maxPossibleGP = definitions.reduce((sum, d) => sum + d.maxPoints, 0);

          setSummary({
            totalGP: roundedWeightedTotalGP,
            maxPossibleGP,
            achievementRate: calculateEqualWeightAchievementRate(result.bhTableRows || []),
            completedIndicators: completedResults.length,
            totalIndicators: definitions.length,
            incompleteIndicators: definitions.length - completedResults.length,
            topIndicators: [...bhResults].sort((a, b) => b.achievementPercent - a.achievementPercent).slice(0, 5),
            bottomIndicators: [...bhResults].sort((a, b) => a.achievementPercent - b.achievementPercent).slice(0, 5)
          });

          const currentMuafCount = result.bhTableRows?.filter(r => r.muaf === 1).length || 0;
          setMuafCount(currentMuafCount);
          const muafInfo = currentMuafCount > 0 ? ` (${currentMuafCount} muaf gösterge ağırlıklandırıldı)` : '';
          showNotification('success', `${Object.keys(result.directGP).length} gösterge yüklendi. Toplam Puan: ${roundedWeightedTotalGP}${muafInfo}`);

          // BH verilerini Firebase'e kaydet
          try {
            await saveGorenBHData(
              filterState.institutionId,
              filterState.institutionName,
              filterState.year,
              filterState.month,
              result.bhTableRows || [],
              roundedWeightedTotalGP,
              currentMuafCount,
              userEmail
            );
            console.log('[GÖREN Module] BH verileri Firebase\'e kaydedildi');
          } catch (firebaseError) {
            console.warn('[GÖREN Module] BH Firebase kaydetme hatası:', firebaseError);
          }
        } else {
          // Diğer modüller için normal hesaplama
          showNotification('success', `${Object.keys(result.data).length} gösterge verisi yüklendi`);
          const calcResults = calculateAllIndicators(definitions, result.data);
          setResults(calcResults);
          setSummary(calculateSummary(calcResults));
        }

        // Dosyayı Firebase Storage'a yükle (arka planda)
        try {
          await uploadGorenDataFile(
            file,
            filterState.institutionId,
            filterState.institutionName,
            moduleType,
            filterState.year,
            filterState.month,
            userEmail
          );
        } catch (firebaseError) {
          console.warn('[GÖREN Module] Firebase Storage yükleme atlandı:', firebaseError);
        }
      } else {
        showNotification('error', result.error || 'Dosya parse edilemedi');
      }
    } catch (error) {
      console.error('[GÖREN Module] Yükleme hatası:', error);
      showNotification('error', 'Dosya yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [filterState, moduleType, userEmail, definitions, calculateAllIndicators, calculateSummary, showNotification]);

  // Satır tıklama (detay paneli aç)
  const handleRowClick = useCallback((code: string) => {
    setSelectedIndicatorCode(code);
  }, []);

  // Detay panelinden parametre değişikliği
  const handleParameterChange = useCallback((code: string, values: ParameterValues) => {
    // Parametre değerlerini güncelle
    const newParamValues = { ...parameterValues, [code]: values };
    setParameterValues(newParamValues);

    // Tek göstergeyi yeniden hesapla
    const definition = definitions.find(d => d.code === code);
    if (definition) {
      const newResult = calculateIndicator(definition, values);

      // Sonuçları güncelle
      setResults(prev => {
        const updated = prev.map(r => r.code === code ? newResult : r);
        // Özeti de güncelle
        setSummary(calculateSummary(updated));
        return updated;
      });
    }
  }, [parameterValues, definitions, calculateIndicator, calculateSummary]);

  // Seçili gösterge tanımı ve sonucu
  const selectedDefinition = selectedIndicatorCode
    ? definitions.find(d => d.code === selectedIndicatorCode) || null
    : null;
  const selectedResult = selectedIndicatorCode
    ? results.find(r => r.code === selectedIndicatorCode) || null
    : null;

  // Kurum listesi - HOSPITALS sabitinden ve İLSM için özel kurumlar
  const institutionOptions: InstitutionOption[] = useMemo(() => {
    if (availableInstitutions.length > 0) {
      return availableInstitutions;
    }

    const options: InstitutionOption[] = [];

    // İLSM için il sağlık müdürlükleri
    options.push(
      { id: 'ism-sanliurfa', name: 'Şanlıurfa İl Sağlık Müdürlüğü', type: 'ILSM' as InstitutionType }
    );

    // BH için tüm hastaneler (Başhekimlikler) - Harran ve Balıklıgöl sistemden muaf
    const excludedHospitals = ['Harran DH', 'Balıklıgöl DH'];
    HOSPITALS.filter(h => !excludedHospitals.includes(h)).forEach(hospital => {
      const id = hospital.toLowerCase().replace(/\s+/g, '-').replace(/[ışğüöçİŞĞÜÖÇ]/g, c => {
        const map: Record<string, string> = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'İ': 'i', 'Ş': 's', 'Ğ': 'g', 'Ü': 'u', 'Ö': 'o', 'Ç': 'c' };
        return map[c] || c;
      });
      options.push({
        id: `bh-${id}`,
        name: hospital,
        type: 'BH' as InstitutionType
      });
    });

    // ADSH için ağız diş sağlığı hastaneleri
    options.push(
      { id: 'adsh-sanliurfa', name: 'Şanlıurfa ADSH', type: 'ADSH' as InstitutionType },
      { id: 'adsh-haliliye', name: 'Haliliye ADSH', type: 'ADSH' as InstitutionType },
      { id: 'adsh-eyyubiye', name: 'Eyyübiye ADSM', type: 'ADSH' as InstitutionType },
      { id: 'adsh-siverek', name: 'Siverek ADSM', type: 'ADSH' as InstitutionType }
    );

    // İLÇESM için ilçe sağlık müdürlükleri
    ['Birecik', 'Bozova', 'Ceylanpınar', 'Halfeti', 'Harran', 'Hilvan', 'Siverek', 'Suruç', 'Viranşehir', 'Akçakale', 'Eyyübiye', 'Haliliye', 'Karaköprü'].forEach(ilce => {
      const id = ilce.toLowerCase().replace(/\s+/g, '-').replace(/[ışğüöçİŞĞÜÖÇ]/g, c => {
        const map: Record<string, string> = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'İ': 'i', 'Ş': 's', 'Ğ': 'g', 'Ü': 'u', 'Ö': 'o', 'Ç': 'c' };
        return map[c] || c;
      });
      options.push({
        id: `ilcesm-${id}`,
        name: `${ilce} İlçe Sağlık Müdürlüğü`,
        type: 'ILCESM' as InstitutionType
      });
    });

    // ASH için acil sağlık hizmetleri
    options.push(
      { id: 'ash-sanliurfa', name: 'Şanlıurfa 112 Acil Sağlık Hizmetleri', type: 'ASH' as InstitutionType }
    );

    // Türkçe karakterleri dikkate alarak A-Z sırala
    return options.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [availableInstitutions]);

  // Ranking için hastane listesi (modül türüne uygun olanlar)
  const rankingHospitals = useMemo(() => {
    return institutionOptions
      .filter(o => o.type === moduleType)
      .map(o => ({ id: o.id, name: o.name }));
  }, [institutionOptions, moduleType]);

  // Puan iyileştirme önerilerini hesapla (tüm modüller için)
  const recommendationsSummary = useMemo(() => {
    if (bhTableData.length === 0 || !totalDirectGP) return null;
    if (moduleType === 'BH') {
      return generateRecommendations(bhTableData, definitions, totalDirectGP);
    }
    // İLÇESM, ADSH ve diğer modüller için generic fonksiyon kullan
    return generateGenericRecommendations(bhTableData, definitions, totalDirectGP, moduleType);
  }, [bhTableData, definitions, totalDirectGP, moduleType]);

  // Gösterge yoksa uyarı göster
  if (definitions.length === 0) {
    return (
      <div className="goren-module p-8">
        <div className="g-card p-8 text-center" style={{ borderColor: 'var(--g-warning)', borderWidth: '1px' }}>
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--g-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="g-title-section mb-2" style={{ color: 'var(--g-warning-text)' }}>
            {INSTITUTION_TYPE_LABELS[moduleType]} Modülü Yakında
          </h3>
          <p className="g-text-body" style={{ color: 'var(--g-text-muted)' }}>
            Bu modül için gösterge tanımları henüz eklenmedi. Yakında aktif olacaktır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="goren-module" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4, 16px)' }}>
      {/* Bildirim */}
      {notification && (
        <div className={`g-toast fixed top-4 right-4 z-50 g-toast--${notification.type}`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {notification.type === 'info' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Filtre Paneli */}
      <GorenFilterPanel
        filterState={filterState}
        onFilterChange={handleFilterChange}
        onApply={handleApply}
        onDownloadTemplate={handleDownloadTemplate}
        onExport={handleExport}
        onUploadFile={handleUploadFile}
        availableInstitutions={institutionOptions}
        isLoading={isLoading}
        canUpload={canUpload}
        hasData={results.length > 0 && summary !== null}
        showInstitutionTypeFilter={false}
      />

      {/* Kurum Başarı Sıralaması - Uygula butonuna basıldıktan sonra göster */}
      {isApplied && rankingHospitals.length > 1 && (
        <GorenHospitalRanking
          hospitals={rankingHospitals}
          year={filterState.year}
          month={filterState.month}
          maxGP={definitions.reduce((sum, d) => sum + d.maxPoints, 0)}
          currentInstitutionId={filterState.institutionId}
          moduleLabel={INSTITUTION_TYPE_LABELS[moduleType]}
        />
      )}

      {/* BH için Toplam Puan Büyük Kart */}
      {totalDirectGP !== null && (
        <div className="g-hero-card">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="g-text-meta" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 'var(--g-space-2)' }}>
                {filterState.institutionName || 'Seçili Kurum'} — {MONTHS[filterState.month - 1]} {filterState.year}
              </p>
              <h2 className="g-num" style={{ fontSize: '48px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: 'var(--g-space-2)' }}>
                {totalDirectGP}
                <span style={{ fontSize: '22px', fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginLeft: '8px' }}>/ {definitions.reduce((sum, d) => sum + d.maxPoints, 0)} puan</span>
              </h2>
              <p className="g-text-body" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Dönem İçi Toplam Performans Puanı
              </p>
            </div>
            <div className="text-right">
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '96px', height: '96px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)'
              }}>
                <span className="g-num" style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
                  %{summary ? summary.achievementRate.toFixed(0) : '0'}
                </span>
              </div>
              <p className="g-text-small" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 'var(--g-space-2)' }}>Başarı Oranı</p>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartları */}
      <GorenSummaryCards
        summary={summary}
        isLoading={isLoading}
        muafCount={muafCount}
        totalIndicators={definitions.length}
        isAdmin={isAdmin}
        trRolOrtalamasi={trRolOrtalamasi}
        onTrRolOrtalamasiChange={handleTrRolOrtalamasiChange}
      />

      {/* Puan İyileştirme Önerileri - BH, İLÇESM ve ADSH modüllerinde veri varken */}
      {(moduleType === 'BH' || moduleType === 'ILCESM' || moduleType === 'ADSH') && bhTableData.length > 0 && summary && (
        <GorenRecommendations
          bhTableData={bhTableData}
          definitions={definitions}
          summary={summary}
          totalGP={totalDirectGP || 0}
          moduleType={moduleType}
        />
      )}

      {/* İçerik */}
      {filterState.institutionId ? (
        bhTableData.length > 0 ? (
          // Tüm modüller için Excel'den birebir yansıtma tablosu
          <>
            {/* BH için Performans Trendi Grafiği - Tablonun üzerinde */}
            <div className="mb-6">
              <GorenHistoryChart
                data={historyData}
                isLoading={isLoadingHistory}
                institutionName={filterState.institutionName}
                moduleLabel={INSTITUTION_TYPE_LABELS[moduleType]}
              />
            </div>

            {/* Radar (Örümcek Ağı) Grafiği - ILSM ve ASH hariç */}
            {moduleType !== 'ILSM' && moduleType !== 'ASH' && (
              <div className="mb-6">
                <GorenRadarChart
                  data={bhTableData}
                  isLoading={isLoading}
                  currentInstitutionId={filterState.institutionId}
                  currentInstitutionName={filterState.institutionName}
                  year={filterState.year}
                  month={filterState.month}
                  moduleType={moduleType}
                  compareInstitutions={rankingHospitals}
                />
              </div>
            )}

            <GorenBHTable
              data={bhTableData}
              totalGP={totalDirectGP || 0}
              isLoading={isLoading}
              moduleType={moduleType}
              recommendations={recommendationsSummary?.recommendations}
            />
          </>
        ) : (
          <GorenIndicatorTable
            results={results}
            definitions={definitions}
            onRowClick={handleRowClick}
            selectedCode={selectedIndicatorCode || undefined}
            isLoading={isLoading}
          />
        )
      ) : (
        <div className="g-card" style={{ padding: 'var(--g-space-12)', textAlign: 'center' }}>
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--g-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="g-title-section" style={{ marginBottom: 'var(--g-space-2)' }}>
            Kurum Seçin
          </h3>
          <p className="g-text-body" style={{ color: 'var(--g-text-muted)' }}>
            Performans hesaplaması yapabilmek için yukarıdan bir kurum seçin ve "Uygula" butonuna tıklayın.
          </p>
        </div>
      )}

      {/* Detay Paneli */}
      <GorenDetailPanel
        definition={selectedDefinition}
        result={selectedResult}
        isOpen={!!selectedIndicatorCode}
        onClose={() => setSelectedIndicatorCode(null)}
        onParameterChange={handleParameterChange}
        readonly={false}
      />
    </div>
  );
};

export default GorenModule;
