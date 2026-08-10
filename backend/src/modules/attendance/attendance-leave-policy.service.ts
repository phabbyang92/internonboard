import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BusinessClockService } from '../../common/time/business-clock.service';
import {
  ATTENDANCE_DATE_PATTERN,
  LEAVE_REQUEST_MAX_DATES,
  LEAVE_REQUEST_MAX_DAYS_AHEAD,
} from './attendance.constants';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';

@Injectable()
export class AttendanceLeavePolicyService {
  constructor(private readonly businessClock: BusinessClockService) {}

  validateRequestedDates(
    requestedDates: string[],
    referenceNow: Date = this.businessClock.now(),
  ): string[] {
    if (
      requestedDates.length === 0 ||
      requestedDates.length > LEAVE_REQUEST_MAX_DATES
    ) {
      this.throwInvalidDate('请选择有效的请假日期');
    }

    const uniqueDates = new Set(requestedDates);

    if (uniqueDates.size !== requestedDates.length) {
      this.throwInvalidDate('请假日期不能重复');
    }

    const today = this.businessClock.getBusinessDate(referenceNow);
    const latestAllowedDate = this.addCalendarDays(
      today,
      LEAVE_REQUEST_MAX_DAYS_AHEAD,
    );

    for (const attendanceDate of requestedDates) {
      this.parseAttendanceDate(attendanceDate);

      if (attendanceDate < today || attendanceDate > latestAllowedDate) {
        throw new BadRequestException({
          code: AttendanceErrorCode.LeaveDateOutOfRange,
          message: `请假日期只能选择 ${today} 至 ${latestAllowedDate}`,
        });
      }
    }

    // 返回排序后的副本，便于后续批量写入和生成稳定响应。
    return [...requestedDates].sort();
  }

  assertCanRegisterLeave(eligibility: AttendanceEligibilityResult): void {
    if (eligibility.eligible) {
      return;
    }

    if (
      eligibility.reason === AttendanceEligibilityReason.StudentNotOnboarded ||
      eligibility.reason === AttendanceEligibilityReason.BeforeInternship ||
      eligibility.reason === AttendanceEligibilityReason.AfterInternship
    ) {
      throw new ForbiddenException({
        code: AttendanceErrorCode.StudentNotOnboarded,
        message: '当前不在有效实习期内，不能登记请假',
      });
    }

    throw new BadRequestException({
      code: AttendanceErrorCode.AttendanceNotRequired,
      message:
        eligibility.reason === AttendanceEligibilityReason.NonWorkday
          ? '该日期无需登记出勤，不能重复登记请假'
          : '该日期缺少有效出勤安排',
    });
  }

  private addCalendarDays(attendanceDate: string, days: number): string {
    const date = this.parseAttendanceDate(attendanceDate);
    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
  }

  private parseAttendanceDate(attendanceDate: string): Date {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      this.throwInvalidDate('请假日期格式必须为 YYYY-MM-DD');
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      this.throwInvalidDate('请假日期无效');
    }

    return date;
  }

  private throwInvalidDate(message: string): never {
    throw new BadRequestException({
      code: AttendanceErrorCode.InvalidLeaveDate,
      message,
    });
  }
}
