import * as XLSX from 'xlsx';
import { ScheduleVersion, ProcessedPhysicianSummary, DetailedScheduleData } from '../../types';

/**
 * Parse Excel workbook to ScheduleVersion
 */
export function parseExcelToScheduleVersion(workbook: XLSX.WorkBook, label: string): ScheduleVersion {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'dd.mm.yyyy' });

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
    const firstCell = String(row[0] || "").trim();
    if (!foundHeader) {
      if (firstCell.toLocaleLowerCase('tr-TR').includes("branş") || firstCell.toLocaleLowerCase('tr-TR').includes("brans")) {
        headers = row;
        foundHeader = true;
      }
      continue;
    }
    dataRows.push(row);
  }

  if (headers.length === 0) {
    console.warn('❌ Excel header bulunamadı.');
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
    return hl.includes("branş") || hl.includes("brans");
  });
  const nameIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("hekim") || hl.includes("doktor") || hl.includes("ad");
  });
  const actionIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("aksiyon") || hl.includes("action");
  });
  const capacityIndex = headers.findIndex((h: any) => {
    const hl = String(h || "").toLocaleLowerCase('tr-TR');
    return hl.includes("kapasite");
  });

  if (branchIndex === -1 || nameIndex === -1 || actionIndex === -1 || capacityIndex === -1) {
    console.warn('❌ Excel kolonları bulunamadı:', { branchIndex, nameIndex, actionIndex, capacityIndex });
    return {
      label,
      timestamp: Date.now(),
      physicianSummaries: [],
      rawScheduleData: [],
      physicians: {}
    };
  }

  const rawScheduleData: DetailedScheduleData[] = [];
  const physicianMap: Record<string, {
    name: string;
    branch: string;
    totalCapacity: number;
    actionDays: Record<string, number>;
    rawRows: any[];
  }> = {};

  for (const row of dataRows) {
    const branch = String(row[branchIndex] || "").trim();
    const physicianName = String(row[nameIndex] || "").trim();
    const action = String(row[actionIndex] || "").trim();
    const capacityRaw = row[capacityIndex];

    if (!physicianName || !branch) continue;

    const capacity = typeof capacityRaw === 'number' ? capacityRaw : parseFloat(String(capacityRaw || "0").replace(',', '.')) || 0;

    const normalizedKey = normalizeStr(physicianName);

    if (!physicianMap[normalizedKey]) {
      physicianMap[normalizedKey] = {
        name: physicianName,
        branch,
        totalCapacity: 0,
        actionDays: {},
        rawRows: []
      };
    }

    physicianMap[normalizedKey].totalCapacity += capacity;
    physicianMap[normalizedKey].actionDays[action] = (physicianMap[normalizedKey].actionDays[action] || 0) + 1;
    physicianMap[normalizedKey].rawRows.push({
      startDate: row[headers.findIndex((h: any) => String(h || "").toLocaleLowerCase('tr-TR').includes("tarih"))] || '',
      action,
      capacity
    });

    rawScheduleData.push({
      branch,
      physicianName,
      action,
      capacity,
      startDate: row[headers.findIndex((h: any) => String(h || "").toLocaleLowerCase('tr-TR').includes("tarih"))] || '',
      startTime: '',
      endTime: ''
    });
  }

  const physicianSummaries: ProcessedPhysicianSummary[] = Object.entries(physicianMap).map(([key, data]) => ({
    physicianName: data.name,
    branch: data.branch,
    totalCapacity: data.totalCapacity,
    totalSessions: data.rawRows.length,
    sessionsByAction: data.actionDays,
    sessionsByDay: {}
  }));

  return {
    label,
    timestamp: Date.now(),
    physicianSummaries,
    rawScheduleData,
    physicians: physicianMap
  };
}
