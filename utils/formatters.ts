
import { MONTHS } from '../constants';

export const normalizeDoctorName = (str: any): string => {
  if (!str) return "";
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'İ')
    .replace(/I/g, 'I')
    .replace(/Ş/g, 'Ş')
    .replace(/Ğ/g, 'Ğ')
    .replace(/Ü/g, 'Ü')
    .replace(/Ö/g, 'Ö')
    .replace(/Ç/g, 'Ç')
    .replace(/\.$/, '');
};

export const getPeriodKey = (year: number, monthName: string): string => {
  const monthIdx = MONTHS.indexOf(monthName);
  const mm = String(monthIdx + 1).padStart(2, '0');
  return `${year}-${mm}`;
};
