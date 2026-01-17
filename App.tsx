
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

import PlanningModule from './components/PlanningModule';
import ChatBot from './components/ChatBot';
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
  const { userPermissions, loading: permissionsLoading, hasModuleAccess, isAdmin } = useUserPermissions(user?.email || null);

  const [view, setView] = useState<ViewType>('dashboard');
  const [dashboardCategory, setDashboardCategory] = useState<'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency' | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string>(''); // Boş başlangıç - kullanıcı seçecek

  // Debug: selectedHospital değişimini logla
  useEffect(() => {
    console.log('🏥 selectedHospital değişti:', selectedHospital);
  }, [selectedHospital]);

  // Her modül için ayrı filtreleme state'i
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

  // Her modül için ayrı ay/yıl seçimleri
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const [monthFilters, setMonthFilters] = useState<Record<ViewType, string>>({
    'detailed-schedule': currentMonth,
    'physician-data': '', // Boş başlangıç - kullanıcı seçecek
    'efficiency-analysis': currentMonth,
    'change-analysis': '', // Boş başlangıç - kullanıcı seçecek
    'performance-planning': currentMonth,
    'data-entry': currentMonth,
    'ai-chatbot': currentMonth,
    'service-analysis': currentMonth,
    'goren': currentMonth,
    'analysis-module': currentMonth,
    'presentation': currentMonth,
    'schedule': currentMonth,
    'admin': currentMonth,
    'emergency-service': currentMonth
  });

  const [yearFilters, setYearFilters] = useState<Record<ViewType, number>>({
    'detailed-schedule': currentYear,
    'physician-data': 0, // Boş başlangıç - kullanıcı seçecek
    'efficiency-analysis': currentYear,
    'change-analysis': 0, // Boş başlangıç - kullanıcı seçecek
    'performance-planning': currentYear,
    'data-entry': currentYear,
    'ai-chatbot': currentYear,
    'service-analysis': currentYear,
    'goren': currentYear,
    'analysis-module': currentYear,
    'presentation': currentYear,
    'schedule': currentYear,
    'admin': currentYear,
    'emergency-service': currentYear
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

  const [planningProposals, setPlanningProposals] = useState<ScheduleProposal[]>([]);
  const [planningSourceMonth, setPlanningSourceMonth] = useState<string>('Kasım');
  const [planningSourceYear, setPlanningSourceYear] = useState<number>(2025);
  const [planningTargetMonth, setPlanningTargetMonth] = useState<string>('Aralık');
  const [planningTargetYear, setPlanningTargetYear] = useState<number>(2025);
  const [planningTargetWorkDays, setPlanningTargetWorkDays] = useState<number>(20);

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

  // Physician-data modülüne her geçişte filtreleri sıfırla
  useEffect(() => {
    if (view === 'physician-data' && !permissionsLoading) {
      // İlk açılışta veya modüle geçişte filtreleri sıfırla
      console.log('🔄 Physician-data modülü açıldı, filtreler sıfırlanıyor...');
      console.log('📊 Mevcut selectedHospital:', selectedHospital);

      // setTimeout ile tüm re-render'lar bittikten sonra sıfırla
      setTimeout(() => {
        setSelectedHospital('');
        setMonthFilters(prev => ({ ...prev, 'physician-data': '' }));
        setYearFilters(prev => ({ ...prev, 'physician-data': 0 }));
        console.log('✅ Filtreler sıfırlandı');
      }, 0);
    }
  }, [view, permissionsLoading]);

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

  useEffect(() => {
    // Hastane değiştiğinde tüm filtreleri varsayılana döndür
    const defaultMonth = MONTHS[new Date().getMonth()];
    const defaultYear = new Date().getFullYear();

    setBranchFilters({
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
      'admin': null,
      'schedule': null
    });

    // Ay ve yıl filtrelerini de sıfırla
    setMonthFilters({
      'detailed-schedule': defaultMonth,
      'physician-data': '', // Boş başlangıç
      'efficiency-analysis': defaultMonth,
      'change-analysis': '', // Boş başlangıç
      'performance-planning': defaultMonth,
      'data-entry': defaultMonth,
      'ai-chatbot': defaultMonth,
      'service-analysis': defaultMonth,
      'goren': defaultMonth,
      'analysis-module': defaultMonth,
      'presentation': defaultMonth,
      'schedule': defaultMonth,
      'admin': defaultMonth
    });

    setYearFilters({
      'detailed-schedule': defaultYear,
      'physician-data': 0, // Boş başlangıç
      'efficiency-analysis': defaultYear,
      'change-analysis': 0, // Boş başlangıç
      'performance-planning': defaultYear,
      'data-entry': defaultYear,
      'ai-chatbot': defaultYear,
      'service-analysis': defaultYear,
      'goren': defaultYear,
      'analysis-module': defaultYear,
      'presentation': defaultYear,
      'schedule': defaultYear,
      'admin': defaultYear
    });

    const newDeptList = HOSPITAL_DEPARTMENTS[selectedHospital] || DEPARTMENTS;
    setDepartments(newDeptList);
    setAppointmentData(MOCK_DATA.filter(d => d.hospital === selectedHospital));
    setHbysData([]);
    setPlanningProposals([]);
    setSutRiskAnalysis(null);
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
                  selectedMonth={selectedMonth}
                  setSelectedMonth={(m) => setMonthFilters(prev => ({ ...prev, [view]: m }))}
                  selectedYear={selectedYear}
                  setSelectedYear={(y) => setYearFilters(prev => ({ ...prev, [view]: y }))}
                  selectedHospital={selectedHospital}
                  allowedHospitals={allowedHospitals}
                  onHospitalChange={setSelectedHospital}
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
                />
              );

            /* Correcting property names to match state setters in PlanningModule */
            case 'performance-planning':
              return (
                <>
                  <FilterPanel
                    selectedHospital={selectedHospital}
                    onHospitalChange={setSelectedHospital}
                    allowedHospitals={allowedHospitals}
                    selectedBranch={selectedBranch}
                    onBranchChange={(branch) => setBranchFilters(prev => ({ ...prev, [view]: branch }))}
                    branchOptions={currentBranchOptions}
                    showHospitalFilter={true}
                    showBranchFilter={true}
                  />
                  <PlanningModule selectedBranch={selectedBranch} appointmentData={appointmentData} hbysData={hbysData} detailedScheduleData={filteredDetailedScheduleData} proposals={planningProposals} setProposals={setPlanningProposals} sourceMonth={planningSourceMonth} setSourceMonth={setPlanningSourceMonth} sourceYear={planningSourceYear} setSourceYear={setPlanningSourceYear} targetMonth={planningTargetMonth} setTargetMonth={setPlanningTargetMonth} targetYear={planningTargetYear} setTargetYear={setPlanningTargetYear} targetWorkDays={planningTargetWorkDays} setTargetWorkDays={setPlanningTargetWorkDays} />
                </>
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
                <>
                  <FilterPanel
                    selectedHospital={selectedHospital}
                    onHospitalChange={setSelectedHospital}
                    allowedHospitals={allowedHospitals}
                    showHospitalFilter={true}
                  />
                  <ChatBot appointmentData={appointmentData} hbysData={hbysData} />
                </>
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
                  <AnalysisModule appointmentData={appointmentData} hbysData={hbysData} planningProposals={planningProposals} pastChangesInitialData={null} pastChangesFinalData={null} onClearPastChanges={() => {}} selectedHospital={selectedHospital} />
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

  return (
    <div className="flex min-h-screen text-slate-900 bg-slate-50 relative font-['Inter']">
      {toast && (
        <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250] flex items-center justify-center">
          <div className="bg-white p-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 min-w-[400px]">
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
             <p className="font-black text-slate-700 text-center">{loadingText}</p>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8">
            <h2 className="text-xl font-black mb-4">Yeni Branş Ekle</h2>
            <input autoFocus className="w-full border p-4 rounded-2xl mb-4 outline-none focus:ring-2 ring-blue-500 font-bold" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Branş adı..." />
            <div className="flex gap-2">
               <button onClick={() => setIsBranchModalOpen(false)} className="flex-1 p-4 font-bold text-slate-500">İptal</button>
               <button onClick={() => { if (newBranchName) { setDepartments(prev => [...prev, newBranchName].sort()); setBranchFilters(prev => ({ ...prev, [view]: newBranchName })); setNewBranchName(''); setIsBranchModalOpen(false); } }} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black">Ekle</button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-56 h-screen sticky top-0 bg-[#f9f7f4] text-slate-900 flex flex-col shrink-0 no-print overflow-hidden">
        <div className="flex flex-col h-full px-6 py-8 overflow-hidden">
          <div className="flex items-center mb-12">
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setView('dashboard')}>
              <img
                src={medisLogo}
                alt="MEDİS Logo"
                className="w-12 h-12 rounded-xl"
              />
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-slate-900">MEDİS</span>
                <span className="text-[9px] font-semibold text-slate-500 leading-tight -mt-0.5">Merkezi Dijital<br/>Sağlık Sistemi</span>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 custom-scrollbar overflow-y-auto overflow-x-hidden">
            <div className="space-y-1">
              <button onClick={() => setIsMhrsExpanded(!isMhrsExpanded)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all hover:bg-white/60 group">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isMhrsActive ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <svg className={`w-3 h-3 ${isMhrsActive ? 'text-white' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                </div>
                <span className={`text-sm font-medium flex-1 ${isMhrsActive ? 'text-slate-900' : 'text-slate-600'}`}>MHRS</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isMhrsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-0.5 ${isMhrsExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}><div className="space-y-0.5 pl-10">
                  {hasModuleAccess('detailedSchedule') && <SubNavItem label="Detaylı Cetveller" active={view === 'detailed-schedule'} onClick={() => setView('detailed-schedule')} color="emerald" />}
                  {hasModuleAccess('physicianData') && <SubNavItem label="Hekim Verileri" active={view === 'physician-data'} onClick={() => setView('physician-data')} color="blue" />}
                  {hasModuleAccess('changeAnalysis') && <SubNavItem label="Değişim Analizleri" active={view === 'change-analysis'} onClick={() => setView('change-analysis')} color="blue" />}
                  {hasModuleAccess('efficiencyAnalysis') && <SubNavItem label="Verimlilik Analizleri" active={view === 'efficiency-analysis'} onClick={() => setView('efficiency-analysis')} color="indigo" />}
              </div></div>
            </div>
            <div className="space-y-1 pt-2">
              <button onClick={() => setIsFinancialExpanded(!isFinancialExpanded)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all hover:bg-white/60 group">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isFinancialExpandedActive ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <span className={`text-xs font-bold ${isFinancialExpandedActive ? 'text-white' : 'text-slate-500'}`}>₺</span>
                </div>
                <span className={`text-sm font-medium flex-1 ${isFinancialExpandedActive ? 'text-slate-900' : 'text-slate-600'}`}>Finansal</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isFinancialExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-0.5 ${isFinancialExpanded ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}><div className="space-y-0.5 pl-10">{hasModuleAccess('serviceAnalysis') && <SubNavItem label="Hizmet Girişim" active={view === 'service-analysis'} onClick={() => setView('service-analysis')} color="rose" />}</div></div>
            </div>
            <div className="space-y-1 pt-2">
              <button onClick={() => setIsEmergencyExpanded(!isEmergencyExpanded)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all hover:bg-white/60 group">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isEmergencyActive ? 'bg-red-600' : 'bg-slate-200'}`}>
                  <svg className={`w-3 h-3 ${isEmergencyActive ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <span className={`text-sm font-medium flex-1 ${isEmergencyActive ? 'text-slate-900' : 'text-slate-600'}`}>Acil Servis</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isEmergencyExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-0.5 ${isEmergencyExpanded ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}><div className="space-y-0.5 pl-10">{hasModuleAccess('emergencyService') && <SubNavItem label="Yeşil Alan Oranları" active={view === 'emergency-service'} onClick={() => setView('emergency-service')} color="red" />}</div></div>
            </div>
            <div className="space-y-1 pt-2">
              <button onClick={() => setIsDevExpanded(!isDevExpanded)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all hover:bg-white/60 group">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isDevActive ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <svg className={`w-3 h-3 ${isDevActive ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/></svg>
                </div>
                <span className={`text-sm font-medium flex-1 ${isDevActive ? 'text-slate-900' : 'text-slate-600'}`}>Hazırlama</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDevExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-0.5 ${isDevExpanded ? 'max-h-[450px] opacity-100' : 'max-h-0 opacity-0'}`}><div className="space-y-0.5 pl-10">
                  {hasModuleAccess('analysisModule') && <SubNavItem label="Analiz Modülü" active={view === 'analysis-module'} onClick={() => setView('analysis-module')} color="indigo" />}
                  {hasModuleAccess('performancePlanning') && <SubNavItem label="AI Planlama" active={view === 'performance-planning'} onClick={() => setView('performance-planning')} color="blue" />}
                  {hasModuleAccess('presentation') && <SubNavItem label="Sunum" active={view === 'presentation'} onClick={() => setView('presentation')} color="slate" />}
              </div></div>
            </div>
            <div className="pt-4 space-y-0.5 border-t border-slate-200 mt-4">
              <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Destek</div>
              {hasModuleAccess('aiChatbot') && <NavItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>} label="AI Sohbet" active={view === 'ai-chatbot'} onClick={() => setView('ai-chatbot')} color="indigo" />}
              {hasModuleAccess('gorenBashekimlik') && <NavItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>} label="GÖREN Başarı" active={view === 'goren'} onClick={() => setView('goren')} color="amber" />}
              {isAdmin && (
                <NavItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>} label="Kullanıcı Yönetimi" active={view === 'admin'} onClick={() => setView('admin')} color="rose" />
              )}
            </div>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200">
            <div className="px-3 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-semibold text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-xs font-medium text-slate-700 truncate flex-1">{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto w-full custom-scrollbar">
        <div className="w-full px-10 py-10">
          <header className="mb-6 flex flex-col gap-4 no-print">
            {/* Title Row with Dashboard Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {view !== 'dashboard' && !view.startsWith('dashboard-') && (
                  <button
                    onClick={() => setView('dashboard')}
                    className="p-3 bg-white hover:bg-slate-100 rounded-2xl transition-all flex items-center justify-center shadow-md border border-slate-200"
                    title="Dashboard'a Dön"
                  >
                    <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </button>
                )}
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">
                    {view === 'dashboard' ? 'Dashboard' : view === 'physician-data' ? 'Hekim Verileri' : view === 'efficiency-analysis' ? 'Verimlilik Analizleri' : view === 'detailed-schedule' ? 'Detaylı Takip' : view === 'change-analysis' ? 'Değişim Analizleri' : view === 'analysis-module' ? 'Analiz Modülü' : view === 'performance-planning' ? 'AI Planlama' : view === 'presentation' ? 'Sunum' : view === 'admin' ? 'Kullanıcı Yönetimi' : view === 'service-analysis' ? 'Hizmet Girişim' : view === 'ai-chatbot' ? 'AI Sohbet' : view === 'goren' ? 'GÖREN Başarı' : 'Modül Analiz'}
                  </h1>
                  <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">{selectedHospital} • {selectedBranch || 'TÜM BRANŞLAR'}</p>
                </div>
              </div>

              {/* Sağ Taraf - Sağlık Bakanlığı Logosu ve Sunuma Ekle Butonu */}
              <div className="flex items-center gap-6">
                {view !== 'presentation' && view !== 'admin' && view !== 'dashboard' && !view.startsWith('dashboard-') && (
                  <button
                    onClick={addCurrentToPresentation}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                    SUNUMA EKLE
                  </button>
                )}

                {/* Sağlık Bakanlığı Logo ve Yazı */}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <img
                    src={sbLogo}
                    alt="T.C. Sağlık Bakanlığı"
                    className="h-12 w-auto object-contain"
                  />
                  <div className="text-left">
                    <p className="text-xs font-bold text-red-600 tracking-wide">T.C. SAĞLIK BAKANLIĞI</p>
                    <p className="text-xs font-semibold text-slate-700">ŞANLIURFA İL SAĞLIK MÜDÜRLÜĞÜ</p>
                  </div>
                </div>
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
