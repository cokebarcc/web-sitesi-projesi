import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import MultiSelectDropdown, { DropdownOption } from './MultiSelectDropdown';
import { MONTHS, YEARS } from '../constants';
import ComplianceAnalysisPanel from './ComplianceAnalysisPanel';
import {
  uploadFinansalFile,
  getFinansalFileMetadata,
  downloadFinansalFile,
  deleteFinansalFile,
  FinansalFileMetadata,
} from '../src/services/finansalStorage';
import type { IslemSatiri, ParseResult } from '../src/services/excelParseHekim';
import { turkishLower } from '../src/services/excelParseHekim';
import type { ExcelParseWorkerResponse } from '../src/workers/workerProtocol';

// Kurum, Rol Grubu ve Basamak tanımları
export interface KurumBilgisi {
  ad: string;
  rolGrubu: string;
  basamak: 2 | 3; // 2: İkinci basamak, 3: Üçüncü basamak
}

export const KURUM_LISTESI: KurumBilgisi[] = [
  { ad: 'AKÇAKALE DH', rolGrubu: 'B', basamak: 2 },
  { ad: 'BALIKLIGÖL DH', rolGrubu: 'B', basamak: 2 },
  { ad: 'BİRECİK DH', rolGrubu: 'B', basamak: 2 },
  { ad: 'BOZOVA DH', rolGrubu: 'D', basamak: 2 },
  { ad: 'CEYLANPINAR DH', rolGrubu: 'C', basamak: 2 },
  { ad: 'HALFETİ DH', rolGrubu: 'D', basamak: 2 },
  { ad: 'HARRAN DH', rolGrubu: 'C', basamak: 2 },
  { ad: 'HİLVAN DH', rolGrubu: 'C', basamak: 2 },
  { ad: 'MEHMET AKİF İNAN EAH', rolGrubu: 'A1', basamak: 3 },
  { ad: 'SİVEREK DH', rolGrubu: 'A2', basamak: 2 },
  { ad: 'SURUÇ DH', rolGrubu: 'B', basamak: 2 },
  { ad: 'ŞANLIURFA EAH', rolGrubu: 'A2', basamak: 3 },
  { ad: 'VİRANŞEHİR DH', rolGrubu: 'B', basamak: 2 },
  { ad: 'ŞANLIURFA ADSH', rolGrubu: 'B', basamak: 2 },
  { ad: 'HALİLİYE ADSH', rolGrubu: 'B', basamak: 2 },
  { ad: 'EYYÜBİYE ADSM', rolGrubu: 'B', basamak: 2 },
  { ad: 'SİVEREK ADSM', rolGrubu: 'C', basamak: 2 },
];

// Kurum adından bilgi getir
function getKurumBilgisi(kurumAd: string): KurumBilgisi | undefined {
  return KURUM_LISTESI.find(k => k.ad === kurumAd);
}

// Branş listesi (kod ve ad)
interface BransBilgisi {
  kod: string;
  ad: string;
}

