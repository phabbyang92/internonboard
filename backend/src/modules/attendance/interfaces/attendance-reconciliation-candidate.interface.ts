import type { AttendanceReconciliationFailure } from './attendance-reconciliation-result.interface';

export interface AttendanceReconciliationCandidate {
  studentId: string;
  ownerHrId: string;
  attendanceDate: string;
  assignedWorkLocation: string;
  assignedWorkLocationAssignmentId: string;
}

export interface AttendanceReconciliationScanResult {
  startDate: string;
  endDate: string;
  studentId: string | null;
  scannedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: AttendanceReconciliationFailure[];
  candidates: AttendanceReconciliationCandidate[];
}

export interface AttendanceReconciliationWriteResult {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  failures: AttendanceReconciliationFailure[];
}
