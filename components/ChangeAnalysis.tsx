
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import {
  DetailedScheduleData,
  ScheduleVersion,
  ProcessedPhysicianSummary,
  SessionActionStats
} from '../types';
import { MONTHS, YEARS } from '../constants';
import { saveVersionAsJson, loadAllChangeAnalysisVersions, loadSingleVersionData, saveExcelFileToStorage } from '../src/services/changeAnalysisStorage';
import { auth } from '../firebase';
import DataFilterPanel from './common/DataFilterPanel';

interface ChangeAnalysisProps {
  versions: Record<string, Record<string, ScheduleVersion>>;
  setVersions: React.Dispatch<React.SetStateAction<Record<string, Record<string, ScheduleVersion>>>>;
  selectedBranch: string | null;
  // Hospital filters
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
  // Global month/year filters
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  // Global cetvel label filters
  baselineLabel: string;
  setBaselineLabel: (label: string) => void;
  updatedLabel: string;
  setUpdatedLabel: (label: string) => void;
  // Admin check
  isAdmin: boolean;
  // Loaded full versions (global state - persists across module changes)
  loadedFullVersions: Record<string, ScheduleVersion>;
  setLoadedFullVersions: React.Dispatch<React.SetStateAction<Record<string, ScheduleVersion>>>;
  // Callback to send phys_compare data to parent (App.tsx)
  onPhysCompareUpdate?: (physCompare: any[]) => void;
}

