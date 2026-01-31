import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { uploadFinansalFile, getFinansalFileMetadata, downloadFinansalFile, deleteFinansalFile } from '../src/services/finansalStorage';

export interface GilExcelData {
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
}

const resolveMergedCells = (sheet: XLSX.WorkSheet) => {
  const merges = sheet['!merges'] || [];
  for (const merge of merges) {
    const topLeft = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
    const val = sheet[topLeft]?.v;
    if (val === undefined && val === null) continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!sheet[addr]) sheet[addr] = { t: 's', v: val };
        else if (sheet[addr].v === undefined) sheet[addr].v = val;
      }
    }
  }
};

// Standalone parse fonksiyonu (ArrayBuffer → ExcelData)
export function parseGilExcel(arrayBuffer: ArrayBuffer, fileName: string): GilExcelData | null {
  try {
    const fileData = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(fileData, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    resolveMergedCells(sheet);
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];

    if (jsonData.length === 0) return null;

    let headerRowIdx = -1;
    let islemKoduColIdx = -1;
    let islemAdiColIdx = -1;
    let aciklamaColIdx = -1;
    let islemPuaniColIdx = -1;
    let ameliyatGrubuColIdx = -1;

    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
      const row = jsonData[i];
      for (let j = 0; j < row.length; j++) {
        const cellVal = String(row[j] || '').trim().toUpperCase();
        if (cellVal.includes('İŞLEM') && cellVal.includes('KOD')) islemKoduColIdx = j;
        else if (cellVal.includes('İŞLEM') && cellVal.includes('ADI')) islemAdiColIdx = j;
        else if (cellVal.includes('İŞLEM') && cellVal.includes('PUAN')) islemPuaniColIdx = j;
        else if (cellVal.includes('AMELİYAT') && cellVal.includes('GRUP')) ameliyatGrubuColIdx = j;
        else if (cellVal.includes('AÇIKLAMA')) aciklamaColIdx = j;
      }
      if (islemKoduColIdx >= 0 && islemAdiColIdx >= 0) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      islemKoduColIdx = 0;
      islemAdiColIdx = 1;
      aciklamaColIdx = 2;
      islemPuaniColIdx = 3;
      ameliyatGrubuColIdx = 4;
    }

    const headers = ['İŞLEM KODU', 'İŞLEM ADI', 'AÇIKLAMA', 'İŞLEM PUANI', 'AMELİYAT GRUPLARI'];

    const rows = jsonData.slice(headerRowIdx + 1)
      .filter(row => {
        const kodu = String(row[islemKoduColIdx] || '').trim();
        const adi = String(row[islemAdiColIdx] || '').trim();
        const aciklama = aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '';
        return kodu !== '' || adi !== '' || aciklama !== '';
      })
      .map(row => {
        const puanRaw = islemPuaniColIdx >= 0 ? String(row[islemPuaniColIdx] || '').trim() : '';
        const puanNum = parseFloat(puanRaw.replace(',', '.'));
        const puanStr = !isNaN(puanNum) ? puanNum.toFixed(2) : puanRaw;
        return [
          String(row[islemKoduColIdx] || '').trim(),
          String(row[islemAdiColIdx] || '').trim(),
          aciklamaColIdx >= 0 ? String(row[aciklamaColIdx] || '').trim() : '',
          puanStr,
          ameliyatGrubuColIdx >= 0 ? String(row[ameliyatGrubuColIdx] || '').trim() : ''
        ];
      });

    return { headers, rows, fileName };
  } catch (error) {
    console.error('GİL Excel parse hatası:', error);
    return null;
  }
}

const GilModule: React.FC = () => {
  const [data, setData] = useState<GilExcelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Firebase'den mevcut dosyayı yükle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getFinansalFileMetadata('gil', 'gil');
        if (!meta?.storagePath) { setInitialLoading(false); return; }

        const ab = await downloadFinansalFile(meta.storagePath);
        if (ab && !cancelled) {
          const parsed = parseGilExcel(ab, meta.fileName);
          if (parsed) setData(parsed);
        }
      } catch (err) {
        console.error('[GİL] Firebase yükleme hatası:', err);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseGilExcel(arrayBuffer, file.name);
      if (parsed) {
        setData(parsed);
        // Firebase'e arka planda yükle
        uploadFinansalFile('gil', 'gil', file).catch(err =>
          console.error('[GİL] Firebase yükleme hatası:', err)
        );
      }
    } catch (error) {
      console.error('Excel okuma hatası:', error);
    } finally {
      setLoading(false);
    }
    e.target.value = '';
  };

  const handleClear = () => {
    setData(null);
    deleteFinansalFile('gil', 'gil').catch(err =>
      console.error('[GİL] silme hatası:', err)
    );
  };

  if (initialLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-lime-500 to-green-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">GİL</h1>
              <p className="text-sm text-slate-400">Veriler yükleniyor...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-lime-500 to-green-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">GİL</h1>
            <p className="text-sm text-slate-400">Genel Tıbbi İşlemler Listesi</p>
          </div>
        </div>
      </div>

      {/* Yükleme veya Tablo */}
      {!data ? (
        <div className="space-y-4">
          <label className={`bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-12 cursor-pointer hover:border-lime-500/50 hover:bg-slate-800/60 transition-all group flex flex-col items-center justify-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="w-16 h-16 bg-lime-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-lime-500/20 transition-colors">
              {loading ? (
                <div className="w-8 h-8 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-8 h-8 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white group-hover:text-lime-300 transition-colors mb-1">
              {loading ? 'Dosya İşleniyor...' : 'GİL Excel Dosyasını Yükleyin'}
            </h3>
            <p className="text-sm text-slate-400 text-center max-w-md">
              .xlsx formatında Genel Tıbbi İşlemler Listesi dosyasını yükleyin.
            </p>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Üst Bar */}
          <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-lime-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">GENEL TIBBİ İŞLEMLER LİSTESİ</h3>
                <p className="text-xs text-slate-500">{data.fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-lime-500/10 text-lime-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-lime-500/20">
                {data.rows.length} kayıt
              </span>
              <label className="bg-slate-700/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors border border-slate-600/30">
                Değiştir
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUpload} />
              </label>
              <button onClick={handleClear} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">
                Temizle
              </button>
            </div>
          </div>

          {/* Tablo */}
          <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700/50">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-700/30 w-12">#</th>
                    {data.headers.map((header, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-700/30 whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {data.rows.map((row, rowIdx) => {
                    const isHeaderRow = String(row[0] || '').trim() === '' && String(row[3] || '').trim() === '';
                    return (
                      <tr key={rowIdx} className={isHeaderRow ? 'bg-slate-800/70' : 'hover:bg-slate-800/50 transition-colors'}>
                        <td className="px-4 py-2.5 text-xs text-slate-500 font-mono border-r border-slate-700/20">{rowIdx + 1}</td>
                        {data.headers.map((_, colIdx) => (
                          <td key={colIdx} className={`px-4 py-2.5 text-xs border-r border-slate-700/20 ${isHeaderRow ? 'text-lime-300 font-bold' : 'text-slate-300'}`}>
                            {row[colIdx] !== null && row[colIdx] !== undefined ? String(row[colIdx]) : ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GilModule;
