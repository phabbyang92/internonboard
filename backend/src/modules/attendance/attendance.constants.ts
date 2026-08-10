import { WorkLocation } from '../student/enums/student.enums';

// 线上签到不需要办公室网络配置，因此不包含在这个列表中。
export const OFFICE_WORK_LOCATIONS = Object.values(WorkLocation).filter(
  (workLocation) => workLocation !== WorkLocation.Online,
);

export const ATTENDANCE_DATE_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const ATTENDANCE_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getAttendanceMonthRange(month: string): {
  startDate: string;
  nextMonthStartDate: string;
} {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

  return {
    startDate: `${month}-01`,
    nextMonthStartDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

// “今天至未来 14 天”包含今天，因此请求中最多可能出现 15 个自然日。
export const LEAVE_REQUEST_MAX_DAYS_AHEAD = 14;
export const LEAVE_REQUEST_MAX_DATES = LEAVE_REQUEST_MAX_DAYS_AHEAD + 1;
