import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { uploadFinansalFile, getFinansalModuleFiles, downloadFinansalFile, deleteFinansalFile } from '../src/services/finansalStorage';

export interface ExcelData {
  headers: string[];
  rows: any[][];
  fileName: string;
}

const resolveMergedCells = (sheet: XLSX.WorkSheet) => {
  if (sheet['!merges']) {
    sheet['!merges'].forEach((merge) => {
      const topLeftCell = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
      if (topLeftCell) {
        for (let r = merge.s.r; r <= merge.e.r; r++) {
          for (let c = merge.s.c; c <= merge.e.c; c++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!sheet[cellRef]) {
              sheet[cellRef] = { ...topLeftCell };
            }
          }
        }
      }
    });
  }
};

// ── Parse fonksiyonları (ArrayBuffer → ExcelData) ──

function parseEk2a(arrayBuffer: ArrayBuffer, fileName: string): ExcelData | null {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  resolveMergedCells(sheet);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
  if (jsonData.length === 0) return null;

  let headerRowIdx = -1, koduColIdx = -1, uzmanlikColIdx = -1;
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim().toUpperCase();
      if (cellVal === 'KODU' || cellVal === 'KOD') koduColIdx = j;
      if (cellVal.includes('UZMANLIK') || cellVal.includes('ANA DALLAR')) uzmanlikColIdx = j;
    }
    if (koduColIdx >= 0 && uzmanlikColIdx >= 0) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; koduColIdx = 0; uzmanlikColIdx = 1; }

  const rows = jsonData.slice(headerRowIdx + 1)
    .filter(row => { const k = String(row[koduColIdx] || '').trim(); return k !== '' && k !== 'ANA DALLAR'; })
    .map(row => [String(row[koduColIdx] || '').trim(), String(row[uzmanlikColIdx] || '').trim()]);

  return { headers: ['KODU', 'UZMANLIK DALLARI'], rows, fileName };
}

function parseEk2a2(arrayBuffer: ArrayBuffer, fileName: string): ExcelData | null {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  resolveMergedCells(sheet);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
  if (jsonData.length === 0) return null;

  let headerRowIdx = -1, islemKoduColIdx = -1, islemAdiColIdx = -1, aciklamaColIdx = -1;
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim().toUpperCase();
      if (cellVal.includes('İŞLEM') && cellVal.includes('KODU')) islemKoduColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('ADI')) islemAdiColIdx = j;
      else if (cellVal.includes('AÇIKLAMA')) aciklamaColIdx = j;
    }
    if (islemKoduColIdx >= 0 && islemAdiColIdx >= 0) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; islemKoduColIdx = 0; islemAdiColIdx = 1; aciklamaColIdx = 2; }

  const hasAciklama = aciklamaColIdx >= 0;
  const headers = hasAciklama ? ['İŞLEM KODU', 'İŞLEM ADI', 'AÇIKLAMA'] : ['İŞLEM KODU', 'İŞLEM ADI'];
  const rows = jsonData.slice(headerRowIdx + 1)
    .filter(row => String(row[islemKoduColIdx] || '').trim() !== '')
    .map(row => {
      const base = [String(row[islemKoduColIdx] || '').trim(), String(row[islemAdiColIdx] || '').trim()];
      if (hasAciklama) base.push(String(row[aciklamaColIdx] || '').trim());
      return base;
    });

  return { headers, rows, fileName };
}

