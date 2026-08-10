import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { CalendarExceptionType } from '../enums/calendar-exception-type.enum';
import { RegionCode } from '../enums/region-code.enum';

export type WorkdayReason = 'weekday' | 'weekend' | CalendarExceptionType;

export interface WorkdayHolidaySummary {
  id: string;
  name: string;
  type: CalendarExceptionType;
  scope: AttendanceCalendarScope;
  regionCode: RegionCode | null;
}

export interface WorkdayResult {
  attendanceDate: string;
  regionCode: RegionCode;
  isWorkday: boolean;
  reason: WorkdayReason;
  holiday: WorkdayHolidaySummary | null;
}
