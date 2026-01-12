import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getBlob } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import * as XLSX from 'xlsx';
import { DetailedScheduleData } from '../../types';

export interface DetailedScheduleFile {
  id: string;
  hospital: string;
  month: string;
  year: number;
  fileName: string;
  fileUrl: string;
  recordCount: number;
  uploadedAt: number;
  uploadedBy: string;
}

/**
 * Upload Excel file to Firebase Storage and save metadata to Firestore
 */
export async function uploadDetailedScheduleFile(
  file: File,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; recordCount?: number; error?: string }> {
  try {
    console.log('🚀 [STORAGE] Dosya yükleme başlıyor...');

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `detailed-schedules/${hospital}/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    console.log('📁 [STORAGE] Yol:', storagePath);

    // Upload file to Storage
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    console.log('✅ [STORAGE] Dosya yüklendi');

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [STORAGE] URL alındı:', fileUrl);

    // Parse file to count records
    console.log('📊 [STORAGE] Excel parse ediliyor...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    let recordCount = 0;

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) as any[];
      recordCount += jsonData.filter(row => {
        const findKey = (patterns: string[]) => {
          const cleanStr = (str: any) => String(str || "").toLocaleLowerCase('tr-TR').trim()
            .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
            .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, '');
          return Object.keys(row).find(k => patterns.some(p => cleanStr(k) === cleanStr(p)));
        };
        const doctorName = row[findKey(['Hekim Ad Soyad', 'Hekim', 'Ad Soyad']) || ''];
        return doctorName && String(doctorName).trim() !== "";
      }).length;
    });

    console.log('✅ [STORAGE] Parse tamamlandı:', recordCount, 'kayıt');

    // Save metadata to Firestore
    const metadata: Omit<DetailedScheduleFile, 'id'> = {
      hospital,
      month,
      year,
      fileName: file.name,
      fileUrl,
      recordCount,
      uploadedAt: timestamp,
      uploadedBy
    };

    await addDoc(collection(db, 'detailedScheduleFiles'), metadata);
    console.log('✅ [STORAGE] Metadata Firestore\'a kaydedildi');

    console.log('🎉 [STORAGE] İşlem BAŞARILI:', recordCount, 'kayıt');
    return { success: true, recordCount };

  } catch (error: any) {
    console.error('❌ [STORAGE] HATA:', error);
    console.error('❌ [STORAGE] Mesaj:', error.message);
    console.error('❌ [STORAGE] Kod:', error.code);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get all detailed schedule files metadata from Firestore
 * @param hospital Optional hospital filter
 */
export async function getDetailedScheduleFiles(hospital?: string): Promise<DetailedScheduleFile[]> {
  try {
    let querySnapshot;

    if (hospital) {
      // Sadece belirli hastaneye ait dosyaları getir
      const q = query(collection(db, 'detailedScheduleFiles'), where('hospital', '==', hospital));
      querySnapshot = await getDocs(q);
    } else {
      // Tüm dosyaları getir
      querySnapshot = await getDocs(collection(db, 'detailedScheduleFiles'));
    }

    const files: DetailedScheduleFile[] = [];

    querySnapshot.forEach((doc) => {
      files.push({
        id: doc.id,
        ...doc.data()
      } as DetailedScheduleFile);
    });

    return files.sort((a, b) => b.uploadedAt - a.uploadedAt);
  } catch (error) {
    console.error('❌ Dosya listesi yükleme hatası:', error);
    return [];
  }
}

/**
 * Download and parse a detailed schedule file from Storage
 */
export async function loadDetailedScheduleData(
  fileUrl: string,
  hospital: string,
  month: string,
  year: number
): Promise<DetailedScheduleData[]> {
  try {
    console.log(`📂 Dosya indiriliyor: ${hospital} ${month} ${year}`);

    // Extract storage path from URL and use getBlob to avoid CORS issues
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (!pathMatch) {
      console.error('❌ URL parse hatası:', fileUrl);
      throw new Error(`Invalid file URL: ${fileUrl}`);
    }

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);
    const blob = await getBlob(storageRef);
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      type: 'array',
      cellDates: true,
      cellNF: true
    });

    const allData: DetailedScheduleData[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) as any[];

      jsonData.forEach((row, idx) => {
        const cleanForMatch = (str: any) => String(str || "").toLocaleLowerCase('tr-TR').trim()
          .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
          .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, '');

        const findKey = (patterns: string[]) => Object.keys(row).find(k =>
          patterns.some(p => cleanForMatch(k) === cleanForMatch(p))
        );

        const doctorNameRaw = row[findKey(['Hekim Ad Soyad', 'Hekim', 'Ad Soyad']) || ''];
        if (!doctorNameRaw || String(doctorNameRaw).trim() === "") return;

        const rawDateVal = row[findKey(['Aksiyon Tarihi', 'Tarih', 'Günü']) || ''];
        const specialtyRaw = row[findKey(['Klinik Adı', 'Klinik', 'Branş', 'Bölüm']) || ''];
        const actionRaw = row[findKey(['Aksiyon', 'İşlem']) || ''];
        const capacityRaw = row[findKey(['Randevu Kapasitesi', 'Kapasite', 'Slot Sayısı']) || ''];
        const startTimeRaw = row[findKey(['Aksiyon Başlangıç Saati', 'Başlangıç Saati', 'Saat']) || ''];
        const endTimeRaw = row[findKey(['Aksiyon Bitiş Saati', 'Bitiş Saati']) || ''];

        let dateStr = "Bilinmiyor";
        if (rawDateVal) {
          let dateObj: Date | null = null;
          if (rawDateVal instanceof Date) {
            dateObj = new Date(rawDateVal.getTime());
            if (dateObj.getHours() >= 21) dateObj.setHours(dateObj.getHours() + 4);
            dateObj.setHours(12, 0, 0, 0);
          } else if (typeof rawDateVal === 'string') {
            const parts = rawDateVal.trim().split(/[./-]/);
            if (parts.length === 3) {
              const d = parseInt(parts[0]);
              const mon = parseInt(parts[1]);
              let y = parseInt(parts[2]);
              if (y < 100) y += 2000;
              if (!isNaN(mon) && mon >= 1 && mon <= 12) {
                dateObj = new Date(y, mon - 1, d);
              }
            }
          } else if (typeof rawDateVal === 'number') {
            dateObj = new Date(Math.round((rawDateVal - 25569) * 864e5));
            dateObj.setHours(12, 0, 0, 0);
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            dateStr = `${dd}.${mm}.${yyyy}`;
          }
        }

        const parseTimeToMinutes = (val: any) => {
          if (!val) return 0;
          if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
          if (typeof val === 'number') return Math.round(val * 1440);
          const parts = String(val).trim().split(':');
          return parts.length >= 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
        };

        const startMins = parseTimeToMinutes(startTimeRaw);
        const endMins = parseTimeToMinutes(endTimeRaw);
        let duration = endMins - startMins;
        if (duration < 0) duration += 1440;

        const formatTime = (mins: number) =>
          `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

        allData.push({
          id: `ds-${Date.now()}-${sheetName}-${idx}-${Math.random()}`,
          specialty: String(specialtyRaw || sheetName || 'Bilinmiyor').toUpperCase().trim(),
          doctorName: String(doctorNameRaw).trim().toUpperCase(),
          hospital,
          startDate: dateStr,
          startTime: startTimeRaw ? (typeof startTimeRaw === 'string' ? startTimeRaw : formatTime(startMins)) : '',
          endDate: '',
          endTime: endTimeRaw ? (typeof endTimeRaw === 'string' ? endTimeRaw : formatTime(endMins)) : '',
          action: String(actionRaw || 'Belirsiz').trim(),
          slotCount: 0,
          duration,
          capacity: parseFloat(String(capacityRaw).replace(/\./g, '').replace(',', '.')) || 0,
          month,
          year
        });
      });
    });

    console.log(`✅ ${allData.length} kayıt yüklendi`);
    return allData;
  } catch (error) {
    console.error('❌ Dosya okuma hatası:', error);
    return [];
  }
}

/**
 * Delete a detailed schedule file and its metadata
 */
export async function deleteDetailedScheduleFile(fileId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'detailedScheduleFiles', fileId));
    console.log(`✅ Dosya silindi: ${fileId}`);
    return true;
  } catch (error) {
    console.error('❌ Dosya silme hatası:', error);
    return false;
  }
}

/**
 * Load all detailed schedule data from all files
 * @param hospital Optional hospital filter - only load files from specific hospital
 */
export async function loadAllDetailedScheduleData(hospital?: string): Promise<DetailedScheduleData[]> {
  try {
    const files = await getDetailedScheduleFiles(hospital);
    const allData: DetailedScheduleData[] = [];

    console.log(`📦 ${files.length} dosya yüklenecek...` + (hospital ? ` (Hastane: ${hospital})` : ''));

    for (const file of files) {
      const data = await loadDetailedScheduleData(file.fileUrl, file.hospital, file.month, file.year);
      allData.push(...data);
    }

    console.log(`✅ Toplam ${allData.length} kayıt yüklendi`);
    return allData;
  } catch (error) {
    console.error('❌ Tüm dosyaları yükleme hatası:', error);
    return [];
  }
}
