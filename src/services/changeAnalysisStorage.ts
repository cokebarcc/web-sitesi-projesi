import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import { ScheduleVersion } from '../../types';

export interface ChangeAnalysisFile {
  id: string;
  hospital: string;
  month: string;
  year: number;
  versionLabel: string;
  fileName: string;
  fileUrl: string;
  timestamp: number;
  uploadedBy: string;
  monthKey: string;
}

/**
 * Upload change analysis version file to Firebase Storage
 */
export async function uploadChangeAnalysisVersion(
  file: File,
  hospital: string,
  month: string,
  year: number,
  versionLabel: string,
  versionData: ScheduleVersion,
  uploadedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🚀 [CHANGE-ANALYSIS] Versiyon yükleme başlıyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const monthKey = `${year}-${month}`;
    const storagePath = `change-analysis/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    console.log('📁 [CHANGE-ANALYSIS] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    console.log('✅ [CHANGE-ANALYSIS] Dosya Storage\'a yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [CHANGE-ANALYSIS] URL alındı');

    // Save metadata to Firestore
    const metadata: Omit<ChangeAnalysisFile, 'id'> = {
      hospital,
      month,
      year,
      versionLabel,
      fileName: file.name,
      fileUrl,
      timestamp,
      uploadedBy,
      monthKey
    };

    await addDoc(collection(db, 'changeAnalysisFiles'), metadata);
    console.log('✅ [CHANGE-ANALYSIS] Metadata Firestore\'a kaydedildi');

    return { success: true };

  } catch (error: any) {
    console.error('❌ [CHANGE-ANALYSIS] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get all change analysis files metadata from Firestore
 */
export async function getChangeAnalysisFiles(
  hospital?: string,
  month?: string,
  year?: number
): Promise<ChangeAnalysisFile[]> {
  try {
    const constraints = [];

    if (hospital) constraints.push(where('hospital', '==', hospital));
    if (month) constraints.push(where('month', '==', month));
    if (year) constraints.push(where('year', '==', year));

    let q;
    if (constraints.length > 0) {
      q = query(collection(db, 'changeAnalysisFiles'), ...constraints);
    } else {
      q = query(collection(db, 'changeAnalysisFiles'));
    }

    const querySnapshot = await getDocs(q);
    const files: ChangeAnalysisFile[] = [];

    querySnapshot.forEach((doc) => {
      files.push({
        id: doc.id,
        ...(doc.data() as Record<string, any>)
      } as ChangeAnalysisFile);
    });

    // Sort by timestamp (newest first)
    return files.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('❌ Dosya listesi yükleme hatası:', error);
    return [];
  }
}

/**
 * Load only metadata (labels/timestamps) for versions - NOT full data
 * Use loadChangeAnalysisVersionFromUrl() to load full data when needed
 */
export async function loadAllChangeAnalysisVersions(
  hospital?: string,
  month?: string,
  year?: number
): Promise<Record<string, Record<string, ScheduleVersion>>> {
  try {
    const files = await getChangeAnalysisFiles(hospital, month, year);
    const allVersions: Record<string, Record<string, ScheduleVersion>> = {};

    console.log(`📦 [CHANGE-ANALYSIS] ${files.length} dosya metadata yükleniyor...`);

    for (const file of files) {
      // Store only metadata - prevent memory overflow
      const metadata: ScheduleVersion = {
        label: file.versionLabel,
        timestamp: file.timestamp,
        physicianSummaries: [], // Empty - loaded on demand
        rawScheduleData: [], // Empty - loaded on demand
        fileUrl: file.fileUrl // Store URL for lazy loading
      } as any;

      if (!allVersions[file.monthKey]) {
        allVersions[file.monthKey] = {};
      }
      allVersions[file.monthKey][file.versionLabel] = metadata;
      console.log(`✅ [CHANGE-ANALYSIS] ${file.monthKey} / ${file.versionLabel} metadata yüklendi`);
    }

    return allVersions;
  } catch (error) {
    console.error('❌ Metadata yükleme hatası:', error);
    return {};
  }
}

/**
 * Load single version's full data on demand
 */
export async function loadSingleVersionData(fileUrl: string): Promise<ScheduleVersion | null> {
  try {
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (!pathMatch) throw new Error(`Invalid file URL: ${fileUrl}`);

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);
    const blob = await getBlob(storageRef);

    // Check if it's a JSON file (our saved format) or Excel file (legacy)
    if (fileUrl.includes('.json')) {
      // Parse JSON (our primary format)
      const text = await blob.text();
      const versionData = JSON.parse(text) as ScheduleVersion;
      console.log('✅ [CHANGE-ANALYSIS] JSON verisi parse edildi:', fileUrl);
      return versionData;
    } else if (fileUrl.includes('.xlsx') || fileUrl.includes('.xls')) {
      // Parse Excel file (legacy format - should not happen with new uploads)
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = await import('xlsx').then(XLSX => XLSX.read(arrayBuffer, { type: 'array' }));

      // Import the parsing function
      const { parseExcelToScheduleVersion } = await import('./excelParser');
      const versionData = parseExcelToScheduleVersion(workbook, fileUrl);
      console.log('✅ [CHANGE-ANALYSIS] Excel verisi parse edildi:', fileUrl);

      return versionData;
    } else {
      console.error('❌ [CHANGE-ANALYSIS] Bilinmeyen dosya formatı:', fileUrl);
      return null;
    }
  } catch (error) {
    console.error('❌ Versiyon verisi yükleme hatası:', error);
    return null;
  }
}

/**
 * Load change analysis version data from a specific URL
 */
async function loadChangeAnalysisVersionFromUrl(
  fileUrl: string,
  versionLabel: string,
  monthKey: string
): Promise<ScheduleVersion | null> {
  try {
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (!pathMatch) throw new Error(`Invalid file URL: ${fileUrl}`);

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);
    const blob = await getBlob(storageRef);

    // Parse the JSON data stored in the blob
    const text = await blob.text();
    const versionData = JSON.parse(text) as ScheduleVersion;

    return versionData;
  } catch (error) {
    console.error('❌ Versiyon dosyası okuma hatası:', error);
    return null;
  }
}

/**
 * Save raw Excel file directly to storage (no JSON conversion to prevent memory overflow)
 */
export async function saveExcelFileToStorage(
  file: File,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; error?: string; fileUrl?: string }> {
  try {
    console.log('🚀 [CHANGE-ANALYSIS] Excel dosyası kaydediliyor...');

    const timestamp = Date.now();
    const monthKey = `${hospital}-${year}-${month}`;
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `change-analysis/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}.xlsx`;

    console.log('📁 [CHANGE-ANALYSIS] Yol:', storagePath);

    // Upload raw Excel file directly - no parsing/stringifying
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    console.log('✅ [CHANGE-ANALYSIS] Excel Storage\'a yüklendi');

    // Save metadata to Firestore
    await addDoc(collection(db, 'changeAnalysisFiles'), {
      hospital,
      month,
      year,
      versionLabel: file.name,
      fileName: file.name,
      fileUrl,
      timestamp,
      uploadedBy,
      monthKey
    });

    console.log('✅ [CHANGE-ANALYSIS] Metadata Firestore\'a kaydedildi');
    return { success: true, fileUrl };
  } catch (error: any) {
    console.error('❌ [CHANGE-ANALYSIS] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Save version data as JSON to storage
 */
export async function saveVersionAsJson(
  versionData: ScheduleVersion,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; error?: string; fileUrl?: string }> {
  try {
    console.log('🚀 [CHANGE-ANALYSIS] JSON versiyon kaydediliyor...');

    const timestamp = Date.now();
    const monthKey = `${hospital}-${year}-${month}`;
    const sanitizedFileName = versionData.label.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `change-analysis/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}.json`;

    console.log('📁 [CHANGE-ANALYSIS] Yol:', storagePath);

    // Convert version data to JSON blob
    const jsonBlob = new Blob([JSON.stringify(versionData)], { type: 'application/json' });

    // Upload to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, jsonBlob);
    console.log('✅ [CHANGE-ANALYSIS] JSON Storage\'a yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [CHANGE-ANALYSIS] URL alındı');

    // Save metadata to Firestore
    const metadata: Omit<ChangeAnalysisFile, 'id'> = {
      hospital,
      month,
      year,
      versionLabel: versionData.label,
      fileName: `${versionData.label}.json`,
      fileUrl,
      timestamp,
      uploadedBy,
      monthKey
    };

    await addDoc(collection(db, 'changeAnalysisFiles'), metadata);
    console.log('✅ [CHANGE-ANALYSIS] Metadata Firestore\'a kaydedildi');

    return { success: true, fileUrl };

  } catch (error: any) {
    console.error('❌ [CHANGE-ANALYSIS] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}
