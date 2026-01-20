
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, storage } from './firebase';
import {
  ViewType,
  AppointmentData,
  HBYSData,
  DetailedScheduleData,
  SUTServiceData,
  ScheduleProposal,
  ScheduleVersion,
  MuayeneMetrics,
  PresentationSlide,
  PresentationTarget,
  PresentationWidgetState
} from './types';
import { MOCK_DATA, DEPARTMENTS, HOSPITALS, YEARS, HOSPITAL_DEPARTMENTS, MONTHS } from './constants';
import LoginPage from './components/LoginPage';
import AdminPanel from './src/components/AdminPanel';
import FilterPanel from './components/common/FilterPanel';

import ChatBot from './components/ChatBot';
import { AIChatPanel } from './src/components/ai';
import ServiceInterventionAnalysis from './components/ServiceInterventionAnalysis';
import DetailedSchedule from './components/DetailedSchedule';
import ChangeAnalysis from './components/ChangeAnalysis';
import GorenBashekimlik from './components/GorenBashekimlik';
import AnalysisModule from './components/AnalysisModule';
import PhysicianData from './components/PhysicianData';
import EfficiencyAnalysis from './components/EfficiencyAnalysis';
import PresentationModule from './components/PresentationModule';
import DashboardHome from './components/DashboardHome';
import DashboardCategory from './components/DashboardCategory';
import EmergencyService from './components/EmergencyService';
import WelcomeDashboard from './components/WelcomeDashboard';
import FloatingSidebar from './components/FloatingSidebar';
import SchedulePlanning from './components/SchedulePlanning';
import ActiveDemand from './components/ActiveDemand';
import { useUserPermissions } from './src/hooks/useUserPermissions';
import { ADMIN_EMAIL } from './src/types/user';

// Logolar
import sbLogo from './logo/sb logo.png';
import medisLogo from './logo/medis logo.svg';

