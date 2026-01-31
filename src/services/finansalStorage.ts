import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../../firebase';

export interface FinansalFileMetadata {
  fileName: string;
  fileUrl: string;
  storagePath: string;
  uploadedAt: number;
  fileSize: number;
}

type ModuleKey = 'ekListe' | 'sutMevzuati' | 'gil' | 'hekimIslem';
type SubKey = string; // ek2a, ek2a2, ek2b, ek2c, ek2cd, sut, gil

/**
 * Upload a file to Firebase Storage for a finansal module
 */
export async function uploadFinansalFile(
  moduleKey: ModuleKey,
  subKey: SubKey,
  file: File
): Promise<{ success: boolean; metadata?: FinansalFileMetadata; error?: string }> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `finansal/${moduleKey}/${subKey}/${timestamp}_${sanitizedFileName}`;

    // Upload to Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);

    const metadata: FinansalFileMetadata = {
      fileName: file.name,
      fileUrl,
      storagePath,
      uploadedAt: timestamp,
      fileSize: file.size
    };

    // Save metadata to Firestore
    const docRef = doc(db, 'appData', 'finansal');
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    const moduleData = existingData[moduleKey] || {};
    moduleData[subKey] = metadata;

    const writeData = { ...existingData, [moduleKey]: moduleData, lastUpdated: new Date().toISOString() };
    console.log(`[FINANSAL] Firestore yazılacak data (${moduleKey}/${subKey}):`, JSON.stringify(Object.keys(writeData)));
    await setDoc(docRef, writeData, { merge: true });

    // Doğrulama: yazılan veriyi geri oku
    const verifyDoc = await getDoc(docRef);
    const verifyData = verifyDoc.exists() ? verifyDoc.data() : null;
    console.log(`[FINANSAL] Firestore doğrulama - ${moduleKey}/${subKey} mevcut mu:`, !!verifyData?.[moduleKey]?.[subKey]);

    return { success: true, metadata };
  } catch (error: any) {
    console.error(`[FINANSAL] ${moduleKey}/${subKey} yükleme hatası:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get file metadata for a specific module/subkey from Firestore
 */
export async function getFinansalFileMetadata(
  moduleKey: ModuleKey,
  subKey: SubKey
): Promise<FinansalFileMetadata | null> {
  try {
    const docRef = doc(db, 'appData', 'finansal');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`[FINANSAL] ${moduleKey}/${subKey} - appData/finansal doc bulunamadı`);
      return null;
    }

    const data = docSnap.data();
    console.log(`[FINANSAL] ${moduleKey}/${subKey} - Doc key'leri:`, Object.keys(data), `| ${moduleKey} var mı:`, !!data[moduleKey], `| ${subKey} var mı:`, !!data[moduleKey]?.[subKey]);
    return data[moduleKey]?.[subKey] || null;
  } catch (error) {
    console.error(`[FINANSAL] ${moduleKey}/${subKey} metadata okuma hatası:`, error);
    return null;
  }
}

/**
 * Get all file metadata for a module
 */
export async function getFinansalModuleFiles(
  moduleKey: ModuleKey
): Promise<Record<string, FinansalFileMetadata>> {
  try {
    const docRef = doc(db, 'appData', 'finansal');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return {};

    const data = docSnap.data();
    return data[moduleKey] || {};
  } catch (error) {
    console.error(`[FINANSAL] ${moduleKey} modül dosyaları okuma hatası:`, error);
    return {};
  }
}

/**
 * Download a file from Firebase Storage as ArrayBuffer
 */
export async function downloadFinansalFile(
  storagePath: string
): Promise<ArrayBuffer | null> {
  try {
    const storageRef = ref(storage, storagePath);
    console.log(`[FINANSAL] getBlob ile indirme deniyor: ${storagePath}`);
    const blob = await getBlob(storageRef);
    console.log(`[FINANSAL] getBlob başarılı, boyut: ${blob.size}`);
    return await blob.arrayBuffer();
  } catch (error: any) {
    console.error(`[FINANSAL] getBlob hatası (${storagePath}):`, error);
    // Fallback: fileUrl ile fetch dene
    try {
      console.log(`[FINANSAL] Fallback: getDownloadURL ile deneniyor...`);
      const storageRef2 = ref(storage, storagePath);
      const url = await getDownloadURL(storageRef2);
      console.log(`[FINANSAL] Download URL alındı, fetch ile indiriliyor...`);
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log(`[FINANSAL] Fetch başarılı, boyut: ${buffer.byteLength}`);
        return buffer;
      }
    } catch (fallbackError) {
      console.error(`[FINANSAL] Fallback fetch de başarısız:`, fallbackError);
    }
    return null;
  }
}

/**
 * Delete a finansal file metadata from Firestore (does not delete from Storage)
 */
export async function deleteFinansalFile(
  moduleKey: ModuleKey,
  subKey: SubKey
): Promise<boolean> {
  try {
    const docRef = doc(db, 'appData', 'finansal');
    const existingDoc = await getDoc(docRef);

    if (!existingDoc.exists()) return false;

    const existingData = existingDoc.data();
    const moduleData = existingData[moduleKey] || {};

    if (!moduleData[subKey]) return false;

    delete moduleData[subKey];

    await setDoc(docRef, { ...existingData, [moduleKey]: moduleData, lastUpdated: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error(`[FINANSAL] ${moduleKey}/${subKey} silme hatası:`, error);
    return false;
  }
}
