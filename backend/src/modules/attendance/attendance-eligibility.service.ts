import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import type {
  AttendanceEligibilityResult,
  AttendanceEligibilityStudentSnapshot,
} from './interfaces/attendance-eligibility-result.interface';
import { AttendanceLocationService } from './attendance-location.service';

@Injectable()
export class AttendanceEligibilityService {
  constructor(
    private readonly studentService: StudentService,
    private readonly businessClock: BusinessClockService,
    private readonly locationService: AttendanceLocationService,
    private readonly calendarService: AttendanceCalendarService,
  ) {}

  async evaluateToday(studentId: string): Promise<AttendanceEligibilityResult> {
    const now = this.businessClock.now();

    return this.evaluate(
      studentId,
      this.businessClock.getBusinessDate(now),
      now,
    );
  }

  async evaluate(
    studentId: string,
    attendanceDate: string,
    statusReferenceDate: Date = this.businessClock.now(),
  ): Promise<AttendanceEligibilityResult> {
    const [result] = await this.evaluateMany(
      studentId,
      [attendanceDate],
      statusReferenceDate,
    );

    return result;
  }

  async evaluateMany(
    studentId: string,
    attendanceDates: string[],
    statusReferenceDate: Date = this.businessClock.now(),
  ): Promise<AttendanceEligibilityResult[]> {
    attendanceDates.forEach((attendanceDate) =>
      this.validateAttendanceDate(attendanceDate),
    );

    if (attendanceDates.length === 0) {
      return [];
    }

    // 批量日期共用一次学生状态刷新和数据快照，避免请假日历产生重复查询。
    await this.studentService.updateDueOnboardingStatuses(statusReferenceDate);
    const student = await this.studentService.findOneById(studentId);
    const snapshot: AttendanceEligibilityStudentSnapshot = {
      id: student.id,
      ownerHrId: student.ownerHrId,
      onboardingStatus: student.onboardingStatus,
      onboardingStartAt: student.onboardingStartAt,
      onboardingEndAt: student.onboardingEndAt,
    };

    return Promise.all(
      attendanceDates.map((attendanceDate) =>
        this.evaluateDate(studentId, attendanceDate, snapshot),
      ),
    );
  }

  private async evaluateDate(
    studentId: string,
    attendanceDate: string,
    snapshot: AttendanceEligibilityStudentSnapshot,
  ): Promise<AttendanceEligibilityResult> {
    const { onboardingStartAt, onboardingEndAt, onboardingStatus } = snapshot;

    if (!onboardingStartAt) {
      return this.ineligible(
        attendanceDate,
        snapshot,
        AttendanceEligibilityReason.ArrangementMissing,
      );
    }

    const startDate = this.businessClock.getBusinessDate(onboardingStartAt);

    if (attendanceDate < startDate) {
      return this.ineligible(
        attendanceDate,
        snapshot,
        AttendanceEligibilityReason.BeforeInternship,
      );
    }

    if (onboardingEndAt) {
      const endDate = this.businessClock.getBusinessDate(onboardingEndAt);

      // 实习结束日期当天仍允许登记，只有次日才视为超出实习期。
      if (attendanceDate > endDate) {
        return this.ineligible(
          attendanceDate,
          snapshot,
          AttendanceEligibilityReason.AfterInternship,
        );
      }
    }

    if (onboardingStatus !== OnboardingStatus.Onboarded) {
      return this.ineligible(
        attendanceDate,
        snapshot,
        AttendanceEligibilityReason.StudentNotOnboarded,
      );
    }

    const location = await this.locationService.findEffectiveLocation(
      studentId,
      attendanceDate,
    );

    if (!location) {
      return this.ineligible(
        attendanceDate,
        snapshot,
        AttendanceEligibilityReason.WorkLocationMissing,
      );
    }

    const workday = await this.calendarService.isWorkday(
      attendanceDate,
      location.regionCode,
    );

    if (!workday.isWorkday) {
      return {
        eligible: false,
        reason: AttendanceEligibilityReason.NonWorkday,
        attendanceDate,
        student: snapshot,
        location,
        workday,
      };
    }

    return {
      eligible: true,
      reason: AttendanceEligibilityReason.Eligible,
      attendanceDate,
      student: snapshot,
      location,
      workday,
    };
  }

  private ineligible(
    attendanceDate: string,
    student: AttendanceEligibilityStudentSnapshot,
    reason: AttendanceEligibilityReason,
  ): AttendanceEligibilityResult {
    return {
      eligible: false,
      reason,
      attendanceDate,
      student,
      location: null,
      workday: null,
    };
  }

  private validateAttendanceDate(attendanceDate: string): void {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      throw new BadRequestException('考勤日期格式必须为 YYYY-MM-DD');
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('考勤日期无效');
    }
  }
}
