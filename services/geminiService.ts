
import { ScheduleProposal, AppointmentData, HBYSData, AISuggestion } from "../types";

// AI functionality has been removed from this application
// These functions now return empty/mock data

export const generatePerformanceBasedSchedule = async (
  perfData: any[],
  targetWorkDays: number,
  sourcePeriod: string,
  targetPeriod: string
): Promise<ScheduleProposal[]> => {
  console.warn('AI functionality has been disabled');
  return [];
};

export const analyzeScheduleWithAI = async (appointmentData: AppointmentData[], hbysData: HBYSData[]): Promise<string> => {
  console.warn('AI functionality has been disabled');
  return "AI analiz özelliği devre dışı bırakıldı.";
};

export const getSpecificOptimizations = async (appointmentData: AppointmentData[], hbysData: HBYSData[]): Promise<AISuggestion[]> => {
  console.warn('AI functionality has been disabled');
  return [];
};
