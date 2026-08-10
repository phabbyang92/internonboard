import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { LEAVE_REQUEST_MAX_DAYS_AHEAD } from './attendance.constants';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { LeaveDateOptionReason } from './enums/leave-date-option-reason.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type {
  LeaveDateOption,
  LeaveDateOptionsResponse,
} from './interfaces/leave-date-option.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface ExistingAttendanceSummary {
  attendanceDate: string;
  status: AttendanceStatus;
}

@Injectable()
export class AttendanceLeaveOptionsService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly businessClock: BusinessClockService,
    private readonly eligibilityService: AttendanceEligibilityService,
  ) {}

  async getOptions(studentId: string): Promise<LeaveDateOptionsResponse> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const now = this.businessClock.now();
    const startDate = this.businessClock.getBusinessDate(now);
    const attendanceDates = this.buildDateRange(
      startDate,
      LEAVE_REQUEST_MAX_DAYS_AHEAD,
    );
    const endDate = attendanceDates.at(-1) ?? startDate;

    const [eligibilityResults, existingRecords] = await Promise.all([
      this.eligibilityService.evaluateMany(studentId, attendanceDates, now),
      this.attendanceRecordModel
        .find({
          studentId: new Types.ObjectId(studentId),
          attendanceDate: { $gte: startDate, $lte: endDate },
        })
        .select({ attendanceDate: 1, status: 1 })
        .lean()
        .exec(),
    ]);
    const existingByDate = new Map(
      (existingRecords as ExistingAttendanceSummary[]).map((record) => [
        record.attendanceDate,
        record,
      ]),
    );

    return {
      startDate,
      endDate,
      maxDaysAhead: LEAVE_REQUEST_MAX_DAYS_AHEAD,
      items: eligibilityResults.map((eligibility) =>
        this.toOption(
          eligibility,
          existingByDate.get(eligibility.attendanceDate),
        ),
      ),
    };
  }

  private toOption(
    eligibility: AttendanceEligibilityResult,
    existingRecord?: ExistingAttendanceSummary,
  ): LeaveDateOption {
    if (existingRecord) {
      return this.existingRecordOption(eligibility, existingRecord.status);
    }

    if (eligibility.eligible) {
      return this.option(
        eligibility,
        true,
        LeaveDateOptionReason.Available,
        '可登记请假',
      );
    }

    if (eligibility.reason === AttendanceEligibilityReason.NonWorkday) {
      if (eligibility.workday?.reason === 'weekend') {
        return this.option(
          eligibility,
          false,
          LeaveDateOptionReason.Weekend,
          '周末无需登记出勤',
        );
      }

      const reason =
        eligibility.workday?.reason === CalendarExceptionType.TemporaryHoliday
          ? LeaveDateOptionReason.TemporaryHoliday
          : LeaveDateOptionReason.PublicHoliday;

      return this.option(
        eligibility,
        false,
        reason,
        eligibility.workday?.holiday?.name ?? '假期无需登记出勤',
      );
    }

    const messages: Record<
      Exclude<
        AttendanceEligibilityReason,
        | AttendanceEligibilityReason.Eligible
        | AttendanceEligibilityReason.NonWorkday
      >,
      string
    > = {
      [AttendanceEligibilityReason.ArrangementMissing]: '缺少实习安排',
      [AttendanceEligibilityReason.BeforeInternship]: '尚未开始实习',
      [AttendanceEligibilityReason.AfterInternship]: '已超过实习结束日期',
      [AttendanceEligibilityReason.StudentNotOnboarded]: '当前不在职',
      [AttendanceEligibilityReason.WorkLocationMissing]: '缺少有效工作地点',
    };
    const optionReasons: Record<
      Exclude<
        AttendanceEligibilityReason,
        | AttendanceEligibilityReason.Eligible
        | AttendanceEligibilityReason.NonWorkday
      >,
      LeaveDateOptionReason
    > = {
      [AttendanceEligibilityReason.ArrangementMissing]:
        LeaveDateOptionReason.ArrangementMissing,
      [AttendanceEligibilityReason.BeforeInternship]:
        LeaveDateOptionReason.BeforeInternship,
      [AttendanceEligibilityReason.AfterInternship]:
        LeaveDateOptionReason.AfterInternship,
      [AttendanceEligibilityReason.StudentNotOnboarded]:
        LeaveDateOptionReason.StudentNotOnboarded,
      [AttendanceEligibilityReason.WorkLocationMissing]:
        LeaveDateOptionReason.WorkLocationMissing,
    };
    const reason = eligibility.reason as Exclude<
      AttendanceEligibilityReason,
      | AttendanceEligibilityReason.Eligible
      | AttendanceEligibilityReason.NonWorkday
    >;

    return this.option(
      eligibility,
      false,
      optionReasons[reason],
      messages[reason],
    );
  }

  private existingRecordOption(
    eligibility: AttendanceEligibilityResult,
    status: AttendanceStatus,
  ): LeaveDateOption {
    if (status === AttendanceStatus.Leave) {
      return this.option(
        eligibility,
        false,
        LeaveDateOptionReason.LeaveAlreadyRegistered,
        '当天已登记请假',
        status,
      );
    }

    if (status === AttendanceStatus.Absent) {
      return this.option(
        eligibility,
        false,
        LeaveDateOptionReason.AbsenceAlreadyRecorded,
        '当天已有缺勤记录',
        status,
      );
    }

    return this.option(
      eligibility,
      false,
      LeaveDateOptionReason.AttendanceAlreadyRecorded,
      '当天已有出勤记录',
      status,
    );
  }

  private option(
    eligibility: AttendanceEligibilityResult,
    selectable: boolean,
    reason: LeaveDateOptionReason,
    message: string,
    existingStatus: AttendanceStatus | null = null,
  ): LeaveDateOption {
    return {
      attendanceDate: eligibility.attendanceDate,
      selectable,
      reason,
      message,
      workLocation: eligibility.location?.workLocation ?? null,
      holidayName: eligibility.workday?.holiday?.name ?? null,
      existingStatus,
    };
  }

  private buildDateRange(startDate: string, daysAhead: number): string[] {
    const start = new Date(`${startDate}T00:00:00.000Z`);

    return Array.from({ length: daysAhead + 1 }, (_, offset) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    });
  }
}