const ChangeAnalysis: React.FC<ChangeAnalysisProps> = ({
  versions,
  setVersions,
  selectedBranch,
  selectedHospital,
  allowedHospitals,
  onHospitalChange,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  baselineLabel,
  setBaselineLabel,
  updatedLabel,
  setUpdatedLabel,
  isAdmin,
  loadedFullVersions,
  setLoadedFullVersions,
  onPhysCompareUpdate
}) => {
  // versions ve loadedFullVersions artık App.tsx'ten geliyor - modül değişiminde korunur

  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Calculate monthKey before any useEffect that needs it
  const monthKey = selectedHospital && selectedYear && selectedMonth
    ? `${selectedHospital}-${selectedYear}-${selectedMonth}`
    : '';

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // NOT: Hastane değişiminde label'ları temizleme kaldırıldı
  // Artık global state kullanıyoruz, modül değişimlerinde veriler korunacak

  // Load full version data when baseline or updated labels change
  useEffect(() => {
    const loadFullData = async () => {
      if (!monthKey) return;

      const toLoad: string[] = [];
      if (baselineLabel && !loadedFullVersions[baselineLabel]) toLoad.push(baselineLabel);
      if (updatedLabel && !loadedFullVersions[updatedLabel]) toLoad.push(updatedLabel);

      if (toLoad.length === 0) return;

      setIsProcessing(true);
      for (const label of toLoad) {
        const metadata = versions[monthKey]?.[label];
        if (metadata && (metadata as any).fileUrl) {
          const fullData = await loadSingleVersionData((metadata as any).fileUrl);
          if (fullData) {
            console.log(`✅ ${label} tam verisi yüklendi:`, {
              physicianCount: Object.keys(fullData.physicians || {}).length,
              physicians: fullData.physicians
            });
            setLoadedFullVersions(prev => ({ ...prev, [label]: fullData }));
          }
        }
      }
      setIsProcessing(false);
    };

    loadFullData();
  }, [baselineLabel, updatedLabel, monthKey, versions]);

  // Load data for selected period
  const handleLoadPeriodData = async () => {
    if (!selectedHospital || !selectedMonth || selectedYear === 0) {
      showToast('Lütfen hastane, yıl ve ay seçin', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast('Veriler yükleniyor...', 'success');

    try {
      const loadedVersions = await loadAllChangeAnalysisVersions(selectedHospital, selectedMonth, selectedYear);
      const monthKey = `${selectedHospital}-${selectedYear}-${selectedMonth}`;

      if (loadedVersions[monthKey] && Object.keys(loadedVersions[monthKey]).length > 0) {
        setVersions(prev => ({
          ...prev,
          [monthKey]: loadedVersions[monthKey]
        }));

        // Otomatik olarak İLK CETVEL ve SON CETVEL'i seç
        const versionLabels = Object.keys(loadedVersions[monthKey]);
        const findLabelByKeyword = (keyword: string) =>
          versionLabels.find(l => l.toLocaleUpperCase('tr-TR').includes(keyword));

        // İLK CETVEL'i eski sürüm olarak seç
        const ilkCetvel = findLabelByKeyword('İLK') || findLabelByKeyword('ILK');
        if (ilkCetvel) {
          setBaselineLabel(ilkCetvel);
        }

        // SON CETVEL'i yeni sürüm olarak seç
        const sonCetvel = findLabelByKeyword('SON');
        if (sonCetvel) {
          setUpdatedLabel(sonCetvel);
        }

        const autoSelectedCount = (ilkCetvel ? 1 : 0) + (sonCetvel ? 1 : 0);
        showToast(`${Object.keys(loadedVersions[monthKey]).length} versiyon yüklendi${autoSelectedCount > 0 ? `, ${autoSelectedCount} sürüm otomatik seçildi` : ''}`, 'success');
      } else {
        showToast('Bu dönem için kayıtlı versiyon bulunamadı', 'warning');
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      showToast('Veri yükleme hatası', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cetvel silme fonksiyonu
  const handleDeleteVersion = (versionLabel: string) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(`"${versionLabel}" sürümünü silmek istediğinizden emin misiniz?`);
    if (!confirmDelete) return;

    setVersions(prev => {
      const updated = { ...prev };
      if (updated[monthKey]) {
        const { [versionLabel]: removed, ...rest } = updated[monthKey];
        updated[monthKey] = rest;
      }
      return updated;
    });

    // Silinen sürüm seçiliyse, seçimi temizle
    if (baselineLabel === versionLabel) setBaselineLabel('');
    if (updatedLabel === versionLabel) setUpdatedLabel('');
  };

  const availableVersions = useMemo(() => {
    if (!monthKey) return [];
    const periodVersions = versions[monthKey] || {};
    return Object.keys(periodVersions).sort((a, b) => periodVersions[b].timestamp - periodVersions[a].timestamp);
  }, [versions, monthKey]);

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\.|doç\./g, '');
  };

  const formatPct = (val: number) => {
    const formatted = Math.abs(val).toFixed(1).replace('.', ',');
    return `${val >= 0 ? '+' : '-'}${formatted}%`;
  };

  const toMins = (val: any): number => {
    if (val === null || val === undefined || val === "") return -1;
    if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
    if (typeof val === 'number') return Math.round(val * 1440);
    if (typeof val === 'string') {
      const p = val.trim().split(':');
      if (p.length >= 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
    }
    return -1;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedHospital || !selectedMonth || selectedYear === 0) {
      showToast('Lütfen önce hastane, ay ve yıl seçin', 'warning');
      e.target.value = '';
      return;
    }

    if (!auth.currentUser?.email) {
      showToast('Dosya yüklemek için giriş yapmalısınız', 'error');
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    showToast('Excel dosyası işleniyor...', 'success');

    try {
      // Parse Excel file to JSON
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Import and use parser
      const { parseExcelToScheduleVersion } = await import('../src/services/excelParser');
      const versionData = parseExcelToScheduleVersion(workbook, file.name);

      // Save as JSON to Storage
      showToast('JSON verisi kaydediliyor...', 'success');
      const saveResult = await saveVersionAsJson(
        versionData,
        selectedHospital,
        selectedMonth,
        selectedYear,
        auth.currentUser!.email
      );

      if (!saveResult.success) {
        showToast(`❌ Yükleme hatası: ${saveResult.error}`, 'error');
        setIsProcessing(false);
        e.target.value = "";
        return;
      }

      // Store only metadata in state - no parsing, no large objects
      const metadata: ScheduleVersion = {
        label: versionData.label,
        timestamp: Date.now(),
        physicianSummaries: [], // Empty - will be loaded on demand when comparing
        rawScheduleData: [], // Empty - will be loaded on demand when comparing
        fileUrl: saveResult.fileUrl // Store URL for lazy loading
      } as any;

      setVersions(prev => ({ ...prev, [monthKey]: { ...(prev[monthKey] || {}), [versionData.label]: metadata } }));
      if (!baselineLabel) setBaselineLabel(versionData.label);
      else setUpdatedLabel(versionData.label);

      showToast(`✅ "${versionData.label}" başarıyla kaydedildi`, 'success');

    } catch (err) {
      console.error(err);
      showToast('Dosya işleme hatası', 'error');
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const comparison = useMemo(() => {
    // Use loaded full versions instead of metadata
    const base = loadedFullVersions[baselineLabel];
    const upd = loadedFullVersions[updatedLabel];
    if (!base || !upd) return null;

    const allDocKeys = Array.from(new Set([...Object.keys(base.physicians), ...Object.keys(upd.physicians)]));

    const processedDocs = allDocKeys.map(key => {
      const bPhys = base.physicians[key];
      const uPhys = upd.physicians[key];

      const name = uPhys?.name || bPhys?.name || uPhys?.physicianName || bPhys?.physicianName || "Bilinmiyor";
      const branch = uPhys?.branch || bPhys?.branch || "Bilinmiyor";

      const baseline_capacity: number = bPhys?.totalCapacity || 0;
      const updated_capacity: number = uPhys?.totalCapacity || 0;
      const capacity_delta: number = updated_capacity - baseline_capacity;

      const baseline_action_days = bPhys?.actionDays || bPhys?.sessionsByAction || {};
      const updated_action_days = uPhys?.actionDays || uPhys?.sessionsByAction || {};
      const all_actions = Array.from(new Set([...Object.keys(baseline_action_days), ...Object.keys(updated_action_days)]));

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

    const isBranchFilterActive = selectedBranch && selectedBranch.trim() !== "" && normalizeStr(selectedBranch) !== normalizeStr("Tüm Branşlar");
    const filteredDocs = isBranchFilterActive 
      ? processedDocs.filter(d => normalizeStr(d.branch) === normalizeStr(selectedBranch))
      : processedDocs;

    const branchAgg: Record<string, { baseline: number, updated: number }> = {};
    filteredDocs.forEach(d => {
       if (!branchAgg[d.branch]) branchAgg[d.branch] = { baseline: 0, updated: 0 };
       branchAgg[d.branch].baseline += d.baseline_capacity;
       branchAgg[d.branch].updated += d.updated_capacity;
    });

    const allBranchChanges = Object.entries(branchAgg).map(([name, caps]) => {
      const delta = caps.updated - caps.baseline;
      const pct = caps.baseline > 0 ? (delta / caps.baseline) * 100 : (caps.updated > 0 ? 100 : 0);
      return { name, delta, pct };
    });
    // Önce düşüşler (en büyük kayıptan), sonra artışlar (en büyükten)
    const branchDecreases = allBranchChanges.filter(b => b.delta < -0.1).sort((a, b) => a.delta - b.delta);
    const branchIncreases = allBranchChanges.filter(b => b.delta > 0.1).sort((a, b) => b.delta - a.delta);
    const topBranchChanges = [...branchDecreases, ...branchIncreases].slice(0, 5);

    // Önce düşüşler, 5'e tamamlanmazsa artışlar
    const docDecreases = filteredDocs
      .filter(p => p.capacity_delta < -0.1)
      .map(p => ({ name: p.name, branch: p.branch, delta: p.capacity_delta, pct: p.baseline_capacity > 0 ? (p.capacity_delta / p.baseline_capacity) * 100 : -100 }))
      .sort((a, b) => a.delta - b.delta);
    const docIncreases = filteredDocs
      .filter(p => p.capacity_delta > 0.1)
      .map(p => ({ name: p.name, branch: p.branch, delta: p.capacity_delta, pct: p.baseline_capacity > 0 ? (p.capacity_delta / p.baseline_capacity) * 100 : 100 }))
      .sort((a, b) => b.delta - a.delta);
    const topDoctorDrivers = [...docDecreases, ...docIncreases].slice(0, 5);

    // Sıralama: önce düşüşler (en büyük kayıp), sonra artışlar (en büyük artış), sonra değişmeyenler
    const physCompareRaw = filteredDocs.filter(d => Math.abs(d.capacity_delta) > 0.1 || d.has_action_change);
    const physDecreases = physCompareRaw.filter(d => d.capacity_delta < -0.1).sort((a, b) => a.capacity_delta - b.capacity_delta);
    const physIncreases = physCompareRaw.filter(d => d.capacity_delta > 0.1).sort((a, b) => b.capacity_delta - a.capacity_delta);
    const physNoChange = physCompareRaw.filter(d => Math.abs(d.capacity_delta) <= 0.1);

    // Cast the return object to 'any' to resolve inference issues in downstream useMemos and JSX.
    return {
      phys_compare: [...physDecreases, ...physIncreases, ...physNoChange],
      topBranchChanges, topDoctorDrivers,
      totalBaseCap: filteredDocs.reduce((s: number, p) => s + p.baseline_capacity, 0),
      totalUpdCap: filteredDocs.reduce((s: number, p) => s + p.updated_capacity, 0),
    } as any;
  }, [loadedFullVersions, baselineLabel, updatedLabel, selectedBranch]);

  // phys_compare verisi değiştiğinde parent'a bildir (EfficiencyAnalysis'te kullanılacak)
  useEffect(() => {
    if (onPhysCompareUpdate && comparison?.phys_compare) {
      onPhysCompareUpdate(comparison.phys_compare);
    }
  }, [comparison?.phys_compare, onPhysCompareUpdate]);

  // Fix: Added explicit casting and Number() conversion for arithmetic reliability.
  const maxAbsBranchDelta = useMemo(() => {
    if (!comparison || !comparison.topBranchChanges.length) return 1;
    const deltas = comparison.topBranchChanges.map((b: any) => Math.abs(Number(b.delta)));
    return Math.max(...(deltas as number[]));
  }, [comparison]);

  // Fix: Added explicit casting and Number() conversion for arithmetic reliability.
  const maxAbsDoctorDelta = useMemo(() => {
    if (!comparison || !comparison.topDoctorDrivers.length) return 1;
    const deltas = comparison.topDoctorDrivers.map((d: any) => Math.abs(Number(d.delta)));
    return Math.max(...(deltas as number[]));
  }, [comparison]);

  // ========== POWERPOINT EXPORT ==========
  const handleExportPowerPoint = async () => {
    if (!comparison) return;
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = 'Degisim Analizi Raporu';
      pptx.author = 'MEDIS';
      pptx.company = 'Sanliurfa Il Saglik Mudurlugu';

      const c = {
        bg: 'f8fafc',
        primary: '4f46e5',   // indigo-600
        primaryLight: 'eef2ff', // indigo-50
        text: '1e293b',
        textMuted: '94a3b8',
        success: '10b981',
        danger: 'ef4444',
        border: 'e2e8f0',
        white: 'ffffff',
        dark: '0f172a',
        headerBg: '1e293b',
      };

      const totalDelta = Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap);
      const deltaColor = totalDelta >= 0 ? c.success : c.danger;
      const deltaSign = totalDelta > 0 ? '+' : '';
      const pctChange = comparison.totalBaseCap > 0 ? ((totalDelta / Number(comparison.totalBaseCap)) * 100).toFixed(1) : '0';

      // ===== SLAYT 1: KAPAK =====
      const s1 = pptx.addSlide();
      s1.background = { color: c.dark };

      // Sag ust dekoratif ince serit
      s1.addShape(pptx.shapes.RECTANGLE, { x: 8, y: 0, w: 5.33, h: 0.15, fill: { color: c.primary } });
      // Orta dekoratif cizgi
      s1.addShape(pptx.shapes.RECTANGLE, { x: 1, y: 3.6, w: 4, h: 0.06, fill: { color: c.primary } });

      // Ust etiket
      s1.addText('MHRS', { x: 1, y: 1.2, w: 11, h: 0.6, fontSize: 16, fontFace: 'Arial', bold: true, color: c.primary, letterSpacing: 8 });

      // Ana baslik
      s1.addText('KAPASiTE DEGiSiM', { x: 1, y: 1.9, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });
      s1.addText('ANALiZi RAPORU', { x: 1, y: 2.7, w: 11, h: 0.9, fontSize: 40, fontFace: 'Arial', bold: true, color: c.white });

      // Hastane ve donem bilgisi
      s1.addText(`${selectedHospital}`, { x: 1, y: 3.9, w: 11, h: 0.5, fontSize: 18, fontFace: 'Arial', color: c.textMuted });
      s1.addText(`${selectedMonth} ${selectedYear}`, { x: 1, y: 4.4, w: 11, h: 0.4, fontSize: 14, fontFace: 'Arial', color: '64748b' });

      // ===== SLAYT 2: ÖZET DASHBOARD =====
      const s2 = pptx.addSlide();
      s2.background = { color: c.bg };
      s2.addText('ÖZET DASHBOARD', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, fontFace: 'Arial', bold: true, color: c.text });
      s2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.8, w: 2, h: 0.04, fill: { color: c.primary } });

      // KPI kutuları
      const kpiY = 1.5;
      const kpiH = 2.5;
      const kpiW = 3.8;

      // Başlangıç Kapasitesi
      s2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: kpiY, w: kpiW, h: kpiH, fill: { color: c.white }, line: { color: c.border, pt: 1 } });
      s2.addText('BASLANGIÇ KAPASITESI', { x: 0.5, y: kpiY + 0.4, w: kpiW, h: 0.4, fontSize: 9, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'center' });
      s2.addText(Number(comparison.totalBaseCap).toLocaleString('tr-TR'), { x: 0.5, y: kpiY + 0.9, w: kpiW, h: 0.8, fontSize: 36, fontFace: 'Arial', bold: true, color: c.text, align: 'center' });

      // Net Fark
      s2.addShape(pptx.shapes.RECTANGLE, { x: 4.8, y: kpiY, w: kpiW, h: kpiH, fill: { color: c.white }, line: { color: c.border, pt: 1 } });
      s2.addText('NET FARK', { x: 4.8, y: kpiY + 0.4, w: kpiW, h: 0.4, fontSize: 9, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'center' });
      s2.addText(`${deltaSign}${totalDelta.toLocaleString('tr-TR')}`, { x: 4.8, y: kpiY + 0.9, w: kpiW, h: 0.8, fontSize: 36, fontFace: 'Arial', bold: true, color: deltaColor, align: 'center' });
      s2.addText(`%${pctChange}`, { x: 4.8, y: kpiY + 1.7, w: kpiW, h: 0.4, fontSize: 14, fontFace: 'Arial', bold: true, color: deltaColor, align: 'center' });

      // Güncel Kapasite
      s2.addShape(pptx.shapes.RECTANGLE, { x: 9.1, y: kpiY, w: kpiW, h: kpiH, fill: { color: c.white }, line: { color: c.border, pt: 1 } });
      s2.addText('GUNCEL KAPASITE', { x: 9.1, y: kpiY + 0.4, w: kpiW, h: 0.4, fontSize: 9, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'center' });
      s2.addText(Number(comparison.totalUpdCap).toLocaleString('tr-TR'), { x: 9.1, y: kpiY + 0.9, w: kpiW, h: 0.8, fontSize: 36, fontFace: 'Arial', bold: true, color: c.text, align: 'center' });

      // Hekim değişim sayısı
      s2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 4.5, w: 12.33, h: 1.2, fill: { color: c.primaryLight }, line: { color: c.border, pt: 1 } });
      s2.addText([
        { text: `${comparison.phys_compare.length}`, options: { fontSize: 24, bold: true, color: c.primary, fontFace: 'Arial' } },
        { text: ' hekimde değişim tespit edildi', options: { fontSize: 14, color: c.text, fontFace: 'Arial' } },
      ], { x: 0.5, y: 4.5, w: 12.33, h: 1.2, align: 'center', valign: 'middle' });

      // ===== SLAYT 3: BRANŞ BAZLI DEĞİŞİM =====
      const s3 = pptx.addSlide();
      s3.background = { color: c.bg };
      s3.addText('BRANŞ BAZLI KAPASİTE DEĞİŞİMİ', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, fontFace: 'Arial', bold: true, color: c.text });
      s3.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.8, w: 2, h: 0.04, fill: { color: c.primary } });
      s3.addText('TOP 5', { x: 10.5, y: 0.3, w: 2.5, h: 0.5, fontSize: 10, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });

      const branchHeader: pptxgen.TableRow = [
        { text: '#', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
        { text: 'BRANŞ', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
        { text: 'FARK', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
        { text: 'YÜZDE', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
      ];
      const branchRows: pptxgen.TableRow[] = comparison.topBranchChanges.map((br: any, idx: number) => {
        const rowBg = idx % 2 === 0 ? c.white : c.bg;
        const dColor = br.delta >= 0 ? c.success : c.danger;
        return [
          { text: `${idx + 1}`, options: { fontSize: 11, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
          { text: br.name, options: { fontSize: 11, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
          { text: `${br.delta > 0 ? '+' : ''}${br.delta.toLocaleString('tr-TR')}`, options: { fontSize: 11, bold: true, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: dColor } },
          { text: `%${br.pct.toFixed(1)}`, options: { fontSize: 11, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: dColor } },
        ];
      });
      s3.addTable([branchHeader, ...branchRows], { x: 0.5, y: 1.2, w: 12.33, colW: [0.6, 7.13, 2.3, 2.3], border: { type: 'solid', pt: 0.5, color: c.border }, rowH: 0.55 });

      // ===== SLAYT 4: HEKİM DRIVERLARI =====
      const s4 = pptx.addSlide();
      s4.background = { color: c.bg };
      s4.addText('EN BÜYÜK HEKİM DRIVERLARI', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, fontFace: 'Arial', bold: true, color: c.text });
      s4.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.8, w: 2, h: 0.04, fill: { color: c.danger } });
      s4.addText('TOP 5', { x: 9, y: 0.3, w: 4, h: 0.5, fontSize: 10, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });

      const driverHeader: pptxgen.TableRow = [
        { text: '#', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
        { text: 'HEKİM', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
        { text: 'BRANŞ', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
        { text: 'FARK', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
        { text: 'YÜZDE', options: { bold: true, fontSize: 10, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
      ];
      const driverRows: pptxgen.TableRow[] = comparison.topDoctorDrivers.map((doc: any, idx: number) => {
        const rowBg = idx % 2 === 0 ? c.white : c.bg;
        return [
          { text: `${idx + 1}`, options: { fontSize: 11, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
          { text: doc.name, options: { fontSize: 11, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
          { text: doc.branch, options: { fontSize: 10, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
          { text: `${doc.delta.toLocaleString('tr-TR')}`, options: { fontSize: 11, bold: true, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.danger } },
          { text: `%${doc.pct.toFixed(1)}`, options: { fontSize: 11, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.danger } },
        ];
      });
      s4.addTable([driverHeader, ...driverRows], { x: 0.5, y: 1.2, w: 12.33, colW: [0.6, 4, 3.73, 2, 2], border: { type: 'solid', pt: 0.5, color: c.border }, rowH: 0.55 });

      // ===== SLAYT 5+: HEKİM BAZLI DEĞİŞİM DETAYLARI =====
      const physData = comparison.phys_compare as any[];
      const perPage = 14;
      const pageCount = Math.ceil(physData.length / perPage);

      for (let page = 0; page < pageCount; page++) {
        const sN = pptx.addSlide();
        sN.background = { color: c.bg };
        sN.addText('HEKİM BAZLI DEĞİŞİM DETAYLARI', { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 18, fontFace: 'Arial', bold: true, color: c.text });
        sN.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 0.65, w: 2, h: 0.04, fill: { color: c.primary } });
        if (pageCount > 1) {
          sN.addText(`Sayfa ${page + 1}/${pageCount}`, { x: 10, y: 0.2, w: 2.8, h: 0.45, fontSize: 10, fontFace: 'Arial', bold: true, color: c.textMuted, align: 'right' });
        }

        const detailHeader: pptxgen.TableRow = [
          { text: 'HEKİM', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
          { text: 'BRANŞ', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
          { text: 'ESKİ KAP', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
          { text: 'YENİ KAP', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
          { text: 'FARK', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, align: 'center', fontFace: 'Arial' } },
          { text: 'AKSİYON DEĞİŞİMLERİ', options: { bold: true, fontSize: 9, color: c.white, fill: { color: c.headerBg }, fontFace: 'Arial' } },
        ];

        const slice = physData.slice(page * perPage, (page + 1) * perPage);
        const detailRows: pptxgen.TableRow[] = slice.map((p: any, idx: number) => {
          const rowBg = idx % 2 === 0 ? c.white : c.bg;
          const dColor = p.capacity_delta >= 0 ? c.success : c.danger;
          const actionText = p.has_action_change
            ? Object.entries(p.action_deltas).map(([act, d]) => `${act} ${Number(d) > 0 ? '+' : ''}${String(d).replace('.', ',')}`).join(', ')
            : 'Değişmedi';
          return [
            { text: p.name, options: { fontSize: 9, bold: true, fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: p.branch, options: { fontSize: 8, fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
            { text: p.baseline_capacity.toLocaleString('tr-TR'), options: { fontSize: 9, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.textMuted } },
            { text: p.updated_capacity.toLocaleString('tr-TR'), options: { fontSize: 9, bold: true, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: c.text } },
            { text: `${p.capacity_delta > 0 ? '+' : ''}${p.capacity_delta.toLocaleString('tr-TR')}`, options: { fontSize: 9, bold: true, align: 'center', fill: { color: rowBg }, fontFace: 'Arial', color: dColor } },
            { text: actionText, options: { fontSize: 8, fill: { color: rowBg }, fontFace: 'Arial', color: p.has_action_change ? c.text : c.textMuted } },
          ];
        });
        sN.addTable([detailHeader, ...detailRows], { x: 0.3, y: 0.9, w: 12.73, colW: [2.5, 2.5, 1.2, 1.2, 1.2, 4.13], border: { type: 'solid', pt: 0.5, color: c.border }, rowH: 0.4 });
      }

      const safeHospital = selectedHospital.replace(/[^a-zA-Z0-9]/g, '_');
      const safeMonth = selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Degisim_Analizi_${safeHospital}_${safeMonth}_${selectedYear}.pptx`;
      await pptx.writeFile({ fileName });
      showToast('PowerPoint sunumu indirildi', 'success');
    } catch (err) {
      console.error('PPTX export hatası:', err);
      showToast('Sunum oluşturulurken hata oluştu', 'error');
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {toast && (
        <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-right-10 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Veri Filtreleme */}
      <DataFilterPanel
        title="Veri Filtreleme"
        showHospitalFilter={true}
        selectedHospital={selectedHospital}
        availableHospitals={allowedHospitals}
        onHospitalChange={onHospitalChange}
        showYearFilter={true}
        selectedYears={selectedYear > 0 ? [selectedYear] : []}
        availableYears={YEARS}
        onYearsChange={(years) => setSelectedYear(years.length > 0 ? years[0] as number : 0)}
        showMonthFilter={true}
        selectedMonths={selectedMonth ? [MONTHS.indexOf(selectedMonth) + 1] : []}
        onMonthsChange={(months) => setSelectedMonth(months.length > 0 ? MONTHS[(months[0] as number) - 1] : '')}
        showApplyButton={true}
        onApply={handleLoadPeriodData}
        isLoading={isProcessing}
        applyDisabled={!selectedHospital || selectedYear === 0 || !selectedMonth}
        customFilters={
          <>
            {/* Eski Sürüm */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-3)]">Eski Sürüm</label>
              <div className="flex gap-1">
                <select value={baselineLabel} onChange={(e) => setBaselineLabel(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-1)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 min-w-[150px] h-[38px]">
                  <option value="" className="bg-[var(--surface-1)]">Eski Sürüm Seçiniz</option>
                  {availableVersions.map(v => <option key={v} value={v} className="bg-[var(--surface-1)]">{v}</option>)}
                </select>
                {isAdmin && baselineLabel && (
                  <button onClick={() => handleDeleteVersion(baselineLabel)} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-all border border-rose-500/30" title="Sürümü Sil">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Yeni Sürüm */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-rose-400">Yeni Sürüm</label>
              <div className="flex gap-1">
                <select value={updatedLabel} onChange={(e) => setUpdatedLabel(e.target.value)} className="px-3 py-2 rounded-lg border border-rose-500/30 bg-[var(--input-bg)] text-rose-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 min-w-[150px] h-[38px]">
                  <option value="" className="bg-[var(--surface-1)] text-[var(--text-1)]">Yeni Sürüm Seçiniz</option>
                  {availableVersions.map(v => <option key={v} value={v} className="bg-[var(--surface-1)] text-[var(--text-1)]">{v}</option>)}
                </select>
                {isAdmin && updatedLabel && (
                  <button onClick={() => handleDeleteVersion(updatedLabel)} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-all border border-rose-500/30" title="Sürümü Sil">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Sürüm Yükleme Butonları */}
            {isAdmin && (
              <>
                <label htmlFor="oldVersionUpload" className="bg-slate-700 text-white px-3 py-2 h-[38px] rounded-lg font-semibold text-xs shadow-sm cursor-pointer hover:bg-slate-800 active:scale-95 flex items-center gap-2 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  Eski Yükle
                </label>
                <input id="oldVersionUpload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} disabled={isProcessing} />

                <label htmlFor="newVersionUpload" className="bg-indigo-600 text-white px-3 py-2 h-[38px] rounded-lg font-semibold text-xs shadow-sm cursor-pointer hover:bg-indigo-700 active:scale-95 flex items-center gap-2 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  Yeni Yükle
                </label>
                <input id="newVersionUpload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} disabled={isProcessing} />
              </>
            )}
            {comparison && (
              <button onClick={handleExportPowerPoint} className="bg-amber-600 text-white px-3 py-2 h-[38px] rounded-lg font-semibold text-xs shadow-sm cursor-pointer hover:bg-amber-700 active:scale-95 flex items-center gap-2 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Sunumu İndir
              </button>
            )}
          </>
        }
      />

      {isProcessing && (
        <div className="p-32 text-center bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] border border-dashed border-indigo-500/30 animate-in fade-in zoom-in-95">
           <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
           <p className="font-black text-xl text-[var(--text-1)] uppercase tracking-tighter">Excel Verisi Analiz Ediliyor...</p>
        </div>
      )}

      {comparison && !isProcessing && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          {/* Dashboard Summary Bar */}
          <div className="bg-slate-900 text-white p-12 rounded-[56px] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-10 border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
            <div className="text-center md:text-left relative z-10">
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4">BAŞLANGIÇ TOPLAMI ({baselineLabel})</p>
              <h3 className="text-5xl font-black tracking-tighter">{Number(comparison.totalBaseCap).toLocaleString('tr-TR')}</h3>
            </div>
            <div className="text-center relative z-10">
              {/* Fix: Ensured number type for subtraction using Number() for robustness. */}
              <div className={`px-10 py-6 rounded-[32px] border-2 ${(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)) >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">NET FARK</p>
                <h3 className="text-5xl font-black tracking-tighter">
                  {(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)) > 0 ? '+' : ''}{(Number(comparison.totalUpdCap) - Number(comparison.totalBaseCap)).toLocaleString('tr-TR')}
                </h3>
              </div>
            </div>
            <div className="text-center md:text-right relative z-10">
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4">GÜNCEL TOPLAM ({updatedLabel})</p>
              <h3 className="text-5xl font-black tracking-tighter">{Number(comparison.totalUpdCap).toLocaleString('tr-TR')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-[24px] border border-[var(--glass-border)] shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  BRANŞ BAZLI KAPASİTE DEĞİŞİMİ
                </h3>
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">TOP 5</span>
              </div>
              <div className="space-y-2.5">
                {comparison.topBranchChanges.map((br: any, idx: number) => (
                  <div key={br.name} className="bg-[var(--surface-2)] border border-[var(--border-1)] rounded-2xl p-3.5 flex flex-col gap-2 hover:bg-[var(--surface-hover)] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-bold uppercase text-[var(--text-1)] leading-tight break-words">{br.name}</p></div>
                      <div className="text-right shrink-0">
                        <p className={`text-[12px] font-black leading-none ${br.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{br.delta > 0 ? '+' : ''}{br.delta.toLocaleString('tr-TR')}</p>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase leading-none">{formatPct(br.pct)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--surface-3)] h-1 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${br.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(Math.abs(br.delta) / maxAbsBranchDelta) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-[24px] border border-[var(--glass-border)] shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-[var(--text-1)] uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
                  EN BÜYÜK HEKİM DRIVERLARI
                </h3>
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">TOP 5</span>
              </div>
              <div className="space-y-2.5">
                {comparison.topDoctorDrivers.map((doc: any, idx: number) => (
                  <div key={idx} className="bg-[var(--surface-2)] border border-[var(--border-1)] rounded-2xl p-3.5 flex flex-col gap-2 hover:bg-[var(--surface-hover)] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-0">
                        <p className="text-[11px] font-bold uppercase text-[var(--text-1)] leading-tight truncate">{doc.name}</p>
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter mt-0.5 truncate">{doc.branch}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black text-rose-400 leading-none">{doc.delta.toLocaleString('tr-TR')}</p>
                        <p className="text-[10px] font-bold text-rose-400/70 mt-1 uppercase leading-none">{formatPct(doc.pct)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--surface-3)] h-1 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${(Math.abs(doc.delta) / maxAbsDoctorDelta) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-[24px] shadow-xl border border-[var(--glass-border)] overflow-hidden">
            <div className="p-8 border-b border-[var(--border-1)] flex justify-between items-center bg-[var(--surface-2)]">
               <h4 className="text-xl font-black text-[var(--text-1)] uppercase italic">Hekim Bazlı Değişim Detayları</h4>
               <div className="bg-slate-700 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{comparison.phys_compare.length} HEKİMDE DEĞİŞİM</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--table-header-bg)]">
                  <tr>
                    <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest">Hekim & Branş</th>
                    <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Eski Kap</th>
                    <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Yeni Kap</th>
                    <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Fark</th>
                    <th className="px-10 py-5 text-[11px] font-black text-[var(--text-2)] uppercase tracking-widest">Aksiyon Değişimleri (GÜN)</th>
                    <th className="px-10 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--table-border)]">
                  {comparison.phys_compare.map((p: any) => {
                    const sortedDeltas = Object.entries(p.action_deltas).sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])));
                    const displayedDeltas = sortedDeltas.slice(0, 3);
                    const remainingCount = sortedDeltas.length - 3;

                    return (
                      <React.Fragment key={p.id}>
                        <tr className={`hover:bg-[var(--table-row-hover)] cursor-pointer transition-colors group ${expandedDoc === p.id ? 'bg-indigo-500/10' : ''}`} onClick={() => setExpandedDoc(expandedDoc === p.id ? null : p.id)}>
                          <td className="px-10 py-6">
                            <p className="font-black text-[var(--text-1)] uppercase text-xs tracking-tight">{p.name}</p>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-1 tracking-tighter">{p.branch}</p>
                          </td>
                          <td className="px-10 py-6 text-center text-xs font-bold text-[var(--text-muted)]">{p.baseline_capacity}</td>
                          <td className="px-10 py-6 text-center text-xs font-black text-[var(--text-1)]">{p.updated_capacity}</td>
                          <td className="px-10 py-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full font-black text-[11px] border ${p.capacity_delta >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                              {p.capacity_delta > 0 ? '+' : ''}{p.capacity_delta}
                            </span>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex flex-wrap gap-1.5">
                              {sortedDeltas.length > 0 ? (
                                <>
                                  {displayedDeltas.map(([act, d]) => (
                                    <span key={act} className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${Number(d) > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                                      {act} {Number(d) > 0 ? '+' : ''}{d.toString().replace('.', ',')}
                                    </span>
                                  ))}
                                  {remainingCount > 0 && <span className="text-[9px] font-black text-[var(--text-muted)] px-1 py-0.5">+{remainingCount} daha...</span>}
                                </>
                              ) : <span className="text-[10px] text-[var(--text-muted)] font-bold italic">Aksiyon gün dağılımı değişmedi</span>}
                            </div>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className={`p-2 rounded-full bg-[var(--surface-3)] text-[var(--text-muted)] transition-transform ${expandedDoc === p.id ? 'rotate-180' : ''}`}>
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                             </div>
                          </td>
                        </tr>
                        {expandedDoc === p.id && (
                          <tr className="bg-[var(--surface-2)] animate-in slide-in-from-top-2 duration-300">
                            <td colSpan={6} className="px-12 py-10">
                              <div className="space-y-8">
                                <div className="bg-[var(--surface-1)] p-8 rounded-[24px] border border-[var(--border-1)]">
                                  <h5 className="text-[11px] font-black text-[var(--text-1)] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                    Aksiyon Kıyas Tablosu
                                  </h5>
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b-2 border-[var(--border-1)]">
                                        <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest">Aksiyon</th>
                                        <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Eski Gün</th>
                                        <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Yeni Gün</th>
                                        <th className="py-3 text-[10px] font-black text-[var(--text-2)] uppercase tracking-widest text-center">Fark</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-1)]">
                                      {Array.from(new Set([...Object.keys(p.baseline_action_days), ...Object.keys(p.updated_action_days)])).sort().map(act => {
                                        const oldD = p.baseline_action_days[act] || 0;
                                        const newD = p.updated_action_days[act] || 0;
                                        const diff = newD - oldD;
                                        if (oldD === 0 && newD === 0) return null;
                                        return (
                                          <tr key={act} className={`transition-colors ${diff !== 0 ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-hover)]'}`}>
                                            <td className="py-3 text-[11px] font-bold text-[var(--text-1)] uppercase">{act}</td>
                                            <td className="py-3 text-[11px] font-black text-[var(--text-muted)] text-center">{oldD.toString().replace('.', ',')} G</td>
                                            <td className="py-3 text-[11px] font-black text-[var(--text-1)] text-center">{newD.toString().replace('.', ',')} G</td>
                                            <td className="py-3 text-center">
                                              <span className={`text-[11px] font-black ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toString().replace('.', ',')} G
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">BAŞLANGIÇ OTURUMLARI ({baselineLabel})</p>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar border rounded-2xl">
                                      <table className="w-full text-[10px] text-left">
                                        <thead className="bg-slate-50 sticky top-0"><tr><th className="p-3">TARİH</th><th className="p-3">AKSİYON</th><th className="p-3 text-center">KAP</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {p.bPhys?.rawRows?.map((r: any, rowIdx: number) => <tr key={rowIdx} className="hover:bg-slate-50"><td className="p-3 font-bold">{r.startDate}</td><td className="p-3 uppercase">{r.action}</td><td className="p-3 text-center font-black">{r.capacity}</td></tr>)}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-rose-100">
                                    <p className="text-[10px] font-black text-rose-400 uppercase mb-4 tracking-widest">GÜNCEL OTURUMLAR ({updatedLabel})</p>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar border rounded-2xl">
                                      <table className="w-full text-[10px] text-left">
                                        <thead className="bg-rose-50/50 sticky top-0"><tr><th className="p-3">TARİH</th><th className="p-3">AKSİYON</th><th className="p-3 text-center">KAP</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {p.uPhys?.rawRows?.map((r: any, rowIdx: number) => <tr key={rowIdx} className="hover:bg-rose-50/30"><td className="p-3 font-bold">{r.startDate}</td><td className="p-3 uppercase">{r.action}</td><td className="p-3 text-center font-black">{r.capacity}</td></tr>)}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!comparison && !isProcessing && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-32 rounded-[56px] border-4 border-dashed border-[var(--glass-border)] text-center flex flex-col items-center gap-8 shadow-inner animate-in fade-in duration-1000">
           <div className="w-24 h-24 bg-[var(--surface-2)] rounded-[40px] flex items-center justify-center text-[var(--text-muted)] shadow-inner group">
             <svg className="w-12 h-12 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
           </div>
           <div>
             <h4 className="text-2xl font-black text-[var(--text-2)] uppercase tracking-[0.2em]">KIYASLANACAK VERİ BULUNAMADI</h4>
             <p className="text-[var(--text-muted)] font-medium max-w-md mx-auto mt-3 italic">Lütfen önce hastane, yıl ve ay seçip "Yükle" butonuna tıklayın, ardından eski ve yeni sürüm seçin.</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChangeAnalysis;
