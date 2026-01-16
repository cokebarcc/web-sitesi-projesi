import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import * as XLSX from 'xlsx';

export interface GreenAreaData {
  hospitalName: string;
  greenAreaCount: number;
  totalCount: number;
  greenAreaRate: number;
}

export interface GreenAreaFile {
  id: string;
  date: string; // YYYY-MM-DD format
  fileName: string;
  fileUrl: string;
  recordCount: number;
  uploadedAt: number;
  uploadedBy: string;
  data: GreenAreaData[];
}

/**
 * Upload green area Excel file to Firebase Storage
 */
export async function uploadGreenAreaFile(
  file: File,
  date: string, // YYYY-MM-DD format
  uploadedBy: string
): Promise<{ success: boolean; data?: GreenAreaData[]; recordCount?: number; error?: string }> {
  try {
    console.log('🚀 [YEŞİL ALAN] Dosya yükleme başlıyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `green-area/${date}/${timestamp}_${sanitizedFileName}`;

    console.log('📁 [YEŞİL ALAN] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    console.log('✅ [YEŞİL ALAN] Dosya Storage\'a yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [YEŞİL ALAN] URL alındı');

    // Parse file
    console.log('📊 [YEŞİL ALAN] Excel parse ediliyor...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const normalizeText = (text: string): string => {
      return String(text || "")
        .trim()
        .replace(/\s+/g, ' ');
    };

    const findColumn = (obj: any, patterns: string[]) => {
      return Object.keys(obj).find(k => {
        const kn = normalizeText(k).toLocaleLowerCase('tr-TR');
        return patterns.some(p => kn.includes(p.toLocaleLowerCase('tr-TR')));
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

    // Find columns - Excel yapısı: Kurum Adı, Yeşil Alan Muayene Sayısı, Toplam Muayene Sayısı
    const colName = findColumn(jsonData[0], ['Kurum Adı', 'Kurum', 'Hastane']);
    const colGreen = findColumn(jsonData[0], ['Yeşil Alan Muayene', 'Yeşil Alan']);
    const colTotal = findColumn(jsonData[0], ['Toplam Muayene', 'Toplam']);

    if (!colName || !colGreen || !colTotal) {
      console.error('Bulunan sütunlar:', { colName, colGreen, colTotal });
      console.error('Mevcut sütunlar:', Object.keys(jsonData[0] || {}));
      return { success: false, error: 'Gerekli sütunlar bulunamadı. Excel\'de "Kurum Adı", "Yeşil Alan Muayene Sayısı", "Toplam Muayene Sayısı" sütunları olmalı.' };
    }

    const data: GreenAreaData[] = [];
    jsonData.forEach(row => {
      const hospitalName = normalizeText(row[colName]);
      if (!hospitalName) return;

      const greenAreaCount = parseNum(row[colGreen]);
      const totalCount = parseNum(row[colTotal]);
      const greenAreaRate = totalCount > 0 ? (greenAreaCount / totalCount) * 100 : 0;

      data.push({
        hospitalName,
        greenAreaCount,
        totalCount,
        greenAreaRate
      });
    });

    const recordCount = data.length;
    console.log('✅ [YEŞİL ALAN] Parse tamamlandı:', recordCount, 'hastane');

    // Save to appData/greenArea document (using existing collection that has permissions)
    const greenAreaDocRef = doc(db, 'appData', 'greenArea');
    const existingDoc = await getDoc(greenAreaDocRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : { files: {} };

    // Store data by date key
    const filesMap = existingData.files || {};
    filesMap[date] = {
      date,
      fileName: file.name,
      fileUrl,
      recordCount,
      uploadedAt: timestamp,
      uploadedBy,
      data
    };

    await setDoc(greenAreaDocRef, { files: filesMap, lastUpdated: new Date().toISOString() });
    console.log('✅ [YEŞİL ALAN] Metadata Firestore\'a kaydedildi');

    return { success: true, data, recordCount };

  } catch (error: any) {
    console.error('❌ [YEŞİL ALAN] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get green area files metadata from Firestore
 */
export async function getGreenAreaFiles(date?: string): Promise<GreenAreaFile[]> {
  try {
    const greenAreaDocRef = doc(db, 'appData', 'greenArea');
    const docSnap = await getDoc(greenAreaDocRef);

    if (!docSnap.exists()) {
      return [];
    }

    const data = docSnap.data();
    const filesMap = data.files || {};

    const files: GreenAreaFile[] = Object.entries(filesMap).map(([key, value]: [string, any]) => ({
      id: key,
      ...value
    }));

    // Filter by date if specified
    const filteredFiles = date ? files.filter(f => f.date === date) : files;

    // Sort by uploadedAt in memory
    return filteredFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);
  } catch (error) {
    console.error('❌ Dosya listesi yükleme hatası:', error);
    return [];
  }
}

/**
 * Load green area data for a specific date
 */
export async function loadGreenAreaData(date: string): Promise<GreenAreaData[] | null> {
  try {
    const files = await getGreenAreaFiles(date);
    if (files.length === 0) {
      console.log(`📭 [YEŞİL ALAN] ${date} için veri bulunamadı`);
      return null;
    }

    // Return the most recent file's data
    const latestFile = files[0];
    console.log(`✅ [YEŞİL ALAN] ${date} için ${latestFile.recordCount} hastane verisi yüklendi`);
    return latestFile.data;
  } catch (error) {
    console.error('❌ Yeşil alan verisi yükleme hatası:', error);
    return null;
  }
}

/**
 * Get all available dates that have green area data
 */
export async function getAvailableGreenAreaDates(): Promise<string[]> {
  try {
    const files = await getGreenAreaFiles();
    const dates = [...new Set(files.map(f => f.date))];
    return dates.sort((a, b) => b.localeCompare(a)); // En yeni tarih önce
  } catch (error) {
    console.error('❌ Tarih listesi yükleme hatası:', error);
    return [];
  }
}
