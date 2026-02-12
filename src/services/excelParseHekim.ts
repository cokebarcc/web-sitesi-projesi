// ═══════════════════════════════════════════════════════════════
// Excel Parse — Hekim İşlem Listesi Parse Fonksiyonları
// HekimIslemListesiModule.tsx'den çıkarılmış saf fonksiyonlar.
// Hem ana thread hem Web Worker tarafından kullanılabilir.
// ═══════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';

// Excel satır tipi
export interface IslemSatiri {
  hastaKayitId: string;
  tarih: string;
  saat: string;
  uzmanlik: string;
  doktor: string;
  drTipi: string;
  gilKodu: string;
  gilAdi: string;
  miktar: number;
  puan: number;
  toplamPuan: number;
  fiyat: number;
  tutar: number;
  hastaTc: string;
  adiSoyadi: string;
  islemNo: string;
  yasi: number;
  tani: string;
  islemAciklama: string;
  disNumarasi: string;
  [key: string]: string | number; // Dinamik ekstra sütunlar
}

// Parse sonucu: satırlar + ekstra sütun bilgileri
export interface ParseResult {
  rows: IslemSatiri[];
  extraColumns: { key: string; label: string }[];
}

// Türkçe-güvenli lowercase (İ→i, I→ı düzgün çalışsın)
export function turkishLower(str: string): string {
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase();
}

// Excel tarih dönüşümü
export function excelDateToString(value: any): string {
  if (!value) return '';
  // Eğer sayısal ise Excel serial date
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = String(date.d).padStart(2, '0');
      const m = String(date.m).padStart(2, '0');
      const y = date.y;
      return `${d}.${m}.${y}`;
    }
  }
  return String(value).trim();
}

