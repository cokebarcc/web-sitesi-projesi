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
    gorenIlsm: boolean;
    gorenIlcesm: boolean;
    gorenBh: boolean;
    gorenAdsh: boolean;
    gorenAsh: boolean;
    gorenManuel: boolean;
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
    changeAnalysis: boolean;
    gil: boolean;
    ekListeTanimlama: boolean;
    gorenIlsm: boolean;
    gorenIlcesm: boolean;
    gorenBh: boolean;
    gorenAdsh: boolean;
    gorenAsh: boolean;
  };
}

// ============ KURUM TANIMLARI ============

export type KurumCategory =
  | 'IL_SAGLIK_MUDURLUGU'
  | 'KAMU_HASTANELERI'
  | 'ILCE_SAGLIK_MUDURLUGU'
  | 'ADSH'
  | 'OZEL_UNIVERSITE'
  | 'ACIL_SAGLIK_HIZMETLERI';

export interface KurumInfo {
  category: KurumCategory;
  name?: string;
}

export const KURUM_CATEGORY_LABELS: Record<KurumCategory, string> = {
  IL_SAGLIK_MUDURLUGU: 'İl Sağlık Müdürlüğü',
  KAMU_HASTANELERI: 'Kamu Hastaneleri',
  ILCE_SAGLIK_MUDURLUGU: 'İlçe Sağlık Müdürlükleri',
  ADSH: 'Ağız ve Diş Sağlığı Hastaneleri',
  OZEL_UNIVERSITE: 'Özel ve Üniversite Hastaneleri',
  ACIL_SAGLIK_HIZMETLERI: 'Acil Sağlık Hizmetleri',
};

// ============ KULLANICI ============

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  permissions: UserPermissions;
  kurum?: KurumInfo;
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
    gorenIlsm: true,
    gorenIlcesm: true,
    gorenBh: true,
    gorenAdsh: true,
    gorenAsh: true,
    gorenManuel: true,
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
    changeAnalysis: false,
    gil: false,
    ekListeTanimlama: false,
    gorenIlsm: false,
    gorenIlcesm: false,
    gorenBh: false,
    gorenAdsh: false,
    gorenAsh: false,
  },
};