export function parseEk2b(arrayBuffer: ArrayBuffer, fileName: string): ExcelData | null {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  resolveMergedCells(sheet);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
  if (jsonData.length === 0) return null;

  let headerRowIdx = -1, islemKoduColIdx = -1, islemAdiColIdx = -1, aciklamaColIdx = -1, islemPuaniColIdx = -1;
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim().toUpperCase();
      if (cellVal.includes('İŞLEM') && cellVal.includes('KODU')) islemKoduColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('ADI')) islemAdiColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('PUAN')) islemPuaniColIdx = j;
      else if (cellVal.includes('AÇIKLAMA')) aciklamaColIdx = j;
    }
    if (islemKoduColIdx >= 0 && islemAdiColIdx >= 0) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; islemKoduColIdx = 0; islemAdiColIdx = 1; aciklamaColIdx = 2; islemPuaniColIdx = 3; }

  const rows = jsonData.slice(headerRowIdx + 1)
    .filter(row => {
      const kodu = String(row[islemKoduColIdx] || '').trim();
      const adi = String(row[islemAdiColIdx] || '').trim();
      const aciklama = aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '';
      if (kodu.includes('.')) return false;
      return kodu !== '' || adi !== '' || aciklama !== '';
    })
    .map(row => {
      const puanRaw = islemPuaniColIdx >= 0 ? String(row[islemPuaniColIdx] || '').trim() : '';
      const puanNum = parseFloat(puanRaw.replace(',', '.'));
      const puanStr = !isNaN(puanNum) ? puanNum.toFixed(2) : puanRaw;
      const fiyat = !isNaN(puanNum) ? (puanNum * 0.593).toFixed(2) + ' TL' : '';
      return [
        String(row[islemKoduColIdx] || '').trim(),
        String(row[islemAdiColIdx] || '').trim(),
        aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '',
        puanStr, fiyat
      ];
    });

  return { headers: ['İŞLEM KODU', 'İŞLEM ADI', 'AÇIKLAMA', 'İŞLEM PUANI', 'İŞLEM FİYATI'], rows, fileName };
}

export function parseEk2c(arrayBuffer: ArrayBuffer, fileName: string): ExcelData | null {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  resolveMergedCells(sheet);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
  if (jsonData.length === 0) return null;

  let headerRowIdx = -1, islemKoduColIdx = -1, islemAdiColIdx = -1, aciklamaColIdx = -1, islemGrubuColIdx = -1, islemPuaniColIdx = -1;
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim().toUpperCase();
      if (cellVal.includes('İŞLEM') && cellVal.includes('KODU')) islemKoduColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('ADI')) islemAdiColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('PUAN')) islemPuaniColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('GRUBU')) islemGrubuColIdx = j;
      else if (cellVal.includes('AÇIKLAMA')) aciklamaColIdx = j;
    }
    if (islemKoduColIdx >= 0 && islemAdiColIdx >= 0) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; islemKoduColIdx = 0; islemAdiColIdx = 1; aciklamaColIdx = 2; islemGrubuColIdx = 3; islemPuaniColIdx = 4; }

  const rows = jsonData.slice(headerRowIdx + 1)
    .filter(row => {
      const kodu = String(row[islemKoduColIdx] || '').trim();
      const adi = String(row[islemAdiColIdx] || '').trim();
      const aciklama = aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '';
      if (kodu.includes('.')) return false;
      return kodu !== '' || adi !== '' || aciklama !== '';
    })
    .map(row => {
      const puanRaw = islemPuaniColIdx >= 0 ? String(row[islemPuaniColIdx] || '').trim() : '';
      const puanNum = parseFloat(puanRaw.replace(',', '.'));
      const puanStr = !isNaN(puanNum) ? puanNum.toFixed(2) : puanRaw;
      const fiyat = !isNaN(puanNum) ? (puanNum * 0.593).toFixed(2) + ' TL' : '';
      const koduRaw = String(row[islemKoduColIdx] || '').trim();
      const kodu = koduRaw.replace(/^P/i, '');
      return [
        kodu,
        String(row[islemAdiColIdx] || '').trim(),
        aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '',
        islemGrubuColIdx >= 0 ? String(row[islemGrubuColIdx] || '').trim() : '',
        puanStr, fiyat
      ];
    });

  return { headers: ['İŞLEM KODU', 'İŞLEM ADI', 'AÇIKLAMA', 'İŞLEM GRUBU', 'İŞLEM PUANI', 'İŞLEM FİYATI'], rows, fileName };
}