// Excel saat dönüşümü
export function excelTimeToString(value: any): string {
  if (!value) return '';
  if (typeof value === 'number') {
    // Fractional day (0-1) → saat:dakika
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  return String(value).trim();
}

// Sütun adı eşleştirme haritası
const COLUMN_MAP: Record<string, string> = {
  'hasta kayit id': 'hastaKayitId',
  'hasta kayıt id': 'hastaKayitId',
  'hastakayitid': 'hastaKayitId',
  'hasta kayit': 'hastaKayitId',
  'hasta kayıt': 'hastaKayitId',
  'kayit id': 'hastaKayitId',
  'kayıt id': 'hastaKayitId',
  'tarih': 'tarih',
  'saat': 'saat',
  'uzmanlik': 'uzmanlik',
  'uzmanlık': 'uzmanlik',
  'doktor': 'doktor',
  'dr.tipi': 'drTipi',
  'drtipi': 'drTipi',
  'dr tipi': 'drTipi',
  'gil kodu': 'gilKodu',
  'gilkodu': 'gilKodu',
  'gil adi': 'gilAdi',
  'gil adı': 'gilAdi',
  'giladi': 'gilAdi',
  'giladı': 'gilAdi',
  'miktar': 'miktar',
  'puan': 'puan',
  'toplam puan': 'toplamPuan',
  'toplampuan': 'toplamPuan',
  'toplam pu': 'toplamPuan',
  'fiyat': 'fiyat',
  'tutar': 'tutar',
  'hasta tc': 'hastaTc',
  'hastatc': 'hastaTc',
  'adi soyadi': 'adiSoyadi',
  'adı soyadı': 'adiSoyadi',
  'ad soyad': 'adiSoyadi',
  'adisoyadi': 'adiSoyadi',
  'islem no': 'islemNo',
  'işlem no': 'islemNo',
  'islemno': 'islemNo',
  'yasi': 'yasi',
  'yaşı': 'yasi',
  'yas': 'yasi',
  'yaş': 'yasi',
  'tani': 'tani',
  'tanı': 'tani',
  'tani kodu': 'tani',
  'tanı kodu': 'tani',
  'islem aciklama': 'islemAciklama',
  'işlem açıklama': 'islemAciklama',
  'islemaciklama': 'islemAciklama',
  'işlem açıklaması': 'islemAciklama',
  'islem aciklamasi': 'islemAciklama',
  'dis numarasi': 'disNumarasi',
  'diş numarası': 'disNumarasi',
  'dis no': 'disNumarasi',
  'diş no': 'disNumarasi',
};

function matchColumn(header: string): string | null {
  const normalized = turkishLower(header).replace(/[*\s]+/g, ' ').trim();
  // Direkt eşleşme
  if (COLUMN_MAP[normalized]) return COLUMN_MAP[normalized];
  // Boşluksuz eşleşme
  const noSpace = normalized.replace(/\s/g, '');
  if (COLUMN_MAP[noSpace]) return COLUMN_MAP[noSpace];
  // Kısmi eşleşme
  for (const [key, val] of Object.entries(COLUMN_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return val;
  }
  return null;
}

// Excel parse fonksiyonu
export function parseHekimIslemExcel(arrayBuffer: ArrayBuffer): ParseResult {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];

  if (jsonData.length < 2) return { rows: [], extraColumns: [] };

  // Header satırını bul
  let headerRowIdx = -1;
  let columnMapping: Record<number, string> = {};

  for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
    const row = jsonData[i];
    const tempMapping: Record<number, string> = {};
    let matchCount = 0;

    for (let j = 0; j < row.length; j++) {
      const cellVal = String(row[j] || '').trim();
      if (!cellVal) continue;
      const matched = matchColumn(cellVal);
      if (matched) {
        tempMapping[j] = matched;
        matchCount++;
      }
    }

    // En az 5 sütun eşleşmeli
    if (matchCount >= 5 && matchCount > Object.keys(columnMapping).length) {
      headerRowIdx = i;
      columnMapping = tempMapping;
    }
  }

  if (headerRowIdx === -1) {
    console.warn('[EXCEL PARSE] Header satırı bulunamadı');
    return { rows: [], extraColumns: [] };
  }

  // Eşleşmeyen sütunları da yakala (dinamik sütunlar)
  const headerRow = jsonData[headerRowIdx];
  const unmappedColumns: Record<number, string> = {};
  for (let j = 0; j < headerRow.length; j++) {
    const cellVal = String(headerRow[j] || '').trim();
    if (!cellVal) continue;
    if (columnMapping[j]) continue;
    unmappedColumns[j] = cellVal;
  }

  const extraColumns = Object.values(unmappedColumns).map(header => ({
    key: header,
    label: header,
  }));

  console.log('[EXCEL PARSE] Header bulundu satır:', headerRowIdx, 'Eşleşmeler:', columnMapping, 'Ekstra sütunlar:', extraColumns.map(c => c.label));

  const rows: IslemSatiri[] = [];

  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    // Boş satır kontrolü
    const hasData = row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined);
    if (!hasData) continue;

    const satir: IslemSatiri = {
      hastaKayitId: '',
      tarih: '',
      saat: '',
      uzmanlik: '',
      doktor: '',
      drTipi: '',
      gilKodu: '',
      gilAdi: '',
      miktar: 0,
      puan: 0,
      toplamPuan: 0,
      fiyat: 0,
      tutar: 0,
      hastaTc: '',
      adiSoyadi: '',
      islemNo: '',
      yasi: 0,
      tani: '',
      islemAciklama: '',
      disNumarasi: '',
    };

    // Bilinen sütunları doldur
    for (const [colIdx, field] of Object.entries(columnMapping)) {
      const val = row[Number(colIdx)];
      switch (field) {
        case 'tarih':
          satir.tarih = excelDateToString(val);
          break;
        case 'saat':
          satir.saat = excelTimeToString(val);
          break;
        case 'miktar':
        case 'puan':
        case 'toplamPuan':
        case 'fiyat':
        case 'tutar':
          satir[field] = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 0;
          break;
        case 'yasi':
          satir.yasi = typeof val === 'number' ? Math.floor(val) : parseInt(String(val)) || 0;
          break;
        case 'hastaTc':
        case 'islemNo':
        case 'gilKodu':
          satir[field] = String(val ?? '').trim();
          break;
        default:
          satir[field] = String(val ?? '').trim();
      }
    }

    // Dinamik (eşleşmeyen) sütunları doldur
    for (const [colIdx, headerLabel] of Object.entries(unmappedColumns)) {
      const val = row[Number(colIdx)];
      satir[headerLabel] = val != null ? String(val).trim() : '';
    }

    rows.push(satir);
  }

  console.log(`[EXCEL PARSE] ${rows.length} satır parse edildi (${extraColumns.length} ekstra sütun)`);
  return { rows, extraColumns };
}
