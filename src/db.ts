import Dexie, { Table } from 'dexie';

export interface DetailedScheduleRecord {
  id: string;
  hospital: string;
  month: string;
  year: number;
  [key: string]: any;
}

export interface MuayeneRecord {
  id?: number;
  period: string;
  [key: string]: any;
}

export class AppDatabase extends Dexie {
  detailedSchedule!: Table<DetailedScheduleRecord>;
  muayene!: Table<MuayeneRecord>;

  constructor() {
    super('HealthDataDB');

    // Version 1: Initial schema with auto-increment
    this.version(1).stores({
      detailedSchedule: '++id, hospital, month, year',
      muayene: '++id, period'
    });

    // Version 2: Use string ID from Excel data instead of auto-increment
    this.version(2).stores({
      detailedSchedule: 'id, hospital, month, year',
      muayene: '++id, period'
    }).upgrade(async tx => {
      // Clear old data with auto-increment IDs when upgrading
      await tx.table('detailedSchedule').clear();
      console.log('🔄 IndexedDB schema upgraded to v2, old data cleared');
    });
  }
}

export const db = new AppDatabase();
