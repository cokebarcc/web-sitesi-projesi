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
  loadGorenCalculation,
  downloadGorenTemplate,
  exportGorenResultsToExcel,
  parseGorenExcel,
  BHTableRow
} from '../../src/services/gorenStorage';

// Alt bileşenler
import GorenFilterPanel from './common/GorenFilterPanel';
import GorenSummaryCards from './common/GorenSummaryCards';
import GorenIndicatorTable from './common/GorenIndicatorTable';
import GorenDetailPanel from './common/GorenDetailPanel';
import GorenDataEntry from './common/GorenDataEntry';
import GorenBHTable from './common/GorenBHTable';

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
}

// Ay isimleri
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const GorenModule: React.FC<GorenModuleProps> = ({
  moduleType,
  userEmail,
  canUpload = true,
  availableInstitutions = []
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
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'entry'>('entry');
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
    try {
      // Kayıtlı hesaplamayı yüklemeye çalış
      const savedResult = await loadGorenCalculation(
        filterState.institutionId,
        filterState.year,
        filterState.month
      );

      if (savedResult) {
        // Kayıtlı sonuç var
        setResults(savedResult.indicators);
        setSummary(savedResult.summary);

        // Parametre değerlerini de yükle
        const loadedParams: Record<string, ParameterValues> = {};
        savedResult.indicators.forEach(ind => {
          loadedParams[ind.code] = ind.parameterValues;
        });
        setParameterValues(loadedParams);

        setViewMode('table');
        showNotification('success', `${MONTHS[filterState.month - 1]} ${filterState.year} verileri yüklendi`);
      } else {
        // Kayıtlı sonuç yok, boş başla
        setResults([]);
        setSummary(null);
        setParameterValues({});
        setViewMode('entry');
        showNotification('info', 'Bu dönem için kayıtlı veri bulunamadı. Veri girişi yapabilirsiniz.');
      }
    } catch (error) {
      console.error('[GÖREN Module] Yükleme hatası:', error);
      showNotification('error', 'Veriler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [filterState, showNotification]);

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

        // BH için doğrudan GP değerlerini kaydet
        if (moduleType === 'BH' && result.directGP) {
          setDirectGPValues(result.directGP);
          setTotalDirectGP(result.totalGP || 0);
          if (result.indicatorNames) {
            setIndicatorNamesFromExcel(result.indicatorNames);
          }

          // BH için Excel'den birebir tablo satırlarını kaydet
          if (result.bhTableRows && result.bhTableRows.length > 0) {
            setBhTableData(result.bhTableRows);
          }

          // BH için özel sonuç oluştur - Excel'den okunan GP değerlerini kullan
          // bhTableRows'dan donemIciPuan değerini kontrol et
          const bhTableRowsMap = new Map<string, BHTableRow>();
          if (result.bhTableRows) {
            for (const row of result.bhTableRows) {
              const code = `SYPG-BH-${row.sira}`;
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
          const totalGP = result.totalGP || 0;
          const maxPossibleGP = definitions.reduce((sum, d) => sum + d.maxPoints, 0);

          setSummary({
            totalGP,
            maxPossibleGP,
            achievementRate: maxPossibleGP > 0 ? (totalGP / maxPossibleGP) * 100 : 0,
            completedIndicators: completedResults.length,
            totalIndicators: definitions.length,
            incompleteIndicators: definitions.length - completedResults.length,
            topIndicators: [...bhResults].sort((a, b) => b.achievementPercent - a.achievementPercent).slice(0, 5),
            bottomIndicators: [...bhResults].sort((a, b) => a.achievementPercent - b.achievementPercent).slice(0, 5)
          });

          showNotification('success', `${Object.keys(result.directGP).length} gösterge yüklendi. Toplam Puan: ${totalGP.toFixed(2)}`);
          setViewMode('table');
        } else {
          // Diğer modüller için normal hesaplama
          showNotification('success', `${Object.keys(result.data).length} gösterge verisi yüklendi`);
          const calcResults = calculateAllIndicators(definitions, result.data);
          setResults(calcResults);
          setSummary(calculateSummary(calcResults));
          setViewMode('table');
        }

        // Firebase'e kaydetmeyi arka planda dene (hata verse de devam et)
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
          console.warn('[GÖREN Module] Firebase yükleme atlandı:', firebaseError);
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

  // Parametre değerleri değişikliği
  const handleValuesChange = useCallback((values: Record<string, ParameterValues>) => {
    setParameterValues(values);
  }, []);

  // Tümünü hesapla
  const handleCalculateAll = useCallback(async () => {
    setIsCalculating(true);
    try {
      const calcResults = calculateAllIndicators(definitions, parameterValues);
      setResults(calcResults);
      setSummary(calculateSummary(calcResults));
      setViewMode('table');

      // Sonuçları kaydet
      if (filterState.institutionId) {
        const institutionResult = createInstitutionResult(
          filterState.institutionId,
          filterState.institutionName,
          moduleType,
          filterState.year,
          filterState.month,
          calcResults,
          userEmail
        );

        const saveResult = await saveGorenCalculation(institutionResult, userEmail);
        if (saveResult.success) {
          showNotification('success', 'Hesaplama tamamlandı ve kaydedildi');
        } else {
          showNotification('info', 'Hesaplama tamamlandı (kayıt yapılamadı)');
        }
      } else {
        showNotification('success', 'Hesaplama tamamlandı');
      }
    } catch (error) {
      console.error('[GÖREN Module] Hesaplama hatası:', error);
      showNotification('error', 'Hesaplama sırasında hata oluştu');
    } finally {
      setIsCalculating(false);
    }
  }, [
    definitions,
    parameterValues,
    filterState,
    moduleType,
    userEmail,
    calculateAllIndicators,
    calculateSummary,
    createInstitutionResult,
    showNotification
  ]);

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

    // BH için tüm hastaneler (Başhekimlikler)
    HOSPITALS.forEach(hospital => {
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
      { id: 'adsh-haliliye', name: 'Haliliye ADSH', type: 'ADSH' as InstitutionType }
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

    return options;
  }, [availableInstitutions]);

  // Gösterge yoksa uyarı göster
  if (definitions.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center">
          <svg className="w-16 h-16 text-amber-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-xl font-bold text-amber-400 mb-2">
            {INSTITUTION_TYPE_LABELS[moduleType]} Modülü Yakında
          </h3>
          <p className="text-[var(--text-muted)]">
            Bu modül için gösterge tanımları henüz eklenmedi. Yakında aktif olacaktır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Bildirim */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-lg backdrop-blur-xl border ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : notification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        }`}>
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
      />

      {/* BH için Toplam Puan Büyük Kart */}
      {moduleType === 'BH' && totalDirectGP !== null && (
        <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-indigo-600/20 backdrop-blur-xl rounded-3xl border border-indigo-500/30 p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-300 uppercase tracking-wider mb-2">
                {filterState.institutionName || 'Seçili Hastane'} - {MONTHS[filterState.month - 1]} {filterState.year}
              </p>
              <h2 className="text-5xl font-black text-white mb-2">
                {totalDirectGP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-2xl font-normal text-indigo-300 ml-2">/ {definitions.reduce((sum, d) => sum + d.maxPoints, 0)} puan</span>
              </h2>
              <p className="text-indigo-200">
                Dönem İçi Toplam Performans Puanı
              </p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-indigo-500/20 border-4 border-indigo-400/30">
                <span className="text-3xl font-bold text-indigo-300">
                  %{summary ? summary.achievementRate.toFixed(0) : '0'}
                </span>
              </div>
              <p className="text-sm text-indigo-300 mt-2">Başarı Oranı</p>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartları */}
      <GorenSummaryCards
        summary={summary}
        isLoading={isLoading}
      />

      {/* Görünüm Değiştirici */}
      {filterState.institutionId && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('entry')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              viewMode === 'entry'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-3)]'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Veri Girişi
            </span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              viewMode === 'table'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-3)]'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Sonuç Tablosu
            </span>
          </button>
        </div>
      )}

      {/* İçerik */}
      {filterState.institutionId ? (
        viewMode === 'entry' ? (
          <GorenDataEntry
            definitions={definitions}
            currentValues={parameterValues}
            onValuesChange={handleValuesChange}
            onCalculateAll={handleCalculateAll}
            isLoading={isCalculating}
          />
        ) : moduleType === 'BH' && bhTableData.length > 0 ? (
          // BH için özel tablo - Excel'den birebir yansıtma
          <GorenBHTable
            data={bhTableData}
            totalGP={totalDirectGP || 0}
            isLoading={isLoading}
          />
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
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-12 text-center">
          <svg className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-bold text-[var(--text-1)] mb-2">
            Kurum Seçin
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
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
