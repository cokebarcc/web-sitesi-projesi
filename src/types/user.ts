export interface UserPermissions {
  // Hangi hastaneleri görebilir (boş array = tümü)
  allowedHospitals: string[];

  // Hangi modülleri görebilir
  modules: {
    detailedSchedule: boolean;
    physicianData: boolean;
    changeAnalysis: boolean;
    efficiencyAnalysis: boolean;
    serviceAnalysis: boolean;
    aiChatbot: boolean;
    gorenBashekimlik: boolean;
    analysisModule: boolean;
    schedulePlanning: boolean;
    performancePlanning: boolean;
    presentation: boolean;
    emergencyService: boolean;
    activeDemand: boolean;
    etikKurul: boolean;
    hekimIslemListesi: boolean;
    ekListeTanimlama: boolean;
    sutMevzuati: boolean;
    gil: boolean;
  };

  // Hangi modüllere veri yükleyebilir
  canUpload?: {
    detailedSchedule: boolean;
    physicianData: boolean;
    emergencyService: boolean;
    activeDemand: boolean;
  };
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  permissions: UserPermissions;
  createdAt: string;
  createdBy: string;
}

export const ADMIN_EMAIL = 'yakupcaglin@hotmail.com';

export const DEFAULT_PERMISSIONS: UserPermissions = {
  allowedHospitals: [],
  modules: {
    detailedSchedule: true,
    physicianData: true,
    changeAnalysis: true,
    efficiencyAnalysis: true,
    serviceAnalysis: true,
    aiChatbot: true,
    gorenBashekimlik: true,
    analysisModule: true,
    schedulePlanning: true,
    performancePlanning: true,
    presentation: true,
    emergencyService: true,
    activeDemand: true,
    etikKurul: true,
    hekimIslemListesi: true,
    ekListeTanimlama: true,
    sutMevzuati: true,
    gil: true,
  },
  canUpload: {
    detailedSchedule: false,
    physicianData: false,
    emergencyService: false,
    activeDemand: false,
  },
};
