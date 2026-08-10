import { RegionCode } from '../enums/region-code.enum';

export interface AttendanceLocationResult {
  assignmentId: string;
  studentId: string;
  workLocation: string;
  regionCode: RegionCode;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}
