/**
 * GÖREN Storage Service
 *
 * Firebase Storage ve Firestore üzerinden veri yönetimi:
 * - Excel dosyası yükleme ve parse etme
 * - Hesaplama sonuçlarını kaydetme/yükleme
 * - Excel şablon üretme
 * - Audit log kaydı
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { storage, db } from '../../firebase';
import * as XLSX from 'xlsx';
import {
  GorenDataFile,
  InstitutionResult,
  ParameterValues,
  GorenAuditLog,
  InstitutionType,
  IndicatorDefinition
} from '../../components/goren/types/goren.types';
import { getIndicatorsByCategory } from '../config/goren/index';

// Firestore koleksiyon adları
const GOREN_DATA_COLLECTION = 'gorenData';
const GOREN_FILES_COLLECTION = 'gorenFiles';
const GOREN_AUDIT_COLLECTION = 'gorenAuditLogs';


// ========== DOSYA YÜKLEME ==========

/**
 * BH tablo satırı - Excel'den birebir yansıtılacak
 */
export interface BHTableRow {
  sira: number;
  gostergeAdi: string;
  birim: string;
  a: number | string | null;
  b: number | string | null;
  donemIci: number | string | null;
  trRolOrtalama: number | string | null;
  donemIciPuan: number | string | null;
  maxPuan: number; // Maksimum alınabilecek puan
  muaf: number | string | null;
}

/**
 * BH Excel parse sonucu - GP değerlerini de içerir
 */
export interface BHParseResult {
  success: boolean;
  data?: Record<string, ParameterValues>;
  directGP?: Record<string, number>; // Sıra numarasına göre "Dönem İçi Puan" değerleri
  totalGP?: number; // Toplam puan
  indicatorNames?: Record<string, string>; // Gösterge adları
  bhTableRows?: BHTableRow[]; // Excel'den birebir satırlar
  error?: string;
}

/**
 * BH Excel formatını parse et
 *
 * Beklenen Excel formatı (Başhekimlik):
 * | Sıra | Gösterge Adı | Birim | A | B | Dönem İçi | TR Rol Ortalama | Dönem İçi Puan | Muaf |
 * |  1   | Hasta Memnuniyet Oranı | % | 800 | 10 | 80 | 75 | 5 | |
 *
 * @param file Excel dosyası ArrayBuffer
 * @param institutionType Kurum türü - BH için özel format kullanılır
 */
