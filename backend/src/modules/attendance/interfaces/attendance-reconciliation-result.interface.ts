export interface AttendanceReconciliationFailure {
  studentId: string;
  attendanceDate: string;
  message: string;
}

export interface AttendanceReconciliationResult {
  startDate: string;
  endDate: string;
  studentId: string | null;
  startedAt: Date;
  completedAt: Date;
  scannedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  failures: AttendanceReconciliationFailure[];
}
