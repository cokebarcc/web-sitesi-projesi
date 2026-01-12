import Dexie, { Table } from 'dexie';

export interface DetailedScheduleRecord {
  id?: number;
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
    this.version(1).stores({
      detailedSchedule: '++id, hospital, month, year',
      muayene: '++id, period'
    });
  }
}

export const db = new AppDatabase();
