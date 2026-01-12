
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
import { useUserPermissions } from './src/hooks/useUserPermissions';
import { ADMIN_EMAIL } from './src/types/user';

const App: React.FC = () => {
  // Firebase Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User Permissions
  const { userPermissions, loading: permissionsLoading, hasModuleAccess, isAdmin } = useUserPermissions(user?.email || null);

  const [view, setView] = useState<ViewType>('dashboard');
  const [dashboardCategory, setDashboardCategory] = useState<'mhrs' | 'financial' | 'preparation' | 'support' | null>(null);
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
    'admin': null
  });

  // Her modül için ayrı ay/yıl seçimleri
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const [monthFilters, setMonthFilters] = useState<Record<ViewType, string>>({
    'detailed-schedule': currentMonth,
    'physician-data': '', // Boş başlangıç - kullanıcı seçecek
    'efficiency-analysis': currentMonth,
    'change-analysis': currentMonth,
    'performance-planning': currentMonth,
    'data-entry': currentMonth,
    'ai-chatbot': currentMonth,
    'service-analysis': currentMonth,
    'goren': currentMonth,
    'analysis-module': currentMonth,
    'presentation': currentMonth,
    'schedule': currentMonth,
    'admin': currentMonth
  });

  const [yearFilters, setYearFilters] = useState<Record<ViewType, number>>({
    'detailed-schedule': currentYear,
    'physician-data': 0, // Boş başlangıç - kullanıcı seçecek
    'efficiency-analysis': currentYear,
    'change-analysis': currentYear,
    'performance-planning': currentYear,
    'data-entry': currentYear,
    'ai-chatbot': currentYear,
    'service-analysis': currentYear,
    'goren': currentYear,
    'analysis-module': currentYear,
    'presentation': currentYear,
    'schedule': currentYear,
    'admin': currentYear
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
    'admin': ''
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
    'admin': ''
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
  const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [detailedScheduleData, setDetailedScheduleData] = useState<DetailedScheduleData[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // Track if Firebase data is loaded
  const [sutServiceData, setSutServiceData] = useState<SUTServiceData[]>(() =>
    loadFromLocalStorage('sutServiceData', [])
  );

  const [muayeneByPeriod, setMuayeneByPeriod] = useState<Record<string, Record<string, MuayeneMetrics>>>(() =>
    loadFromLocalStorage('muayeneByPeriod', {})
  );
  const [ameliyatByPeriod, setAmeliyatByPeriod] = useState<Record<string, Record<string, number>>>(() =>
    loadFromLocalStorage('ameliyatByPeriod', {})
  );
  const [muayeneMetaByPeriod, setMuayeneMetaByPeriod] = useState<Record<string, { fileName: string; uploadedAt: number }>>(() =>
    loadFromLocalStorage('muayeneMetaByPeriod', {})
  );
  const [ameliyatMetaByPeriod, setAmeliyatMetaByPeriod] = useState<Record<string, { fileName: string; uploadedAt: number }>>(() =>
    loadFromLocalStorage('ameliyatMetaByPeriod', {})
  );

  const [scheduleVersions, setScheduleVersions] = useState<Record<string, Record<string, ScheduleVersion>>>(() =>
    loadFromLocalStorage('scheduleVersions', {})
  );
  
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

  // Sync for presentation "Add current screen"
  const [slides, setSlides] = useState<PresentationSlide[]>(() =>
    loadFromLocalStorage('presentationSlides', [])
  );

  // Otomatik veri yükleme kaldırıldı - kullanıcı "Uygula" butonuna tıklayacak

  // Physician-data modülüne her geçişte filtreleri sıfırla
  useEffect(() => {
    if (view === 'physician-data' && !permissionsLoading) {
      // İlk açılışta veya modüle geçişte filtreleri sıfırla
      console.log('🔄 Physician-data modülü açıldı, filtreler sıfırlanıyor...');
      console.log('📊 Mevcut selectedHospital:', selectedHospital);
      setSelectedHospital('');
      setMonthFilters(prev => ({ ...prev, 'physician-data': '' }));
      setYearFilters(prev => ({ ...prev, 'physician-data': 0 }));
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
        if (data.muayeneByPeriod) setMuayeneByPeriod(data.muayeneByPeriod);
        if (data.ameliyatByPeriod) setAmeliyatByPeriod(data.ameliyatByPeriod);
        if (data.muayeneMetaByPeriod) setMuayeneMetaByPeriod(data.muayeneMetaByPeriod);
        if (data.ameliyatMetaByPeriod) setAmeliyatMetaByPeriod(data.ameliyatMetaByPeriod);
        if (data.scheduleVersions) setScheduleVersions(data.scheduleVersions);
        if (data.sutServiceData) setSutServiceData(data.sutServiceData);
        if (data.presentationSlides) setSlides(data.presentationSlides);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Save data to Firestore whenever it changes (debounced)
  // detailedScheduleData excluded - stored in Firebase Storage
  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(async () => {
      try {
        const dataToSave = {
          // detailedScheduleData excluded - stored in Storage
          muayeneByPeriod,
          ameliyatByPeriod,
          muayeneMetaByPeriod,
          ameliyatMetaByPeriod,
          scheduleVersions,
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
  }, [user, muayeneByPeriod, ameliyatByPeriod, muayeneMetaByPeriod, ameliyatMetaByPeriod, scheduleVersions, sutServiceData, slides]);

  // IndexedDB removed - data now stored in Firestore for all users

  useEffect(() => {
    localStorage.setItem('muayeneByPeriod', JSON.stringify(muayeneByPeriod));
  }, [muayeneByPeriod]);

  useEffect(() => {
    localStorage.setItem('ameliyatByPeriod', JSON.stringify(ameliyatByPeriod));
  }, [ameliyatByPeriod]);

  useEffect(() => {
    localStorage.setItem('muayeneMetaByPeriod', JSON.stringify(muayeneMetaByPeriod));
  }, [muayeneMetaByPeriod]);

  useEffect(() => {
    localStorage.setItem('ameliyatMetaByPeriod', JSON.stringify(ameliyatMetaByPeriod));
  }, [ameliyatMetaByPeriod]);

  useEffect(() => {
    localStorage.setItem('scheduleVersions', JSON.stringify(scheduleVersions));
  }, [scheduleVersions]);

  useEffect(() => {
    localStorage.setItem('sutServiceData', JSON.stringify(sutServiceData));
  }, [sutServiceData]);

  useEffect(() => {
    localStorage.setItem('presentationSlides', JSON.stringify(slides));
  }, [slides]);

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
      'physician-data': defaultMonth,
      'efficiency-analysis': defaultMonth,
      'change-analysis': defaultMonth,
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
      'physician-data': defaultYear,
      'efficiency-analysis': defaultYear,
      'change-analysis': defaultYear,
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
                  onApplyFilters={async (hospital, year, month) => {
                    // Önce Detaylı Cetveller modülü için veri yükle
                    await handleLoadDetailedScheduleData(hospital, month, year);
                    // Veri yüklendikten sonra filtreleri senkronize et
                    setSelectedHospital(hospital);
                    setMonthFilters(prev => ({ ...prev, 'detailed-schedule': month }));
                    setYearFilters(prev => ({ ...prev, 'detailed-schedule': year }));
                  }}
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
    <div className="flex min-h-screen text-slate-900 bg-[#F8FAFC] relative font-['Inter']">
      {toast && (
        <div className={`fixed top-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-10 duration-300 font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250] flex items-center justify-center">
          <div className="bg-white p-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="font-black">{loadingText}</p>
          </div>
        </div>
      )}

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

      <aside className="w-72 h-screen sticky top-0 bg-slate-950 text-white flex flex-col border-r border-white/5 shadow-2xl shrink-0 no-print overflow-hidden">
        <div className="flex flex-col h-full px-5 py-5 overflow-hidden">
          <div className="flex items-center mb-10">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('detailed-schedule')}>
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform shrink-0">M</div>
              <span className="text-lg font-black tracking-tight transition-opacity duration-300 whitespace-nowrap">MHRS Analiz</span>
            </div>
          </div>
          <nav className="flex-1 space-y-4 custom-scrollbar overflow-y-auto overflow-x-hidden pr-2">
            <div className="space-y-1">
              <button onClick={() => setIsMhrsExpanded(!isMhrsExpanded)} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors hover:bg-white/5">
                <div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${isMhrsActive ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500'}`}><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg></div><span className="text-sm font-black tracking-tight uppercase">MHRS</span></div>
                <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isMhrsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-1 ${isMhrsExpanded ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}><div className="ml-7 pl-4 border-l border-white/10 space-y-1">
                  {hasModuleAccess('detailedSchedule') && <SubNavItem label="Detaylı Cetveller" active={view === 'detailed-schedule'} onClick={() => setView('detailed-schedule')} color="emerald" />}
                  {hasModuleAccess('physicianData') && <SubNavItem label="Hekim Verileri" active={view === 'physician-data'} onClick={() => setView('physician-data')} color="blue" />}
                  {hasModuleAccess('changeAnalysis') && <SubNavItem label="Değişim Analizleri" active={view === 'change-analysis'} onClick={() => setView('change-analysis')} color="blue" />}
                  {hasModuleAccess('efficiencyAnalysis') && <SubNavItem label="Verimlilik Analizleri" active={view === 'efficiency-analysis'} onClick={() => setView('efficiency-analysis')} color="indigo" />}
              </div></div>
            </div>
            <div className="space-y-1">
              <button onClick={() => setIsFinancialExpanded(!isFinancialExpanded)} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors hover:bg-white/5">
                <div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black shrink-0 ${isFinancialExpandedActive ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-white/5 text-slate-500'}`}><span className="text-xl font-bold">₺</span></div><span className="text-sm font-black tracking-tight uppercase">FİNANSAL ANALİZ</span></div>
                <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isFinancialExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-1 ${isFinancialExpanded ? 'max-h-[200px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}><div className="ml-7 pl-4 border-l border-white/10 space-y-1">{hasModuleAccess('serviceAnalysis') && <SubNavItem label="Hizmet Girişim" active={view === 'service-analysis'} onClick={() => setView('service-analysis')} color="rose" />}</div></div>
            </div>
            <div className="space-y-1 pt-2">
              <button onClick={() => setIsDevExpanded(!isDevExpanded)} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors hover:bg-white/5">
                <div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black shrink-0 ${isDevActive ? 'bg-slate-100 text-slate-900 shadow-lg' : 'bg-white/5 text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/></svg></div><span className="text-[11px] font-black tracking-tighter uppercase">Hazırlama Aşaması</span></div>
                <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isDevExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-1 ${isDevExpanded ? 'max-h-[450px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}><div className="ml-7 pl-4 border-l border-white/10 space-y-1">
                  {hasModuleAccess('analysisModule') && <SubNavItem label="Analiz Modülü" active={view === 'analysis-module'} onClick={() => setView('analysis-module')} color="indigo" />}
                  {hasModuleAccess('performancePlanning') && <SubNavItem label="AI Planlama" active={view === 'performance-planning'} onClick={() => setView('performance-planning')} color="blue" />}
                  {hasModuleAccess('presentation') && <SubNavItem label="SUNUM" active={view === 'presentation'} onClick={() => setView('presentation')} color="slate" />}
              </div></div>
            </div>
            <div className="pt-4 space-y-1">
              <div className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">DESTEK SİSTEMLERİ</div>
              {hasModuleAccess('aiChatbot') && <NavItem icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>} label="AI Sohbet" active={view === 'ai-chatbot'} onClick={() => setView('ai-chatbot')} color="indigo" />}
              {hasModuleAccess('gorenBashekimlik') && <NavItem icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>} label="GÖREN Başarı" active={view === 'goren'} onClick={() => setView('goren')} color="amber" />}
              {isAdmin && (
                <NavItem icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>} label="Kullanıcı Yönetimi" active={view === 'admin'} onClick={() => setView('admin')} color="rose" />
              )}
            </div>
          </nav>
          <div className="mt-auto pt-6">
            <div className="bg-white/5 rounded-2xl p-4 border-t border-white/5">
              <span className="text-[10px] font-black text-slate-500 uppercase block mb-2">Aktif Kullanıcı</span>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-black text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-bold text-white truncate flex-1">{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all flex items-center justify-center"
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
              {view !== 'presentation' && view !== 'admin' && view !== 'dashboard' && !view.startsWith('dashboard-') && (
                <button
                  onClick={addCurrentToPresentation}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                  SUNUMA EKLE
                </button>
              )}
            </div>
          </header>
          <section className="animate-in fade-in slide-in-from-top-4 duration-500">{renderView()}</section>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, color }: any) => {
  const colorMap: any = { blue: 'bg-blue-600', emerald: 'bg-emerald-600', rose: 'bg-rose-600', indigo: 'bg-indigo-600', amber: 'bg-amber-600', slate: 'bg-slate-500' };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group shrink-0 ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all shrink-0 ${active ? colorMap[color] + ' shadow-lg' : 'bg-white/5 group-hover:bg-white/10'}`}>{icon}</div>
      <span className="text-sm font-bold transition-opacity duration-300 whitespace-nowrap opacity-100">{label}</span>
    </button>
  );
};

const SubNavItem = ({ label, active, onClick, color }: any) => {
  const dotColor: any = { emerald: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]', indigo: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]', blue: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]', rose: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]', amber: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]', slate: 'bg-slate-300 shadow-[0_0_8px_rgba(255,255,255,0.3)]' };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap ${active ? 'bg-white/5 text-white font-black' : 'text-slate-500 hover:text-slate-300 font-bold'}`}>
      <div className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${active ? dotColor[color] : 'bg-slate-700'}`}></div>
      <span className="transition-opacity duration-300 opacity-100">{label}</span>
    </button>
  );
};

export default App;
