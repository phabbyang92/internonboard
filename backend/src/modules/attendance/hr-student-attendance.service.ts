import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { HrUser, type HrUserDocument } from '../auth/schemas/hr-user.schema';
import { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import { getAttendanceMonthRange } from './attendance.constants';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { GetHrStudentAttendanceQueryDto } from './dto/get-hr-student-attendance-query.dto';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import type {
  HrAttendanceRecordItem,
  HrAttendanceStatusDates,
  HrStudentAttendanceDetailResponse,
  HrStudentAttendanceSummary,
} from './interfaces/hr-attendance-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface AttendanceDetailRecord {
  _id: { toString(): string };
  attendanceDate: string;
  status: AttendanceRecord['status'];
  lateLevel: AttendanceRecord['lateLevel'];
  source: AttendanceRecord['source'];
  checkInAt: Date | null;
  assignedWorkLocation: string;
  checkInMode: AttendanceRecord['checkInMode'];
  checkInLocation: string | null;
  correctedByHrId?: { toString(): string } | null;
  correctedAt?: Date | null;
  correctionReason?: string | null;
  originalStatus?: AttendanceRecord['originalStatus'];
  correctionCount?: number;
}

const ATTENDANCE_STATUSES = new Set<AttendanceStatus>([
  AttendanceStatus.OnTime,
  AttendanceStatus.Late,
]);

@Injectable()
export class HrStudentAttendanceService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    @InjectModel(HrUser.name)
    private readonly hrUserModel: Model<HrUserDocument>,
    private readonly accessService: HrAttendanceAccessService,
    private readonly queryPreparationService: AttendanceQueryPreparationService,
  ) {}

  async getStudentAttendance(
    studentId: string,
    query: GetHrStudentAttendanceQueryDto,
    access: HrAccessContext,
  ): Promise<HrStudentAttendanceDetailResponse> {
    // 先验证学生当前归属，普通 HR 无法借详情接口读取其他 HR 的学生。
    const student = await this.accessService.getAccessibleStudent(
      studentId,
      access,
    );

    // 详情查询只补算目标学生，避免查看一个学生时扫描整个 HR 范围。
    await this.queryPreparationService.prepareStudentMonth(
      studentId,
      query.month,
    );

    const { startDate, nextMonthStartDate } = getAttendanceMonthRange(
      query.month,
    );
    const records = (await this.attendanceRecordModel
      .find({
        studentId: new Types.ObjectId(studentId),
        attendanceDate: {
          $gte: startDate,
          $lt: nextMonthStartDate,
        },
      })
      .sort({ attendanceDate: 1, _id: 1 })
      .lean()
      .exec()) as unknown as AttendanceDetailRecord[];
    const ownerHr = await this.loadOwnerHr(student.ownerHrId);

    return {
      month: query.month,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        ownerHr,
        phone: student.phone,
        onboardingStartAt: student.onboardingStartAt,
        onboardingEndAt: student.onboardingEndAt,
        currentWorkLocation: student.workLocation,
      },
      summary: this.buildSummary(records),
      items: records.map((record) => this.serializeRecord(record)),
    };
  }

  private async loadOwnerHr(ownerHrId: string | null) {
    if (!ownerHrId) {
      return { id: '', name: '未知 HR' };
    }

    const ownerHr = await this.hrUserModel
      .findById(ownerHrId)
      .select({ name: 1 })
      .lean()
      .exec();

    return {
      id: ownerHrId,
      name: ownerHr?.name ?? '未知 HR',
    };
  }

  private buildSummary(
    records: AttendanceDetailRecord[],
  ): HrStudentAttendanceSummary {
    const lateDates = this.collectStatusDates(records, AttendanceStatus.Late);
    const leaveDates = this.collectStatusDates(records, AttendanceStatus.Leave);
    const absentDates = this.collectStatusDates(
      records,
      AttendanceStatus.Absent,
    );
    const attendanceRecords = records.filter((record) =>
      ATTENDANCE_STATUSES.has(record.status),
    );

    return {
      totalAttendanceDays: attendanceRecords.length,
      late: this.serializeStatusDates(lateDates),
      leave: this.serializeStatusDates(leaveDates),
      absent: this.serializeStatusDates(absentDates),
      onlineAttendanceDays: attendanceRecords.filter(
        (record) => record.checkInMode === CheckInMode.Online,
      ).length,
      offlineAttendanceDays: attendanceRecords.filter(
        (record) => record.checkInMode === CheckInMode.Offline,
      ).length,
      latestCheckIn: this.findLatestCheckIn(records),
    };
  }

  private collectStatusDates(
    records: AttendanceDetailRecord[],
    status: AttendanceStatus,
  ): string[] {
    return records
      .filter((record) => record.status === status)
      .map((record) => record.attendanceDate);
  }

  private serializeStatusDates(dates: string[]): HrAttendanceStatusDates {
    const sortedDates = [...dates].sort();
    return { count: sortedDates.length, dates: sortedDates };
  }

  private findLatestCheckIn(
    records: AttendanceDetailRecord[],
  ): HrStudentAttendanceSummary['latestCheckIn'] {
    const latest = records.reduce<AttendanceDetailRecord | null>(
      (currentLatest, record) => {
        if (!record.checkInAt || !record.checkInMode) {
          return currentLatest;
        }

        if (
          !currentLatest?.checkInAt ||
          record.checkInAt.getTime() > currentLatest.checkInAt.getTime()
        ) {
          return record;
        }

        return currentLatest;
      },
      null,
    );

    if (!latest?.checkInAt || !latest.checkInMode) {
      return null;
    }

    return {
      attendanceDate: latest.attendanceDate,
      checkInAt: latest.checkInAt,
      assignedWorkLocation: latest.assignedWorkLocation,
      checkInMode: latest.checkInMode,
      checkInLocation: latest.checkInLocation ?? null,
    };
  }

  private serializeRecord(
    record: AttendanceDetailRecord,
  ): HrAttendanceRecordItem {
    return {
      id: record._id.toString(),
      attendanceDate: record.attendanceDate,
      status: record.status,
      lateLevel: record.lateLevel ?? null,
      source: record.source,
      checkInAt: record.checkInAt ?? null,
      assignedWorkLocation: record.assignedWorkLocation,
      checkInMode: record.checkInMode ?? null,
      checkInLocation: record.checkInLocation ?? null,
      correction: this.serializeCorrection(record),
    };
  }

  private serializeCorrection(record: AttendanceDetailRecord) {
    if (
      !record.correctedByHrId ||
      !record.correctedAt ||
      !record.correctionReason
    ) {
      return null;
    }

    return {
      correctedByHrId: record.correctedByHrId.toString(),
      correctedAt: record.correctedAt,
      reason: record.correctionReason,
      originalStatus: record.originalStatus ?? null,
      count: record.correctionCount ?? 1,
    };
  }
}