const BRANS_LISTESI: BransBilgisi[] = [
  { kod: '4400', ad: 'Acil Tıp' },
  { kod: '4800', ad: 'Aile Hekimliği' },
  { kod: '3100', ad: 'Anesteziyoloji ve Reanimasyon' },
  { kod: '2400', ad: 'Beyin ve Sinir Cerrahisi' },
  { kod: '2000', ad: 'Çocuk Cerrahisi' },
  { kod: '1500', ad: 'Çocuk Sağlığı ve Hastalıkları' },
  { kod: '1600', ad: 'Çocuk ve Ergen Ruh Sağlığı ve Hastalıkları' },
  { kod: '1700', ad: 'Deri ve Zührevi Hastalıkları' },
  { kod: '1200', ad: 'Enfeksiyon Hastalıkları ve Klinik Mikrobiyoloji' },
  { kod: '1800', ad: 'Fiziksel Tıp ve Rehabilitasyon' },
  { kod: '1900', ad: 'Genel Cerrahi' },
  { kod: '2200', ad: 'Göğüs Cerrahisi' },
  { kod: '1171', ad: 'Göğüs Hastalıkları' },
  { kod: '2900', ad: 'Göz Hastalıkları' },
  { kod: '1000', ad: 'İç Hastalıkları' },
  { kod: '3000', ad: 'Kadın Hastalıkları ve Doğum' },
  { kod: '2300', ad: 'Kalp ve Damar Cerrahisi' },
  { kod: '1100', ad: 'Kardiyoloji' },
  { kod: '2800', ad: 'Kulak Burun Boğaz Hastalıkları' },
  { kod: '1300', ad: 'Nöroloji' },
  { kod: '3400', ad: 'Nükleer Tıp' },
  { kod: '2600', ad: 'Ortopedi ve Travmatoloji' },
  { kod: '2500', ad: 'Plastik, Rekonstrüktif ve Estetik Cerrahi' },
  { kod: '3200', ad: 'Radyasyon Onkolojisi' },
  { kod: '3300', ad: 'Radyoloji' },
  { kod: '1400', ad: 'Ruh Sağlığı ve Hastalıkları' },
  { kod: '4000', ad: 'Spor Hekimliği' },
  { kod: '4200', ad: 'Hava ve Uzay Hekimliği' },
  { kod: '4300', ad: 'Sualtı Hekimliği ve Hiperbarik Tıp' },
  { kod: '600', ad: 'Tıbbi Ekoloji ve Hidroklimatoloji' },
  { kod: '3600', ad: 'Tıbbi Genetik' },
  { kod: '2700', ad: 'Üroloji' },
  { kod: '3197', ad: 'Algoloji (Anesteziyoloji ve Reanimasyon)' },
  { kod: '3198', ad: 'Algoloji (Nöroloji)' },
  { kod: '3199', ad: 'Algoloji (Fizik Tedavi ve Rehabilitasyon)' },
  { kod: '1301', ad: 'Klinik Nörofizyoloji (Nöroloji)' },
  { kod: '1596', ad: 'Çocuk Acil' },
  { kod: '1593', ad: 'Çocuk Endokrinolojisi' },
  { kod: '1592', ad: 'Çocuk Enfeksiyon Hastalıkları' },
  { kod: '1591', ad: 'Çocuk Gastroenterolojisi' },
  { kod: '1574', ad: 'Çocuk Genetik Hastalıkları' },
  { kod: '1590', ad: 'Çocuk Göğüs Hastalıkları' },
  { kod: '1589', ad: 'Çocuk Hematolojisi ve Onkolojisi' },
  { kod: '1594', ad: 'Çocuk İmmünolojisi ve Alerji Hastalıkları' },
  { kod: '1587', ad: 'Çocuk Hematolojisi' },
  { kod: '1582', ad: 'Çocuk Onkolojisi' },
  { kod: '1595', ad: 'Çocuk Endokrinolojisi ve Metabolizma Hastalıkları' },
  { kod: '1588', ad: 'Çocuk İmmünolojisi' },
  { kod: '1598', ad: 'Çocuk Alerjisi' },
  { kod: '1561', ad: 'Neonatoloji' },
  { kod: '1586', ad: 'Çocuk Kardiyolojisi' },
  { kod: '1585', ad: 'Çocuk Metabolizma Hastalıkları' },
  { kod: '1584', ad: 'Çocuk Nefrolojisi' },
  { kod: '1583', ad: 'Çocuk Nörolojisi' },
  { kod: '1599', ad: 'Çocuk Romatolojisi' },
  { kod: '2781', ad: 'Çocuk Ürolojisi' },
  { kod: '1597', ad: 'Gelişimsel Pediatri' },
  { kod: '1975', ad: 'Gastroenteroloji Cerrahisi' },
  { kod: '1910', ad: 'Cerrahi Onkoloji' },
  { kod: '1076', ad: 'Gastroenteroloji' },
  { kod: '1053', ad: 'Tıbbi Onkoloji' },
  { kod: '1070', ad: 'Hematoloji' },
  { kod: '1073', ad: 'Geriatri' },
  { kod: '1078', ad: 'Endokrinoloji ve Metabolizma Hastalıkları' },
  { kod: '1099', ad: 'Alerji' },
  { kod: '1069', ad: 'İmmünoloji ve Alerji Hastalıkları (İç Hastalıkları)' },
  { kod: '1198', ad: 'İmmünoloji ve Alerji Hastalıkları (Göğüs Hastalıkları)' },
  { kod: '1701', ad: 'İmmünoloji ve Alerji Hastalıkları (Deri ve Zührevi Hastalıkları)' },
  { kod: '1068', ad: 'İş ve Meslek Hastalıkları' },
  { kod: '1062', ad: 'Nefroloji' },
  { kod: '1055', ad: 'Romatoloji (İç Hastalıkları)' },
  { kod: '1855', ad: 'Romatoloji (Fiziksel Tıp ve Rehabilitasyon)' },
  { kod: '3010', ad: 'Jinekolojik Onkoloji Cerrahisi' },
  { kod: '3056', ad: 'Perinatoloji' },
  { kod: '2387', ad: 'Çocuk Kalp ve Damar Cerrahisi' },
  { kod: '2679', ad: 'El Cerrahisi (Ortopedi ve Travmatoloji)' },
  { kod: '1901', ad: 'El Cerrahisi (Genel Cerrahi)' },
  { kod: '2579', ad: 'El Cerrahisi (Plastik, Rekonstrüktif ve Estetik Cerrahi)' },
  { kod: '5350', ad: 'Ağız, Yüz ve Çene Cerrahisi' },
  { kod: '5100', ad: 'Ağız, Diş ve Çene Cerrahisi' },
  { kod: '5600', ad: 'Ağız, Diş ve Çene Radyolojisi' },
  { kod: '5200', ad: 'Ortodonti' },
  { kod: '5300', ad: 'Çocuk Diş Hekimliği' },
  { kod: '5400', ad: 'Protetik Diş Tedavisi' },
  { kod: '5150', ad: 'Restoratif Diş Tedavisi' },
  { kod: '5500', ad: 'Periodontoloji' },
  { kod: '5550', ad: 'Endodonti' },
  { kod: '5700', ad: 'Diş Hastalıkları ve Tedavisi' },
];

