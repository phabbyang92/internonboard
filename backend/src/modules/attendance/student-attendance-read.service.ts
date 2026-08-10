import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import type { StudentAttendanceRecordsResponse } from './interfaces/student-attendance-records-response.interface';
import type { StudentAttendanceTodayResponse } from './interfaces/student-attendance-today-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

@Injectable()
export class StudentAttendanceReadService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly businessClock: BusinessClockService,
    private readonly eligibilityService: AttendanceEligibilityService,
    private readonly checkInPolicyService: AttendanceCheckInPolicyService,
    private readonly queryPreparationService: AttendanceQueryPreparationService,
  ) {}

  async getToday(studentId: string): Promise<StudentAttendanceTodayResponse> {
    this.validateStudentId(studentId);
    const now = this.businessClock.now();
    const attendanceDate = this.businessClock.getBusinessDate(now);

    // 读取前先幂等补算，11:00 后刷新页面即可看到最终缺勤状态。
    await this.queryPreparationService.prepareStudentDaily(
      studentId,
      attendanceDate,
      now,
    );

    const eligibility = await this.eligibilityService.evaluate(
      studentId,
      attendanceDate,
      now,
    );
    const record = await this.attendanceRecordModel
      .findOne({
        studentId: new Types.ObjectId(studentId),
        attendanceDate,
      })
      .lean()
      .exec();
    const policy = eligibility.eligible
      ? this.checkInPolicyService.getPolicy(
          eligibility.location?.workLocation ?? '',
        )
      : null;

    return {
      attendanceDate,
      isWorkday: eligibility.workday?.isWorkday ?? false,
      assignedWorkLocation: eligibility.location?.workLocation ?? null,
      allowedCheckInModes: policy?.allowedCheckInModes ?? [],
      officeNetworkRequiredFor: policy?.officeNetworkRequiredFor ?? [],
      checkInWindow:
        this.businessClock.getAttendanceWindow(now) === 'closed'
          ? 'closed'
          : 'open',
      status: record
        ? record.status
        : eligibility.eligible
          ? 'pending'
          : 'not_required',
      checkInAt: record?.checkInAt ?? null,
    };
  }

  async getRecords(
    studentId: string,
    month: string,
  ): Promise<StudentAttendanceRecordsResponse> {
    this.validateStudentId(studentId);
    const now = this.businessClock.now();

    await this.queryPreparationService.prepareStudentMonth(
      studentId,
      month,
      now,
    );

    const items = await this.attendanceRecordModel
      .find({
        studentId: new Types.ObjectId(studentId),
        attendanceDate: {
          $gte: `${month}-01`,
          $lte: `${month}-31`,
        },
      })
      .sort({ attendanceDate: 1 })
      .lean()
      .exec();
    const attendanceStatuses = new Set([
      AttendanceStatus.OnTime,
      AttendanceStatus.Late,
    ]);
    const mappedItems = items.map((item) => ({
      attendanceDate: item.attendanceDate,
      status: item.status,
      lateLevel: item.lateLevel ?? null,
      checkInAt: item.checkInAt ?? null,
      assignedWorkLocation: item.assignedWorkLocation,
      checkInMode: item.checkInMode ?? null,
      checkInLocation: item.checkInLocation ?? null,
    }));

    return {
      month,
      summary: {
        totalAttendanceDays: items.filter((item) =>
          attendanceStatuses.has(item.status),
        ).length,
        late: this.summarizeStatus(items, AttendanceStatus.Late),
        leave: this.summarizeStatus(items, AttendanceStatus.Leave),
        absent: this.summarizeStatus(items, AttendanceStatus.Absent),
        onlineAttendanceDays: items.filter(
          (item) =>
            attendanceStatuses.has(item.status) &&
            item.checkInMode === CheckInMode.Online,
        ).length,
        offlineAttendanceDays: items.filter(
          (item) =>
            attendanceStatuses.has(item.status) &&
            item.checkInMode === CheckInMode.Offline,
        ).length,
      },
      items: mappedItems,
    };
  }

  private summarizeStatus(
    items: Array<Pick<AttendanceRecord, 'attendanceDate' | 'status'>>,
    status: AttendanceStatus,
  ) {
    const dates = items
      .filter((item) => item.status === status)
      .map((item) => item.attendanceDate);

    return { count: dates.length, dates };
  }

  private validateStudentId(studentId: string): void {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }
  }
}
