
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import AdminPanel from './src/components/admin/AdminPanel';
import FilterPanel from './components/common/FilterPanel';

import ChatBot from './components/ChatBot';
import { AIChatPanel } from './src/components/ai';
import ServiceInterventionAnalysis from './components/ServiceInterventionAnalysis';
import EtikKurulModule from './components/EtikKurulModule';
import HekimIslemListesiModule from './components/HekimIslemListesiModule';
import EkListeTanimlama from './components/EkListeTanimlama';
import SutMevzuati from './components/SutMevzuati';
import GilModule from './components/GilModule';
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
import MapDashboard from './components/map/MapDashboard';
import FloatingSidebar from './components/FloatingSidebar';
import CommandPalette from './components/CommandPalette';
import SchedulePlanning from './components/SchedulePlanning';
import ActiveDemand from './components/ActiveDemand';
import AICetvelPlanlama from './components/AICetvelPlanlama';
import GorenModule from './components/goren/GorenModule';
import GorenManuelHesaplama from './components/goren/GorenManuelHesaplama';
import PdfViewer from './components/PdfViewer';
import StickyNotes from './components/StickyNotes';
import ComparisonWizard from './components/ComparisonWizard';
import { useUserPermissions } from './src/hooks/useUserPermissions';
import { ADMIN_EMAIL } from './src/types/user';
import SessionManagement from './src/components/SessionManagement';
import { registerSession, logoutSession } from './src/services/sessionService';

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

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('medis_theme');
    return (saved === 'dark') ? 'dark' : 'light';
  });
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('medis_theme', next);
      return next;
    });
  }, []);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [view, setViewState] = useState<ViewType>(() => {
    const saved = localStorage.getItem('medis_active_view');
    return (saved as ViewType) || 'welcome';
  });
  const [dashboardCategory, setDashboardCategory] = useState<'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency' | null>(() => {
    const saved = localStorage.getItem('medis_dashboard_category');
    return saved ? (saved as 'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency') : null;
  });

  // View değiştiğinde localStorage'a kaydet
  const setView = useCallback((newView: ViewType) => {
    setViewState(newView);
    localStorage.setItem('medis_active_view', newView);
  }, []);

  // Dashboard category değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (dashboardCategory) {
      localStorage.setItem('medis_dashboard_category', dashboardCategory);
    } else {
      localStorage.removeItem('medis_dashboard_category');
    }
  }, [dashboardCategory]);

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
    'welcome': null,
    'dashboard': null,
    'dashboard-mhrs': null,
    'dashboard-financial': null,
    'dashboard-preparation': null,
    'dashboard-support': null,
    'dashboard-emergency': null,
    'schedule': null,
    'performance-planning': null,
    'data-entry': null,
    'physician-data': null,
    'ai-chatbot': null,
    'service-analysis': null,
    'etik-kurul': null,
    'hekim-islem-listesi': null,
    'ek-liste-tanimlama': null,
    'sut-mevzuati': null,
    'gil': null,
    'detailed-schedule': null,
    'change-analysis': null,
    'goren': null,
    'analysis-module': null,
    'efficiency-analysis': null,
    'presentation': null,
    'emergency-service': null,
    'schedule-planning': null,
    'active-demand': null,
    'goren-ilsm': null,
    'goren-ilcesm': null,
    'goren-bh': null,
    'goren-adsh': null,
    'goren-ash': null,
    'ai-cetvel-planlama': null,
    'pdf-viewer': null,
    'comparison-wizard': null,
    'goren-manuel': null,
    'admin': null,
    'session-management': null
  });

  // Eski yapı ile uyumluluk - modüller güncellenene kadar kullanılacak
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const [monthFilters, setMonthFilters] = useState<Record<ViewType, string>>({
    'welcome': '',
    'dashboard': '',
    'dashboard-mhrs': '',
    'dashboard-financial': '',
    'dashboard-preparation': '',
    'dashboard-support': '',
    'dashboard-emergency': '',
    'schedule': '',
    'performance-planning': '',
    'data-entry': '',
    'physician-data': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'etik-kurul': '',
    'hekim-islem-listesi': '',
    'ek-liste-tanimlama': '',
    'sut-mevzuati': '',
    'gil': '',
    'detailed-schedule': '',
    'change-analysis': '',
    'goren': '',
    'analysis-module': '',
    'efficiency-analysis': '',
    'presentation': '',
    'emergency-service': '',
    'schedule-planning': '',
    'active-demand': '',
    'goren-ilsm': '',
    'goren-ilcesm': '',
    'goren-bh': '',
    'goren-adsh': '',
    'goren-ash': '',
    'ai-cetvel-planlama': '',
    'pdf-viewer': '',
    'comparison-wizard': '',
    'goren-manuel': '',
    'admin': '',
    'session-management': ''
  });

  const [yearFilters, setYearFilters] = useState<Record<ViewType, number>>({
    'welcome': 0,
    'dashboard': 0,
    'dashboard-mhrs': 0,
    'dashboard-financial': 0,
    'dashboard-preparation': 0,
    'dashboard-support': 0,
    'dashboard-emergency': 0,
    'schedule': 0,
    'performance-planning': 0,
    'data-entry': 0,
    'physician-data': 0,
    'ai-chatbot': 0,
    'service-analysis': 0,
    'etik-kurul': 0,
    'hekim-islem-listesi': 0,
    'ek-liste-tanimlama': 0,
    'sut-mevzuati': 0,
    'gil': 0,
    'detailed-schedule': 0,
    'change-analysis': 0,
    'goren': 0,
    'analysis-module': 0,
    'efficiency-analysis': 0,
    'presentation': 0,
    'emergency-service': 0,
    'schedule-planning': 0,
    'active-demand': 0,
    'goren-ilsm': 0,
    'goren-ilcesm': 0,
    'goren-bh': 0,
    'goren-adsh': 0,
    'goren-ash': 0,
    'ai-cetvel-planlama': 0,
    'pdf-viewer': 0,
    'comparison-wizard': 0,
    'goren-manuel': 0,
    'admin': 0,
    'session-management': 0
  });

  // Her modül için cetvel seçimleri (ChangeAnalysis için)
  const [baselineLabels, setBaselineLabels] = useState<Record<ViewType, string>>({
    'welcome': '',
    'dashboard': '',
    'dashboard-mhrs': '',
    'dashboard-financial': '',
    'dashboard-preparation': '',
    'dashboard-support': '',
    'dashboard-emergency': '',
    'schedule': '',
    'performance-planning': '',
    'data-entry': '',
    'physician-data': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'etik-kurul': '',
    'hekim-islem-listesi': '',
    'ek-liste-tanimlama': '',
    'sut-mevzuati': '',
    'gil': '',
    'detailed-schedule': '',
    'change-analysis': '',
    'goren': '',
    'analysis-module': '',
    'efficiency-analysis': '',
    'presentation': '',
    'emergency-service': '',
    'schedule-planning': '',
    'active-demand': '',
    'goren-ilsm': '',
    'goren-ilcesm': '',
    'goren-bh': '',
    'goren-adsh': '',
    'goren-ash': '',
    'ai-cetvel-planlama': '',
    'pdf-viewer': '',
    'comparison-wizard': '',
    'goren-manuel': '',
    'admin': '',
    'session-management': ''
  });

  const [updatedLabels, setUpdatedLabels] = useState<Record<ViewType, string>>({
    'welcome': '',
    'dashboard': '',
    'dashboard-mhrs': '',
    'dashboard-financial': '',
    'dashboard-preparation': '',
    'dashboard-support': '',
    'dashboard-emergency': '',
    'schedule': '',
    'performance-planning': '',
    'data-entry': '',
    'physician-data': '',
    'ai-chatbot': '',
    'service-analysis': '',
    'etik-kurul': '',
    'hekim-islem-listesi': '',
    'ek-liste-tanimlama': '',
    'sut-mevzuati': '',
    'gil': '',
    'detailed-schedule': '',
    'change-analysis': '',
    'goren': '',
    'analysis-module': '',
    'efficiency-analysis': '',
    'presentation': '',
    'emergency-service': '',
    'schedule-planning': '',
    'active-demand': '',
    'goren-ilsm': '',
    'goren-ilcesm': '',
    'goren-bh': '',
    'goren-adsh': '',
    'goren-ash': '',
    'ai-cetvel-planlama': '',
    'pdf-viewer': '',
    'comparison-wizard': '',
    'goren-manuel': '',
    'admin': '',
    'session-management': ''
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isStickyNotesOpen, setIsStickyNotesOpen] = useState(false);

  const [isMhrsExpanded, setIsMhrsExpanded] = useState(true);
  const [isFinancialExpanded, setIsFinancialExpanded] = useState(true);
  const [isDevExpanded, setIsDevExpanded] = useState(true);
  const [isEmergencyExpanded, setIsEmergencyExpanded] = useState(true);

  // Sync for presentation "Add current screen"
  const [slides, setSlides] = useState<PresentationSlide[]>([]);

  // Otomatik veri yükleme kaldırıldı - kullanıcı "Uygula" butonuna tıklayacak
  // Modül geçişlerinde filtreler ve veriler KORUNUR - sıfırlama kaldırıldı

  // Ctrl+K / Cmd+K command palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Firebase Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Session Tracking - Kullanıcı giriş yaptığında oturum kaydı oluştur
  useEffect(() => {
    if (!user || !userPermissions) return;

    let cleanup: (() => void) | null = null;

    registerSession(
      user.uid,
      user.email || '',
      userPermissions.displayName || user.email?.split('@')[0] || ''
    ).then((unregister) => {
      cleanup = unregister;
    }).catch((err) => {
      console.error('Session kayıt hatası:', err);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [user, userPermissions]);

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
        // muayeneByPeriod excluded - loaded from Storage (physician-data)
        // ameliyatByPeriod excluded - loaded from Storage (physician-data)
        // muayeneMetaByPeriod excluded - managed locally
        // ameliyatMetaByPeriod excluded - managed locally
        if (data.sutServiceData) setSutServiceData(data.sutServiceData);
        if (data.presentationSlides) setSlides(data.presentationSlides);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Cache for loaded data - only load once per hospital/year/month
  const [loadedDataCache, setLoadedDataCache] = useState<Set<string>>(new Set());

  // Function to load data for specific hospital/year/month
  const handleLoadPeriodData = async (hospital: string, year: number, month: string, silent = false) => {
    const cacheKey = `${hospital}-${year}-${month}`;

    // Check if already loaded
    if (loadedDataCache.has(cacheKey)) {
      console.log(`✅ Veriler zaten yüklü: ${cacheKey}`);
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setLoadingText(`${hospital} - ${month} ${year} verileri yükleniyor...`);
    }

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

      if (!silent) {
        showToast(`${hospital} - ${month} ${year} verileri yüklendi`, 'success');
      }
    } catch (error) {
      console.error('❌ Veri yükleme hatası:', error);
      if (!silent) {
        showToast('Veri yükleme hatası', 'error');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setLoadingText('Veriler Güncelleniyor...');
      }
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

      // Verimlilik Analizleri karşılaştırması için bir önceki ayın cetvel verisini sessizce yükle
      const minMonth = Math.min(...months);
      for (const year of years) {
        const prevMonthIdx = minMonth > 1 ? minMonth - 1 : 12;
        const prevYear = minMonth > 1 ? year : year - 1;
        const prevMonthName = MONTHS[prevMonthIdx - 1];
        await handleLoadPeriodData(hospital, prevYear, prevMonthName, true);
      }

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

                  // İLK ve SON cetvel varsa phys_compare'ı burada hesapla
                  // (ChangeAnalysis modülü açılmadan da Verimlilik popup'ında görünsün)
                  if (ilkCetvel && sonCetvel && fullVersions[ilkCetvel] && fullVersions[sonCetvel]) {
                    const base = fullVersions[ilkCetvel];
                    const upd = fullVersions[sonCetvel];
                    const allDocKeys = Array.from(new Set([
                      ...Object.keys(base.physicians || {}),
                      ...Object.keys(upd.physicians || {})
                    ]));

                    const processedDocs = allDocKeys.map(key => {
                      const bPhys = base.physicians[key];
                      const uPhys = upd.physicians[key];
                      const name = uPhys?.name || bPhys?.name || (uPhys as any)?.physicianName || (bPhys as any)?.physicianName || 'Bilinmiyor';
                      const branch = uPhys?.branch || bPhys?.branch || 'Bilinmiyor';
                      const baseline_capacity = bPhys?.totalCapacity || 0;
                      const updated_capacity = uPhys?.totalCapacity || 0;
                      const capacity_delta = updated_capacity - baseline_capacity;

                      const baseline_action_days = bPhys?.actionDays || (bPhys as any)?.sessionsByAction || {};
                      const updated_action_days = uPhys?.actionDays || (uPhys as any)?.sessionsByAction || {};
                      const all_actions = Array.from(new Set([
                        ...Object.keys(baseline_action_days),
                        ...Object.keys(updated_action_days)
                      ]));

                      const action_deltas: Record<string, number> = {};
                      let has_action_change = false;
                      all_actions.forEach(act => {
                        const bDays = baseline_action_days[act] || 0;
                        const uDays = updated_action_days[act] || 0;
                        const delta = uDays - bDays;
                        if (Math.abs(delta) >= 0.1) {
                          action_deltas[act] = delta;
                          has_action_change = true;
                        }
                      });

                      return { id: key, name, branch, baseline_capacity, updated_capacity, capacity_delta, action_deltas, has_action_change, bPhys, uPhys, baseline_action_days, updated_action_days };
                    });

                    const physCompare = processedDocs.filter(d => Math.abs(d.capacity_delta) > 0.1 || d.has_action_change);
                    setChangeAnalysisPhysCompare(physCompare);
                    console.log(`✅ phys_compare otomatik hesaplandı: ${physCompare.length} hekim değişimi bulundu`);
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
                  userName={userPermissions?.displayName || user?.email?.split('@')[0]}
                  userEmail={user?.email || ''}
                  onNavigate={(v) => setView(v as ViewType)}
                  onLogout={handleLogout}
                  isAdmin={isAdmin}
                  hasModuleAccess={hasModuleAccess}
                  detailedScheduleData={detailedScheduleData}
                  muayeneByPeriod={muayeneByPeriod}
                  ameliyatByPeriod={ameliyatByPeriod}
                  scheduleVersions={scheduleVersions}
                  selectedHospital={selectedHospital}
                  isDataLoaded={isDataLoaded}
                  theme={theme}
                  onToggleTheme={toggleTheme}
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
            case 'ai-cetvel-planlama':
              return (
                <AICetvelPlanlama
                  detailedScheduleData={filteredDetailedScheduleData}
                  allDetailedScheduleData={detailedScheduleData}
                  ameliyatByPeriod={ameliyatByPeriod}
                  ameliyatMetaByPeriod={ameliyatMetaByPeriod}
                  globalSelectedYears={globalSelectedYears}
                  setGlobalSelectedYears={setGlobalSelectedYears}
                  globalSelectedMonths={globalSelectedMonths}
                  setGlobalSelectedMonths={setGlobalSelectedMonths}
                  globalAppliedYears={globalAppliedYears}
                  globalAppliedMonths={globalAppliedMonths}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
                  onCentralDataLoad={handleCentralDataLoad}
                  onLoadPeriodData={handleLoadPeriodData}
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
                  canUpload={canUploadData('changeAnalysis')}
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

            case 'etik-kurul':
              return <EtikKurulModule />;

            case 'hekim-islem-listesi':
              return <HekimIslemListesiModule />;

            case 'ek-liste-tanimlama':
              return <EkListeTanimlama canUpload={canUploadData('ekListeTanimlama')} />;

            case 'sut-mevzuati':
              return <SutMevzuati />;

            case 'gil':
              return <GilModule canUpload={canUploadData('gil')} />;

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
            case 'admin': return <AdminPanel currentUserEmail={user?.email || ''} onNavigate={setView} />;
            case 'session-management': return <SessionManagement currentUserEmail={user?.email || ''} />;
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
            case 'goren-manuel':
              return <GorenManuelHesaplama />;
            case 'goren-ilsm':
              return (
                <GorenModule
                  moduleType="ILSM"
                  userEmail={user?.email || ''}
                  canUpload={canUploadData('gorenIlsm')}
                  isAdmin={isAdmin}
                />
              );
            case 'goren-ilcesm':
              return (
                <GorenModule
                  moduleType="ILCESM"
                  userEmail={user?.email || ''}
                  canUpload={canUploadData('gorenIlcesm')}
                  isAdmin={isAdmin}
                />
              );
            case 'goren-bh':
              return (
                <GorenModule
                  moduleType="BH"
                  userEmail={user?.email || ''}
                  canUpload={canUploadData('gorenBh')}
                  isAdmin={isAdmin}
                />
              );
            case 'goren-adsh':
              return (
                <GorenModule
                  moduleType="ADSH"
                  userEmail={user?.email || ''}
                  canUpload={canUploadData('gorenAdsh')}
                  isAdmin={isAdmin}
                />
              );
            case 'goren-ash':
              return (
                <GorenModule
                  moduleType="ASH"
                  userEmail={user?.email || ''}
                  canUpload={canUploadData('gorenAsh')}
                  isAdmin={isAdmin}
                />
              );
            case 'pdf-viewer':
              return (
                <PdfViewer
                  onBack={() => setView('welcome')}
                />
              );
            case 'comparison-wizard':
              return (
                <ComparisonWizard
                  theme={theme}
                  selectedHospital={selectedHospital}
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

  const isMhrsActive = ['detailed-schedule', 'physician-data', 'efficiency-analysis', 'change-analysis', 'ai-cetvel-planlama'].includes(view);
  const isFinancialExpandedActive = ['service-analysis'].includes(view);
  const isDevActive = ['analysis-module', 'performance-planning', 'presentation'].includes(view);
  const isEmergencyActive = ['emergency-service'].includes(view);

  const handleLogout = async () => {
    try {
      await logoutSession();
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#0f1729] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#5b9cff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-black text-lg">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onLoginSuccess={() => setAuthLoading(false)} />;
  }

  // Welcome ekranı — Şanlıurfa İlçe Haritası
  if (view === 'welcome') {
    return (
      <div className={`flex h-screen font-['Inter'] ${
        theme === 'dark'
          ? 'text-slate-200 bg-gradient-to-br from-[#0f1729] via-[#131d33] to-[#0f1729]'
          : 'text-slate-800 bg-gradient-to-br from-[#e4eaf3] via-[#dce3ef] to-[#e4eaf3]'
      }`}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={(v) => { setView(v); setIsCommandPaletteOpen(false); }}
          hasModuleAccess={hasModuleAccess}
        />
        {toast && (
          <div className={`fixed top-6 right-6 z-[500] px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 max-w-md transition-all duration-300 animate-in slide-in-from-right ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}>
            {toast.type === 'success' ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        )}
        <FloatingSidebar
          currentView={view}
          onNavigate={(v) => setView(v as ViewType)}
          userEmail={user?.email || ''}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          hasModuleAccess={hasModuleAccess}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <div className="flex-1 ml-[72px] flex flex-col overflow-hidden">
          {/* Sticky Breadcrumb Header — diğer modüllerle aynı */}
          <header
            className="shrink-0 z-[200] px-8 pt-3 pb-2 flex justify-between items-center no-print backdrop-blur-xl border-b transition-colors duration-500"
            style={{
              background: 'var(--sticky-bg)',
              borderColor: 'var(--sticky-border)'
            }}
          >
            <nav className="flex items-center gap-2 text-sm">
              <button className="text-[#5b9cff] transition-colors flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Ana Sayfa</span>
              </button>
            </nav>
            <div className="flex items-center gap-2">
              {/* Sticky Notes Button */}
              <button
                onClick={() => setIsStickyNotesOpen(prev => !prev)}
                className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                  isStickyNotesOpen
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-amber-400 hover:bg-[#131d33]/80 border border-transparent hover:border-[#2d4163]/30'
                      : 'text-slate-500 hover:text-amber-500 hover:bg-white/80 border border-transparent hover:border-slate-200/60'
                }`}
                title="Hızlı Notlar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              {/* Sağlık Bakanlığı Logo ve Yazı - Sağda */}
              <div className={`flex items-center gap-3 backdrop-blur-xl px-4 py-2 rounded-2xl border transition-colors duration-500 ${
                theme === 'dark'
                  ? 'bg-[#131d33]/80 border-[#2d4163]/30'
                  : 'bg-white/80 border-slate-200/60 shadow-sm'
              }`}>
                <img
                  src={sbLogo}
                  alt="T.C. Sağlık Bakanlığı"
                  className={`h-8 w-auto object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
                />
                <div className="text-left">
                  <p className={`text-[9px] font-bold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>T.C. SAĞLIK BAKANLIĞI</p>
                  <p className={`text-[9px] font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-500'}`}>ŞANLIURFA İL SAĞLIK MÜDÜRLÜĞÜ</p>
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 min-h-0">
            <MapDashboard
              theme={theme}
              userName={userPermissions?.displayName || user?.email?.split('@')[0]}
              userEmail={user?.email || ''}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen relative font-['Inter'] transition-colors duration-500 ${
      theme === 'dark'
        ? 'text-slate-200 bg-gradient-to-br from-[#0f1729] via-[#131d33] to-[#0f1729]'
        : 'text-slate-800 bg-gradient-to-br from-[#e4eaf3] via-[#dce3ef] to-[#e4eaf3]'
    }`}>
      {toast && (
        <div className={`fixed top-6 right-6 z-[500] px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 max-w-md transition-all duration-300 animate-in slide-in-from-right ${
          toast.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}>
          {toast.type === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-[#0f1729]/70 backdrop-blur-sm z-[250] flex items-center justify-center">
          <div className="bg-[#131d33] border border-[#2d4163]/50 p-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 min-w-[400px]">
             {/* ECG Kalp Ritmi Animasyonu */}
             <div className="relative w-full h-24 flex items-center justify-center overflow-hidden">
               <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                 <defs>
                   <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" style={{stopColor: '#5b9cff', stopOpacity: 0.8}} />
                     <stop offset="100%" style={{stopColor: '#38bdf8', stopOpacity: 0.4}} />
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
             <p className="font-bold text-slate-200 text-center text-sm">{loadingText}</p>
             {/* Progress indicator dots */}
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-[#5b9cff] animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-2 h-2 rounded-full bg-[#5b9cff] animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-2 h-2 rounded-full bg-[#5b9cff] animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .slide-in-from-right {
          animation: slideInRight 0.3s ease-out forwards;
        }

        @keyframes viewFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .view-transition {
          animation: viewFadeIn 0.25s ease-out forwards;
        }
      `}</style>

      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#131d33] border border-[#2d4163]/50 w-full max-w-md rounded-[32px] shadow-2xl p-8">
            <h2 className="text-xl font-black mb-4 text-white">Yeni Branş Ekle</h2>
            <input autoFocus className="w-full border border-[#2d4163] bg-[#0f1729] text-white p-4 rounded-2xl mb-4 outline-none focus:ring-2 ring-[#5b9cff] font-bold placeholder-[#556a85]" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Branş adı..." />
            <div className="flex gap-2">
               <button onClick={() => setIsBranchModalOpen(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-white transition-colors">İptal</button>
               <button onClick={() => { if (newBranchName) { setDepartments(prev => [...prev, newBranchName].sort()); setBranchFilters(prev => ({ ...prev, [view]: newBranchName })); setNewBranchName(''); setIsBranchModalOpen(false); } }} className="flex-1 bg-[#5b9cff] text-white p-4 rounded-2xl font-black hover:bg-[#4388f5] transition-colors">Ekle</button>
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
        dataStatus={{
          'detailed-schedule': detailedScheduleData.length > 0,
          'physician-data': Object.keys(muayeneByPeriod).length > 0,
          'change-analysis': Object.keys(scheduleVersions).length > 0,
          'efficiency-analysis': detailedScheduleData.length > 0 && Object.keys(muayeneByPeriod).length > 0,
          'active-demand': false,
          'emergency-service': false,
          'service-analysis': sutServiceData.length > 0,
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(v) => { setView(v); setIsCommandPaletteOpen(false); }}
        hasModuleAccess={hasModuleAccess}
      />

      {/* Sticky Notes */}
      <StickyNotes
        isOpen={isStickyNotesOpen}
        onClose={() => setIsStickyNotesOpen(false)}
        userEmail={user?.email || ''}
      />

      {/* Main Content - Sidebar için padding-left eklendi */}
      <main className="flex-1 min-w-0 overflow-y-auto w-full custom-scrollbar ml-[88px]">
        {/* Sticky Breadcrumb Header */}
        <header
          className="sticky top-0 z-[200] px-8 pt-3 pb-2 flex justify-between items-center no-print backdrop-blur-xl border-b transition-colors duration-500"
          style={{
            background: 'var(--sticky-bg)',
            borderColor: 'var(--sticky-border)'
          }}
        >
            {/* Breadcrumb Navigasyon */}
            {(() => {
              const viewMeta: Record<string, { group?: string; label: string; groupView?: string }> = {
                'welcome': { label: 'Ana Sayfa' },
                'dashboard': { label: 'Kontrol Paneli' },
                'dashboard-mhrs': { label: 'MHRS', group: 'Kontrol Paneli', groupView: 'dashboard' },
                'dashboard-financial': { label: 'Finansal', group: 'Kontrol Paneli', groupView: 'dashboard' },
                'dashboard-preparation': { label: 'Hazırlama', group: 'Kontrol Paneli', groupView: 'dashboard' },
                'dashboard-support': { label: 'Destek', group: 'Kontrol Paneli', groupView: 'dashboard' },
                'dashboard-emergency': { label: 'Acil Servis', group: 'Kontrol Paneli', groupView: 'dashboard' },
                'emergency-service': { label: 'Yeşil Alan Oranları', group: 'Acil Servis' },
                'active-demand': { label: 'Aktif Talep', group: 'MHRS' },
                'detailed-schedule': { label: 'Detaylı Cetveller', group: 'MHRS' },
                'physician-data': { label: 'Hekim Verileri', group: 'MHRS' },
                'change-analysis': { label: 'Değişim Analizleri', group: 'MHRS' },
                'efficiency-analysis': { label: 'Verimlilik Analizleri', group: 'MHRS' },
                'ai-cetvel-planlama': { label: 'AI Cetvel Planlama', group: 'MHRS' },
                'goren-ilsm': { label: 'İl Sağlık Müdürlüğü', group: 'GÖREN Performans' },
                'goren-ilcesm': { label: 'İlçe Sağlık Müdürlüğü', group: 'GÖREN Performans' },
                'goren-bh': { label: 'Başhekimlik', group: 'GÖREN Performans' },
                'goren-adsh': { label: 'ADSH', group: 'GÖREN Performans' },
                'goren-ash': { label: 'Acil Sağlık', group: 'GÖREN Performans' },
                'goren-manuel': { label: 'Manuel Hesaplama', group: 'GÖREN Performans' },
                'service-analysis': { label: 'Hizmet Girişim', group: 'Finansal' },
                'etik-kurul': { label: 'Etik Kurul', group: 'Finansal' },
                'hekim-islem-listesi': { label: 'Hekim İşlem Listesi', group: 'Finansal' },
                'ek-liste-tanimlama': { label: 'Ek Liste Tanımlama', group: 'Finansal' },
                'sut-mevzuati': { label: 'SUT Mevzuatı', group: 'Finansal' },
                'gil': { label: 'GİL', group: 'Finansal' },
                'analysis-module': { label: 'Analiz Modülü', group: 'Hazırlama' },
                'schedule-planning': { label: 'Cetvel Planlama', group: 'Hazırlama' },
                'presentation': { label: 'Sunum / Rapor', group: 'Hazırlama' },
                'ai-chatbot': { label: 'AI Asistan' },
                'goren': { label: 'GÖREN Başarı' },
                'pdf-viewer': { label: 'PDF Görüntüleyici' },
                'comparison-wizard': { label: 'Veri Karşılaştırma' },
                'admin': { label: 'Kullanıcı Yönetimi' },
                'performance-planning': { label: 'Performans Planlama' },
              };
              const meta = viewMeta[view] || { label: view };
              return (
                <nav className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setView('welcome')}
                    className="text-slate-500 hover:text-[#5b9cff] transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Ana Sayfa</span>
                  </button>
                  {meta.group && (
                    <>
                      <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-slate-400 font-medium">{meta.group}</span>
                    </>
                  )}
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-[#5b9cff] font-semibold">{meta.label}</span>
                </nav>
              );
            })()}
            <div className="flex items-center gap-2">
              {/* Sticky Notes Button */}
              <button
                onClick={() => setIsStickyNotesOpen(prev => !prev)}
                className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                  isStickyNotesOpen
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-amber-400 hover:bg-[#131d33]/80 border border-transparent hover:border-[#2d4163]/30'
                      : 'text-slate-500 hover:text-amber-500 hover:bg-white/80 border border-transparent hover:border-slate-200/60'
                }`}
                title="Hızlı Notlar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            {/* Sağlık Bakanlığı Logo ve Yazı - Sağda */}
            <div className={`flex items-center gap-3 backdrop-blur-xl px-4 py-2 rounded-2xl border transition-colors duration-500 ${
              theme === 'dark'
                ? 'bg-[#131d33]/80 border-[#2d4163]/30'
                : 'bg-white/80 border-slate-200/60 shadow-sm'
            }`}>
              <img
                src={sbLogo}
                alt="T.C. Sağlık Bakanlığı"
                className={`h-8 w-auto object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
              />
              <div className="text-left">
                <p className={`text-[9px] font-bold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>T.C. SAĞLIK BAKANLIĞI</p>
                <p className={`text-[9px] font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-500'}`}>ŞANLIURFA İL SAĞLIK MÜDÜRLÜĞÜ</p>
              </div>
            </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="w-full px-8 pb-6 pt-2">
          <section key={view} className="view-transition">{renderView()}</section>
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