export function parseEk2cd(arrayBuffer: ArrayBuffer, fileName: string): ExcelData | null {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  resolveMergedCells(sheet);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
  if (jsonData.length === 0) return null;

  let headerRowIdx = -1, islemKoduColIdx = -1, islemAdiColIdx = -1, aciklamaColIdx = -1, islemPuaniColIdx = -1;
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim().toUpperCase();
      if (cellVal.includes('İŞLEM') && cellVal.includes('KODU')) islemKoduColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('ADI')) islemAdiColIdx = j;
      else if (cellVal.includes('İŞLEM') && cellVal.includes('PUAN')) islemPuaniColIdx = j;
      else if (cellVal.includes('AÇIKLAMA')) aciklamaColIdx = j;
    }
    if (islemKoduColIdx >= 0 && islemAdiColIdx >= 0) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; islemKoduColIdx = 0; islemAdiColIdx = 1; aciklamaColIdx = 2; islemPuaniColIdx = 3; }

  const rows = jsonData.slice(headerRowIdx + 1)
    .filter(row => {
      const kodu = String(row[islemKoduColIdx] || '').trim();
      const adi = String(row[islemAdiColIdx] || '').trim();
      const aciklama = aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '';
      if (kodu.includes('.')) return false;
      return kodu !== '' || adi !== '' || aciklama !== '';
    })
    .map(row => {
      const puanRaw = islemPuaniColIdx >= 0 ? String(row[islemPuaniColIdx] || '').trim() : '';
      const puanNum = parseFloat(puanRaw.replace(',', '.'));
      const puanStr = !isNaN(puanNum) ? puanNum.toFixed(2) : puanRaw;
      const fiyat = !isNaN(puanNum) ? (puanNum * 0.593).toFixed(2) + ' TL' : '';
      return [
        String(row[islemKoduColIdx] || '').trim(),
        String(row[islemAdiColIdx] || '').trim(),
        aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '',
        puanStr, fiyat
      ];
    });

  return { headers: ['İŞLEM KODU', 'İŞLEM ADI', 'AÇIKLAMALAR', 'İŞLEM PUANI', 'İŞLEM FİYATI'], rows, fileName };
}

// ── Parse fonksiyonu mapping ──
const parsers: Record<string, (ab: ArrayBuffer, fn: string) => ExcelData | null> = {
  ek2a: parseEk2a, ek2a2: parseEk2a2, ek2b: parseEk2b, ek2c: parseEk2c, ek2cd: parseEk2cd
};

interface EkListeTanimlamaProps {
  canUpload?: boolean;
}