const App: React.FC = () => {
  // Clean up localStorage on app start - remove large data
  useEffect(() => {
    try {
      // Remove scheduleVersions (now stored in Storage only)
      localStorage.removeItem('scheduleVersions');

      // Check total localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }

      // If localStorage is too full (>4MB), clear old large items
      if (totalSize > 4 * 1024 * 1024) {
        console.warn('⚠️ LocalStorage çok büyük, temizleniyor...');
        const keysToRemove = ['muayeneByPeriod', 'ameliyatByPeriod', 'muayeneMetaByPeriod', 'ameliyatMetaByPeriod'];
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            console.log(`✅ ${key} temizlendi`);
          } catch (e) {
            console.error(`❌ ${key} temizlenemedi:`, e);
          }
        });
      }

      console.log('✅ LocalStorage temizliği tamamlandı');
    } catch (error) {
      console.error('LocalStorage temizleme hatası:', error);
    }
  }, []);

  // Firebase Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User Permissions
  const { userPermissions, loading: permissionsLoading, hasModuleAccess, canUploadData, isAdmin } = useUserPermissions(user?.email || null);

  const [view, setView] = useState<ViewType>('welcome');
  const [dashboardCategory, setDashboardCategory] = useState<'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency' | null>(null);

  // ========== GLOBAL FİLTRE STATE (TÜM MODÜLLER İÇİN TEK MERKEZ) ==========
  // Modül değişiminde bu state'ler KORUNUR - sıfırlanmaz
  const [selectedHospital, setSelectedHospital] = useState<string>(''); // Boş başlangıç - kullanıcı seçecek
  const [globalSelectedYears, setGlobalSelectedYears] = useState<number[]>([]); // Çoklu yıl seçimi
  const [globalSelectedMonths, setGlobalSelectedMonths] = useState<number[]>([]); // Çoklu ay seçimi (1-12)
  const [globalAppliedYears, setGlobalAppliedYears] = useState<number[]>([]); // Uygulanan yıllar
  const [globalAppliedMonths, setGlobalAppliedMonths] = useState<number[]>([]); // Uygulanan aylar
  const [globalSelectedBranch, setGlobalSelectedBranch] = useState<string | null>(null); // Branş filtresi

  // Debug: Global filtre değişimini logla
  useEffect(() => {
    console.log('🎯 Global Filtre Değişti:', {
      selectedHospital,
      globalSelectedYears,
      globalSelectedMonths,
      globalAppliedYears,
      globalAppliedMonths
    });
  }, [selectedHospital, globalSelectedYears, globalSelectedMonths, globalAppliedYears, globalAppliedMonths]);

  // Eski yapı ile uyumluluk için (modüller yavaş yavaş güncellenecek)
  const [branchFilters, setBranchFilters] = useState<Record<ViewType, string | null>>({
    'detailed-schedule': null,
    'physician-data': null,
    'efficiency-analysis': null,
    'change-analysis': null,
    'performance-planning': null,
    'data-entry': null,
    'ai-chatbot': null,
    'service-analysis': null,
    'goren': null,
    'analysis-module': null,
    'presentation': null,
    'schedule': null,
    'admin': null,
    'emergency-service': null
  });

  // Eski yapı ile uyumluluk - modüller güncellenene kadar kullanılacak
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const [monthFilters, setMonthFilters] = useState<Record<ViewType, string>>({
    'detailed-schedule': '',
    'physician-data': '',
    'efficiency-analysis': '',
    'change-analysis': '',
    'performance-planning': '',
    'data-entry': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'goren': '',
    'analysis-module': '',
    'presentation': '',
    'schedule': '',
    'admin': '',
    'emergency-service': ''
  });

  const [yearFilters, setYearFilters] = useState<Record<ViewType, number>>({
    'detailed-schedule': 0,
    'physician-data': 0,
    'efficiency-analysis': 0,
    'change-analysis': 0,
    'performance-planning': 0,
    'data-entry': 0,
    'ai-chatbot': 0,
    'service-analysis': 0,
    'goren': 0,
    'analysis-module': 0,
    'presentation': 0,
    'schedule': 0,
    'admin': 0,
    'emergency-service': 0
  });

  // Her modül için cetvel seçimleri (ChangeAnalysis için)
  const [baselineLabels, setBaselineLabels] = useState<Record<ViewType, string>>({
    'detailed-schedule': '',
    'physician-data': '',
    'efficiency-analysis': '',
    'change-analysis': '',
    'performance-planning': '',
    'data-entry': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'goren': '',
    'analysis-module': '',
    'presentation': '',
    'schedule': '',
    'admin': '',
    'emergency-service': ''
  });

  const [updatedLabels, setUpdatedLabels] = useState<Record<ViewType, string>>({
    'detailed-schedule': '',
    'physician-data': '',
    'efficiency-analysis': '',
    'change-analysis': '',
    'performance-planning': '',
    'data-entry': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'goren': '',
    'analysis-module': '',
    'presentation': '',
    'schedule': '',
    'admin': '',
    'emergency-service': ''
  });

  // Mevcut modül için aktif filtreyi al
  const selectedBranch = branchFilters[view];
  const selectedMonth = monthFilters[view];
  const selectedYear = yearFilters[view];
  const selectedBaselineLabel = baselineLabels[view];
  const selectedUpdatedLabel = updatedLabels[view];

  
  const [departments, setDepartments] = useState<string[]>(HOSPITAL_DEPARTMENTS[selectedHospital] || DEPARTMENTS);
  const [appointmentData, setAppointmentData] = useState<AppointmentData[]>(MOCK_DATA.filter(d => d.hospital === selectedHospital));
  const [hbysData, setHbysData] = useState<HBYSData[]>([]);
  // Load data from localStorage on mount (for non-detailedSchedule data)
  // LocalStorage removed - all data loaded from Firestore

  const [detailedScheduleData, setDetailedScheduleData] = useState<DetailedScheduleData[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // Track if Firebase data is loaded
  const [sutServiceData, setSutServiceData] = useState<SUTServiceData[]>([]);

  const [muayeneByPeriod, setMuayeneByPeriod] = useState<Record<string, Record<string, MuayeneMetrics>>>({});
  const [ameliyatByPeriod, setAmeliyatByPeriod] = useState<Record<string, Record<string, number>>>({});
  const [muayeneMetaByPeriod, setMuayeneMetaByPeriod] = useState<Record<string, { fileName: string; uploadedAt: number }>>({});
  const [ameliyatMetaByPeriod, setAmeliyatMetaByPeriod] = useState<Record<string, { fileName: string; uploadedAt: number }>>({});

  // scheduleVersions no longer loaded from LocalStorage - stored in Storage only
  const [scheduleVersions, setScheduleVersions] = useState<Record<string, Record<string, ScheduleVersion>>>({});

  // ChangeAnalysis için yüklenmiş tam versiyon verileri (modül değişiminde korunur)
  const [changeAnalysisLoadedVersions, setChangeAnalysisLoadedVersions] = useState<Record<string, ScheduleVersion>>({});

  // ChangeAnalysis'ten hesaplanmış hekim karşılaştırma verisi (phys_compare)
  const [changeAnalysisPhysCompare, setChangeAnalysisPhysCompare] = useState<any[]>([]);

  const [sutRiskAnalysis, setSutRiskAnalysis] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Veriler Güncelleniyor...');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [isMhrsExpanded, setIsMhrsExpanded] = useState(true);
  const [isFinancialExpanded, setIsFinancialExpanded] = useState(true);
  const [isDevExpanded, setIsDevExpanded] = useState(true);
  const [isEmergencyExpanded, setIsEmergencyExpanded] = useState(true);

  // Sync for presentation "Add current screen"
  const [slides, setSlides] = useState<PresentationSlide[]>([]);

  // Otomatik veri yükleme kaldırıldı - kullanıcı "Uygula" butonuna tıklayacak
  // Modül geçişlerinde filtreler ve veriler KORUNUR - sıfırlama kaldırıldı

  // Firebase Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Firebase Data Sync - Load data from Firestore when user logs in
  // detailedScheduleData is loaded from Storage (see useEffect above)
  useEffect(() => {
    if (!user) return;

    const dataRef = doc(db, 'appData', 'mainData');

    const unsubscribe = onSnapshot(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // detailedScheduleData excluded - loaded from Storage
        // scheduleVersions excluded - loaded from Storage (change-analysis)
        if (data.muayeneByPeriod) setMuayeneByPeriod(data.muayeneByPeriod);
        if (data.ameliyatByPeriod) setAmeliyatByPeriod(data.ameliyatByPeriod);
        if (data.muayeneMetaByPeriod) setMuayeneMetaByPeriod(data.muayeneMetaByPeriod);
        if (data.ameliyatMetaByPeriod) setAmeliyatMetaByPeriod(data.ameliyatMetaByPeriod);
        if (data.sutServiceData) setSutServiceData(data.sutServiceData);
        if (data.presentationSlides) setSlides(data.presentationSlides);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Cache for loaded data - only load once per hospital/year/month
  const [loadedDataCache, setLoadedDataCache] = useState<Set<string>>(new Set());

  // Function to load data for specific hospital/year/month
  const handleLoadPeriodData = async (hospital: string, year: number, month: string) => {
    const cacheKey = `${hospital}-${year}-${month}`;

    // Check if already loaded
    if (loadedDataCache.has(cacheKey)) {
      console.log(`✅ Veriler zaten yüklü: ${cacheKey}`);
      return;
    }

    setIsLoading(true);
    setLoadingText(`${hospital} - ${month} ${year} verileri yükleniyor...`);

    try {
      console.log(`🔄 Veriler yükleniyor: ${hospital} - ${month} ${year}`);

      // Load detailed schedule data
      const { loadAllDetailedScheduleData } = await import('./src/services/detailedScheduleStorage');
      const scheduleData = await loadAllDetailedScheduleData(hospital, month, year);
      setDetailedScheduleData(prev => {
        // Remove old data for this period and add new
        const filtered = prev.filter(d => !(d.hospital === hospital && d.month === month && d.year === year));
        return [...filtered, ...scheduleData];
      });
      console.log(`✅ ${scheduleData.length} detaylı cetvel kaydı yüklendi`);

      // Load muayene and ameliyat data from Storage
      const { loadAllMuayeneData, loadAllAmeliyatData } = await import('./src/services/physicianDataStorage');

      // Load muayene data for this period
      const muayeneFiles = await import('./src/services/physicianDataStorage').then(m =>
        m.getPhysicianDataFiles(hospital, month, year, 'muayene')
      );

      if (muayeneFiles.length > 0) {
        const muayeneDataForPeriod = await loadAllMuayeneData(hospital, month, year);
        setMuayeneByPeriod(prev => ({ ...prev, ...muayeneDataForPeriod }));
        console.log(`✅ ${hospital} - Muayene verisi yüklendi`);
      }

      // Load ameliyat data for this period
      const ameliyatFiles = await import('./src/services/physicianDataStorage').then(m =>
        m.getPhysicianDataFiles(hospital, month, year, 'ameliyat')
      );

      if (ameliyatFiles.length > 0) {
        const ameliyatDataForPeriod = await loadAllAmeliyatData(hospital, month, year);
        setAmeliyatByPeriod(prev => ({ ...prev, ...ameliyatDataForPeriod }));
        console.log(`✅ ${hospital} - Ameliyat verisi yüklendi`);
      }

      // Mark as loaded
      setLoadedDataCache(prev => new Set([...prev, cacheKey]));
      console.log(`✅ Tüm veriler başarıyla yüklendi: ${cacheKey}`);

      showToast(`${hospital} - ${month} ${year} verileri yüklendi`, 'success');
    } catch (error) {
      console.error('❌ Veri yükleme hatası:', error);
      showToast('Veri yükleme hatası', 'error');
    } finally {
      setIsLoading(false);
      setLoadingText('Veriler Güncelleniyor...');
    }
  };

  // ========== VERİMLİLİK ANALİZLERİ İÇİN MERKEZİ VERİ YÜKLEME ==========
  // Bu fonksiyon tek bir Uygula butonu ile tüm bağlı modüllerin verilerini yükler:
  // - Detaylı Cetveller
  // - Hekim Verileri
  // - Değişim Analizleri
  const handleCentralDataLoad = async (hospital: string, years: number[], months: number[]) => {
    if (!hospital || years.length === 0 || months.length === 0) {
      showToast('Lütfen hastane, yıl ve ay seçiniz', 'error');
      return;
    }

    setIsLoading(true);
    setLoadingText('Tüm modüller için veriler yükleniyor...');

    try {
      console.log('🚀 Merkezi veri yükleme başladı:', { hospital, years, months });

      // Global filtreleri güncelle
      setGlobalAppliedYears(years);
      setGlobalAppliedMonths(months);

      // Her yıl/ay kombinasyonu için veri yükle
      for (const year of years) {
        for (const monthIdx of months) {
          const month = MONTHS[monthIdx - 1];
          await handleLoadPeriodData(hospital, year, month);

          // Değişim Analizleri verilerini de yükle (Verimlilik Analizleri için)
          // Tam veriyi yükle - metadata değil physicians içeren veri
          try {
            const { loadAllChangeAnalysisVersions, loadSingleVersionData } = await import('./src/services/changeAnalysisStorage');
            const loadedVersionsMetadata = await loadAllChangeAnalysisVersions(hospital, month, year);

            // Dönen tüm monthKey'leri kontrol et (Firestore'daki format)
            const allMonthKeys = Object.keys(loadedVersionsMetadata);
            console.log('🔍 [CHANGE-ANALYSIS] Bulunan monthKey\'ler:', allMonthKeys);

            for (const monthKey of allMonthKeys) {
              const versionLabels = Object.keys(loadedVersionsMetadata[monthKey]);

              if (versionLabels.length > 0) {
                const fullVersions: Record<string, ScheduleVersion> = {};

                // Her versiyon için tam veriyi yükle
                for (const label of versionLabels) {
                  const metadata = loadedVersionsMetadata[monthKey][label];
                  if ((metadata as any).fileUrl) {
                    const fullData = await loadSingleVersionData((metadata as any).fileUrl);
                    if (fullData) {
                      fullVersions[label] = fullData;
                      console.log(`✅ ${label} tam verisi yüklendi (${Object.keys(fullData.physicians || {}).length} hekim)`);
                    }
                  }
                }

                if (Object.keys(fullVersions).length > 0) {
                  setScheduleVersions(prev => ({
                    ...prev,
                    [monthKey]: fullVersions
                  }));
                  console.log(`✅ ${monthKey} için ${Object.keys(fullVersions).length} versiyon tam verisi yüklendi`);

                  // Otomatik olarak İLK CETVEL ve SON CETVEL'i seç (ChangeAnalysis için)
                  const findLabelByKeyword = (keyword: string) =>
                    versionLabels.find(l => l.toLocaleUpperCase('tr-TR').includes(keyword));

                  const ilkCetvel = findLabelByKeyword('İLK') || findLabelByKeyword('ILK');
                  const sonCetvel = findLabelByKeyword('SON');

                  if (ilkCetvel) {
                    setBaselineLabels(prev => ({ ...prev, 'change-analysis': ilkCetvel }));
                    // İlk cetvel'in full verisini changeAnalysisLoadedVersions'a kaydet
                    if (fullVersions[ilkCetvel]) {
                      setChangeAnalysisLoadedVersions(prev => ({ ...prev, [ilkCetvel]: fullVersions[ilkCetvel] }));
                    }
                    console.log(`🔄 Eski sürüm otomatik seçildi: ${ilkCetvel}`);
                  }
                  if (sonCetvel) {
                    setUpdatedLabels(prev => ({ ...prev, 'change-analysis': sonCetvel }));
                    // Son cetvel'in full verisini changeAnalysisLoadedVersions'a kaydet
                    if (fullVersions[sonCetvel]) {
                      setChangeAnalysisLoadedVersions(prev => ({ ...prev, [sonCetvel]: fullVersions[sonCetvel] }));
                    }
                    console.log(`🔄 Yeni sürüm otomatik seçildi: ${sonCetvel}`);
                  }

                  // ChangeAnalysis modülü için ay/yıl filtrelerini de güncelle
                  setMonthFilters(prev => ({ ...prev, 'change-analysis': month }));
                  setYearFilters(prev => ({ ...prev, 'change-analysis': year }));
                }
              }
            }
          } catch (versionError) {
            console.warn('Değişim analizi verileri yüklenemedi:', versionError);
          }
        }
      }

      showToast(`${hospital} için ${months.length * years.length} dönem verisi yüklendi`, 'success');
      console.log('✅ Merkezi veri yükleme tamamlandı');
    } catch (error) {
      console.error('❌ Merkezi veri yükleme hatası:', error);
      showToast('Veri yükleme hatası', 'error');
    } finally {
      setIsLoading(false);
      setLoadingText('Veriler Güncelleniyor...');
    }
  };

  // Save data to Firestore whenever it changes (debounced)
  // detailedScheduleData excluded - stored in Firebase Storage
  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(async () => {
      try {
        const dataToSave = {
          // detailedScheduleData excluded - stored in Storage
          // scheduleVersions excluded - stored in Storage (change-analysis)
          muayeneByPeriod,
          ameliyatByPeriod,
          muayeneMetaByPeriod,
          ameliyatMetaByPeriod,
          sutServiceData,
          presentationSlides: slides,
          lastUpdated: new Date().toISOString()
        };

        // Check data size (Firestore limit is 1MB)
        const dataSize = new Blob([JSON.stringify(dataToSave)]).size;
        const maxSize = 1048576; // 1MB in bytes

        if (dataSize > maxSize) {
          console.warn(`⚠️ Veri boyutu çok büyük (${(dataSize / 1024 / 1024).toFixed(2)} MB), Firestore'a kaydedilemiyor.`);
          return;
        }

        const dataRef = doc(db, 'appData', 'mainData');
        await setDoc(dataRef, dataToSave, { merge: true });
        console.log('✅ Veriler Firestore\'a kaydedildi');
      } catch (error) {
        console.error('Error saving to Firestore:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [user, muayeneByPeriod, ameliyatByPeriod, muayeneMetaByPeriod, ameliyatMetaByPeriod, sutServiceData, slides]);

  // LocalStorage DISABLED - All data now stored in Firestore to prevent quota issues
  // (LocalStorage was causing quota exceeded errors with large datasets)

  // Hastane değiştiğinde sadece hastaneye özel verileri güncelle
  // FİLTRELER SIIFIRLANMAZ - kullanıcı seçimlerini korur
  useEffect(() => {
    const newDeptList = HOSPITAL_DEPARTMENTS[selectedHospital] || DEPARTMENTS;
    setDepartments(newDeptList);
    setAppointmentData(MOCK_DATA.filter(d => d.hospital === selectedHospital));
  }, [selectedHospital]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleImportDetailedExcel = async (files: FileList | null, targetHospital?: string, targetMonth?: string, targetYear?: number) => {
    if (!files?.length || !targetHospital || !targetMonth || !targetYear) {
      showToast("Lütfen hastane, ay ve yıl seçin.", "error");
      return;
    }

    if (!user?.email) {
      showToast("Dosya yüklemek için giriş yapmalısınız.", "error");
      return;
    }

    setIsLoading(true);
    setLoadingText('Dosya Firebase Storage\'a yükleniyor...');

    try {
      const file = files[0];
      console.log('📁 Dosya yükleme başladı:', { targetHospital, targetMonth, targetYear, fileName: file.name });

      // Upload file to Firebase Storage
      const { uploadDetailedScheduleFile, loadAllDetailedScheduleData } = await import('./src/services/detailedScheduleStorage');
      const result = await uploadDetailedScheduleFile(file, targetHospital, targetMonth, targetYear, user.email);

      if (result.success) {
        showToast(`✅ Dosya yüklendi: ${result.recordCount} kayıt`, 'success');

        // Reload data with same filters (hospital, month, year)
        console.log('🔄 Veriler yeniden yükleniyor...');
        const allData = await loadAllDetailedScheduleData(targetHospital, targetMonth, targetYear);
        setDetailedScheduleData(allData);
        console.log(`✅ Toplam ${allData.length} kayıt yüklendi`);
      } else {
        showToast(`❌ Yükleme hatası: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('❌ Dosya yükleme hatası:', error);
      showToast("Dosya yükleme hatası.", "error");
    } finally {
      setIsLoading(false);
      setLoadingText('Veriler Güncelleniyor...');
    }
  };

  const handleLoadDetailedScheduleData = async (hospital: string, month: string, year: number) => {
    setIsLoading(true);
    setLoadingText(`${hospital} - ${month} ${year} verileri yükleniyor...`);

    try {
      console.log(`📂 Veri yükleniyor: ${hospital} ${month} ${year}`);
      const { loadAllDetailedScheduleData } = await import('./src/services/detailedScheduleStorage');
      const records = await loadAllDetailedScheduleData(hospital, month, year);
      setDetailedScheduleData(records);
      console.log(`✅ ${records.length} kayıt yüklendi`);
      showToast(`✅ ${records.length} kayıt yüklendi`, 'success');
    } catch (error) {
      console.error('❌ Veri yükleme hatası:', error);
      showToast("Veri yükleme hatası.", "error");
    } finally {
      setIsLoading(false);
      setLoadingText('Veriler Güncelleniyor...');
    }
  };

  const currentBranchOptions = useMemo(() => {
    const branches = new Set<string>();
    // Seçili hastaneye ait detaylı cetvel verilerinden branşları al
    detailedScheduleData
      .filter(d => d.hospital === selectedHospital)
      .forEach(d => branches.add(d.specialty));
    // Seçili hastaneye ait randevu verilerinden branşları al
    appointmentData.forEach(a => branches.add(a.specialty));
    return Array.from(branches).filter(b => b && b !== 'Bilinmiyor').sort();
  }, [detailedScheduleData, appointmentData, selectedHospital]);

  // Kullanıcı yetkilerine göre hastane listesi
  const allowedHospitals = useMemo(() => {
    if (!userPermissions) return HOSPITALS;
    if (isAdmin) return HOSPITALS; // Admin tüm hastaneleri görebilir
    if (userPermissions.permissions.allowedHospitals.length === 0) return HOSPITALS; // Boş array = tüm hastaneler
    return userPermissions.permissions.allowedHospitals;
  }, [userPermissions, isAdmin]);

  // Seçili hastaneye göre filtrelenmiş veriler
  const filteredDetailedScheduleData = useMemo(() => {
    const filtered = detailedScheduleData.filter(d => d.hospital === selectedHospital);
    console.log('🔍 Filtreleme:', {
      totalData: detailedScheduleData.length,
      selectedHospital,
      filteredCount: filtered.length,
      allHospitals: [...new Set(detailedScheduleData.map(d => d.hospital))]
    });
    return filtered;
  }, [detailedScheduleData, selectedHospital]);

  // Unified rendering bridge for Normal View vs Presentation View
  const renderView = () => {
    return (
      <div key={selectedHospital} className="w-full">
        {(() => {
          switch (view) {
            case 'welcome':
              return (
                <WelcomeDashboard
                  userName={user?.email?.split('@')[0]}
                  userEmail={user?.email || ''}
                  onNavigate={(v) => setView(v as ViewType)}
                />
              );

            case 'dashboard':
              return (
                <DashboardHome
                  onNavigateToCategory={(cat) => {
                    setDashboardCategory(cat);
                    setView(`dashboard-${cat}` as ViewType);
                  }}
                  userPermissions={userPermissions}
                />
              );

            case 'dashboard-mhrs':
            case 'dashboard-financial':
            case 'dashboard-preparation':
            case 'dashboard-support':
            case 'dashboard-emergency':
              const category = dashboardCategory || 'mhrs';
              return (
                <div>
                  <DashboardCategory
                    category={category}
                    onBack={() => {
                      setView('dashboard');
                      setDashboardCategory(null);
                    }}
                    hasModuleAccess={hasModuleAccess}
                    onModuleSelect={(moduleId) => {
                      // Modül ID'sine göre view'i değiştir
                      setView(moduleId as ViewType);
                    }}
                  />
                </div>
              );

            case 'physician-data':
              return (
                <PhysicianData
                  data={filteredDetailedScheduleData}
                  onNavigateToDetailed={() => setView('detailed-schedule')}
                  muayeneByPeriod={muayeneByPeriod}
                  setMuayeneByPeriod={setMuayeneByPeriod}
                  ameliyatByPeriod={ameliyatByPeriod}
                  setAmeliyatByPeriod={setAmeliyatByPeriod}
                  muayeneMetaByPeriod={muayeneMetaByPeriod}
                  setMuayeneMetaByPeriod={setMuayeneMetaByPeriod}
                  ameliyatMetaByPeriod={ameliyatMetaByPeriod}
                  setAmeliyatMetaByPeriod={setAmeliyatMetaByPeriod}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={(m) => setMonthFilters(prev => ({ ...prev, [view]: m }))}
                  selectedYear={selectedYear}
                  setSelectedYear={(y) => setYearFilters(prev => ({ ...prev, [view]: y }))}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  onLoadPeriodData={handleLoadPeriodData}
                  canUpload={canUploadData('physicianData')}
                />
              );
            case 'efficiency-analysis':
              return (
                <EfficiencyAnalysis
                  detailedScheduleData={filteredDetailedScheduleData}
                  muayeneByPeriod={muayeneByPeriod}
                  ameliyatByPeriod={ameliyatByPeriod}
                  muayeneMetaByPeriod={muayeneMetaByPeriod}
                  ameliyatMetaByPeriod={ameliyatMetaByPeriod}
                  versions={scheduleVersions}
                  changeAnalysisPhysCompare={changeAnalysisPhysCompare}
                  // Global filtre state'leri
                  globalSelectedYears={globalSelectedYears}
                  setGlobalSelectedYears={setGlobalSelectedYears}
                  globalSelectedMonths={globalSelectedMonths}
                  setGlobalSelectedMonths={setGlobalSelectedMonths}
                  globalAppliedYears={globalAppliedYears}
                  globalAppliedMonths={globalAppliedMonths}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  // Merkezi veri yükleme fonksiyonu
                  onCentralDataLoad={handleCentralDataLoad}
                  isLoading={isLoading}
                />
              );
            case 'detailed-schedule':
              return (
                <DetailedSchedule
                  data={filteredDetailedScheduleData}
                  selectedBranch={selectedBranch}
                  onImportExcel={handleImportDetailedExcel}
                  onDelete={(id) => setDetailedScheduleData(prev => prev.filter(d => d.id !== id))}
                  onClearAll={() => setDetailedScheduleData(prev => prev.filter(d => d.hospital !== selectedHospital))}
                  onRemoveMonth={(m, y) => setDetailedScheduleData(prev => prev.filter(d => !(d.hospital === selectedHospital && d.month === m && d.year === y)))}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  onLoadData={handleLoadDetailedScheduleData}
                  canUpload={canUploadData('detailedSchedule')}
                />
              );

            case 'change-analysis':
              return (
                <ChangeAnalysis
                  versions={scheduleVersions}
                  setVersions={setScheduleVersions}
                  selectedBranch={selectedBranch}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={(m) => setMonthFilters(prev => ({ ...prev, [view]: m }))}
                  selectedYear={selectedYear}
                  setSelectedYear={(y) => setYearFilters(prev => ({ ...prev, [view]: y }))}
                  baselineLabel={selectedBaselineLabel}
                  setBaselineLabel={(label) => setBaselineLabels(prev => ({ ...prev, [view]: label }))}
                  updatedLabel={selectedUpdatedLabel}
                  setUpdatedLabel={(label) => setUpdatedLabels(prev => ({ ...prev, [view]: label }))}
                  isAdmin={isAdmin}
                  loadedFullVersions={changeAnalysisLoadedVersions}
                  setLoadedFullVersions={setChangeAnalysisLoadedVersions}
                  onPhysCompareUpdate={setChangeAnalysisPhysCompare}
                />
              );

            case 'service-analysis':
              return (
                <>
                  <FilterPanel
                    selectedHospital={selectedHospital}
                    onHospitalChange={setSelectedHospital}
                    allowedHospitals={allowedHospitals}
                    showHospitalFilter={true}
                  />
                  <ServiceInterventionAnalysis sutData={sutServiceData} onImportSUT={(f) => {}} aiAnalysis={sutRiskAnalysis} setAiAnalysis={setSutRiskAnalysis} />
                </>
              );

            case 'ai-chatbot':
              return (
                <div className="h-[calc(100vh-120px)]">
                  <AIChatPanel
                    userId={user?.uid || user?.email || 'anonymous'}
                    hospitalId={selectedHospital || 'all'}
                    currentView={view}
                    selectedFilters={{
                      hospital: selectedHospital,
                      years: globalAppliedYears,
                      months: globalAppliedMonths,
                      branch: branchFilters[view] || undefined
                    }}
                  />
                </div>
              );

            case 'goren':
              return (
                <>
                  <FilterPanel
                    selectedHospital={selectedHospital}
                    onHospitalChange={setSelectedHospital}
                    allowedHospitals={allowedHospitals}
                    showHospitalFilter={true}
                  />
                  <GorenBashekimlik />
                </>
              );

            case 'analysis-module':
              return (
                <>
                  <FilterPanel
                    selectedHospital={selectedHospital}
                    onHospitalChange={setSelectedHospital}
                    allowedHospitals={allowedHospitals}
                    showHospitalFilter={true}
                  />
                  <AnalysisModule appointmentData={appointmentData} hbysData={hbysData} planningProposals={[]} pastChangesInitialData={null} pastChangesFinalData={null} onClearPastChanges={() => {}} selectedHospital={selectedHospital} />
                </>
              );
            case 'presentation': return <PresentationModule slides={slides} setSlides={setSlides} detailedScheduleData={filteredDetailedScheduleData} muayeneByPeriod={muayeneByPeriod} ameliyatByPeriod={ameliyatByPeriod} versions={scheduleVersions} selectedHospital={selectedHospital} />;
            case 'admin': return <AdminPanel currentUserEmail={user?.email || ''} />;
            case 'emergency-service':
              return (
                <EmergencyService
                  selectedMonth={selectedMonth}
                  setSelectedMonth={(m) => setMonthFilters(prev => ({ ...prev, 'emergency-service': m }))}
                  selectedYear={selectedYear}
                  setSelectedYear={(y) => setYearFilters(prev => ({ ...prev, 'emergency-service': y }))}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  canUpload={canUploadData('emergencyService')}
                />
              );
            case 'schedule-planning':
              return (
                <SchedulePlanning
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  selectedBranch={selectedBranch}
                  detailedScheduleData={detailedScheduleData}
                />
              );
            case 'active-demand':
              return (
                <ActiveDemand
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  canUpload={canUploadData('activeDemand')}
                />
              );
            default: return null;
          }
        })()}
      </div>
    );
  };

  const addCurrentToPresentation = () => {
    const slideId = `slide-${Date.now()}`;
    const widgetId = `w-${Date.now()}`;
    
    // Map current ViewType to a PresentationTarget if applicable
    const targetMap: Record<string, PresentationTarget> = {
      'efficiency-analysis': 'CAPACITY_CHART',
      'detailed-schedule': 'DETAILED_SUMMARY',
      'physician-data': 'PHYSICIAN_LIST',
      'change-analysis': 'CHANGE_SUMMARY',
      'analysis-module': 'ANALYSIS_OVERVIEW'
    };

    const targetType = targetMap[view] || 'COVER_SLIDE';
    
    // Attempt to guess current month/year/branch for snapshot
    const snapshot: PresentationWidgetState = {
      branch: selectedBranch || 'ALL',
      month: 'Kasım', // Default fallback
      year: 2025
    };

    const newSlide: PresentationSlide = {
      id: slideId,
      title: `${view.toUpperCase()} - GÖRÜNÜM`,
      widgets: [{
        id: widgetId,
        type: targetType,
        mode: 'LIVE',
        snapshotState: snapshot
      }]
    };

    setSlides(prev => [...prev, newSlide]);
    showToast("Görünüm sunuma eklendi. 'Sunum' sekmesinden düzenleyebilirsiniz.");
  };

  const isMhrsActive = ['detailed-schedule', 'physician-data', 'efficiency-analysis', 'change-analysis'].includes(view);
  const isFinancialExpandedActive = ['service-analysis'].includes(view);
  const isDevActive = ['analysis-module', 'performance-planning', 'presentation'].includes(view);
  const isEmergencyActive = ['emergency-service'].includes(view);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-black text-lg">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onLoginSuccess={() => setAuthLoading(false)} />;
  }

  // Welcome ekranı için özel tam ekran layout
  if (view === 'welcome') {
    return (
      <div className="min-h-screen font-['Inter']">
        {toast && (
          <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
            {toast.message}
          </div>
        )}
        <WelcomeDashboard
          userName={user?.email?.split('@')[0]}
          userEmail={user?.email || ''}
          onNavigate={(v) => setView(v as ViewType)}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          hasModuleAccess={hasModuleAccess}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-slate-200 bg-gradient-to-br from-[#0a0a1a] via-[#0d1025] to-[#0a0a1a] relative font-['Inter']">
      {toast && (
        <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'}`}>
          {toast.message}
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center">
          <div className="bg-[#12121a] border border-slate-700/50 p-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 min-w-[400px]">
             {/* ECG Kalp Ritmi Animasyonu */}
             <div className="relative w-full h-24 flex items-center justify-center overflow-hidden">
               <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                 <defs>
                   <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" style={{stopColor: '#3b82f6', stopOpacity: 0.8}} />
                     <stop offset="100%" style={{stopColor: '#60a5fa', stopOpacity: 0.4}} />
                   </linearGradient>
                 </defs>
                 {/* ECG Çizgisi */}
                 <path
                   d="M0,30 L40,30 L43,10 L46,50 L49,30 L60,30 L63,25 L66,35 L69,30 L200,30"
                   fill="none"
                   stroke="url(#ecgGradient)"
                   strokeWidth="2.5"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   className="animate-ecg"
                 />
               </svg>
               {/* Kalp İkonu */}
               <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
                 <svg className="w-8 h-8 text-rose-500 animate-heartbeat" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                 </svg>
               </div>
             </div>
             <p className="font-black text-slate-200 text-center">{loadingText}</p>
          </div>
        </div>
      )}

      {/* ECG ve Kalp Animasyonları için CSS */}
      <style>{`
        @keyframes ecg {
          0% {
            stroke-dasharray: 0 1000;
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dasharray: 1000 1000;
            stroke-dashoffset: -1000;
          }
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          10% {
            transform: scale(1.2);
          }
          20% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.15);
          }
          40% {
            transform: scale(1);
          }
        }

        .animate-ecg {
          animation: ecg 2s linear infinite;
        }

        .animate-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }
      `}</style>

      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-slate-700/50 w-full max-w-md rounded-[32px] shadow-2xl p-8">
            <h2 className="text-xl font-black mb-4 text-white">Yeni Branş Ekle</h2>
            <input autoFocus className="w-full border border-slate-700 bg-slate-800/50 text-white p-4 rounded-2xl mb-4 outline-none focus:ring-2 ring-blue-500 font-bold placeholder-slate-500" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Branş adı..." />
            <div className="flex gap-2">
               <button onClick={() => setIsBranchModalOpen(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-white transition-colors">İptal</button>
               <button onClick={() => { if (newBranchName) { setDepartments(prev => [...prev, newBranchName].sort()); setBranchFilters(prev => ({ ...prev, [view]: newBranchName })); setNewBranchName(''); setIsBranchModalOpen(false); } }} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black hover:bg-blue-700 transition-colors">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sidebar */}
      <FloatingSidebar
        currentView={view}
        onNavigate={(v) => setView(v as ViewType)}
        userEmail={user?.email || ''}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        hasModuleAccess={hasModuleAccess}
      />

      {/* Main Content - Sidebar için padding-left eklendi */}
      <main className="flex-1 min-w-0 overflow-y-auto w-full custom-scrollbar ml-[88px]">
        <div className="w-full px-8 py-6">
          {/* Üst Bar - Logo sağda */}
          <header className="mb-6 flex justify-end items-center no-print">
            {/* Sağlık Bakanlığı Logo ve Yazı - Sağda (Logo solda, yazı sağda) */}
            <div className="flex items-center gap-3 bg-[#12121a]/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-slate-700/30">
              <img
                src={sbLogo}
                alt="T.C. Sağlık Bakanlığı"
                className="h-8 w-auto object-contain brightness-0 invert"
              />
              <div className="text-left">
                <p className="text-[9px] font-bold text-white tracking-wide">T.C. SAĞLIK BAKANLIĞI</p>
                <p className="text-[9px] font-semibold text-white/80">ŞANLIURFA İL SAĞLIK MÜDÜRLÜĞÜ</p>
              </div>
            </div>
          </header>
          <section className="animate-in fade-in slide-in-from-top-4 duration-500">{renderView()}</section>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, color }: any) => {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all ${active ? 'bg-white/60 text-slate-900' : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'}`}>
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-medium whitespace-nowrap">{label}</span>
    </button>
  );
};

const SubNavItem = ({ label, active, onClick, color }: any) => {
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all whitespace-nowrap ${active ? 'text-slate-900 font-medium bg-white/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/30 font-normal'}`}>
      {label}
    </button>
  );
};

export default App;