// IslemSatiri ve ParseResult artık excelParseHekim.ts'den import ediliyor
export type { IslemSatiri } from '../src/services/excelParseHekim';

// Bilinen (sabit) tablo sütun tanımları
const KNOWN_TABLE_COLUMNS: { key: string; label: string; align?: 'left' | 'right' | 'center'; minW?: string }[] = [
  { key: 'hastaKayitId', label: 'Hasta Kayıt ID', minW: '100px' },
  { key: 'tarih', label: 'Tarih', minW: '90px' },
  { key: 'saat', label: 'Saat', minW: '60px' },
  { key: 'uzmanlik', label: 'Uzmanlık', minW: '160px' },
  { key: 'doktor', label: 'Doktor', minW: '160px' },
  { key: 'drTipi', label: 'Dr.Tipi', minW: '80px' },
  { key: 'gilKodu', label: 'GİL Kodu', minW: '80px' },
  { key: 'gilAdi', label: 'GİL Adı', minW: '280px' },
  { key: 'miktar', label: 'Miktar', align: 'right', minW: '60px' },
  { key: 'puan', label: 'Puan', align: 'right', minW: '60px' },
  { key: 'toplamPuan', label: 'Toplam Puan', align: 'right', minW: '90px' },
  { key: 'fiyat', label: 'Fiyat', align: 'right', minW: '70px' },
  { key: 'tutar', label: 'Tutar', align: 'right', minW: '70px' },
  { key: 'hastaTc', label: 'Hasta TC', minW: '100px' },
  { key: 'adiSoyadi', label: 'Adı Soyadı', minW: '160px' },
  { key: 'islemNo', label: 'İşlem No', minW: '100px' },
  { key: 'yasi', label: 'Yaşı', align: 'right', minW: '50px' },
  { key: 'tani', label: 'Tanı', minW: '100px' },
  { key: 'islemAciklama', label: 'İşlem Açıklama', minW: '200px' },
  { key: 'disNumarasi', label: 'Diş No', minW: '60px' },
];