const EkListeTanimlama: React.FC<EkListeTanimlamaProps> = ({ canUpload = false }) => {
  const [ek2aData, setEk2aData] = useState<ExcelData | null>(null);
  const [ek2a2Data, setEk2a2Data] = useState<ExcelData | null>(null);
  const [ek2bData, setEk2bData] = useState<ExcelData | null>(null);
  const [ek2cData, setEk2cData] = useState<ExcelData | null>(null);
  const [ek2cdData, setEk2cdData] = useState<ExcelData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const setters: Record<string, (d: ExcelData | null) => void> = {
    ek2a: setEk2aData, ek2a2: setEk2a2Data, ek2b: setEk2bData, ek2c: setEk2cData, ek2cd: setEk2cdData
  };

  // Firebase'den mevcut dosyaları yükle
  useEffect(() => {
    let cancelled = false;
    const localSetters: Record<string, (d: ExcelData | null) => void> = {
      ek2a: setEk2aData, ek2a2: setEk2a2Data, ek2b: setEk2bData, ek2c: setEk2cData, ek2cd: setEk2cdData
    };
    (async () => {
      try {
        const files = await getFinansalModuleFiles('ekListe');
        const keys = Object.keys(files);
        if (keys.length === 0) { setInitialLoading(false); return; }

        await Promise.all(keys.map(async (subKey) => {
          if (cancelled) return;
          const meta = files[subKey];
          if (!meta?.storagePath) return;
          const parser = parsers[subKey];
          const setter = localSetters[subKey];
          if (!parser || !setter) return;

          const ab = await downloadFinansalFile(meta.storagePath);
          if (ab && !cancelled) {
            const parsed = parser(ab, meta.fileName);
            if (parsed) setter(parsed);
          }
        }));
      } catch (err) {
        console.error('[EK LİSTE] Firebase yükleme hatası:', err);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ortak upload handler
  const handleUpload = async (subKey: string, file: File) => {
    setLoadingId(subKey);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const parser = parsers[subKey];
      const setter = setters[subKey];
      if (!parser || !setter) return;

      const parsed = parser(arrayBuffer, file.name);
      if (parsed) {
        setter(parsed);
        // Firebase'e yükle (arka planda)
        uploadFinansalFile('ekListe', subKey, file).catch(err =>
          console.error(`[EK LİSTE] ${subKey} Firebase yükleme hatası:`, err)
        );
      }
    } catch (error) {
      console.error('Excel okuma hatası:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleFileChange = (subKey: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(subKey, file);
    e.target.value = '';
  };

  const handleClear = async (subKey: string) => {
    setters[subKey]?.(null);
    deleteFinansalFile('ekListe', subKey).catch(err =>
      console.error(`[EK LİSTE] ${subKey} silme hatası:`, err)
    );
  };

  const showUploadButtons = !ek2aData || !ek2a2Data || !ek2bData || !ek2cData || !ek2cdData;

  if (initialLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Ek Liste Tanımlama</h1>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Veriler yükleniyor...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Ek Liste Tanımlama</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Excel dosyaları yükleyerek ek listeleri tanımlayın</p>
          </div>
        </div>
      </div>

      {/* Excel Yükleme Butonları */}
      {canUpload && showUploadButtons && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {!ek2aData && (
            <label className={`backdrop-blur-xl rounded-2xl border p-6 cursor-pointer hover:border-emerald-500/50 transition-all group ${loadingId === 'ek2a' ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  {loadingId === 'ek2a' ? (<div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>) : (
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold group-hover:text-emerald-300 transition-colors" style={{ color: 'var(--text-1)' }}>EK-2A</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Ayaktan Başvurularda Ödeme Listesi</p>
                </div>
                <svg className="w-5 h-5 group-hover:text-emerald-400 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2a')} />
            </label>
          )}
          {!ek2a2Data && (
            <label className={`backdrop-blur-xl rounded-2xl border p-6 cursor-pointer hover:border-blue-500/50 transition-all group ${loadingId === 'ek2a2' ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  {loadingId === 'ek2a2' ? (<div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>) : (
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold group-hover:text-blue-300 transition-colors" style={{ color: 'var(--text-1)' }}>EK-2A-2</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Ayaktan Baş. İlave Ol. Fat. İş. Listesi</p>
                </div>
                <svg className="w-5 h-5 group-hover:text-blue-400 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2a2')} />
            </label>
          )}
          {!ek2bData && (
            <label className={`backdrop-blur-xl rounded-2xl border p-6 cursor-pointer hover:border-amber-500/50 transition-all group ${loadingId === 'ek2b' ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  {loadingId === 'ek2b' ? (<div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></div>) : (
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold group-hover:text-amber-300 transition-colors" style={{ color: 'var(--text-1)' }}>EK-2B</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Hizmet Başı İşlem Puan Listesi</p>
                </div>
                <svg className="w-5 h-5 group-hover:text-amber-400 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2b')} />
            </label>
          )}
          {!ek2cData && (
            <label className={`backdrop-blur-xl rounded-2xl border p-6 cursor-pointer hover:border-purple-500/50 transition-all group ${loadingId === 'ek2c' ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  {loadingId === 'ek2c' ? (<div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin"></div>) : (
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold group-hover:text-purple-300 transition-colors" style={{ color: 'var(--text-1)' }}>EK-2C</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Tanıya Dayalı İşlem Puan Listesi</p>
                </div>
                <svg className="w-5 h-5 group-hover:text-purple-400 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2c')} />
            </label>
          )}
          {!ek2cdData && (
            <label className={`backdrop-blur-xl rounded-2xl border p-6 cursor-pointer hover:border-rose-500/50 transition-all group ${loadingId === 'ek2cd' ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                  {loadingId === 'ek2cd' ? (<div className="w-5 h-5 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin"></div>) : (
                    <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold group-hover:text-rose-300 transition-colors" style={{ color: 'var(--text-1)' }}>EK-2Ç</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Diş Tedavileri Puan Listesi</p>
                </div>
                <svg className="w-5 h-5 group-hover:text-rose-400 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2cd')} />
            </label>
          )}
        </div>
      )}

      {/* Tablolar */}
      <div className="space-y-6">
        {/* EK-2A Tablosu */}
        {ek2aData && (
          <div className="space-y-4">
            <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>EK-2A AYAKTAN BAŞVURULARDA ÖDEME LİSTESİ</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ek2aData.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/20">{ek2aData.rows.length} kayıt</span>
                {canUpload && <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>Değiştir<input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2a')} /></label>}
                <button onClick={() => handleClear('ek2a')} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">Temizle</button>
              </div>
            </div>
            <div className="backdrop-blur-xl rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-2)' }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-12" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>#</th>{ek2aData.headers.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>{h}</th>))}</tr></thead>
                  <tbody style={{ borderColor: 'var(--border-2)' }}>{ek2aData.rows.map((row, ri) => (<tr key={ri} className="transition-colors" style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-row-hover)')} onMouseLeave={e => (e.currentTarget.style.background = '')}><td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{ri + 1}</td>{ek2aData.headers.map((_, ci) => (<td key={ci} className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)', borderRight: '1px solid var(--border-2)' }}>{row[ci] != null ? String(row[ci]) : ''}</td>))}</tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EK-2A-2 Tablosu */}
        {ek2a2Data && (
          <div className="space-y-4">
            <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>EK-2A-2 AYAKTAN BAŞ. İLAVE OL. FAT. İŞ. LİSTESİ</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ek2a2Data.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-500/20">{ek2a2Data.rows.length} kayıt</span>
                {canUpload && <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>Değiştir<input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2a2')} /></label>}
                <button onClick={() => handleClear('ek2a2')} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">Temizle</button>
              </div>
            </div>
            <div className="backdrop-blur-xl rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-2)' }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-12" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>#</th>{ek2a2Data.headers.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>{h}</th>))}</tr></thead>
                  <tbody style={{ borderColor: 'var(--border-2)' }}>{ek2a2Data.rows.map((row, ri) => (<tr key={ri} className="transition-colors" style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-row-hover)')} onMouseLeave={e => (e.currentTarget.style.background = '')}><td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{ri + 1}</td>{ek2a2Data.headers.map((_, ci) => (<td key={ci} className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)', borderRight: '1px solid var(--border-2)' }}>{row[ci] != null ? String(row[ci]) : ''}</td>))}</tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EK-2B Tablosu */}
        {ek2bData && (
          <div className="space-y-4">
            <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>EK-2B HİZMET BAŞI İŞLEM PUAN LİSTESİ</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ek2bData.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/20">{ek2bData.rows.length} kayıt</span>
                {canUpload && <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>Değiştir<input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2b')} /></label>}
                <button onClick={() => handleClear('ek2b')} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">Temizle</button>
              </div>
            </div>
            <div className="backdrop-blur-xl rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-2)' }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-12" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>#</th>{ek2bData.headers.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>{h}</th>))}</tr></thead>
                  <tbody style={{ borderColor: 'var(--border-2)' }}>{ek2bData.rows.map((row, ri) => {
                    const isHdr = String(row[0] || '').trim() === '' && String(row[3] || '').trim() === '';
                    return (<tr key={ri} className={isHdr ? '' : 'transition-colors'} style={{ background: isHdr ? 'var(--surface-1)' : undefined, borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => { if (!isHdr) e.currentTarget.style.background = 'var(--table-row-hover)'; }} onMouseLeave={e => { if (!isHdr) e.currentTarget.style.background = ''; }}><td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{ri + 1}</td>{ek2bData.headers.map((_, ci) => (<td key={ci} className={`px-4 py-2.5 text-xs ${isHdr ? 'font-bold' : ''}`} style={{ borderRight: '1px solid var(--border-2)', color: isHdr ? 'var(--accent-amber)' : 'var(--text-2)' }}>{row[ci] != null ? String(row[ci]) : ''}</td>))}</tr>);
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EK-2C Tablosu */}
        {ek2cData && (
          <div className="space-y-4">
            <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>EK-2C TANIYA DAYALI İŞLEM PUAN LİSTESİ</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ek2cData.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-500/20">{ek2cData.rows.length} kayıt</span>
                {canUpload && <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>Değiştir<input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2c')} /></label>}
                <button onClick={() => handleClear('ek2c')} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">Temizle</button>
              </div>
            </div>
            <div className="backdrop-blur-xl rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-2)' }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-12" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>#</th>{ek2cData.headers.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>{h}</th>))}</tr></thead>
                  <tbody style={{ borderColor: 'var(--border-2)' }}>{ek2cData.rows.map((row, ri) => {
                    const isHdr = String(row[0] || '').trim() === '' && String(row[4] || '').trim() === '';
                    return (<tr key={ri} className={isHdr ? '' : 'transition-colors'} style={{ background: isHdr ? 'var(--surface-1)' : undefined, borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => { if (!isHdr) e.currentTarget.style.background = 'var(--table-row-hover)'; }} onMouseLeave={e => { if (!isHdr) e.currentTarget.style.background = ''; }}><td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{ri + 1}</td>{ek2cData.headers.map((_, ci) => (<td key={ci} className={`px-4 py-2.5 text-xs ${isHdr ? 'font-bold' : ''}`} style={{ borderRight: '1px solid var(--border-2)', color: isHdr ? 'var(--accent-purple)' : 'var(--text-2)' }}>{row[ci] != null ? String(row[ci]) : ''}</td>))}</tr>);
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EK-2Ç Tablosu */}
        {ek2cdData && (
          <div className="space-y-4">
            <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>EK-2Ç DİŞ TEDAVİLERİ PUAN LİSTESİ</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ek2cdData.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-500/20">{ek2cdData.rows.length} kayıt</span>
                {canUpload && <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>Değiştir<input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange('ek2cd')} /></label>}
                <button onClick={() => handleClear('ek2cd')} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">Temizle</button>
              </div>
            </div>
            <div className="backdrop-blur-xl rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-2)' }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-12" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>#</th>{ek2cdData.headers.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border-2)' }}>{h}</th>))}</tr></thead>
                  <tbody style={{ borderColor: 'var(--border-2)' }}>{ek2cdData.rows.map((row, ri) => {
                    const isHdr = String(row[0] || '').trim() === '' && String(row[3] || '').trim() === '';
                    return (<tr key={ri} className={isHdr ? '' : 'transition-colors'} style={{ background: isHdr ? 'var(--surface-1)' : undefined, borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => { if (!isHdr) e.currentTarget.style.background = 'var(--table-row-hover)'; }} onMouseLeave={e => { if (!isHdr) e.currentTarget.style.background = ''; }}><td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{ri + 1}</td>{ek2cdData.headers.map((_, ci) => (<td key={ci} className={`px-4 py-2.5 text-xs ${isHdr ? 'font-bold' : ''}`} style={{ borderRight: '1px solid var(--border-2)', color: isHdr ? 'var(--accent-rose)' : 'var(--text-2)' }}>{row[ci] != null ? String(row[ci]) : ''}</td>))}</tr>);
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EkListeTanimlama;
