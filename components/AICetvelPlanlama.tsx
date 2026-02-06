import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import { DetailedScheduleData } from '../types';
import { MONTHS, YEARS, HOSPITALS } from '../constants';
import { getPeriodKey, normalizeDoctorName } from '../utils/formatters';
import DataFilterPanel from './common/DataFilterPanel';
import { KURUM_LISTESI } from './HekimIslemListesiModule';

interface AICetvelPlanlamaProps {
  detailedScheduleData: DetailedScheduleData[];       // Sadece seçili hastane
  allDetailedScheduleData: DetailedScheduleData[];    // TÜM hastaneler (rol grubu için)
  ameliyatByPeriod: Record<string, Record<string, number>>;
  ameliyatMetaByPeriod: Record<string, { fileName: string; uploadedAt: number }>;
  globalSelectedYears: number[];
  setGlobalSelectedYears: (years: number[]) => void;
  globalSelectedMonths: number[];
  setGlobalSelectedMonths: (months: number[]) => void;
  globalAppliedYears: number[];
  globalAppliedMonths: number[];
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  onCentralDataLoad: (hospital: string, years: number[], months: number[]) => Promise<void>;
  onLoadPeriodData: (hospital: string, year: number, month: string, silent?: boolean) => Promise<void>;
  isLoading?: boolean;
}

const SURGERY_ACTIONS = ['AMELİYAT', 'AMELİYATTA', 'SURGERY', 'AMELİYATHANE'];
const EXCLUDED_ACTIONS = ['HAFTA SONU TATİLİ', 'HAFTASONU TATİLİ', 'SONUÇ/KONTROL MUAYENE', 'SONUÇ/KONTROL MUAYENESİ'];
const MUAYENE_ACTIONS = ['MUAYENE', 'POLİKLİNİK'];

interface DoctorEfficiency {
  doctorName: string;
  branchName: string;
  plannedDays: number;
  performedABC: number;
  efficiency: number;
  branchAvg: number;
  roleGroupBranchAvg: number | null;
  muayeneDailyCapacity: number; // Günlük ortalama muayene kapasitesi
  status: 'low' | 'normal' | 'high' | 'no-data';
}

interface Proposal {
  doctorName: string;
  branchName: string;
  currentDays: number;
  proposedDays: number;
  reduction: number;
  efficiency: number;
  branchAvg: number;
  roleGroupAvg: number | null;
  targetEfficiency: number;
  estimatedCapacityGain: number;
}

const formatNum = (val: number): string => {
  if (!isFinite(val) || isNaN(val)) return '-';
  if (Number.isInteger(val)) return val.toLocaleString('tr-TR');
  return parseFloat(val.toFixed(2)).toLocaleString('tr-TR');
};

// KURUM_LISTESI (uppercase) -> HOSPITALS (mixed case) eşleştirmesi
const findHospitalMixedCase = (kurumAdUpper: string): string | null => {
  const match = HOSPITALS.find(h => h.toLocaleUpperCase('tr-TR') === kurumAdUpper);
  return match || null;
};

const getRoleGroup = (hospitalName: string): string | null => {
  const normalized = hospitalName.toLocaleUpperCase('tr-TR');
  const kurum = KURUM_LISTESI.find(k => k.ad === normalized);
  if (!kurum) return null;
  // A1 ve A2'yi aynı grup olarak değerlendir
  if (kurum.rolGrubu === 'A1' || kurum.rolGrubu === 'A2') return 'A';
  return kurum.rolGrubu;
};

// Aynı rol grubundaki hastaneleri mixed case olarak döndür (HOSPITALS listesinden)
const getSameRoleGroupHospitalsMixed = (hospitalName: string): string[] => {
  const roleGroup = getRoleGroup(hospitalName);
  if (!roleGroup) return [];
  return KURUM_LISTESI
    .filter(k => {
      const grp = (k.rolGrubu === 'A1' || k.rolGrubu === 'A2') ? 'A' : k.rolGrubu;
      return grp === roleGroup;
    })
    .map(k => findHospitalMixedCase(k.ad))
    .filter((h): h is string => h !== null);
};

// Bir hastanenin cerrahi verimlilik verilerini hesapla
const computeHospitalSurgeryData = (
  schedules: DetailedScheduleData[],
  ameliyatData: Record<string, number>,
  month: string,
  year: number
) => {
  const periodSchedules = schedules.filter(d => d.month === month && d.year === year);
  const doctorSurgDays = new Map<string, { branch: string; days: Set<string> }>();

  periodSchedules.forEach(item => {
    const actionNorm = item.action.toLocaleUpperCase('tr-TR');
    if (SURGERY_ACTIONS.some(sa => actionNorm.includes(sa))) {
      const normName = normalizeDoctorName(item.doctorName);
      if (!doctorSurgDays.has(normName)) {
        doctorSurgDays.set(normName, { branch: item.specialty, days: new Set() });
      }
      doctorSurgDays.get(normName)!.days.add(item.startDate);
    }
  });

  // Branş bazlı toplam
  const branchTotals = new Map<string, { totalABC: number; totalDays: number }>();
  doctorSurgDays.forEach((info, normName) => {
    const abc = ameliyatData[normName] || 0;
    const days = info.days.size;
    const prev = branchTotals.get(info.branch) || { totalABC: 0, totalDays: 0 };
    prev.totalABC += abc;
    prev.totalDays += days;
    branchTotals.set(info.branch, prev);
  });

  return branchTotals;
};

