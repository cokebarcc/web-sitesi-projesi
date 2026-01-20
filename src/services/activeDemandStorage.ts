import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import * as XLSX from 'xlsx';
import { DemandEntry, BranchDemand, DemandSummary, HospitalDemandSummary } from '../../types';

export interface ActiveDemandFile {
  id: string;
  hospitalId: string;
  hospitalName: string;
  date: string; // YYYY-MM-DD format
  fileName: string;
  fileUrl: string;
  totalDemand: number;
  branchCount: number;
  uploadedAt: number;
  uploadedBy: string;
  branches: BranchDemand[];
}

/**
 * Upload active demand Excel file to Firebase Storage
 */
export async function uploadActiveDemandFile(
  file: File,
  hospitalId: string,
  hospitalName: string,
  date: string, // YYYY-MM-DD format
  uploadedBy: string
): Promise<{ success: boolean; data?: BranchDemand[]; totalDemand?: number; error?: string }> {
  try {
    console.log('[AKTIF TALEP] Dosya yukleme basliyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `active-demand/${hospitalId}/${date}/${timestamp}_${sanitizedFileName}`;

    console.log('[AKTIF TALEP] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    console.log('[AKTIF TALEP] Dosya Storage\'a yuklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('[AKTIF TALEP] URL alindi');

    // Parse file
    console.log('[AKTIF TALEP] Excel parse ediliyor...');
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

    // Find columns - Excel yapisi: Brans Adi, Talep Sayisi
    const colBranch = findColumn(jsonData[0], ['Brans', 'Klinik', 'Poliklinik', 'Uzmanlik']);
    const colDemand = findColumn(jsonData[0], ['Talep', 'Sayi', 'Adet']);

    if (!colBranch || !colDemand) {
      console.error('Bulunan sutunlar:', { colBranch, colDemand });
      console.error('Mevcut sutunlar:', Object.keys(jsonData[0] || {}));
      return { success: false, error: 'Gerekli sutunlar bulunamadi. Excel\'de "Brans/Klinik" ve "Talep Sayisi" sutunlari olmali.' };
    }

    const branches: BranchDemand[] = [];
    let totalDemand = 0;

    jsonData.forEach(row => {
      const branchName = normalizeText(row[colBranch]);
      if (!branchName) return;

      const demandCount = parseNum(row[colDemand]);
      totalDemand += demandCount;

      branches.push({
        branchName,
        demandCount
      });
    });

    console.log('[AKTIF TALEP] Parse tamamlandi:', branches.length, 'brans,', totalDemand, 'toplam talep');

    // Save to appData/activeDemand document
    const activeDemandDocRef = doc(db, 'appData', 'activeDemand');
    const existingDoc = await getDoc(activeDemandDocRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : { files: {} };

    // Store data by hospitalId-date key
    const filesMap = existingData.files || {};
    const key = `${hospitalId}_${date}`;
    filesMap[key] = {
      id: key,
      hospitalId,
      hospitalName,
      date,
      fileName: file.name,
      fileUrl,
      totalDemand,
      branchCount: branches.length,
      uploadedAt: timestamp,
      uploadedBy,
      branches
    };

    await setDoc(activeDemandDocRef, { files: filesMap, lastUpdated: new Date().toISOString() });
    console.log('[AKTIF TALEP] Metadata Firestore\'a kaydedildi');

    return { success: true, data: branches, totalDemand };

  } catch (error: any) {
    console.error('[AKTIF TALEP] HATA:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get active demand files metadata from Firestore
 */
export async function getActiveDemandFiles(date?: string, hospitalId?: string): Promise<ActiveDemandFile[]> {
  try {
    const activeDemandDocRef = doc(db, 'appData', 'activeDemand');
    const docSnap = await getDoc(activeDemandDocRef);

    if (!docSnap.exists()) {
      return [];
    }

    const data = docSnap.data();
    const filesMap = data.files || {};

    let files: ActiveDemandFile[] = Object.values(filesMap);

    // Filter by date if specified
    if (date) {
      files = files.filter(f => f.date === date);
    }

    // Filter by hospitalId if specified
    if (hospitalId) {
      files = files.filter(f => f.hospitalId === hospitalId);
    }

    // Sort by uploadedAt
    return files.sort((a, b) => b.uploadedAt - a.uploadedAt);
  } catch (error) {
    console.error('[AKTIF TALEP] Dosya listesi yukleme hatasi:', error);
    return [];
  }
}

/**
 * Get demand summary for a specific date (aggregated across all hospitals)
 */
export async function getDemandSummary(date: string): Promise<DemandSummary | null> {
  try {
    const files = await getActiveDemandFiles(date);

    if (files.length === 0) {
      console.log(`[AKTIF TALEP] ${date} icin veri bulunamadi`);
      return null;
    }

    let totalProvinceDemand = 0;
    const branchTotalsMap: Record<string, number> = {};
    const hospitalSummaries: HospitalDemandSummary[] = [];

    files.forEach(file => {
      totalProvinceDemand += file.totalDemand;

      hospitalSummaries.push({
        hospitalId: file.hospitalId,
        hospitalName: file.hospitalName,
        totalDemand: file.totalDemand,
        branches: file.branches
      });

      file.branches.forEach(branch => {
        if (!branchTotalsMap[branch.branchName]) {
          branchTotalsMap[branch.branchName] = 0;
        }
        branchTotalsMap[branch.branchName] += branch.demandCount;
      });
    });

    const branchTotals: BranchDemand[] = Object.entries(branchTotalsMap)
      .map(([branchName, demandCount]) => ({ branchName, demandCount }))
      .sort((a, b) => b.demandCount - a.demandCount);

    const summary: DemandSummary = {
      totalProvinceDemand,
      totalHospitals: files.length,
      branchTotals,
      hospitalSummaries: hospitalSummaries.sort((a, b) => b.totalDemand - a.totalDemand)
    };

    console.log(`[AKTIF TALEP] ${date} icin ozet: ${totalProvinceDemand} talep, ${files.length} hastane`);
    return summary;
  } catch (error) {
    console.error('[AKTIF TALEP] Ozet yukleme hatasi:', error);
    return null;
  }
}

/**
 * Get all available dates that have active demand data
 */
export async function getAvailableActiveDemandDates(): Promise<string[]> {
  try {
    const files = await getActiveDemandFiles();
    const dates = [...new Set(files.map(f => f.date))];
    return dates.sort((a, b) => b.localeCompare(a)); // En yeni tarih once
  } catch (error) {
    console.error('[AKTIF TALEP] Tarih listesi yukleme hatasi:', error);
    return [];
  }
}

/**
 * Get available years, months, and days from stored data
 */
export async function getAvailableDateParts(): Promise<{
  years: number[];
  monthsByYear: Record<number, number[]>;
  daysByYearMonth: Record<string, number[]>;
}> {
  try {
    const dates = await getAvailableActiveDemandDates();
    const years = new Set<number>();
    const monthsByYear: Record<number, Set<number>> = {};
    const daysByYearMonth: Record<string, Set<number>> = {};

    dates.forEach(dateStr => {
      const [year, month, day] = dateStr.split('-').map(Number);
      years.add(year);

      if (!monthsByYear[year]) monthsByYear[year] = new Set();
      monthsByYear[year].add(month);

      const key = `${year}-${month}`;
      if (!daysByYearMonth[key]) daysByYearMonth[key] = new Set();
      daysByYearMonth[key].add(day);
    });

    return {
      years: Array.from(years).sort((a, b) => b - a),
      monthsByYear: Object.fromEntries(
        Object.entries(monthsByYear).map(([y, m]) => [Number(y), Array.from(m).sort((a, b) => a - b)])
      ),
      daysByYearMonth: Object.fromEntries(
        Object.entries(daysByYearMonth).map(([k, d]) => [k, Array.from(d).sort((a, b) => a - b)])
      )
    };
  } catch (error) {
    console.error('[AKTIF TALEP] Tarih parcalari yukleme hatasi:', error);
    return { years: [], monthsByYear: {}, daysByYearMonth: {} };
  }
}

/**
 * Delete demand entry for a specific hospital and date
 */
export async function deleteDemandEntry(hospitalId: string, date: string): Promise<boolean> {
  try {
    const activeDemandDocRef = doc(db, 'appData', 'activeDemand');
    const existingDoc = await getDoc(activeDemandDocRef);

    if (!existingDoc.exists()) return false;

    const existingData = existingDoc.data();
    const filesMap = existingData.files || {};
    const key = `${hospitalId}_${date}`;

    if (!filesMap[key]) return false;

    delete filesMap[key];
    await setDoc(activeDemandDocRef, { files: filesMap, lastUpdated: new Date().toISOString() });

    console.log(`[AKTIF TALEP] ${hospitalId} - ${date} verisi silindi`);
    return true;
  } catch (error) {
    console.error('[AKTIF TALEP] Silme hatasi:', error);
    return false;
  }
}

/**
 * Get hospitals that have uploaded data for a specific date
 */
export async function getHospitalsWithData(date: string): Promise<string[]> {
  try {
    const files = await getActiveDemandFiles(date);
    return files.map(f => f.hospitalName);
  } catch (error) {
    console.error('[AKTIF TALEP] Hastane listesi yukleme hatasi:', error);
    return [];
  }
}
