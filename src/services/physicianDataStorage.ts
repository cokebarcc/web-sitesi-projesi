import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import * as XLSX from 'xlsx';
import { MuayeneMetrics } from '../../types';

export interface PhysicianDataFile {
  id: string;
  hospital: string;
  month: string;
  year: number;
  type: 'muayene' | 'ameliyat';
  fileName: string;
  fileUrl: string;
  recordCount: number;
  uploadedAt: number;
  uploadedBy: string;
}

/**
 * Upload muayene Excel file to Firebase Storage
 */
export async function uploadMuayeneFile(
  file: File,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; data?: Record<string, MuayeneMetrics>; recordCount?: number; error?: string }> {
  try {
    console.log('🚀 [MUAYENE] Dosya yükleme başlıyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `physician-data/muayene/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    console.log('📁 [MUAYENE] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    console.log('✅ [MUAYENE] Dosya Storage\'a yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [MUAYENE] URL alındı');

    // Parse file
    console.log('📊 [MUAYENE] Excel parse ediliyor...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const normalizeDoctorName = (name: string): string => {
      return String(name || "")
        .toLocaleUpperCase('tr-TR')
        .trim()
        .replace(/\s+/g, ' ');
    };

    const findColumn = (obj: any, patterns: string[]) => {
      return Object.keys(obj).find(k => {
        const kn = normalizeDoctorName(k);
        return patterns.some(p => kn.includes(normalizeDoctorName(p)));
      });
    };

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "" || val === "-") return 0;
      if (typeof val === 'number') return val;
      let str = String(val).trim();
      if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
      } else {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const colName = findColumn(jsonData[0], ['Hekim Ad Soyad', 'Hekim']);
    const colMhrs = findColumn(jsonData[0], ['MHRS Muayene Sayısı', 'MHRS Muayene']);
    const colAyaktan = findColumn(jsonData[0], ['Ayaktan Muayene Sayısı', 'Ayaktan Muayene']);
    const colToplam = findColumn(jsonData[0], ['Toplam Muayene Sayısı', 'Toplam Muayene']);

    if (!colName || (!colMhrs && !colAyaktan && !colToplam)) {
      return { success: false, error: 'Gerekli sütunlar bulunamadı' };
    }

    const agg: Record<string, MuayeneMetrics> = {};
    jsonData.forEach(row => {
      const docName = normalizeDoctorName(row[colName]);
      if (!docName) return;
      if (!agg[docName]) agg[docName] = { mhrs: 0, ayaktan: 0, toplam: 0 };
      agg[docName].mhrs += parseNum(row[colMhrs]);
      agg[docName].ayaktan += parseNum(row[colAyaktan]);
      agg[docName].toplam += parseNum(row[colToplam]);
    });

    const recordCount = Object.keys(agg).length;
    console.log('✅ [MUAYENE] Parse tamamlandı:', recordCount, 'hekim');

    // Save metadata to Firestore
    const metadata: Omit<PhysicianDataFile, 'id'> = {
      hospital,
      month,
      year,
      type: 'muayene',
      fileName: file.name,
      fileUrl,
      recordCount,
      uploadedAt: timestamp,
      uploadedBy
    };

    await addDoc(collection(db, 'physicianDataFiles'), metadata);
    console.log('✅ [MUAYENE] Metadata Firestore\'a kaydedildi');

    return { success: true, data: agg, recordCount };

  } catch (error: any) {
    console.error('❌ [MUAYENE] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Upload ameliyat Excel file to Firebase Storage
 */
export async function uploadAmeliyatFile(
  file: File,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; data?: Record<string, number>; recordCount?: number; error?: string }> {
  try {
    console.log('🚀 [AMELIYAT] Dosya yükleme başlıyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `physician-data/ameliyat/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    console.log('📁 [AMELIYAT] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    console.log('✅ [AMELIYAT] Dosya Storage\'a yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [AMELIYAT] URL alındı');

    // Parse file
    console.log('📊 [AMELIYAT] Excel parse ediliyor...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const normalizeDoctorName = (name: string): string => {
      return String(name || "")
        .toLocaleUpperCase('tr-TR')
        .trim()
        .replace(/\s+/g, ' ');
    };

    const findColumn = (obj: any, patterns: string[]) => {
      return Object.keys(obj).find(k => {
        const kn = normalizeDoctorName(k);
        return patterns.some(p => kn.includes(normalizeDoctorName(p)));
      });
    };

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "" || val === "-") return 0;
      if (typeof val === 'number') return val;
      let str = String(val).trim();
      if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
      } else {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const colName = findColumn(jsonData[0], ['Hekim Ad Soyad', 'Hekim']);
    const colSurg = findColumn(jsonData[0], ['A+B+C Grubu Ameliyat', 'Ameliyat Sayısı', 'ABC Ameliyat']);

    if (!colName || !colSurg) {
      return { success: false, error: 'Gerekli sütunlar bulunamadı' };
    }

    const agg: Record<string, number> = {};
    jsonData.forEach(row => {
      const docName = normalizeDoctorName(row[colName]);
      if (!docName) return;
      agg[docName] = (agg[docName] || 0) + parseNum(row[colSurg]);
    });

    const recordCount = Object.keys(agg).length;
    console.log('✅ [AMELIYAT] Parse tamamlandı:', recordCount, 'hekim');

    // Save metadata to Firestore
    const metadata: Omit<PhysicianDataFile, 'id'> = {
      hospital,
      month,
      year,
      type: 'ameliyat',
      fileName: file.name,
      fileUrl,
      recordCount,
      uploadedAt: timestamp,
      uploadedBy
    };

    await addDoc(collection(db, 'physicianDataFiles'), metadata);
    console.log('✅ [AMELIYAT] Metadata Firestore\'a kaydedildi');

    return { success: true, data: agg, recordCount };

  } catch (error: any) {
    console.error('❌ [AMELIYAT] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get all physician data files metadata from Firestore
 */
export async function getPhysicianDataFiles(
  hospital?: string,
  month?: string,
  year?: number,
  type?: 'muayene' | 'ameliyat'
): Promise<PhysicianDataFile[]> {
  try {
    const constraints = [];

    if (hospital) constraints.push(where('hospital', '==', hospital));
    if (month) constraints.push(where('month', '==', month));
    if (year) constraints.push(where('year', '==', year));
    if (type) constraints.push(where('type', '==', type));

    let q;
    if (constraints.length > 0) {
      q = query(collection(db, 'physicianDataFiles'), ...constraints);
    } else {
      q = query(collection(db, 'physicianDataFiles'));
    }

    const querySnapshot = await getDocs(q);
    const files: PhysicianDataFile[] = [];

    querySnapshot.forEach((doc) => {
      files.push({
        id: doc.id,
        ...doc.data()
      } as PhysicianDataFile);
    });

    // Sort by uploadedAt in memory instead of using orderBy
    return files.sort((a, b) => b.uploadedAt - a.uploadedAt);
  } catch (error) {
    console.error('❌ Dosya listesi yükleme hatası:', error);
    return [];
  }
}

/**
 * Load all muayene data from Storage
 */
export async function loadAllMuayeneData(): Promise<Record<string, Record<string, MuayeneMetrics>>> {
  try {
    const files = await getPhysicianDataFiles(undefined, undefined, undefined, 'muayene');
    const allData: Record<string, Record<string, MuayeneMetrics>> = {};

    console.log(`📦 [MUAYENE] ${files.length} dosya yüklenecek...`);

    for (const file of files) {
      const periodKey = `${file.year}-${file.month}`;
      const data = await loadMuayeneDataFromUrl(file.fileUrl);
      allData[periodKey] = data;
      console.log(`✅ [MUAYENE] ${periodKey}: ${Object.keys(data).length} hekim`);
    }

    return allData;
  } catch (error) {
    console.error('❌ Tüm muayene dosyalarını yükleme hatası:', error);
    return {};
  }
}

/**
 * Load all ameliyat data from Storage
 */
export async function loadAllAmeliyatData(): Promise<Record<string, Record<string, number>>> {
  try {
    const files = await getPhysicianDataFiles(undefined, undefined, undefined, 'ameliyat');
    const allData: Record<string, Record<string, number>> = {};

    console.log(`📦 [AMELIYAT] ${files.length} dosya yüklenecek...`);

    for (const file of files) {
      const periodKey = `${file.year}-${file.month}`;
      const data = await loadAmeliyatDataFromUrl(file.fileUrl);
      allData[periodKey] = data;
      console.log(`✅ [AMELIYAT] ${periodKey}: ${Object.keys(data).length} hekim`);
    }

    return allData;
  } catch (error) {
    console.error('❌ Tüm ameliyat dosyalarını yükleme hatası:', error);
    return {};
  }
}

/**
 * Load muayene data from a specific URL
 */
async function loadMuayeneDataFromUrl(fileUrl: string): Promise<Record<string, MuayeneMetrics>> {
  try {
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (!pathMatch) throw new Error(`Invalid file URL: ${fileUrl}`);

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);
    const blob = await getBlob(storageRef);
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const normalizeDoctorName = (name: string): string => {
      return String(name || "")
        .toLocaleUpperCase('tr-TR')
        .trim()
        .replace(/\s+/g, ' ');
    };

    const findColumn = (obj: any, patterns: string[]) => {
      return Object.keys(obj).find(k => {
        const kn = normalizeDoctorName(k);
        return patterns.some(p => kn.includes(normalizeDoctorName(p)));
      });
    };

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "" || val === "-") return 0;
      if (typeof val === 'number') return val;
      let str = String(val).trim();
      if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
      } else {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const colName = findColumn(jsonData[0], ['Hekim Ad Soyad', 'Hekim']);
    const colMhrs = findColumn(jsonData[0], ['MHRS Muayene Sayısı', 'MHRS Muayene']);
    const colAyaktan = findColumn(jsonData[0], ['Ayaktan Muayene Sayısı', 'Ayaktan Muayene']);
    const colToplam = findColumn(jsonData[0], ['Toplam Muayene Sayısı', 'Toplam Muayene']);

    const agg: Record<string, MuayeneMetrics> = {};
    jsonData.forEach(row => {
      const docName = normalizeDoctorName(row[colName!]);
      if (!docName) return;
      if (!agg[docName]) agg[docName] = { mhrs: 0, ayaktan: 0, toplam: 0 };
      agg[docName].mhrs += parseNum(row[colMhrs!]);
      agg[docName].ayaktan += parseNum(row[colAyaktan!]);
      agg[docName].toplam += parseNum(row[colToplam!]);
    });

    return agg;
  } catch (error) {
    console.error('❌ Muayene dosyası okuma hatası:', error);
    return {};
  }
}

/**
 * Load ameliyat data from a specific URL
 */
async function loadAmeliyatDataFromUrl(fileUrl: string): Promise<Record<string, number>> {
  try {
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (!pathMatch) throw new Error(`Invalid file URL: ${fileUrl}`);

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);
    const blob = await getBlob(storageRef);
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const normalizeDoctorName = (name: string): string => {
      return String(name || "")
        .toLocaleUpperCase('tr-TR')
        .trim()
        .replace(/\s+/g, ' ');
    };

    const findColumn = (obj: any, patterns: string[]) => {
      return Object.keys(obj).find(k => {
        const kn = normalizeDoctorName(k);
        return patterns.some(p => kn.includes(normalizeDoctorName(p)));
      });
    };

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "" || val === "-") return 0;
      if (typeof val === 'number') return val;
      let str = String(val).trim();
      if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
      } else {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const colName = findColumn(jsonData[0], ['Hekim Ad Soyad', 'Hekim']);
    const colSurg = findColumn(jsonData[0], ['A+B+C Grubu Ameliyat', 'Ameliyat Sayısı', 'ABC Ameliyat']);

    const agg: Record<string, number> = {};
    jsonData.forEach(row => {
      const docName = normalizeDoctorName(row[colName!]);
      if (!docName) return;
      agg[docName] = (agg[docName] || 0) + parseNum(row[colSurg!]);
    });

    return agg;
  } catch (error) {
    console.error('❌ Ameliyat dosyası okuma hatası:', error);
    return {};
  }
}
