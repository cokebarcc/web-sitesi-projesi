import * as XLSX from 'xlsx';
import { ScheduleVersion, ProcessedPhysicianSummary, DetailedScheduleData } from '../../types';

const AM_WINDOW = { start: 8 * 60, end: 12 * 60 };
const PM_WINDOW = { start: 13 * 60, end: 17 * 60 };
const MIN_SESSION_THRESHOLD = 30;

/**
 * Convert time string to minutes
 */
function getTimeInMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) || isNaN(m)) ? 0 : (h * 60 + m);
}

/**
 * Calculate overlap between two time ranges in minutes
 */
function getOverlapMinutes(start1: number, end1: number, start2: number, end2: number): number {
  const start = Math.max(start1, start2);
  const end = Math.min(end1, end2);
  return Math.max(0, end - start);
}

/**
 * Parse Excel workbook to ScheduleVersion
 */
export function parseExcelToScheduleVersion(workbook: XLSX.WorkBook, label: string): ScheduleVersion {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'dd.mm.yyyy' });

  console.log('📊 [EXCEL-PARSER] Sheet name:', sheetName);
  console.log('📊 [EXCEL-PARSER] İlk 5 satır:', rawData.slice(0, 5));

  // Her satırın tüm hücrelerini göster
  rawData.slice(0, 10).forEach((row: any, idx: number) => {
    console.log(`📊 [EXCEL-PARSER] Satır ${idx}:`, row);
  });

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '')
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\.|doç\./g, '');
  };

  const toMins = (val: any): number => {
    if (val === null || val === undefined || val === "") return -1;
    if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
    if (typeof val === 'number') return Math.round(val * 1440);
    if (typeof val === 'string') {
      const p = val.trim().split(':');
      if (p.length >= 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
    }
    return -1;
  };

  let headers: any[] = [];
  let dataRows: any[][] = [];
  let foundHeader = false;
  for (const row of rawData as any[][]) {
    if (!row || row.length === 0) continue;

    if (!foundHeader) {
      // Satırdaki herhangi bir hücrede "branş", "klinik" veya "hekim" var mı kontrol et
      const hasRequiredColumns = row.some((cell: any) => {
        const cellStr = String(cell || "").toLocaleLowerCase('tr-TR');
        return cellStr.includes("branş") || cellStr.includes("brans") ||
               cellStr.includes("klinik") || cellStr.includes("hekim");
      });

      if (hasRequiredColumns) {
        headers = row;
        foundHeader = true;
        console.log('✅ [EXCEL-PARSER] Header satırı bulundu:', headers);
      }
      continue;
    }
    dataRows.push(row);
  }

  if (headers.length === 0) {
    console.error('❌ [EXCEL-PARSER] Excel header bulunamadı. Hiçbir satırda "branş" içeren kolon yok!');
    console.error('❌ [EXCEL-PARSER] İlk 10 satır:', rawData.slice(0, 10));
    return {
      label,
      timestamp: Date.now(),
      physicianSummaries: [],
      rawScheduleData: [],
      physicians: {}
    };
  }

  const branchIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("branş") || hl.includes("brans") || hl.includes("klinik");
  });
  const nameIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("hekim") || hl.includes("doktor");
  });
  const dateIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("tarih") && hl.includes("aksiyon");
  });
  const startTimeIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("baslangic") || hl.includes("başlangıç");
  });
  const endTimeIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("bitis") || hl.includes("bitiş");
  });
  const actionIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("aksiyon") && !hl.includes("tarih") && !hl.includes("baslangic") && !hl.includes("başlangıç") && !hl.includes("bitis") && !hl.includes("bitiş");
  });
  const capacityIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("kapasite") || hl.includes("randevu");
  });

  if (branchIndex === -1 || nameIndex === -1 || actionIndex === -1 || capacityIndex === -1 || dateIndex === -1 || startTimeIndex === -1 || endTimeIndex === -1) {
    console.error('❌ [EXCEL-PARSER] Excel kolonları bulunamadı:', { branchIndex, nameIndex, dateIndex, startTimeIndex, endTimeIndex, actionIndex, capacityIndex });
    console.error('❌ [EXCEL-PARSER] Headers:', headers);
    return {
      label,
      timestamp: Date.now(),
      physicianSummaries: [],
      rawScheduleData: [],
      physicians: {}
    };
  }

  console.log('✅ [EXCEL-PARSER] Kolon indexleri:', { branchIndex, nameIndex, dateIndex, startTimeIndex, endTimeIndex, actionIndex, capacityIndex });

  const rawScheduleData: DetailedScheduleData[] = [];

  // Build daily map to calculate action days using AM/PM logic (like DetailedSchedule)
  const dailyMap: Record<string, Record<string, {
    AM: Record<string, { mins: number, firstStart: number }>,
    PM: Record<string, { mins: number, firstStart: number }>
  }>> = {};
  const docCap: Record<string, number> = {};
  const docBranch: Record<string, string> = {};

  // First pass: Build rawScheduleData and calculate overlaps for each physician-date-action
  for (const row of dataRows) {
    const branch = String(row[branchIndex] || "").trim();
    const physicianName = String(row[nameIndex] || "").trim();
    const action = String(row[actionIndex] || "").trim().toLocaleUpperCase('tr-TR');
    const startDate = String(row[dateIndex] || "").trim();
    const startTime = String(row[startTimeIndex] || "").trim();
    const endTime = String(row[endTimeIndex] || "").trim();
    const capacityRaw = row[capacityIndex];

    // Debug: İlk satırı logla
    if (dataRows.indexOf(row) === 0) {
      console.log('🔍 [EXCEL-PARSER] İlk satır verisi:', { branch, physicianName, action, startDate, startTime, endTime, capacity: capacityRaw });
    }

    if (!physicianName || !branch || !action || !startDate) continue;

    const capacity = typeof capacityRaw === 'number' ? capacityRaw : parseFloat(String(capacityRaw || "0").replace(',', '.')) || 0;

    const normalizedKey = normalizeStr(physicianName);

    // Track branch and capacity for each physician
    docBranch[normalizedKey] = branch;
    docCap[normalizedKey] = (docCap[normalizedKey] || 0) + capacity;

    // Calculate time overlap with AM/PM windows
    const rowStart = getTimeInMinutes(startTime);
    const rowEnd = getTimeInMinutes(endTime);
    const duration = rowEnd - rowStart;

    if (!dailyMap[normalizedKey]) dailyMap[normalizedKey] = {};
    if (!dailyMap[normalizedKey][startDate]) dailyMap[normalizedKey][startDate] = { AM: {}, PM: {} };

    const amOverlap = getOverlapMinutes(rowStart, rowEnd, AM_WINDOW.start, AM_WINDOW.end);
    if (amOverlap > 0) {
      if (!dailyMap[normalizedKey][startDate].AM[action]) dailyMap[normalizedKey][startDate].AM[action] = { mins: 0, firstStart: Infinity };
      dailyMap[normalizedKey][startDate].AM[action].mins += amOverlap;
      dailyMap[normalizedKey][startDate].AM[action].firstStart = Math.min(dailyMap[normalizedKey][startDate].AM[action].firstStart, rowStart);
    }

    const pmOverlap = getOverlapMinutes(rowStart, rowEnd, PM_WINDOW.start, PM_WINDOW.end);
    if (pmOverlap > 0) {
      if (!dailyMap[normalizedKey][startDate].PM[action]) dailyMap[normalizedKey][startDate].PM[action] = { mins: 0, firstStart: Infinity };
      dailyMap[normalizedKey][startDate].PM[action].mins += pmOverlap;
      dailyMap[normalizedKey][startDate].PM[action].firstStart = Math.min(dailyMap[normalizedKey][startDate].PM[action].firstStart, rowStart);
    }

    rawScheduleData.push({
      branch,
      physicianName,
      action,
      capacity,
      startDate,
      startTime,
      endTime
    });
  }

  // Second pass: Calculate actionDays from dailyMap
  const physicianMap: Record<string, ProcessedPhysicianSummary> = {};

  Object.entries(dailyMap).forEach(([normalizedKey, dates]) => {
    const actionDays: { [action: string]: number } = {};

    Object.entries(dates).forEach(([dateStr, sessions]) => {
      // Find AM winner (dominant action in morning)
      let amWinner = "";
      let amMaxMins = -1;
      let amEarliest = Infinity;
      Object.entries(sessions.AM).forEach(([act, stats]) => {
        if (stats.mins >= MIN_SESSION_THRESHOLD) {
          if (stats.mins > amMaxMins) {
            amMaxMins = stats.mins;
            amWinner = act;
            amEarliest = stats.firstStart;
          } else if (stats.mins === amMaxMins && stats.firstStart < amEarliest) {
            amWinner = act;
            amEarliest = stats.firstStart;
          }
        }
      });

      // Find PM winner (dominant action in afternoon)
      let pmWinner = "";
      let pmMaxMins = -1;
      let pmEarliest = Infinity;
      Object.entries(sessions.PM).forEach(([act, stats]) => {
        if (stats.mins >= MIN_SESSION_THRESHOLD) {
          if (stats.mins > pmMaxMins) {
            pmMaxMins = stats.mins;
            pmWinner = act;
            pmEarliest = stats.firstStart;
          } else if (stats.mins === pmMaxMins && stats.firstStart < pmEarliest) {
            pmWinner = act;
            pmEarliest = stats.firstStart;
          }
        }
      });

      // Award 0.5 days to each winning action
      if (amWinner) actionDays[amWinner] = (actionDays[amWinner] || 0) + 0.5;
      if (pmWinner) actionDays[pmWinner] = (actionDays[pmWinner] || 0) + 0.5;
    });

    // Get original physician name from first occurrence
    const originalName = rawScheduleData.find(r => normalizeStr(r.physicianName) === normalizedKey)?.physicianName || "";

    physicianMap[normalizedKey] = {
      name: originalName, // ProcessedPhysicianSummary type'ına uygun
      branch: docBranch[normalizedKey] || "",
      totalCapacity: docCap[normalizedKey] || 0,
      totalWorkDays: Object.keys(dates).length, // Total unique dates
      actionDays: actionDays, // ProcessedPhysicianSummary type'ına uygun
      rawRows: [] // Type uyumu için
    };
  });

  const physicianSummaries: ProcessedPhysicianSummary[] = Object.values(physicianMap);

  console.log('✅ [EXCEL-PARSER] Parse tamamlandı:', {
    label,
    physicianCount: Object.keys(physicianMap).length,
    totalRows: rawScheduleData.length
  });

  return {
    label,
    timestamp: Date.now(),
    physicianSummaries,
    rawScheduleData,
    physicians: physicianMap as any
  };
}