// Excel parse fonksiyonları excelParseHekim.ts'e taşındı.
// Worker üzerinden çağrılır.
function parseExcelInWorker(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../src/workers/excelParseWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<ExcelParseWorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'PARSE_PROGRESS':
          break;
        case 'PARSE_SUCCESS':
          worker.terminate();
          resolve({ rows: msg.rows as IslemSatiri[], extraColumns: msg.extraColumns });
          break;
        case 'PARSE_ERROR':
          worker.terminate();
          reject(new Error(msg.error));
          break;
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Worker hatası: ${err.message}`));
    };

    worker.postMessage(
      { type: 'PARSE_EXCEL', arrayBuffer },
      [arrayBuffer]
    );
  });
}

// turkishLower artık excelParseHekim.ts'den import ediliyor, re-export
export { turkishLower };

// Sayı formatlama
export function formatNumber(val: number, decimals = 2): string {
  if (val === 0) return '0';
  return val.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Filtre bilgisinden benzersiz Firebase subKey oluştur
function buildSubKey(kurum: string, years: number[], months: number[], brans: string): string {
  const parts = [
    kurum ? kurum.substring(0, 30).replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '_').replace(/_+/g, '_') : '',
    years.length > 0 ? years.sort().join('-') : '',
    months.length > 0 ? months.sort((a, b) => a - b).join('-') : '',
    brans || ''
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('__') : 'islemListesi';
}

// Sayfa boyutu seçenekleri
const PAGE_SIZES = [50, 100, 250, 500];

const HekimIslemListesiModule: React.FC = () => {
  const [selectedKurum, setSelectedKurum] = useState<string>('');
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedBrans, setSelectedBrans] = useState<string>('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [tableData, setTableData] = useState<IslemSatiri[]>([]);
  const [extraColumns, setExtraColumns] = useState<{ key: string; label: string }[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [activeTab, setActiveTab] = useState<'liste' | 'analiz'>('liste');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Dinamik tablo sütunları: bilinen + ekstra
  const tableColumns = useMemo(() => {
    const extra = extraColumns.map(ec => ({
      key: ec.key,
      label: ec.label,
      align: 'left' as const,
      minW: '100px',
    }));
    return [...KNOWN_TABLE_COLUMNS, ...extra];
  }, [extraColumns]);

  // Firebase kayıtlı dosya state'leri
  const [savedFileInfo, setSavedFileInfo] = useState<FinansalFileMetadata | null>(null);
  const [allSavedFiles, setAllSavedFiles] = useState<Record<string, FinansalFileMetadata>>({});
  const [firebaseLoading, setFirebaseLoading] = useState(false);
  const [firebaseMessage, setFirebaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mevcut filtrelere göre Firebase subKey
  const currentSubKey = useMemo(
    () => buildSubKey(selectedKurum, selectedYears, selectedMonths, selectedBrans),
    [selectedKurum, selectedYears, selectedMonths, selectedBrans]
  );

  const kurumOptions: DropdownOption[] = KURUM_LISTESI.map(k => ({
    value: k.ad,
    label: k.ad
  }));

  const yearOptions: DropdownOption[] = YEARS.map(y => ({
    value: y,
    label: String(y)
  }));

  const monthOptions: DropdownOption[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({
    value: m,
    label: MONTHS[m - 1]
  }));

  const bransOptions: DropdownOption[] = BRANS_LISTESI.map(b => ({
    value: b.kod,
    label: `${b.kod} - ${b.ad}`
  }));

  const seciliKurumBilgisi = selectedKurum ? getKurumBilgisi(selectedKurum) : null;

  const hasSelection = !!selectedKurum || selectedYears.length > 0 || selectedMonths.length > 0 || !!selectedBrans;

  // Firebase mesajını 4sn sonra temizle
  useEffect(() => {
    if (firebaseMessage) {
      const timer = setTimeout(() => setFirebaseMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [firebaseMessage]);

  // Mount'ta tüm kayıtlı dosyaları Firebase'den çek
  const loadAllSavedFiles = useCallback(async () => {
    try {
      const { getFinansalModuleFiles } = await import('../src/services/finansalStorage');
      const allFiles = await getFinansalModuleFiles('hekimIslem');
      console.log('[HEKİM İŞLEM LİSTESİ] Tüm kayıtlı dosyalar:', Object.keys(allFiles));
      setAllSavedFiles(allFiles);
    } catch (error) {
      console.error('[HEKİM İŞLEM LİSTESİ] Firebase dosya listesi hatası:', error);
    }
  }, []);

  useEffect(() => {
    loadAllSavedFiles();
  }, [loadAllSavedFiles]);

  // Filtre değiştiğinde ilgili subKey'e ait kayıtlı dosyayı güncelle
  useEffect(() => {
    const matchingFile = allSavedFiles[currentSubKey] || null;
    // Eğer tam eşleşme yoksa ve filtre boşsa, eski 'islemListesi' key'ine fallback
    if (!matchingFile && currentSubKey === 'islemListesi') {
      // Zaten fallback key, eşleşme yok
      setSavedFileInfo(null);
    } else if (!matchingFile && Object.keys(allSavedFiles).length > 0 && currentSubKey === 'islemListesi') {
      // Filtre boş: ilk bulunan dosyayı göster (geriye uyumluluk)
      const firstKey = Object.keys(allSavedFiles)[0];
      setSavedFileInfo(allSavedFiles[firstKey]);
    } else {
      setSavedFileInfo(matchingFile);
    }
  }, [currentSubKey, allSavedFiles]);

  // Kayıtlı dosyayı Firebase'den indir ve tabloya yükle
  const handleLoadSavedFile = async () => {
    setFirebaseLoading(true);
    setFirebaseMessage(null);
    try {
      // savedFileInfo yoksa Firebase'den taze kontrol et (dinamik subKey ile)
      let fileInfo = savedFileInfo;
      if (!fileInfo) {
        const metadata = await getFinansalFileMetadata('hekimIslem', currentSubKey);
        console.log(`[HEKİM İŞLEM LİSTESİ] Firebase metadata sorgu (${currentSubKey}):`, metadata);
        if (metadata) {
          fileInfo = metadata;
          setSavedFileInfo(metadata);
          setAllSavedFiles(prev => ({ ...prev, [currentSubKey]: metadata }));
        } else {
          setFirebaseMessage({ type: 'error', text: 'Bu filtre için kayıtlı dosya bulunamadı. Önce Excel dosyası yükleyiniz.' });
          setFirebaseLoading(false);
          return;
        }
      }

      console.log('[HEKİM İŞLEM LİSTESİ] İndirme başlıyor, storagePath:', fileInfo.storagePath);
      const arrayBuffer = await downloadFinansalFile(fileInfo.storagePath);
      if (arrayBuffer) {
        console.log('[HEKİM İŞLEM LİSTESİ] İndirme tamamlandı, boyut:', arrayBuffer.byteLength);
        const parseResult = await parseExcelInWorker(arrayBuffer);
        if (parseResult.rows.length > 0) {
          setTableData(parseResult.rows);
          setExtraColumns(parseResult.extraColumns);
          setFileName(fileInfo.fileName);
          setCurrentPage(1);
          setFirebaseMessage({ type: 'success', text: `${parseResult.rows.length.toLocaleString('tr-TR')} satır yüklendi` });
          console.log(`[HEKİM İŞLEM LİSTESİ] Firebase'den yüklendi: ${fileInfo.fileName} (${parseResult.rows.length} satır)`);
        } else {
          setFirebaseMessage({ type: 'error', text: 'Dosya parse edilemedi' });
        }
      } else {
        setFirebaseMessage({ type: 'error', text: 'Dosya indirilemedi. Storage erişim hatası olabilir.' });
      }
    } catch (error: any) {
      console.error('[HEKİM İŞLEM LİSTESİ] Firebase dosya indirme hatası:', error);
      setFirebaseMessage({ type: 'error', text: `Hata: ${error.message || 'Dosya yüklenirken hata oluştu'}` });
    } finally {
      setFirebaseLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedKurum('');
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedBrans('');
  };

  const handleClearData = () => {
    setTableData([]);
    setExtraColumns([]);
    setFileName('');
    setCurrentPage(1);
  };

  // Firebase'den kayıtlı dosyayı sil
  const handleDeleteSavedFile = async () => {
    if (!savedFileInfo) return;
    setFirebaseLoading(true);
    try {
      await deleteFinansalFile('hekimIslem', currentSubKey);
      setSavedFileInfo(null);
      setAllSavedFiles(prev => {
        const updated = { ...prev };
        delete updated[currentSubKey];
        return updated;
      });
      setTableData([]);
      setExtraColumns([]);
      setFileName('');
      setCurrentPage(1);
      setFirebaseMessage({ type: 'success', text: 'Kayıtlı dosya silindi' });
      console.log(`[HEKİM İŞLEM LİSTESİ] Firebase dosya silindi (${currentSubKey})`);
    } catch (error) {
      console.error('[HEKİM İŞLEM LİSTESİ] Firebase silme hatası:', error);
      setFirebaseMessage({ type: 'error', text: 'Dosya silinirken hata oluştu' });
    } finally {
      setFirebaseLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setFirebaseMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parseResult = await parseExcelInWorker(arrayBuffer);
      setTableData(parseResult.rows);
      setExtraColumns(parseResult.extraColumns);
      setFileName(file.name);
      setCurrentPage(1);
      console.log(`[HEKİM İŞLEM LİSTESİ] ${file.name}: ${parseResult.rows.length} satır yüklendi (${parseResult.extraColumns.length} ekstra sütun)`);

      // Firebase'e kaydet (filtre bazlı subKey ile)
      const subKey = currentSubKey;
      console.log(`[HEKİM İŞLEM LİSTESİ] Firebase'e kaydediliyor, subKey: ${subKey}`);
      const result = await uploadFinansalFile('hekimIslem', subKey, file);
      if (result.success && result.metadata) {
        setSavedFileInfo(result.metadata);
        setAllSavedFiles(prev => ({ ...prev, [subKey]: result.metadata! }));
        setFirebaseMessage({ type: 'success', text: 'Dosya Firebase\'e kaydedildi' });
        console.log(`[HEKİM İŞLEM LİSTESİ] Firebase'e kaydedildi: ${file.name} (subKey: ${subKey})`);
      } else {
        setFirebaseMessage({ type: 'error', text: 'Firebase kayıt başarısız: ' + (result.error || '') });
      }
    } catch (error: any) {
      console.error('[HEKİM İŞLEM LİSTESİ] Dosya yükleme hatası:', error);
      setFirebaseMessage({ type: 'error', text: `Excel parse hatası: ${error?.message || 'Bilinmeyen hata'}` });
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  // Özet hesaplamalar
  const summary = useMemo(() => {
    if (tableData.length === 0) return null;
    const toplamTutar = tableData.reduce((sum, r) => sum + r.tutar, 0);
    const toplamPuan = tableData.reduce((sum, r) => sum + r.toplamPuan, 0);
    const toplamMiktar = tableData.reduce((sum, r) => sum + r.miktar, 0);
    const uniqueDoctors = new Set(tableData.map(r => r.doktor).filter(Boolean));
    const uniquePatients = new Set(tableData.map(r => r.hastaTc).filter(Boolean));
    return {
      toplamSatir: tableData.length,
      toplamTutar,
      toplamPuan,
      toplamMiktar,
      hekimSayisi: uniqueDoctors.size,
      hastaSayisi: uniquePatients.size,
    };
  }, [tableData]);

  // Sayfalama
  const totalPages = Math.ceil(tableData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableData.slice(start, start + pageSize);
  }, [tableData, currentPage, pageSize]);

  // Sayfa değiştiğinde tabloya scroll
  const goToPage = (page: number) => {
    setCurrentPage(page);
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Hekim İşlem Listesi</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Hekim işlem listesi modülü</p>
          </div>
        </div>
      </div>

      {/* Veri Yükleme Filtre Paneli */}
      <div className="backdrop-blur-xl rounded-2xl border p-5 mb-6 relative z-[100]" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Veri Yükleme</span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Kurum Filtresi */}
          <MultiSelectDropdown
            label="Kurum"
            options={kurumOptions}
            selectedValues={selectedKurum ? [selectedKurum] : []}
            onChange={(values) => setSelectedKurum(values.length > 0 ? String(values[0]) : '')}
            placeholder="Kurum Seçiniz..."
            emptyMessage="Kurum bulunamadı"
            showSearch={true}
            compact={true}
            singleSelect={true}
          />

          {/* Yıl Filtresi */}
          <MultiSelectDropdown
            label="Yıl"
            options={yearOptions}
            selectedValues={selectedYears}
            onChange={(values) => setSelectedYears(values as number[])}
            placeholder="Yıl seçiniz..."
            showSearch={false}
            compact={true}
          />

          {/* Ay Filtresi */}
          <MultiSelectDropdown
            label="Ay"
            options={monthOptions}
            selectedValues={selectedMonths}
            onChange={(values) => setSelectedMonths(values as number[])}
            placeholder="Ay seçiniz..."
            disabled={selectedYears.length === 0}
            emptyMessage={selectedYears.length === 0 ? 'Önce yıl seçiniz' : 'Ay bulunamadı'}
            showSearch={false}
            compact={true}
          />

          {/* Branş Filtresi */}
          <MultiSelectDropdown
            label="Branş"
            options={bransOptions}
            selectedValues={selectedBrans ? [selectedBrans] : []}
            onChange={(values) => setSelectedBrans(values.length > 0 ? String(values[0]) : '')}
            placeholder="Branş seçiniz..."
            emptyMessage="Branş bulunamadı"
            showSearch={true}
            compact={true}
            singleSelect={true}
          />

          {/* Excel Yükleme Butonu */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading || firebaseLoading}
            className="px-5 py-2 h-[38px] bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            {uploadLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Yükleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Excel Yükle
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />

          {/* Uygula Butonu — Firebase'den kayıtlı veriyi getirir */}
          <button
            onClick={handleLoadSavedFile}
            disabled={firebaseLoading || uploadLoading}
            className="px-5 py-2 h-[38px] bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {firebaseLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Getiriliyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Uygula
              </>
            )}
          </button>

          {/* Rol Grubu Badge + Temizle */}
          <div className="flex items-center gap-2 ml-auto">
            {seciliKurumBilgisi && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">Rol</span>
                <span className="text-sm font-black status-warning">{seciliKurumBilgisi.rolGrubu}</span>
              </div>
            )}
            {hasSelection && (
              <button
                onClick={handleClear}
                className="text-xs font-medium flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Firebase Durum Bilgisi */}
        {(firebaseLoading || firebaseMessage || savedFileInfo) && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {/* Yükleniyor */}
            {firebaseLoading && tableData.length === 0 && (
              <div className="flex items-center gap-2 text-xs status-warning">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Kayıtlı dosya yükleniyor...
              </div>
            )}


            {/* Başarı / Hata mesajı */}
            {firebaseMessage && (
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                firebaseMessage.type === 'success'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'status-danger bg-red-500/10 border border-red-500/20'
              }`}>
                {firebaseMessage.type === 'success' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {firebaseMessage.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigasyonu */}
      {tableData.length > 0 && (
        <div className="flex gap-1 mb-4 rounded-xl border p-1 inline-flex" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
          <button
            onClick={() => setActiveTab('liste')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'liste'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                : ''
            }`}
            style={activeTab !== 'liste' ? { color: 'var(--text-3)' } : undefined}
            onMouseEnter={e => { if (activeTab !== 'liste') { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; } }}
            onMouseLeave={e => { if (activeTab !== 'liste') { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; } }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            İşlem Listesi
          </button>
          <button
            onClick={() => setActiveTab('analiz')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'analiz'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                : ''
            }`}
            style={activeTab !== 'analiz' ? { color: 'var(--text-3)' } : undefined}
            onMouseEnter={e => { if (activeTab !== 'analiz') { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; } }}
            onMouseLeave={e => { if (activeTab !== 'analiz') { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; } }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Uygunluk Analizi
          </button>
        </div>
      )}

      {/* İçerik Alanı */}
      {tableData.length === 0 ? (
        <div className="backdrop-blur-xl rounded-2xl border p-12 text-center" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
          {savedFileInfo ? (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Kayıtlı Dosya Mevcut</h3>
              <p className="text-sm max-w-md mx-auto mb-1" style={{ color: 'var(--text-3)' }}>
                {savedFileInfo.fileName}
              </p>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                {(savedFileInfo.fileSize / 1024 / 1024).toFixed(1)} MB - {new Date(savedFileInfo.uploadedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={handleLoadSavedFile}
                disabled={firebaseLoading}
                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto shadow-lg shadow-emerald-500/20"
              >
                {firebaseLoading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Veri Getiriliyor...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Kayıtlı Veriyi Getir
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Veri Bekleniyor</h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
                Hekim İşlem Listesi verilerini görüntülemek için Excel dosyası yükleyiniz.
              </p>
            </>
          )}
        </div>
      ) : activeTab === 'analiz' ? (
        <ComplianceAnalysisPanel
          tableData={tableData}
          kurumBilgisi={seciliKurumBilgisi || undefined}
          extraColumnKeys={extraColumns.map(ec => ec.key)}
        />
      ) : (
        <>
          {/* Özet Kartları */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Toplam Satır</p>
                <p className="text-lg font-black" style={{ color: 'var(--text-1)' }}>{summary.toplamSatir.toLocaleString('tr-TR')}</p>
              </div>
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Hekim Sayısı</p>
                <p className="text-lg font-black text-emerald-400">{summary.hekimSayisi}</p>
              </div>
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Hasta Sayısı</p>
                <p className="text-lg font-black status-info">{summary.hastaSayisi.toLocaleString('tr-TR')}</p>
              </div>
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Toplam Miktar</p>
                <p className="text-lg font-black text-cyan-400">{summary.toplamMiktar.toLocaleString('tr-TR')}</p>
              </div>
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Toplam Puan</p>
                <p className="text-lg font-black status-accent">{formatNumber(summary.toplamPuan)}</p>
              </div>
              <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Toplam Tutar</p>
                <p className="text-lg font-black status-warning">{formatNumber(summary.toplamTutar)} ₺</p>
              </div>
            </div>
          )}

          {/* Tablo Üst Bar */}
          <div className="backdrop-blur-xl rounded-t-2xl border border-b-0 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{fileName}</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tableData.length.toLocaleString('tr-TR')} kayıt
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Sayfa boyutu */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Göster:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                >
                  {PAGE_SIZES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleClearData}
                className="text-xs status-danger hover:text-red-300 font-medium flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Veriyi Temizle
              </button>
            </div>
          </div>

          {/* Tablo */}
          <div
            ref={tableRef}
            className="border overflow-auto max-h-[600px] custom-scrollbar"
            style={{ background: 'var(--bg-app)', borderColor: 'var(--border-2)' }}
          >
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)' }}>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold status-warning uppercase tracking-wider whitespace-nowrap w-[40px]" style={{ borderRight: '1px solid var(--border-2)' }}>#</th>
                  {tableColumns.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2.5 text-[10px] font-bold status-warning uppercase tracking-wider whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                      style={{ minWidth: col.minW, borderRight: '1px solid var(--border-2)' }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={idx}
                      className="transition-colors"
                      style={{ background: idx % 2 === 0 ? 'var(--table-row-alt-bg)' : 'var(--bg-app)', borderBottom: '1px solid var(--border-2)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--table-row-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'var(--table-row-alt-bg)' : 'var(--bg-app)'; }}
                    >
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-2)' }}>{globalIdx}</td>
                      {tableColumns.map(col => {
                        const val = row[col.key];
                        const isNumeric = col.align === 'right';
                        return (
                          <td
                            key={col.key}
                            className={`px-3 py-1.5 text-xs whitespace-nowrap ${
                              isNumeric ? 'text-right font-mono' : ''
                            }`}
                            style={{ borderRight: '1px solid var(--border-2)', color: isNumeric ? 'var(--text-2)' : 'var(--text-3)' }}
                          >
                            {isNumeric && typeof val === 'number' ? formatNumber(val) : String(val || '')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {((currentPage - 1) * pageSize + 1).toLocaleString('tr-TR')} - {Math.min(currentPage * pageSize, tableData.length).toLocaleString('tr-TR')} / {tableData.length.toLocaleString('tr-TR')} kayıt
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  ««
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  «
                </button>

                {/* Sayfa numaraları */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-2.5 py-1 text-xs rounded transition-all ${
                        currentPage === page
                          ? 'bg-amber-600 text-white font-bold'
                          : ''
                      }`}
                      style={currentPage !== page ? { color: 'var(--text-3)' } : undefined}
                      onMouseEnter={e => { if (currentPage !== page) { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; } }}
                      onMouseLeave={e => { if (currentPage !== page) { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; } }}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  »
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  »»
                </button>
              </div>
            </div>
          )}

          {/* Sayfalama yoksa alt border */}
          {totalPages <= 1 && (
            <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 h-2" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} />
          )}
        </>
      )}

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--bg-app);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border-2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: var(--bg-app);
        }
      `}</style>
    </div>
  );
};

export default HekimIslemListesiModule;
