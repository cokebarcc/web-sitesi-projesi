// ═══════════════════════════════════════════════════════════════
// Compliance Export — Excel Dışa Aktarma
// XLSX bağımlılığı sadece bu dosyada. Worker'a dahil edilmez.
// ═══════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import type { ComplianceResult } from '../types/complianceTypes';
import type { IslemSatiriLike } from './complianceAnalysis';

export function exportResultsToExcel(
  rows: IslemSatiriLike[],
  results: ComplianceResult[],
  extraColumnKeys?: string[]
): ArrayBuffer {
  const exportData: any[][] = [];
  const extras = extraColumnKeys || [];

  // Header
  exportData.push([
    'Tarih', 'Saat', 'Uzmanlık', 'Doktor', 'Dr.Tipi',
    'GİL Kodu', 'GİL Adı', 'Miktar', 'Puan', 'Toplam Puan',
    'Fiyat', 'Tutar', 'Hasta TC', 'Adı Soyadı', 'İşlem No', 'Diş No',
    ...extras,
    '— Uygunluk Durumu', '— Eşleşme', '— Güven', '— İhlal Sayısı',
    '— İhlal Açıklaması', '— Kaynak', '— Referans Kural', '— Puan Farkı', '— Fiyat Farkı'
  ]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = results[i];
    if (!result) continue;

    const ihlalAciklama = result.ihlaller.map(ih => `[${ih.ihlal_kodu}] ${ih.ihlal_aciklamasi}`).join(' | ');
    const kaynak = result.eslesen_kural?.kaynak || '';
    const refKural = result.ihlaller.map(ih => ih.referans_kural_metni).join(' | ');
    const extraValues = extras.map(key => row[key] ?? '');

    exportData.push([
      row.tarih, row.saat, row.uzmanlik, row.doktor, row.drTipi,
      row.gilKodu, row.gilAdi, row.miktar, row.puan, row.toplamPuan,
      row.fiyat, row.tutar, row.hastaTc, row.adiSoyadi, row.islemNo, row.disNumarasi,
      ...extraValues,
      result.uygunluk_durumu, result.eslesmeDurumu, result.eslesme_guveni, result.ihlaller.length,
      ihlalAciklama, kaynak, refKural,
      result.puan_farki ?? '', result.fiyat_farki ?? ''
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Uygunluk Analizi');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
