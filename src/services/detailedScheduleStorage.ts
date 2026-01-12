import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

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
 * BASIT TEST: Sadece dosyayı Storage'a yükle
 */
export async function uploadDetailedScheduleFile(
  file: File,
  hospital: string,
  month: string,
  year: number,
  uploadedBy: string
): Promise<{ success: boolean; recordCount?: number; error?: string }> {
  try {
    console.log('🚀 [STORAGE] Yükleme başlıyor...');
    console.log('📝 [STORAGE] Parametreler:', { hospital, month, year, uploadedBy, fileName: file.name });

    // Basit dosya yolu
    const timestamp = Date.now();
    const storagePath = `test/${timestamp}_${file.name}`;
    console.log('📁 [STORAGE] Yol:', storagePath);

    // Storage referansı oluştur
    const storageRef = ref(storage, storagePath);
    console.log('✅ [STORAGE] Referans oluşturuldu');

    // Dosyayı yükle
    console.log('⬆️  [STORAGE] uploadBytes çağrılıyor...');
    const snapshot = await uploadBytes(storageRef, file);
    console.log('✅ [STORAGE] uploadBytes başarılı!', snapshot);

    // URL al
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ [STORAGE] Download URL alındı:', fileUrl);

    console.log('🎉 [STORAGE] Yükleme BAŞARILI!');
    return { success: true, recordCount: 1 };

  } catch (error: any) {
    console.error('❌ [STORAGE] HATA:', error);
    console.error('❌ [STORAGE] Hata mesajı:', error.message);
    console.error('❌ [STORAGE] Hata kodu:', error.code);
    console.error('❌ [STORAGE] Tam hata:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Geçici: Boş liste döndür
 */
export async function getDetailedScheduleFiles(): Promise<DetailedScheduleFile[]> {
  return [];
}

/**
 * Geçici: Boş liste döndür
 */
export async function loadAllDetailedScheduleData(): Promise<any[]> {
  return [];
}
