import type { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import type { CalendarExceptionType } from '../enums/calendar-exception-type.enum';
import type { RegionCode } from '../enums/region-code.enum';

export interface CalendarExceptionResponse {
  id: string;
  date: string;
  name: string;
  type: CalendarExceptionType;
  scope: AttendanceCalendarScope;
  regionCode: RegionCode | null;
  reason: string | null;
  createdByHrId: string;
  updatedByHrId: string;
  createdAt: Date;
  updatedAt: Date;
}