const AICetvelPlanlama: React.FC<AICetvelPlanlamaProps> = ({
  detailedScheduleData,
  allDetailedScheduleData,
  ameliyatByPeriod,
  ameliyatMetaByPeriod,
  globalSelectedYears,
  setGlobalSelectedYears,
  globalSelectedMonths,
  setGlobalSelectedMonths,
  globalAppliedYears,
  globalAppliedMonths,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  onCentralDataLoad,
  onLoadPeriodData,
  isLoading = false,
}) => {
  const selectedMonth = globalAppliedMonths.length > 0 ? MONTHS[globalAppliedMonths[0] - 1] : '';
  const selectedYear = globalAppliedYears.length > 0 ? String(globalAppliedYears[0]) : '';

  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  // Kademeli azaltım eşikleri: ≥%80 normal, %60-80 ılımlı, <%60 agresif
  const [sortColumn, setSortColumn] = useState<string>('efficiency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [roleGroupLoadingStatus, setRoleGroupLoadingStatus] = useState('');

  // Rol grubu verileri icin cache - ayni grup+donem icin tekrar Firebase'den cekmez
  const roleGroupCacheRef = useRef<Set<string>>(new Set());

  const isPeriodSelected = !!(selectedMonth && selectedYear);

  const periodKey = selectedMonth && selectedYear && selectedHospital
    ? `${selectedHospital}-${getPeriodKey(Number(selectedYear), selectedMonth)}`
    : '';

  // Ameliyat yapan branşlar (seçili hastane)
  const surgicalBranches = useMemo(() => {
    if (!isPeriodSelected) return [];
    const branches = new Set<string>();
    detailedScheduleData
      .filter(d => d.month === selectedMonth && d.year === Number(selectedYear))
      .forEach(d => {
        const actionNorm = d.action.toLocaleUpperCase('tr-TR');
        if (SURGERY_ACTIONS.some(sa => actionNorm.includes(sa))) {
          branches.add(d.specialty);
        }
      });
    return Array.from(branches).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [detailedScheduleData, selectedMonth, selectedYear, isPeriodSelected]);

  // Seçili hastanenin rol grubu bilgisi
  const currentRoleGroup = useMemo(() => getRoleGroup(selectedHospital), [selectedHospital]);
  const sameGroupHospitals = useMemo(() => getSameRoleGroupHospitalsMixed(selectedHospital), [selectedHospital]);

  // === ANA HESAPLAMA ===
  const { doctorEfficiencies, branchAverages, roleGroupBranchAverages, kpiStats, roleGroupHospitalCount } = useMemo(() => {
    const empty = {
      doctorEfficiencies: [] as DoctorEfficiency[],
      branchAverages: new Map<string, number>(),
      roleGroupBranchAverages: new Map<string, number>(),
      kpiStats: { totalSurgeryDays: 0, totalABC: 0, avgEfficiency: 0, doctorCount: 0, surgicalDoctorCount: 0 },
      roleGroupHospitalCount: 0,
    };
    if (!isPeriodSelected) return empty;

    const periodSchedules = detailedScheduleData.filter(d => d.month === selectedMonth && d.year === Number(selectedYear));
    const rawAmeliyatData = ameliyatByPeriod[periodKey] || {};

    // === KATMAN 1: Hekim bazlı cerrahi verimlilik ===
    const doctorSurgeryDaysMap = new Map<string, Set<string>>();
    const doctorBranchMap = new Map<string, { name: string; branch: string }>();
    // Muayene kapasitesi: sadece muayene/poliklinik aksiyonlarının kapasitesi ve gün sayısı
    const doctorMuayeneDaysMap = new Map<string, Set<string>>();
    const doctorMuayeneCapacityMap = new Map<string, number>();

    periodSchedules.forEach(item => {
      const normName = normalizeDoctorName(item.doctorName);
      if (!doctorBranchMap.has(normName)) {
        doctorBranchMap.set(normName, { name: item.doctorName, branch: item.specialty });
      }
      const actionNorm = item.action.toLocaleUpperCase('tr-TR');

      const isExcluded = EXCLUDED_ACTIONS.some(ex => actionNorm.includes(ex));
      const isSurgery = SURGERY_ACTIONS.some(sa => actionNorm.includes(sa));
      const isMuayene = !isExcluded && !isSurgery && MUAYENE_ACTIONS.some(ma => actionNorm.includes(ma));

      if (isExcluded) return;

      if (isSurgery) {
        if (!doctorSurgeryDaysMap.has(normName)) doctorSurgeryDaysMap.set(normName, new Set());
        doctorSurgeryDaysMap.get(normName)!.add(item.startDate);
      }

      // Sadece muayene/poliklinik aksiyonlarının kapasitesini ve günlerini topla
      if (isMuayene) {
        if (!doctorMuayeneDaysMap.has(normName)) doctorMuayeneDaysMap.set(normName, new Set());
        doctorMuayeneDaysMap.get(normName)!.add(item.startDate);
        doctorMuayeneCapacityMap.set(normName, (doctorMuayeneCapacityMap.get(normName) || 0) + (item.capacity || 0));
      }
    });

    const efficiencyList: { normName: string; doctorName: string; branch: string; plannedDays: number; performedABC: number; efficiency: number; muayeneDailyCapacity: number }[] = [];
    doctorSurgeryDaysMap.forEach((days, normName) => {
      const info = doctorBranchMap.get(normName);
      if (!info) return;
      const plannedDays = days.size;
      const performedABC = rawAmeliyatData[normName] || 0;
      const efficiency = plannedDays > 0 ? performedABC / plannedDays : 0;
      // Günlük kapasite: muayene/poliklinik kapasitesi / muayene gün sayısı
      const muayeneDays = doctorMuayeneDaysMap.get(normName)?.size || 0;
      const totalMuayeneCapacity = doctorMuayeneCapacityMap.get(normName) || 0;
      const muayeneDailyCapacity = muayeneDays > 0 ? totalMuayeneCapacity / muayeneDays : 0;
      efficiencyList.push({ normName, doctorName: info.name, branch: info.branch, plannedDays, performedABC, efficiency, muayeneDailyCapacity });
    });

    // === KATMAN 2: Hastane branş ortalaması (sadece seçili hastane) ===
    const branchAverages = new Map<string, number>();
    const branchTotals = new Map<string, { totalABC: number; totalDays: number }>();
    efficiencyList.forEach(doc => {
      const prev = branchTotals.get(doc.branch) || { totalABC: 0, totalDays: 0 };
      prev.totalABC += doc.performedABC;
      prev.totalDays += doc.plannedDays;
      branchTotals.set(doc.branch, prev);
    });
    branchTotals.forEach((totals, branch) => {
      branchAverages.set(branch, totals.totalDays > 0 ? totals.totalABC / totals.totalDays : 0);
    });

    // === KATMAN 3: İl rol grubu branş ortalaması (TÜM aynı gruptaki hastaneler) ===
    const roleGroupBranchAverages = new Map<string, number>();
    let roleGroupHospitalCount = 0;

    if (selectedHospital && sameGroupHospitals.length > 0) {
      const rgBranchTotals = new Map<string, { totalABC: number; totalDays: number }>();
      const loadedHospitals = new Set<string>();

      sameGroupHospitals.forEach(hospMixed => {
        // Bu hastane için period key oluştur
        const hospPeriodKey = `${hospMixed}-${getPeriodKey(Number(selectedYear), selectedMonth)}`;
        const hospAmeliyatData = ameliyatByPeriod[hospPeriodKey];

        // Bu hastanenin cetvel verisini allDetailedScheduleData'dan al
        const hospSchedules = allDetailedScheduleData.filter(d =>
          d.hospital === hospMixed && d.month === selectedMonth && d.year === Number(selectedYear)
        );

        // Hem cetvel hem ameliyat verisi olan hastaneleri say
        if (hospSchedules.length > 0 && hospAmeliyatData) {
          loadedHospitals.add(hospMixed);
          const hospBranchTotals = computeHospitalSurgeryData(hospSchedules, hospAmeliyatData, selectedMonth, Number(selectedYear));
          hospBranchTotals.forEach((totals, branch) => {
            const prev = rgBranchTotals.get(branch) || { totalABC: 0, totalDays: 0 };
            prev.totalABC += totals.totalABC;
            prev.totalDays += totals.totalDays;
            rgBranchTotals.set(branch, prev);
          });
        }
      });

      roleGroupHospitalCount = loadedHospitals.size;

      rgBranchTotals.forEach((totals, branch) => {
        roleGroupBranchAverages.set(branch, totals.totalDays > 0 ? totals.totalABC / totals.totalDays : 0);
      });
    }

    // DoctorEfficiency listesi
    const doctorEfficiencies: DoctorEfficiency[] = efficiencyList
      .filter(doc => selectedBranch === 'ALL' || doc.branch === selectedBranch)
      .map(doc => {
        const branchAvg = branchAverages.get(doc.branch) || 0;
        const rgAvg = roleGroupBranchAverages.size > 0 ? (roleGroupBranchAverages.get(doc.branch) ?? null) : null;

        // Referans verimlilik: rol grubu ortalaması varsa onu, yoksa hastane branş ortalamasını kullan
        // Tek hekimli branşlarda hastane ort. = hekim kendisi olur, rol grubu daha anlamlı
        const referenceAvg = (rgAvg !== null && rgAvg > 0) ? rgAvg : branchAvg;

        let status: DoctorEfficiency['status'] = 'normal';
        if (doc.plannedDays === 0 && doc.performedABC === 0) status = 'no-data';
        else if (referenceAvg > 0 && doc.efficiency < referenceAvg * 0.8) status = 'low';
        else if (referenceAvg > 0 && doc.efficiency > referenceAvg * 1.5) status = 'high';
        return {
          doctorName: doc.doctorName,
          branchName: doc.branch,
          plannedDays: doc.plannedDays,
          performedABC: doc.performedABC,
          efficiency: doc.efficiency,
          branchAvg,
          roleGroupBranchAvg: rgAvg,
          muayeneDailyCapacity: doc.muayeneDailyCapacity,
          status,
        };
      });

    const totalSurgeryDays = efficiencyList.reduce((sum, d) => sum + d.plannedDays, 0);
    const totalABC = efficiencyList.reduce((sum, d) => sum + d.performedABC, 0);
    const avgEfficiency = totalSurgeryDays > 0 ? totalABC / totalSurgeryDays : 0;

    return {
      doctorEfficiencies,
      branchAverages,
      roleGroupBranchAverages,
      kpiStats: {
        totalSurgeryDays,
        totalABC,
        avgEfficiency,
        doctorCount: doctorBranchMap.size,
        surgicalDoctorCount: doctorSurgeryDaysMap.size,
      },
      roleGroupHospitalCount,
    };
  }, [detailedScheduleData, allDetailedScheduleData, ameliyatByPeriod, selectedMonth, selectedYear, periodKey, isPeriodSelected, selectedHospital, selectedBranch, sameGroupHospitals]);

  // Sıralama
  const sortedDoctors = useMemo(() => {
    const sorted = [...doctorEfficiencies];
    sorted.sort((a, b) => {
      let valA: number, valB: number;
      switch (sortColumn) {
        case 'doctorName': return sortDirection === 'asc' ? a.doctorName.localeCompare(b.doctorName, 'tr-TR') : b.doctorName.localeCompare(a.doctorName, 'tr-TR');
        case 'branchName': return sortDirection === 'asc' ? a.branchName.localeCompare(b.branchName, 'tr-TR') : b.branchName.localeCompare(a.branchName, 'tr-TR');
        case 'plannedDays': valA = a.plannedDays; valB = b.plannedDays; break;
        case 'performedABC': valA = a.performedABC; valB = b.performedABC; break;
        case 'efficiency': valA = a.efficiency; valB = b.efficiency; break;
        case 'branchAvg': valA = a.branchAvg; valB = b.branchAvg; break;
        default: valA = a.efficiency; valB = b.efficiency;
      }
      return sortDirection === 'asc' ? valA! - valB! : valB! - valA!;
    });
    return sorted;
  }, [doctorEfficiencies, sortColumn, sortDirection]);

  // Öneri hesaplama - kademeli azaltım: ≥%80 → yok, %60-80 → ılımlı, %40-60 → orta, <%40 → agresif
  // Kadın Hastalıkları ve Doğum: ≥%30 → min 2 gün korunsun, <%30 → normal azaltım
  const proposals: Proposal[] = useMemo(() => {
    return doctorEfficiencies
      .filter(doc => doc.status === 'low' && doc.plannedDays > 0)
      .map(doc => {
        // Hedef verimlilik: önce rol grubu ortalaması, yoksa hastane branş ortalaması
        const targetEff = (doc.roleGroupBranchAvg !== null && doc.roleGroupBranchAvg > 0)
          ? doc.roleGroupBranchAvg
          : (doc.branchAvg > 0 ? doc.branchAvg : 1);

        // Verimlilik oranı: hekimin verimliliği / referans ortalama
        const ratio = targetEff > 0 ? doc.efficiency / targetEff : 0;

        // Kadın Hastalıkları ve Doğum branşı özel kuralı
        const isKHD = doc.branchName.toLocaleUpperCase('tr-TR').includes('KADIN HASTALIKLARI');

        let proposedDays: number;

        if (isKHD && ratio >= 0.3) {
          // KHD branşı %30 üzeri: ameliyat günü 2'nin altına düşmesin
          if (doc.plannedDays <= 2) return null; // Zaten 2 veya altında, azaltma
          // Normal kademeli azaltım uygula ama min 2 gün
          if (ratio >= 0.8) return null;
          else if (ratio >= 0.6) {
            const azaltim = doc.plannedDays >= 5 ? 2 : 1;
            proposedDays = Math.max(2, doc.plannedDays - azaltim);
          } else if (ratio >= 0.4) {
            const azaltim = doc.plannedDays >= 5 ? 3 : 2;
            proposedDays = Math.max(2, doc.plannedDays - azaltim);
          } else {
            // %30-40 arası: orta azaltım ama min 2 gün
            const azaltim = doc.plannedDays >= 5 ? 3 : 2;
            proposedDays = Math.max(2, doc.plannedDays - azaltim);
          }
        } else if (ratio >= 0.8) {
          // %80 ve üzeri: azaltıma gitme
          return null;
        } else if (ratio >= 0.6) {
          // %60-80 arası: ılımlı azaltım
          const azaltim = doc.plannedDays >= 5 ? 2 : 1;
          proposedDays = Math.max(1, doc.plannedDays - azaltim);
        } else if (ratio >= 0.4) {
          // %40-60 arası: orta düzey azaltım
          const azaltim = doc.plannedDays >= 5 ? 3 : 2;
          proposedDays = Math.max(1, doc.plannedDays - azaltim);
        } else {
          // %40 altı: agresif azaltım
          if (doc.performedABC > 0) {
            proposedDays = Math.max(1, Math.round(doc.performedABC / targetEff));
          } else {
            proposedDays = Math.max(1, Math.round(doc.plannedDays * 0.5));
          }
          if (proposedDays >= doc.plannedDays) {
            proposedDays = Math.max(1, doc.plannedDays - 1);
          }
        }

        // Ameliyat hacmi koruma: önerilen günlerde hedef verimlilikle çalışsa bile
        // mevcut ameliyat sayısını karşılayabilmeli
        if (doc.performedABC > 0 && targetEff > 0) {
          const minDaysForVolume = Math.ceil(doc.performedABC / targetEff);
          if (proposedDays < minDaysForVolume) {
            proposedDays = Math.min(minDaysForVolume, doc.plannedDays);
          }
        }

        // Azaltım yoksa öneri üretme
        if (proposedDays >= doc.plannedDays) return null;

        const reduction = doc.plannedDays - proposedDays;
        // Kapasite kazanımı: azaltılan gün × hekimin günlük ort. kapasite
        // Kapasite verisi yoksa minimum 42 kabul et
        const dailyCap = doc.muayeneDailyCapacity > 0 ? doc.muayeneDailyCapacity : 42;
        const estimatedCapacityGain = reduction * Math.round(dailyCap);
        return {
          doctorName: doc.doctorName,
          branchName: doc.branchName,
          currentDays: doc.plannedDays,
          proposedDays,
          reduction: Math.max(0, reduction),
          efficiency: doc.efficiency,
          branchAvg: doc.branchAvg,
          roleGroupAvg: doc.roleGroupBranchAvg,
          targetEfficiency: targetEff,
          estimatedCapacityGain: Math.max(0, estimatedCapacityGain),
        };
      })
      .filter((p): p is Proposal => p !== null && p.reduction > 0)
      .sort((a, b) => b.reduction - a.reduction);
  }, [doctorEfficiencies]);

  const totalReduction = proposals.reduce((sum, p) => sum + p.reduction, 0);
  const totalCapacityGain = proposals.reduce((sum, p) => sum + p.estimatedCapacityGain, 0);

  // Uygula: Önce seçili hastane, sonra rol grubu hastaneleri (cache'li + sessiz)
  const handleApply = async () => {
    if (!selectedHospital || globalSelectedYears.length === 0 || globalSelectedMonths.length === 0) {
      alert('Lütfen hastane, yıl ve ay seçiniz!');
      return;
    }

    // 1. Seçili hastane verilerini yükle
    await onCentralDataLoad(selectedHospital, globalSelectedYears, globalSelectedMonths);

    // 2. Aynı rol grubundaki diğer hastanelerin verilerini yükle (cache kontrollü)
    const otherHospitals = sameGroupHospitals.filter(h => h !== selectedHospital);
    if (otherHospitals.length > 0) {
      // Cache key: rolGrubu-yıllar-aylar
      const rgCacheKey = `${currentRoleGroup}-${globalSelectedYears.join(',')}-${globalSelectedMonths.join(',')}`;

      if (roleGroupCacheRef.current.has(rgCacheKey)) {
        console.log(`✅ Rol grubu verileri cache'den kullanılıyor: ${rgCacheKey}`);
        return;
      }

      setRoleGroupLoadingStatus(`Rol grubu verileri yükleniyor...`);
      for (const hosp of otherHospitals) {
        for (const year of globalSelectedYears) {
          for (const monthIdx of globalSelectedMonths) {
            const month = MONTHS[monthIdx - 1];
            try {
              await onLoadPeriodData(hosp, year, month, true);
            } catch (e) {
              console.warn(`⚠️ Rol grubu veri yükleme hatası:`, e);
            }
          }
        }
      }
      roleGroupCacheRef.current.add(rgCacheKey);
      setRoleGroupLoadingStatus('');
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleExportExcel = () => {
    const effRows = sortedDoctors.map(doc => ({
      'Hekim Adı': doc.doctorName,
      'Branş': doc.branchName,
      'Ameliyat Günü': doc.plannedDays,
      'ABC Ameliyat': doc.performedABC,
      'Verimlilik (ABC/Gün)': doc.efficiency > 0 ? Number(doc.efficiency.toFixed(2)) : 0,
      'Branş Ortalaması': doc.branchAvg > 0 ? Number(doc.branchAvg.toFixed(2)) : 0,
      'Rol Grubu Ort.': doc.roleGroupBranchAvg !== null ? Number(doc.roleGroupBranchAvg.toFixed(2)) : '-',
      'Günlük Kapasite': doc.muayeneDailyCapacity > 0 ? Math.round(doc.muayeneDailyCapacity) : '-',
      'Durum': doc.status === 'low' ? 'DÜŞÜK' : doc.status === 'high' ? 'YÜKSEK' : 'NORMAL',
    }));

    const propRows = proposals.map(p => ({
      'Hekim Adı': p.doctorName,
      'Branş': p.branchName,
      'Mevcut Gün': p.currentDays,
      'Önerilen Gün': p.proposedDays,
      'Azaltım': p.reduction,
      'Mevcut Verimlilik': Number(p.efficiency.toFixed(2)),
      'Hedef Verimlilik': Number(p.targetEfficiency.toFixed(2)),
      'Rol Grubu Ort.': p.roleGroupAvg !== null ? Number(p.roleGroupAvg.toFixed(2)) : '-',
      'Tahmini Kapasite Kazanımı': p.estimatedCapacityGain,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(effRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Verimlilik Analizi');
    const ws2 = XLSX.utils.json_to_sheet(propRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Cetvel Önerileri');
    XLSX.writeFile(wb, `AI_Cetvel_Planlama_${selectedHospital}_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleExportPowerPoint = async () => {
    if (!isPeriodSelected || sortedDoctors.length === 0) return;
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = 'AI Cetvel Planlama Raporu';
      pptx.author = 'MEDIS';
      pptx.company = 'Şanlıurfa İl Sağlık Müdürlüğü';

      const c = {
        bg: 'f8fafc', primary: '4f46e5', primaryLight: 'eef2ff',
        text: '1e293b', textMuted: '94a3b8', success: '10b981',
        danger: 'ef4444', border: 'e2e8f0', white: 'ffffff',
        dark: '0f172a', headerBg: '1e293b', amber: 'd97706',
      };

      // SLAYT 1: KAPAK
      const s1 = pptx.addSlide();
      s1.background = { color: c.dark };
      s1.addShape(pptx.shapes.RECTANGLE, { x: 8, y: 0, w: 5.33, h: 0.15, fill: { color: c.primary } });
      s1.addShape(pptx.shapes.RECTANGLE, { x: 1, y: 3.6, w: 4, h: 0.06, fill: { color: c.primary } });
      s1.addText('MHRS', { x: 1, y: 1.2, w: 11, h: 0.6, fontSize: 16, fontFace: 'Arial', bold: true, color: c.primary });
      s1.addText('AI CETVEL PLANLAMA', { x: 1, y: 1.9, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });
      s1.addText('RAPORU', { x: 1, y: 2.7, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });
      s1.addText(selectedHospital, { x: 1, y: 3.9, w: 11, h: 0.5, fontSize: 18, fontFace: 'Arial', color: c.textMuted });
      s1.addText(`${selectedMonth} ${selectedYear}`, { x: 1, y: 4.4, w: 11, h: 0.4, fontSize: 14, fontFace: 'Arial', color: '64748b' });
      if (currentRoleGroup) {
        s1.addText(`Rol Grubu: ${currentRoleGroup}`, { x: 1, y: 4.9, w: 11, h: 0.4, fontSize: 12, fontFace: 'Arial', color: c.primary });
      }

      // SLAYT 2: OZET DASHBOARD
      const s2 = pptx.addSlide();
      s2.background = { color: c.bg };
      s2.addText('ÖZET DASHBOARD', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, fontFace: 'Arial', bold: true, color: c.text });
      s2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.8, w: 2, h: 0.04, fill: { color: c.primary } });

      const kpiW = 3.8; const kpiH = 2.2; const kpiY = 1.2;
      const kpis = [
        { label: 'CERRAHİ HEKİM', value: String(kpiStats.surgicalDoctorCount), color: c.text },
        { label: 'TOPLAM AMELİYAT GÜNÜ', value: String(kpiStats.totalSurgeryDays), color: c.text },
        { label: 'ORT. VERİMLİLİK (ABC/GÜN)', value: formatNum(kpiStats.avgEfficiency), color: c.primary },
      ];
      kpis.forEach((kpi, i) => {
        const xPos = 0.5 + i * (kpiW + 0.35);
        s2.addShape(pptx.shapes.RECTANGLE, { x: xPos, y: kpiY, w: kpiW, h: kpiH, fill: { color: c.white }, line: { color: c.border, pt: 1 } });
        s2.addText(kpi.label, { x: xPos, y: kpiY + 0.3, w: kpiW, h: 0.4, fontSize: 9, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'center' });
        s2.addText(kpi.value, { x: xPos, y: kpiY + 0.8, w: kpiW, h: 0.9, fontSize: 36, fontFace: 'Arial', bold: true, color: kpi.color, align: 'center' });
      });

      if (proposals.length > 0) {
        s2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 3.8, w: 12.33, h: 1.4, fill: { color: c.primaryLight }, line: { color: c.border, pt: 1 } });
        s2.addText([
          { text: `${totalReduction} gün`, options: { fontSize: 28, bold: true, color: c.danger, fontFace: 'Arial' } },
          { text: ' ameliyat azaltımı öneriliyor  →  ', options: { fontSize: 14, color: c.text, fontFace: 'Arial' } },
          { text: `~${totalCapacityGain.toLocaleString('tr-TR')} kapasite kazanımı`, options: { fontSize: 20, bold: true, color: c.success, fontFace: 'Arial' } },
        ], { x: 0.5, y: 3.8, w: 12.33, h: 1.4, align: 'center', valign: 'middle' });
      }

      // SLAYT 3: VERIMLILIK TABLOSU
      const perPage = 14;
      const pageCount = Math.ceil(sortedDoctors.length / perPage);
      for (let page = 0; page < pageCount; page++) {
        const sN = pptx.addSlide();
        sN.background = { color: c.bg };
        sN.addText('CERRAHİ VERİMLİLİK TABLOSU', { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 18, fontFace: 'Arial', bold: true, color: c.text });
        sN.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.65, w: 2, h: 0.04, fill: { color: c.primary } });
        if (pageCount > 1) {
          sN.addText(`Sayfa ${page + 1}/${pageCount}`, { x: 10, y: 0.2, w: 2.8, h: 0.45, fontSize: 10, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });
        }

        const hOpts = (align: 'left' | 'center' = 'center') => ({ bold: true as const, fontSize: 9, color: c.white, fill: { color: c.headerBg }, align, fontFace: 'Arial' });
        const effHeader: pptxgen.TableRow = [
          { text: 'HEKİM', options: hOpts('left') },
          { text: 'BRANŞ', options: hOpts('left') },
          { text: 'AMEL. GÜNÜ', options: hOpts() },
          { text: 'ABC', options: hOpts() },
          { text: 'VERİMLİLİK', options: hOpts() },
          { text: 'BRANŞ ORT.', options: hOpts() },
          { text: 'ROL GR. ORT.', options: hOpts() },
          { text: 'DURUM', options: hOpts() },
        ];

        const slice = sortedDoctors.slice(page * perPage, (page + 1) * perPage);
        const effRows: pptxgen.TableRow[] = slice.map((doc, idx) => {
          const rowBg = doc.status === 'low' ? (idx % 2 === 0 ? 'fce4e4' : 'fef2f2') : doc.status === 'high' ? (idx % 2 === 0 ? 'dcfce7' : 'f0fdf4') : idx % 2 === 0 ? 'e8eaf0' : c.white;
          const effColor = doc.status === 'low' ? c.danger : doc.status === 'high' ? c.success : c.text;
          const statusText = doc.status === 'low' ? 'DÜŞÜK' : doc.status === 'high' ? 'YÜKSEK' : 'NORMAL';
          const statusColor = doc.status === 'low' ? c.danger : doc.status === 'high' ? c.success : c.textMuted;
          return [
            { text: doc.doctorName, options: { fontSize: 9, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: doc.branchName, options: { fontSize: 8, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
            { text: String(doc.plannedDays), options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: String(doc.performedABC), options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: formatNum(doc.efficiency), options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: effColor } },
            { text: formatNum(doc.branchAvg), options: { fontSize: 9, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
            { text: doc.roleGroupBranchAvg !== null ? formatNum(doc.roleGroupBranchAvg) : '-', options: { fontSize: 9, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: '6366f1' } },
            { text: statusText, options: { fontSize: 8, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: statusColor } },
          ];
        });

        sN.addTable([effHeader, ...effRows], {
          x: 0.3, y: 0.9, w: 12.73,
          colW: [2.5, 2.3, 1.2, 1.0, 1.3, 1.5, 1.5, 1.43],
          border: { type: 'solid', pt: 0.5, color: c.border },
          rowH: 0.4,
        });
      }

      // SLAYT 4+: ONERI TABLOSU
      if (proposals.length > 0) {
        const propPerPage = 14;
        const propPageCount = Math.ceil(proposals.length / propPerPage);
        for (let page = 0; page < propPageCount; page++) {
          const sP = pptx.addSlide();
          sP.background = { color: c.bg };
          sP.addText('CETVEL DEĞİŞİKLİK ÖNERİLERİ', { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 18, fontFace: 'Arial', bold: true, color: c.text });
          sP.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.65, w: 2, h: 0.04, fill: { color: c.danger } });
          if (propPageCount > 1) {
            sP.addText(`Sayfa ${page + 1}/${propPageCount}`, { x: 10, y: 0.2, w: 2.8, h: 0.45, fontSize: 10, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });
          }
          sP.addText(`Toplam: ${totalReduction} gün azaltım  →  ~${totalCapacityGain.toLocaleString('tr-TR')} kapasite kazanımı`, {
            x: 0.5, y: 0.7, w: 8, h: 0.25, fontSize: 9, fontFace: 'Arial', bold: true, color: c.amber, align: 'left',
          });

          const pHdr = (t: string, a: 'left' | 'center' = 'center') => ({ text: t, options: { bold: true as const, fontSize: 9, color: c.white, fill: { color: c.headerBg }, align: a, fontFace: 'Arial' } });
          const propHeader: pptxgen.TableRow = [
            pHdr('HEKİM', 'left'), pHdr('BRANŞ', 'left'), pHdr('MEVCUT GÜN'),
            pHdr('ÖNERİLEN GÜN'), pHdr('AZALTIM'), pHdr('VERİMLİLİK'),
            pHdr('HEDEF ORT.'), pHdr('KAPASİTE KAZANIMI'),
          ];

          const propSlice = proposals.slice(page * propPerPage, (page + 1) * propPerPage);
          const propRows: pptxgen.TableRow[] = propSlice.map((p, idx) => {
            const rowBg = idx % 2 === 0 ? 'fde8d8' : 'fef2f2';
            return [
              { text: p.doctorName, options: { fontSize: 9, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
              { text: p.branchName, options: { fontSize: 8, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
              { text: String(p.currentDays), options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
              { text: String(p.proposedDays), options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.success } },
              { text: `-${p.reduction}`, options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.danger } },
              { text: formatNum(p.efficiency), options: { fontSize: 9, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.danger } },
              { text: formatNum(p.targetEfficiency), options: { fontSize: 9, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: '6366f1' } },
              { text: `+${p.estimatedCapacityGain}`, options: { fontSize: 10, bold: true, align: 'center' as const, fill: { color: rowBg }, fontFace: 'Arial', color: c.amber } },
            ];
          });

          sP.addTable([propHeader, ...propRows], {
            x: 0.3, y: 0.9, w: 12.73,
            colW: [2.5, 2.0, 1.2, 1.3, 1.1, 1.3, 1.3, 2.03],
            border: { type: 'solid', pt: 0.5, color: c.border },
            rowH: 0.4,
          });
        }
      }

      const safeHospital = selectedHospital.replace(/[^a-zA-Z0-9]/g, '_');
      const safeMonth = selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
      await pptx.writeFile({ fileName: `AI_Cetvel_Planlama_${safeHospital}_${safeMonth}_${selectedYear}.pptx` });
    } catch (err) {
      console.error('PPTX export hatası:', err);
      alert('Sunum oluşturulurken hata oluştu');
    }
  };

  const SortHeader: React.FC<{ column: string; label: string; className?: string }> = ({ column, label, className = '' }) => (
    <th
      className={`px-4 py-3.5 text-[11px] font-black uppercase tracking-wider cursor-pointer hover:text-[var(--accent-1)] transition-colors select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <span className="flex items-center justify-center gap-1.5">
        {label}
        {sortColumn === column && (
          <span className="text-[var(--accent-1)] text-[10px]">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Filtre Paneli */}
      <DataFilterPanel
        title="AI Cetvel Planlama - Veri Seçimi"
        showHospitalFilter={true}
        selectedHospital={selectedHospital}
        availableHospitals={allowedHospitals}
        onHospitalChange={onHospitalChange}
        showYearFilter={true}
        selectedYears={globalSelectedYears}
        availableYears={YEARS}
        onYearsChange={setGlobalSelectedYears}
        showMonthFilter={true}
        selectedMonths={globalSelectedMonths}
        onMonthsChange={setGlobalSelectedMonths}
        showBranchFilter={true}
        selectedBranch={selectedBranch === 'ALL' ? null : selectedBranch}
        availableBranches={surgicalBranches}
        onBranchChange={(branch) => setSelectedBranch(branch || 'ALL')}
        showApplyButton={true}
        onApply={handleApply}
        isLoading={isLoading}
        applyDisabled={!selectedHospital || globalSelectedYears.length === 0 || globalSelectedMonths.length === 0}
        selectionCount={globalAppliedYears.length * globalAppliedMonths.length}
        selectionLabel="dönem yüklendi"
      />

      {/* Rol Grubu Yükleme Durumu */}
      {roleGroupLoadingStatus && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-[10px] text-amber-400 animate-pulse">{roleGroupLoadingStatus}</span>
        </div>
      )}

      {/* KPI Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <KpiCard
          title="Cerrahi Hekim Sayısı"
          value={isPeriodSelected ? kpiStats.surgicalDoctorCount : null}
          accent="capacity"
          isEmpty={!isPeriodSelected}
        />
        <KpiCard
          title="Toplam Ameliyat Günü"
          value={isPeriodSelected ? kpiStats.totalSurgeryDays : null}
          accent="surgeryDay"
          isEmpty={!isPeriodSelected}
        />
        <KpiCard
          title="Toplam ABC Ameliyat"
          value={isPeriodSelected ? kpiStats.totalABC : null}
          accent="surgeryCount"
          isEmpty={!isPeriodSelected}
        />
        <KpiCard
          title="Ort. Verimlilik (ABC/Gün)"
          value={isPeriodSelected ? formatNum(kpiStats.avgEfficiency) : null}
          accent="ratio"
          isEmpty={!isPeriodSelected}
        />
        <KpiCard
          title="Önerilen Azaltım"
          value={isPeriodSelected ? `${totalReduction} gün` : null}
          subtitle={totalCapacityGain > 0 ? `~${totalCapacityGain} kapasite kazanımı` : undefined}
          accent="visits"
          isEmpty={!isPeriodSelected || totalReduction === 0}
        />
      </div>

      {/* Hekim Verimlilik Tablosu */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-[var(--text-1)] uppercase">
              Cerrahi Verimlilik Tablosu
            </h3>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
              Hekim bazlı ameliyat verimliliği - Eşik altı hekimler kırmızı ile vurgulanır
            </p>
          </div>
          {isPeriodSelected && sortedDoctors.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPowerPoint}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase bg-amber-600 hover:bg-amber-700 text-white transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sunum İndir
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel İndir
              </button>
            </div>
          )}
        </div>

        {!isPeriodSelected ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-muted)] text-sm font-medium">Hastane ve dönem seçerek verileri yükleyin</p>
          </div>
        ) : sortedDoctors.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-muted)] text-sm font-medium">Seçilen dönemde ameliyat verisi bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)]/60 border-b-2 border-[var(--border-1)]">
                  <SortHeader column="doctorName" label="Hekim" className="!text-left !justify-start" />
                  <SortHeader column="branchName" label="Branş" className="!text-left !justify-start" />
                  <SortHeader column="plannedDays" label="Ameliyat Günü" />
                  <SortHeader column="performedABC" label="ABC Ameliyat" />
                  <SortHeader column="efficiency" label="Verimlilik" />
                  <SortHeader column="branchAvg" label="Branş Ort." />
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">
                    <RoleGroupTooltip
                      roleGroup={currentRoleGroup}
                      hospitals={sameGroupHospitals}
                      loadedCount={roleGroupHospitalCount}
                    />
                  </th>
                  <SortHeader column="status" label="Durum" />
                </tr>
              </thead>
              <tbody>
                {sortedDoctors.map((doc, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors border-b border-[var(--border-1)]/50 ${
                      doc.status === 'low'
                        ? (idx % 2 === 0 ? 'bg-red-500/10 hover:bg-red-500/18' : 'bg-red-500/[0.04] hover:bg-red-500/12')
                        : doc.status === 'high'
                        ? (idx % 2 === 0 ? 'bg-emerald-500/10 hover:bg-emerald-500/18' : 'bg-emerald-500/[0.04] hover:bg-emerald-500/12')
                        : idx % 2 === 0 ? 'bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)]/60' : 'hover:bg-[var(--surface-2)]/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-[13px] font-semibold text-[var(--text-1)] whitespace-nowrap">{doc.doctorName}</td>
                    <td className="px-4 py-3 text-[12px] font-medium text-[var(--text-muted)] whitespace-nowrap">{doc.branchName}</td>
                    <td className="px-4 py-3 text-[14px] font-bold text-center text-[var(--text-1)]">{doc.plannedDays}</td>
                    <td className="px-4 py-3 text-[14px] font-bold text-center text-[var(--text-1)]">{doc.performedABC}</td>
                    <td className={`px-4 py-3 text-[14px] font-black text-center ${
                      doc.status === 'low' ? 'text-red-400' : doc.status === 'high' ? 'text-emerald-400' : 'text-[var(--text-1)]'
                    }`}>
                      {formatNum(doc.efficiency)}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-center text-[var(--text-muted)]">
                      {formatNum(doc.branchAvg)}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-center text-indigo-400">
                      {doc.roleGroupBranchAvg !== null ? formatNum(doc.roleGroupBranchAvg) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[70px] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                        doc.status === 'low'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : doc.status === 'high'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-1)]'
                      }`}>
                        {doc.status === 'low' ? 'DÜŞÜK' : doc.status === 'high' ? 'YÜKSEK' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Oneri Tablosu */}
      {isPeriodSelected && proposals.length > 0 && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-10 rounded-[24px] shadow-lg border border-[var(--glass-border)] space-y-6">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h3 className="text-xl font-black text-[var(--text-1)] uppercase">
                Cetvel Değişiklik Önerileri
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                Verimlilik eşiği altındaki hekimler - Ameliyat günlerinin azaltılması önerilir
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-[11px] font-black text-amber-400 uppercase">
                  Toplam: {totalReduction} gün azaltım → ~{totalCapacityGain} kapasite kazanımı
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)]/60 border-b-2 border-[var(--border-1)]">
                  <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider">Hekim</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider">Branş</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Mevcut Gün</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Önerilen Gün</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Azaltım</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Verimlilik</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Hedef Ort.</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider">Kapasite Kazanımı</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p, idx) => (
                  <tr key={idx} className={`transition-colors border-b border-[var(--border-1)]/50 ${
                    idx % 2 === 0 ? 'bg-red-500/[0.12] hover:bg-red-500/[0.18]' : 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                  }`}>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[var(--text-1)] whitespace-nowrap">{p.doctorName}</td>
                    <td className="px-4 py-3 text-[12px] font-medium text-[var(--text-muted)] whitespace-nowrap">{p.branchName}</td>
                    <td className="px-4 py-3 text-[14px] font-bold text-center text-[var(--text-1)]">{p.currentDays}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-lg text-[14px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {p.proposedDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-lg text-[13px] font-black bg-red-500/15 text-red-400 border border-red-500/25">
                        -{p.reduction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-center text-red-400">{formatNum(p.efficiency)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-center text-indigo-400">{formatNum(p.targetEfficiency)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 rounded-lg text-[13px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        +{p.estimatedCapacityGain}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Rol Grubu Tooltip component
const RoleGroupTooltip: React.FC<{
  roleGroup: string | null;
  hospitals: string[];
  loadedCount: number;
}> = ({ roleGroup, hospitals, loadedCount }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="relative cursor-help inline-flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span>Rol Gr. Branş Ort.</span>
      {roleGroup && (
        <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/20 px-1 rounded">
          {roleGroup}
        </span>
      )}
      {showTooltip && roleGroup && hospitals.length > 0 && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[220px]">
          <div className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-xl shadow-2xl p-4 space-y-2">
            <div className="text-[10px] font-black text-indigo-400 uppercase border-b border-[var(--border-1)] pb-2">
              Rol Grubu {roleGroup} Hastaneleri ({loadedCount}/{hospitals.length} yüklü)
            </div>
            <div className="space-y-1">
              {hospitals.map((h, i) => (
                <div key={i} className="text-[10px] text-[var(--text-1)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

// KPI Card component
const KpiCard: React.FC<{
  title: string;
  value: string | number | null;
  accent: string;
  isEmpty: boolean;
  subtitle?: string;
}> = ({ title, value, accent, isEmpty, subtitle }) => {
  const accentColors: Record<string, string> = {
    capacity: 'from-indigo-500 to-blue-600',
    visits: 'from-emerald-500 to-teal-600',
    ratio: 'from-violet-500 to-purple-600',
    surgeryDay: 'from-amber-500 to-orange-600',
    surgeryCount: 'from-rose-500 to-pink-600',
  };
  const gradient = accentColors[accent] || accentColors.capacity;

  return (
    <div className="relative overflow-hidden bg-[var(--glass-bg)] backdrop-blur-xl rounded-[20px] p-6 border border-[var(--glass-border)] shadow-lg group hover:shadow-xl transition-all duration-300">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">{title}</p>
      {isEmpty ? (
        <div className="text-2xl font-black text-[var(--text-muted)] opacity-30">&mdash;</div>
      ) : (
        <>
          <div className="text-2xl font-black text-[var(--text-1)]">
            {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
          </div>
          {subtitle && <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1 uppercase">{subtitle}</p>}
        </>
      )}
    </div>
  );
};

export default AICetvelPlanlama;
