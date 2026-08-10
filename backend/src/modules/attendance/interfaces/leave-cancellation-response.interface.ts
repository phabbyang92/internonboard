export interface LeaveCancellationResponse {
  attendanceDate: string;
  leaveBatchId: string | null;
  cancelledAt: Date;
}