export const parseGorenExcelBH = (
  file: ArrayBuffer,
  institutionType: InstitutionType = 'BH'
): BHParseResult => {
  try {
    const workbook = XLSX.read(new Uint8Array(file), { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return { success: false, error: 'Excel dosyası boş.' };
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (jsonData.length === 0) {
      return { success: false, error: 'Excel dosyasında veri bulunamadı.' };
    }

    // BH formatı için kolon isimlerini kontrol et
    const firstRow = jsonData[0];
    const hasSiraColumn = 'Sıra' in firstRow || 'SIRA' in firstRow || 'Sira' in firstRow;
    const hasPuanColumn = 'Dönem İçi Puan' in firstRow || 'DÖNEM İÇİ PUAN' in firstRow || 'Dönem İçi̇ Puan' in firstRow;

    if (!hasSiraColumn) {
      return {
        success: false,
        error: 'Excel dosyasında "Sıra" kolonu bulunamadı. Lütfen şablonu kullanın.'
      };
    }

    // Türkçe karakter normalizasyonu (İ→i, Ş→ş, vb.)
    const normalizeTr = (s: string): string =>
      s.toLowerCase()
        .replace(/İ/g, 'i').replace(/I/g, 'ı')
        .replace(/i̇/g, 'i') // combining dot above
        .normalize('NFC')
        .replace(/\s+/g, ' ').trim();

    const allColumns = Object.keys(firstRow);

    // Kolon isimlerini bul
    const siraColumn = allColumns.find(k =>
      normalizeTr(k).includes('sıra') || normalizeTr(k) === 'sira'
    ) || 'Sıra';

    // Önce "Dönem İçi Puan" sütununu bul (daha spesifik - önce aranmalı)
    const puanColumn = allColumns.find(k =>
      normalizeTr(k).includes('dönem içi puan') || normalizeTr(k).includes('donem ici puan')
    ) || 'Dönem İçi Puan';

    const gostergeAdiColumn = allColumns.find(k =>
      normalizeTr(k).includes('gösterge adı') || normalizeTr(k).includes('gosterge adi')
    ) || 'Gösterge Adı';

    // "Dönem İçi" sütunu: "puan" ve "rol" içermeyen, sadece "dönem içi" olanı bul
    const donemIciColumn = allColumns.find(k => {
      const n = normalizeTr(k);
      return (n.includes('dönem içi') || n.includes('donem ici')) &&
        !n.includes('puan') && !n.includes('rol');
    }) || 'Dönem İçi';

    // "TR Rol Ortalama" sütunu
    const trRolOrtalamaColumn = allColumns.find(k => {
      const n = normalizeTr(k);
      return n.includes('tr rol') || n.includes('türkiye rol') ||
        n.includes('rol ortalama') || n.includes('rol ort');
    }) || 'TR Rol Ortalama';

    const birimColumn = allColumns.find(k =>
      normalizeTr(k).includes('birim')
    ) || 'Birim';

    const muafColumn = allColumns.find(k =>
      normalizeTr(k).includes('muaf')
    ) || 'Muaf';

    // DEBUG: Sütun eşleştirme kontrolü
    console.log('[GÖREN Parse] Excel sütunları:', allColumns);
    console.log('[GÖREN Parse] Normalize edilmiş:', allColumns.map(c => `"${c}" → "${normalizeTr(c)}"`));
    console.log('[GÖREN Parse] Algılanan sütunlar:', {
      siraColumn,
      gostergeAdiColumn,
      donemIciColumn,
      trRolOrtalamaColumn,
      puanColumn,
      birimColumn,
      muafColumn
    });
    console.log('[GÖREN Parse] donemIci === trRolOrtalama?', donemIciColumn === trRolOrtalamaColumn);
    console.log('[GÖREN Parse] İlk satır verileri:', firstRow);
    console.log('[GÖREN Parse] İlk satır dönemİçi:', firstRow[donemIciColumn], 'trRol:', firstRow[trRolOrtalamaColumn]);

    // Parametre değerlerini ve puanları çıkar
    const parameterData: Record<string, ParameterValues> = {};
    const directGP: Record<string, number> = {};
    const indicatorNames: Record<string, string> = {};
    const bhTableRows: BHTableRow[] = [];
    let totalGP = 0;

    for (const row of jsonData) {
      // Sıra numarasını al
      const sira = row[siraColumn];
      if (sira === undefined || sira === null || sira === '') continue;

      const siraNum = parseInt(String(sira), 10);
      if (isNaN(siraNum) || siraNum < 1 || siraNum > 99) continue;

      // Gösterge kodunu kurum tipine göre oluştur
      const codePrefix: Record<InstitutionType, string> = {
        'BH': 'SYPG-BH',
        'ILSM': 'SYPG-İLSM',
        'ILCESM': 'SYPG-İLÇESM',
        'ADSH': 'SYPG-ADSH',
        'ASH': 'SYPG-ASH'
      };
      const code = `${codePrefix[institutionType]}-${siraNum}`;

      // Gösterge adını kaydet
      const gostergeAdi = row[gostergeAdiColumn];
      if (gostergeAdi) {
        indicatorNames[code] = String(gostergeAdi).trim();
      }

      // A ve B değerlerini al
      parameterData[code] = {};

      const aValue = row['A'];
      if (aValue !== undefined && aValue !== null && aValue !== '') {
        const numValue = parseFloat(String(aValue).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          parameterData[code]['A'] = numValue;
        }
      }

      const bValue = row['B'];
      if (bValue !== undefined && bValue !== null && bValue !== '') {
        const numValue = parseFloat(String(bValue).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          parameterData[code]['B'] = numValue;
        }
      }

      // Dönem İçi (GD) değerini al
      const gdValue = row[donemIciColumn];
      if (gdValue !== undefined && gdValue !== null && gdValue !== '') {
        const numValue = parseFloat(String(gdValue).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          parameterData[code]['GD'] = numValue;
        }
      }

      // Dönem İçi Puan (GP) değerini al
      let gpNumValue: number | null = null;
      const gpValue = row[puanColumn];
      if (gpValue !== undefined && gpValue !== null && gpValue !== '') {
        const numValue = parseFloat(String(gpValue).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          directGP[code] = numValue;
          parameterData[code]['GP'] = numValue;
          totalGP += numValue;
          gpNumValue = numValue;
        }
      }

      // TR Rol Ortalama değerini al
      let trRolOrtalamaValue: number | string | null = null;
      const trRolVal = row[trRolOrtalamaColumn];
      if (trRolVal !== undefined && trRolVal !== null && trRolVal !== '') {
        const numValue = parseFloat(String(trRolVal).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          trRolOrtalamaValue = numValue;
        } else {
          trRolOrtalamaValue = String(trRolVal).trim();
        }
      }

      // Birim değerini al
      const birimValue = row[birimColumn];
      const birimStr = birimValue !== undefined && birimValue !== null && birimValue !== ''
        ? String(birimValue).trim()
        : '-';

      // Muaf değerini al
      let muafValue: number | string | null = null;
      const muafVal = row[muafColumn];
      if (muafVal !== undefined && muafVal !== null && muafVal !== '') {
        const numValue = parseFloat(String(muafVal).replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          muafValue = numValue;
        } else {
          muafValue = String(muafVal).trim();
        }
      }

      // Registry'den maxPoints değerini al
      const indicators = getIndicatorsByCategory(institutionType);
      const indicator = indicators.find(ind => ind.code === code);
      const maxPuan = indicator?.maxPoints ?? 4; // Varsayılan 4

      // BH tablo satırı oluştur
      bhTableRows.push({
        sira: siraNum,
        gostergeAdi: indicatorNames[code] || `Gösterge ${siraNum}`,
        birim: birimStr,
        a: parameterData[code]['A'] ?? null,
        b: parameterData[code]['B'] ?? null,
        donemIci: parameterData[code]['GD'] ?? null,
        trRolOrtalama: trRolOrtalamaValue,
        donemIciPuan: gpNumValue,
        maxPuan: maxPuan,
        muaf: muafValue
      });
    }

    if (Object.keys(parameterData).length === 0) {
      return {
        success: false,
        error: 'Excel dosyasında geçerli gösterge verisi bulunamadı.'
      };
    }

    // Satırları sıra numarasına göre sırala
    bhTableRows.sort((a, b) => a.sira - b.sira);

    return {
      success: true,
      data: parameterData,
      directGP,
      totalGP,
      indicatorNames,
      bhTableRows
    };
  } catch (error) {
    console.error('[GÖREN Storage] BH Excel parse hatası:', error);
    return {
      success: false,
      error: `Excel dosyası okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

/**
 * Excel dosyasını parse et ve parametre değerlerini çıkar
 *
 * Beklenen Excel formatı:
 * | Gösterge Kodu | A | B | C | GO | HD | ÖD |
 * | SYPG-İLSM-1   | 750 | 10 | | | | |
 */
export const parseGorenExcel = (
  file: ArrayBuffer,
  institutionType?: InstitutionType
): { success: boolean; data?: Record<string, ParameterValues>; directGP?: Record<string, number>; totalGP?: number; indicatorNames?: Record<string, string>; bhTableRows?: BHTableRow[]; error?: string } => {
  // Tüm modüller için BH tarzı parser'ı dene (Sıra kolonu varsa)
  // institutionType verilmişse o tipi kullan
  if (institutionType) {
    return parseGorenExcelBH(file, institutionType);
  }

  try {
    const workbook = XLSX.read(new Uint8Array(file), { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return { success: false, error: 'Excel dosyası boş.' };
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (jsonData.length === 0) {
      return { success: false, error: 'Excel dosyasında veri bulunamadı.' };
    }

    // Gösterge Kodu kolonunu bul
    const firstRow = jsonData[0];
    const codeColumnNames = ['Gösterge Kodu', 'Code', 'Kod', 'GÖSTERGE KODU'];
    let codeColumn: string | null = null;

    for (const colName of codeColumnNames) {
      if (colName in firstRow) {
        codeColumn = colName;
        break;
      }
    }

    // Eğer kod kolonu yoksa, BH formatını dene
    if (!codeColumn) {
      // Sıra kolonu varsa BH formatı olabilir
      const hasSiraColumn = 'Sıra' in firstRow || 'SIRA' in firstRow || 'Sira' in firstRow;
      if (hasSiraColumn) {
        return parseGorenExcelBH(file, institutionType || 'BH');
      }

      return {
        success: false,
        error: 'Excel dosyasında "Gösterge Kodu" kolonu bulunamadı. Lütfen şablonu kullanın.'
      };
    }

    // Parametre değerlerini çıkar
    const parameterData: Record<string, ParameterValues> = {};
    const validParams = ['A', 'B', 'C', 'D', 'E', 'F', 'GO', 'HD', 'ÖD'];

    for (const row of jsonData) {
      const code = String(row[codeColumn] || '').trim();
      if (!code || !code.startsWith('SYPG-')) continue;

      parameterData[code] = {};

      for (const param of validParams) {
        const value = row[param];
        if (value !== undefined && value !== null && value !== '') {
          // Sayıya çevir
          const numValue = parseFloat(
            String(value)
              .replace(',', '.')
              .replace(/[^\d.-]/g, '')
          );

          if (!isNaN(numValue)) {
            parameterData[code][param] = numValue;
          }
        }
      }
    }

    if (Object.keys(parameterData).length === 0) {
      return {
        success: false,
        error: 'Excel dosyasında geçerli gösterge verisi bulunamadı.'
      };
    }

    return { success: true, data: parameterData };
  } catch (error) {
    console.error('[GÖREN Storage] Excel parse hatası:', error);
    return {
      success: false,
      error: `Excel dosyası okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

/**
 * Excel dosyasını Firebase Storage'a yükle ve Firestore'a metadata kaydet
 */
export const uploadGorenDataFile = async (
  file: File,
  institutionId: string,
  institutionName: string,
  institutionType: InstitutionType,
  year: number,
  month: number,
  uploadedBy: string
): Promise<{
  success: boolean;
  data?: Record<string, ParameterValues>;
  directGP?: Record<string, number>;
  totalGP?: number;
  indicatorNames?: Record<string, string>;
  fileId?: string;
  error?: string;
}> => {
  try {
    // 1. Dosyayı oku ve parse et
    const arrayBuffer = await file.arrayBuffer();
    const parseResult = parseGorenExcel(arrayBuffer, institutionType);

    if (!parseResult.success || !parseResult.data) {
      return { success: false, error: parseResult.error };
    }

    // 2. Firebase Storage'a yükle
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `goren/${institutionType}/${institutionId}/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    // 3. Firestore'a metadata kaydet
    const docRef = doc(collection(db, GOREN_FILES_COLLECTION));
    const fileDoc: GorenDataFile = {
      id: docRef.id,
      institutionId,
      institutionName,
      institutionType,
      year,
      month,
      fileName: file.name,
      fileUrl,
      uploadedAt: timestamp,
      uploadedBy,
      indicatorCount: Object.keys(parseResult.data).length
    };

    await setDoc(docRef, fileDoc);

    // 4. Audit log
    await logGorenAction(
      uploadedBy,
      uploadedBy,
      'upload',
      institutionType,
      institutionId,
      { year, month },
      `Dosya yüklendi: ${file.name} (${Object.keys(parseResult.data).length} gösterge)`
    );

    return {
      success: true,
      data: parseResult.data,
      directGP: parseResult.directGP,
      totalGP: parseResult.totalGP,
      indicatorNames: parseResult.indicatorNames,
      fileId: docRef.id
    };
  } catch (error) {
    console.error('[GÖREN Storage] Dosya yükleme hatası:', error);
    return {
      success: false,
      error: `Dosya yüklenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

// ========== HESAPLAMA KAYIT/YÜKLEME ==========

/**
 * Hesaplama sonucunu Firestore'a kaydet
 */
export const saveGorenCalculation = async (
  result: InstitutionResult,
  savedBy: string
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // Benzersiz ID: kurum_yıl_ay
    const docId = `${result.institutionId}_${result.period.year}_${String(result.period.month).padStart(2, '0')}`;
    const docRef = doc(db, GOREN_DATA_COLLECTION, docId);

    await setDoc(docRef, {
      ...result,
      savedAt: Date.now(),
      savedBy
    });

    // Audit log
    await logGorenAction(
      savedBy,
      savedBy,
      'save',
      result.institutionType,
      result.institutionId,
      result.period,
      `Hesaplama kaydedildi: ${result.summary.totalGP}/${result.summary.maxPossibleGP} puan`
    );

    return { success: true, id: docId };
  } catch (error) {
    console.error('[GÖREN Storage] Kaydetme hatası:', error);
    return {
      success: false,
      error: `Kayıt başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

/**
 * Kaydedilmiş hesaplama sonucunu yükle
 */
export const loadGorenCalculation = async (
  institutionId: string,
  year: number,
  month: number
): Promise<InstitutionResult | null> => {
  try {
    const docId = `${institutionId}_${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, GOREN_DATA_COLLECTION, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data() as InstitutionResult;
  } catch (error) {
    console.error('[GÖREN Storage] Yükleme hatası:', error);
    return null;
  }
};

// ========== BH VERİ KAYIT/YÜKLEME ==========

/**
 * BH verileri için kayıt yapısı
 */
export interface BHSavedData {
  institutionId: string;
  institutionName: string;
  year: number;
  month: number;
  bhTableRows: BHTableRow[];
  totalGP: number;
  muafCount: number;
  savedAt: number;
  savedBy: string;
}

/**
 * BH verilerini Firestore'a kaydet
 */
export const saveGorenBHData = async (
  institutionId: string,
  institutionName: string,
  year: number,
  month: number,
  bhTableRows: BHTableRow[],
  totalGP: number,
  muafCount: number,
  savedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const docId = `BH_${institutionId}_${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, GOREN_DATA_COLLECTION, docId);

    const data: BHSavedData = {
      institutionId,
      institutionName,
      year,
      month,
      bhTableRows,
      totalGP,
      muafCount,
      savedAt: Date.now(),
      savedBy
    };

    await setDoc(docRef, data);

    console.log('[GÖREN Storage] BH verileri kaydedildi:', docId);
    return { success: true };
  } catch (error) {
    console.error('[GÖREN Storage] BH kaydetme hatası:', error);
    return {
      success: false,
      error: `Kayıt başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

/**
 * Kaydedilmiş BH verilerini yükle
 */
export const loadGorenBHData = async (
  institutionId: string,
  year: number,
  month: number
): Promise<BHSavedData | null> => {
  try {
    const docId = `BH_${institutionId}_${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, GOREN_DATA_COLLECTION, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log('[GÖREN Storage] BH verisi bulunamadı:', docId);
      return null;
    }

    console.log('[GÖREN Storage] BH verileri yüklendi:', docId);
    return docSnap.data() as BHSavedData;
  } catch (error) {
    console.error('[GÖREN Storage] BH yükleme hatası:', error);
    return null;
  }
};

/**
 * Kurum için tüm dönemlerin hesaplama sonuçlarını getir
 */
export const loadGorenCalculationHistory = async (
  institutionId: string,
  limitCount: number = 12
): Promise<InstitutionResult[]> => {
  try {
    const q = query(
      collection(db, GOREN_DATA_COLLECTION),
      where('institutionId', '==', institutionId),
      orderBy('calculatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as InstitutionResult);
  } catch (error) {
    console.error('[GÖREN Storage] Geçmiş yükleme hatası:', error);
    return [];
  }
};

// ========== DOSYA YÖNETİMİ ==========

/**
 * Yüklenen dosyaları listele
 */
export const getGorenFiles = async (
  institutionType?: InstitutionType,
  institutionId?: string,
  year?: number,
  month?: number
): Promise<GorenDataFile[]> => {
  try {
    const constraints: ReturnType<typeof where>[] = [];

    if (institutionType) {
      constraints.push(where('institutionType', '==', institutionType));
    }
    if (institutionId) {
      constraints.push(where('institutionId', '==', institutionId));
    }
    if (year) {
      constraints.push(where('year', '==', year));
    }
    if (month) {
      constraints.push(where('month', '==', month));
    }

    const q = constraints.length > 0
      ? query(collection(db, GOREN_FILES_COLLECTION), ...constraints, orderBy('uploadedAt', 'desc'))
      : query(collection(db, GOREN_FILES_COLLECTION), orderBy('uploadedAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as GorenDataFile);
  } catch (error) {
    console.error('[GÖREN Storage] Dosya listesi hatası:', error);
    return [];
  }
};

/**
 * Dosyayı sil
 */
export const deleteGorenFile = async (
  fileId: string,
  deletedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const docRef = doc(db, GOREN_FILES_COLLECTION, fileId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Dosya bulunamadı.' };
    }

    const fileData = docSnap.data() as GorenDataFile;
    await deleteDoc(docRef);

    // Audit log
    await logGorenAction(
      deletedBy,
      deletedBy,
      'delete',
      fileData.institutionType,
      fileData.institutionId,
      { year: fileData.year, month: fileData.month },
      `Dosya silindi: ${fileData.fileName}`
    );

    return { success: true };
  } catch (error) {
    console.error('[GÖREN Storage] Dosya silme hatası:', error);
    return {
      success: false,
      error: `Silme başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

// ========== EXCEL ŞABLON ÜRETİMİ ==========

/**
 * Gösterge tanımlarından Excel şablon dosyası oluştur
 */
export const generateGorenTemplate = (
  indicators: IndicatorDefinition[],
  institutionType: InstitutionType
): Blob => {
  // Şablon verileri
  const templateData = indicators.map(ind => {
    const row: Record<string, string | number> = {
      'Gösterge Kodu': ind.code,
      'Gösterge Adı': ind.name,
      'Maks Puan': ind.maxPoints
    };

    // Tüm olası parametreleri ekle (boş)
    const allParams = ['A', 'B', 'C', 'GO', 'HD', 'ÖD'];
    for (const param of allParams) {
      const paramDef = ind.parameters.find(p => p.key === param);
      if (paramDef) {
        // Parametre açıklamasını kolon başlığına ekle
        row[param] = ''; // Kullanıcı dolduracak
      }
    }

    return row;
  });

  // Excel oluştur
  const ws = XLSX.utils.json_to_sheet(templateData);

  // Kolon genişliklerini ayarla
  const colWidths = [
    { wch: 18 },  // Gösterge Kodu
    { wch: 60 },  // Gösterge Adı
    { wch: 10 },  // Maks Puan
    { wch: 15 },  // A
    { wch: 15 },  // B
    { wch: 15 },  // C
    { wch: 15 },  // GO
    { wch: 15 },  // HD
    { wch: 15 },  // ÖD
  ];
  ws['!cols'] = colWidths;

  // Workbook oluştur
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gösterge Verileri');

  // Açıklama sayfası ekle
  const helpData = indicators.map(ind => ({
    'Gösterge Kodu': ind.code,
    'Parametre': ind.parameters.map(p => `${p.key}: ${p.label}`).join('\n'),
    'Formül': ind.gdFormula,
    'Kaynak': ind.source || '-',
    'Notlar': ind.notes || '-'
  }));

  const helpWs = XLSX.utils.json_to_sheet(helpData);
  helpWs['!cols'] = [
    { wch: 18 },
    { wch: 80 },
    { wch: 25 },
    { wch: 15 },
    { wch: 50 }
  ];
  XLSX.utils.book_append_sheet(wb, helpWs, 'Açıklamalar');

  // Blob olarak döndür
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
};

/**
 * Şablon dosyasını indir
 */
export const downloadGorenTemplate = (
  indicators: IndicatorDefinition[],
  institutionType: InstitutionType
): void => {
  const blob = generateGorenTemplate(indicators, institutionType);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `GOREN_${institutionType}_Sablon.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// ========== SONUÇ EXPORT ==========

/**
 * Hesaplama sonuçlarını Excel olarak dışa aktar
 */
export const exportGorenResultsToExcel = (
  result: InstitutionResult
): void => {
  // Ana sonuç tablosu
  const resultData = result.indicators.map(ind => ({
    'Gösterge Kodu': ind.code,
    'Gösterge Adı': ind.name,
    'A': ind.parameterValues['A'] ?? '-',
    'B': ind.parameterValues['B'] ?? '-',
    'C': ind.parameterValues['C'] ?? '-',
    'GO': ind.parameterValues['GO'] ?? '-',
    'GD': ind.gdFormatted,
    'GP': ind.gp,
    'Maks Puan': ind.maxPoints,
    'Başarı %': `%${ind.achievementPercent}`,
    'Durum': ind.status === 'success' ? 'Hesaplandı' : ind.statusMessage || 'Eksik'
  }));

  const ws = XLSX.utils.json_to_sheet(resultData);
  ws['!cols'] = [
    { wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 20 }
  ];

  // Özet sayfası
  const summaryData = [{
    'Kurum': result.institutionName,
    'Kurum Türü': result.institutionType,
    'Dönem': `${result.period.month}/${result.period.year}`,
    'Toplam Puan': result.summary.totalGP,
    'Maksimum Puan': result.summary.maxPossibleGP,
    'Başarı Oranı': `%${result.summary.achievementRate}`,
    'Hesaplanan Gösterge': result.summary.completedIndicators,
    'Toplam Gösterge': result.summary.totalIndicators,
    'Hesaplama Tarihi': new Date(result.calculatedAt).toLocaleString('tr-TR')
  }];

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = Array(9).fill({ wch: 20 });

  // Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Özet');
  XLSX.utils.book_append_sheet(wb, ws, 'Gösterge Sonuçları');

  // İndir
  const fileName = `GOREN_${result.institutionType}_${result.institutionName}_${result.period.year}_${result.period.month}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ========== AUDIT LOG ==========

/**
 * Kullanıcı işlemini logla
 */
export const logGorenAction = async (
  userId: string,
  userEmail: string,
  action: GorenAuditLog['action'],
  institutionType: InstitutionType,
  institutionId: string,
  period: { year: number; month: number },
  details?: string
): Promise<void> => {
  try {
    const docRef = doc(collection(db, GOREN_AUDIT_COLLECTION));
    const logEntry: GorenAuditLog = {
      id: docRef.id,
      userId,
      userEmail,
      action,
      institutionType,
      institutionId,
      period,
      details,
      timestamp: Date.now()
    };

    await setDoc(docRef, logEntry);
  } catch (error) {
    console.error('[GÖREN Storage] Audit log hatası:', error);
    // Audit log hatası ana işlemi durdurmaz
  }
};

/**
 * Audit loglarını getir
 */
export const getGorenAuditLogs = async (
  institutionId?: string,
  limitCount: number = 50
): Promise<GorenAuditLog[]> => {
  try {
    const constraints: ReturnType<typeof where>[] = [];

    if (institutionId) {
      constraints.push(where('institutionId', '==', institutionId));
    }

    const q = query(
      collection(db, GOREN_AUDIT_COLLECTION),
      ...constraints,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as GorenAuditLog);
  } catch (error) {
    console.error('[GÖREN Storage] Audit log getirme hatası:', error);
    return [];
  }
};

// ========== TR ROL ORTALAMASI ==========

const TR_ROL_ORTALAMASI_COLLECTION = 'gorenTrRolOrtalamasi';

/**
 * TR Rol Ortalaması kaydet (sadece admin)
 */
export const saveTrRolOrtalamasi = async (
  institutionId: string,
  year: number,
  month: number,
  value: number,
  savedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const docId = `${institutionId}_${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, TR_ROL_ORTALAMASI_COLLECTION, docId);

    await setDoc(docRef, {
      institutionId,
      year,
      month,
      value,
      savedAt: Date.now(),
      savedBy
    });

    console.log('[GÖREN Storage] TR Rol Ortalaması kaydedildi:', docId, value);
    return { success: true };
  } catch (error) {
    console.error('[GÖREN Storage] TR Rol Ortalaması kaydetme hatası:', error);
    return {
      success: false,
      error: `Kayıt başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
};

/**
 * TR Rol Ortalaması yükle
 */
export const loadTrRolOrtalamasi = async (
  institutionId: string,
  year: number,
  month: number
): Promise<number | null> => {
  try {
    const docId = `${institutionId}_${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, TR_ROL_ORTALAMASI_COLLECTION, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return data.value as number;
  } catch (error) {
    console.error('[GÖREN Storage] TR Rol Ortalaması yükleme hatası:', error);
    return null;
  }
};

/**
 * BH geçmiş verilerini yükle (grafik için)
 * Seçili aya kadar olan tüm ayları getirir
 */
export interface BHHistoryData {
  year: number;
  month: number;
  monthLabel: string;
  totalGP: number;
  trRolOrtalamasi: number | null;
}

export const loadBHHistoryData = async (
  institutionId: string,
  endYear: number,
  endMonth: number,
  monthCount: number = 12,
  moduleType?: string
): Promise<BHHistoryData[]> => {
  const results: BHHistoryData[] = [];
  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Minimum tarih: modül tipine göre belirlenir
  // ILSM: 2025 Mayıs, diğerleri: 2025 Haziran
  const minYear = 2025;
  const minMonth = moduleType === 'ILSM' ? 5 : 6; // ILSM: Mayıs, diğerleri: Haziran

  // Seçili aydan Aralık'a kadar ileriye de bak (aynı yıl içinde)
  // Örn: Kasım seçiliyse Aralık'ı da kontrol et
  const maxYear = endYear;
  const maxMonth = 12; // Yılın sonuna kadar ileriye bak

  // Tüm taranacak ayları oluştur: minDate'ten maxDate'e kadar
  const allMonths: { year: number; month: number }[] = [];
  let scanYear = minYear;
  let scanMonth = minMonth;

  while (scanYear < maxYear || (scanYear === maxYear && scanMonth <= maxMonth)) {
    allMonths.push({ year: scanYear, month: scanMonth });
    scanMonth++;
    if (scanMonth > 12) {
      scanMonth = 1;
      scanYear++;
    }
  }

  // Son monthCount kadar ayı al (en güncel aylar)
  const monthsToCheck = allMonths.slice(-monthCount);

  for (const { year, month } of monthsToCheck) {
    try {
      // BH verisini yükle
      const bhData = await loadGorenBHData(institutionId, year, month);
      // TR Rol ortalamasını yükle
      const trRol = await loadTrRolOrtalamasi(institutionId, year, month);

      if (bhData) {
        results.push({
          year,
          month,
          monthLabel: `${monthNames[month - 1]} ${year}`,
          totalGP: bhData.totalGP,
          trRolOrtalamasi: trRol
        });
      }
    } catch (error) {
      console.error(`[GÖREN Storage] Geçmiş veri yükleme hatası (${year}/${month}):`, error);
    }
  }

  return results;
};

// ========== TÜM HASTANELER BH VERİLERİ ==========

/**
 * Bir hastane başarı sıralaması kaydı
 */
export interface HospitalRankingEntry {
  institutionId: string;
  institutionName: string;
  totalGP: number;
  maxGP: number;
  achievementRate: number; // Eşit ağırlıklı başarı oranı (%)
  dataExists: boolean;
}

/**
 * Belirli bir ay/yıl için tüm hastanelerin BH verilerini yükle
 * Başarı sıralaması için kullanılır - hastane yetkisi gözetmeksizin
 */
export const loadAllHospitalsBHRanking = async (
  hospitalIds: { id: string; name: string }[],
  year: number,
  month: number,
  maxGP: number
): Promise<HospitalRankingEntry[]> => {
  // Tüm hastaneleri paralel olarak yükle (performans için)
  const promises = hospitalIds.map(async (hospital) => {
    try {
      const bhData = await loadGorenBHData(hospital.id, year, month);

      if (bhData && bhData.bhTableRows && bhData.bhTableRows.length > 0) {
        // Eşit ağırlıklı başarı oranı hesapla
        // Muaf olmayan tüm göstergeler dahil (puanı boş olanlar 0 olarak sayılır)
        const eligibleRows = bhData.bhTableRows.filter(
          (r: BHTableRow) => r.muaf !== 1
        );
        let achievementRate = 0;
        if (eligibleRows.length > 0) {
          const totalPercent = eligibleRows.reduce((sum: number, r: BHTableRow) => {
            const maxP = r.maxPuan || 4;
            const gp = typeof r.donemIciPuan === 'number' ? r.donemIciPuan : 0;
            return sum + (maxP > 0 ? (gp / maxP) * 100 : 0);
          }, 0);
          achievementRate = totalPercent / eligibleRows.length;
        }

        return {
          institutionId: hospital.id,
          institutionName: hospital.name,
          totalGP: bhData.totalGP,
          maxGP,
          achievementRate,
          dataExists: true
        } as HospitalRankingEntry;
      } else {
        return {
          institutionId: hospital.id,
          institutionName: hospital.name,
          totalGP: 0,
          maxGP,
          achievementRate: 0,
          dataExists: false
        } as HospitalRankingEntry;
      }
    } catch (error) {
      console.error(`[GÖREN Storage] Hastane verisi yükleme hatası (${hospital.name}):`, error);
      return {
        institutionId: hospital.id,
        institutionName: hospital.name,
        totalGP: 0,
        maxGP,
        achievementRate: 0,
        dataExists: false
      } as HospitalRankingEntry;
    }
  });

  const results = await Promise.all(promises);

  // Başarı oranına göre sırala (yüksekten düşüğe)
  results.sort((a, b) => {
    // Verisi olmayanlar en sona
    if (a.dataExists && !b.dataExists) return -1;
    if (!a.dataExists && b.dataExists) return 1;
    return b.achievementRate - a.achievementRate;
  });

  return results;
};
