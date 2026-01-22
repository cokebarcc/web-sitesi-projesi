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

// Firestore koleksiyon adları
const GOREN_DATA_COLLECTION = 'gorenData';
const GOREN_FILES_COLLECTION = 'gorenFiles';
const GOREN_AUDIT_COLLECTION = 'gorenAuditLogs';

// ========== DOSYA YÜKLEME ==========

/**
 * Excel dosyasını parse et ve parametre değerlerini çıkar
 *
 * Beklenen Excel formatı:
 * | Gösterge Kodu | A | B | C | GO | HD | ÖD |
 * | SYPG-İLSM-1   | 750 | 10 | | | | |
 */
export const parseGorenExcel = (
  file: ArrayBuffer
): { success: boolean; data?: Record<string, ParameterValues>; error?: string } => {
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

    if (!codeColumn) {
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
  fileId?: string;
  error?: string;
}> => {
  try {
    // 1. Dosyayı oku ve parse et
    const arrayBuffer = await file.arrayBuffer();
    const parseResult = parseGorenExcel(arrayBuffer);

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
