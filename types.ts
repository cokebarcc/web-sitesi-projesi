
export interface PerformanceData {
  id: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  month: string;
  year: number;
  polyclinic: {
    days: number;
    totalExams: number;
    mhrsCapacity: number;
    noShowRate: number;
  };
  surgery: {
    days: number;
    totalSurgeries: number;
    groupABC: string;
  };
  ward: {
    days: number;
    bedOccupancy: number;
  };
  otherDays: number;
  allActions: { type: string; days: number }[];
  constraints: string;
}

export interface HBYSData {
  id: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  month: string;
  year: number;
  totalExams: number;
  surgeryABC: number;
  surgeryTime: number;
}

export interface SUTServiceData {
  sutCode: string;
  procedureName: string;
  hospitalValues: { [hospitalName: string]: number };
}

export interface DetailedScheduleData {
  id: string;
  specialty: string;
  doctorName: string;
  hospital: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  action: string;
  slotCount: number;
  duration: number;
  capacity: number;
  month: string;
  year: number;
}

export interface MuayeneMetrics {
  mhrs: number;
  ayaktan: number;
  toplam: number;
}

// Comparison Module Types
export interface SessionActionStats {
  action: string;
  mins: number;
  firstStart: number;
}

export interface ProcessedPhysicianSummary {
  name: string;
  branch: string;
  totalCapacity: number;
  totalWorkDays: number; 
  actionDays: Record<string, number>;
  rawRows: DetailedScheduleData[];
}

export interface ScheduleVersion {
  id: string;
  label: string;
  timestamp: number;
  fileName: string;
  monthKey: string;
  physicians: Record<string, ProcessedPhysicianSummary>;
  diagnostics: {
    rawRowsCount: number;
    validRowsCount: number;
    invalidRowsCount: number;
    mapping: Record<string, string>;
    qualityIssues: {
      unparseableDate: number;
      unparseableTime: number;
      zeroDuration: number;
    };
  };
}

export interface ScheduleProposal {
  doctorName: string;
  specialty: string;
  decSummary: string;
  efficiencyComment: string;
  polyDiff?: number;
  surgDiff?: number;
  febPlan: {
    polyclinic: number;
    surgery: number;
    fixedActions: { type: string; days: number }[];
  };
  justification: string[];
  risks: string;
}

export type ActionType = 'Poliklinik' | 'Ameliyat' | 'Servis' | 'İzin' | 'Nöbet Ertesi' | 'Eğitim' | 'Diğer' | 'Yılbaşı' | 'Nöbet' | string;

export interface AppointmentData {
  id: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  month: string;
  year: number;
  date: string;
  actionType: ActionType;
  slotDuration?: number;
  totalSlots?: number;
  bookedSlots?: number;
  daysCount?: number; 
  status: 'active' | 'passive';
}

export interface AISuggestion {
  priority: 'High' | 'Medium' | 'Low';
  category: string;
  title: string;
  description: string;
}

// Presentation Configuration Types
export type PresentationTarget = 
  | 'CAPACITY_CHART'        // EfficiencyAnalysis -> CapacityUsageChart
  | 'SURGERY_CHART'         // EfficiencyAnalysis -> SurgicalEfficiencyChart
  | 'DISTRIBUTION_CHART'    // EfficiencyAnalysis -> ActionDistributionChart
  | 'SURG_HOURS_CHART'      // EfficiencyAnalysis -> SurgHoursChart
  | 'DETAILED_SUMMARY'      // DetailedSchedule -> SummaryTable
  | 'PHYSICIAN_LIST'        // PhysicianData -> PerformanceTable
  | 'CHANGE_SUMMARY'        // ChangeAnalysis -> ComparisonTable
  | 'ANALYSIS_OVERVIEW'     // AnalysisModule (Complete)
  | 'KPI_SUMMARY'           // Presentation-only KPI cards
  | 'COVER_SLIDE';          // Presentation-only Cover

export interface PresentationWidgetState {
  month?: string;
  year?: number;
  branch?: string;
  hospital?: string;  // YENİ - Snapshot hospital bilgisi
  viewLimit?: number | 'ALL';
}

export interface PresentationWidget {
  id: string;
  type: PresentationTarget;
  mode: 'LIVE' | 'SNAPSHOT';
  snapshotState?: PresentationWidgetState;
  position?: { x: number; y: number }; // Position in percentage (0-100)
  size?: { width: number; height: number }; // Size in percentage (0-100)
}

export interface PresentationSlide {
  id: string;
  title: string;
  widgets: PresentationWidget[];
}

export type ViewType =
  | 'welcome'                // Leonardo AI tarzı karşılama ekranı
  | 'dashboard'              // YENİ - Ana dashboard
  | 'dashboard-mhrs'         // YENİ - MHRS kategori dashboard'u
  | 'dashboard-financial'    // YENİ - Finansal kategori dashboard'u
  | 'dashboard-preparation'  // YENİ - Hazırlama kategori dashboard'u
  | 'dashboard-support'      // YENİ - Destek modülleri dashboard'u
  | 'dashboard-emergency'    // Acil Servis kategori dashboard'u
  | 'schedule'
  | 'performance-planning'
  | 'data-entry'
  | 'physician-data'
  | 'ai-chatbot'
  | 'service-analysis'
  | 'etik-kurul'              // Etik Kurul modülü (Finansal)
  | 'hekim-islem-listesi'     // Hekim İşlem Listesi modülü (Finansal)
  | 'ek-liste-tanimlama'      // Ek Liste Tanımlama modülü (Finansal)
  | 'sut-mevzuati'             // SUT Mevzuatı modülü (Finansal)
  | 'gil'                       // GİL modülü (Finansal)
  | 'detailed-schedule'
  | 'change-analysis'
  | 'goren'
  | 'analysis-module'
  | 'efficiency-analysis'
  | 'presentation'
  | 'emergency-service'      // Acil Servis modülü
  | 'schedule-planning'      // Cetvel Planlama modülü
  | 'active-demand'          // Aktif Talep modülü
  | 'goren-ilsm'             // GÖREN - İl Sağlık Müdürlüğü
  | 'goren-ilcesm'           // GÖREN - İlçe Sağlık Müdürlüğü
  | 'goren-bh'               // GÖREN - Başhekimlik
  | 'goren-adsh'             // GÖREN - Ağız ve Diş Sağlığı Hastanesi
  | 'goren-ash'              // GÖREN - Acil Sağlık Hizmetleri
  | 'admin';

// Aktif Talep (Active Demand) Types
export interface BranchDemand {
  branchName: string;
  demandCount: number;
}

export interface DemandEntry {
  id: string;
  hospitalId: string;
  hospitalName: string;
  date: string;           // YYYY-MM-DD formatı
  branches: BranchDemand[];
  totalDemand: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface HospitalDemandSummary {
  hospitalId: string;
  hospitalName: string;
  totalDemand: number;
  branches: BranchDemand[];
}

export interface DemandSummary {
  totalProvinceDemand: number;
  totalHospitals: number;
  branchTotals: BranchDemand[];
  hospitalSummaries: HospitalDemandSummary[];
}
