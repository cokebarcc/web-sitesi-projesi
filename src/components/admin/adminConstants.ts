export interface ModuleInfo {
  key: string;
  label: string;
  uploadKey?: string;
}

export interface ModuleGroup {
  label: string;
  icon: string;
  color: string;
  modules: ModuleInfo[];
}

export const MODULE_GROUPS: Record<string, ModuleGroup> = {
  mhrs: {
    label: 'MHRS',
    icon: 'calendar',
    color: '#6366f1',
    modules: [
      { key: 'detailedSchedule', label: 'Detayli Cetveller', uploadKey: 'detailedSchedule' },
      { key: 'physicianData', label: 'Hekim Verileri', uploadKey: 'physicianData' },
      { key: 'changeAnalysis', label: 'Degisim Analizleri', uploadKey: 'changeAnalysis' },
      { key: 'efficiencyAnalysis', label: 'Verimlilik Analizleri' },
    ],
  },
  acilServis: {
    label: 'Acil Servis',
    icon: 'emergency',
    color: '#ef4444',
    modules: [
      { key: 'emergencyService', label: 'Yesil Alan Oranlari', uploadKey: 'emergencyService' },
      { key: 'activeDemand', label: 'Aktif Talep', uploadKey: 'activeDemand' },
    ],
  },
  finansal: {
    label: 'Finansal',
    icon: 'chart',
    color: '#8b5cf6',
    modules: [
      { key: 'serviceAnalysis', label: 'Hizmet Girisim' },
      { key: 'etikKurul', label: 'Etik Kurul' },
      { key: 'hekimIslemListesi', label: 'Hekim Islem Listesi' },
      { key: 'ekListeTanimlama', label: 'Ek Liste Tanimlama', uploadKey: 'ekListeTanimlama' },
      { key: 'sutMevzuati', label: 'SUT Mevzuati' },
      { key: 'gil', label: 'GIL', uploadKey: 'gil' },
    ],
  },
  goren: {
    label: 'GOREN Performans',
    icon: 'trophy',
    color: '#f59e0b',
    modules: [
      { key: 'gorenIlsm', label: 'Il Saglik Mudurlugu', uploadKey: 'gorenIlsm' },
      { key: 'gorenIlcesm', label: 'Ilce Saglik Mudurlugu', uploadKey: 'gorenIlcesm' },
      { key: 'gorenBh', label: 'Bashekimlik', uploadKey: 'gorenBh' },
      { key: 'gorenAdsh', label: 'ADSH', uploadKey: 'gorenAdsh' },
      { key: 'gorenAsh', label: 'Acil Saglik', uploadKey: 'gorenAsh' },
      { key: 'gorenManuel', label: 'Manuel Hesaplama' },
    ],
  },
  hazirlama: {
    label: 'Hazirlama',
    icon: 'settings',
    color: '#06b6d4',
    modules: [
      { key: 'analysisModule', label: 'Analiz Modulu' },
      { key: 'performancePlanning', label: 'AI Planlama' },
      { key: 'schedulePlanning', label: 'Cetvel Planlama' },
      { key: 'presentation', label: 'Sunum' },
    ],
  },
  destek: {
    label: 'Destek',
    icon: 'chat',
    color: '#10b981',
    modules: [
      { key: 'aiChatbot', label: 'AI Sohbet' },
    ],
  },
};

export const PERMISSION_PRESETS = {
  fullAccess: {
    label: 'Tam Erisim',
    description: 'Tum moduller acik, yukleme izni yok',
    apply: () => {
      const modules: Record<string, boolean> = {};
      Object.values(MODULE_GROUPS).forEach(group => {
        group.modules.forEach(mod => { modules[mod.key] = true; });
      });
      return modules;
    },
  },
  readOnly: {
    label: 'Sadece Goruntuleme',
    description: 'Tum moduller acik, yukleme izni yok',
    apply: () => {
      const modules: Record<string, boolean> = {};
      Object.values(MODULE_GROUPS).forEach(group => {
        group.modules.forEach(mod => { modules[mod.key] = true; });
      });
      return modules;
    },
  },
  mhrsOnly: {
    label: 'Sadece MHRS',
    description: 'Yalnizca MHRS modulleri',
    apply: () => {
      const modules: Record<string, boolean> = {};
      Object.values(MODULE_GROUPS).forEach(group => {
        group.modules.forEach(mod => { modules[mod.key] = false; });
      });
      MODULE_GROUPS.mhrs.modules.forEach(mod => { modules[mod.key] = true; });
      return modules;
    },
  },
  none: {
    label: 'Hicbiri',
    description: 'Tum moduller kapali',
    apply: () => {
      const modules: Record<string, boolean> = {};
      Object.values(MODULE_GROUPS).forEach(group => {
        group.modules.forEach(mod => { modules[mod.key] = false; });
      });
      return modules;
    },
  },
};

export const MODULE_TOTAL = Object.values(MODULE_GROUPS).reduce(
  (sum, group) => sum + group.modules.length, 0
);

export const countActiveModules = (modules: Record<string, boolean>): number => {
  return Object.values(modules).filter(Boolean).length;
};

export const getAvatarColor = (email: string): string => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
  let hash = 0;
  for (const char of email) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const getInitials = (name: string): string => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};
