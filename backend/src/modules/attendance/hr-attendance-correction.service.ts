import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { WorkLocation } from '../student/enums/student.enums';
import { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import type { CorrectAttendanceRecordDto } from './dto/correct-attendance-record.dto';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import type {
  CorrectAttendanceRecordResponse,
  HrAttendanceRecordItem,
} from './interfaces/hr-attendance-response.interface';
import type { AttendanceLocationResult } from './interfaces/attendance-location-result.interface';
import { AttendanceLocationService } from './attendance-location.service';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface AttendanceRecordSnapshot {
  _id: Types.ObjectId;
  status: AttendanceStatus;
  source: AttendanceSource;
  originalStatus?: AttendanceStatus | null;
  correctionCount?: number;
  attendanceDate: string;
  lateLevel: LateLevel | null;
  checkInAt: Date | null;
  assignedWorkLocation: string;
  checkInMode: CheckInMode | null;
  checkInLocation: string | null;
  correctedByHrId?: Types.ObjectId | null;
  correctedAt?: Date | null;
  correctionReason?: string | null;
}

interface CorrectionFields {
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  checkInAt: Date | null;
  checkInAttemptAt: null;
  assignedWorkLocation: string;
  assignedWorkLocationAssignmentId: Types.ObjectId;
  checkInMode: CheckInMode | null;
  checkInLocation: string | null;
  leaveBatchId: null;
  leaveRegisteredAt: null;
}

interface CorrectionWriteResult {
  before: AttendanceRecordSnapshot | null;
  record: AttendanceRecordSnapshot;
}

@Injectable()
export class HrAttendanceCorrectionService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly accessService: HrAttendanceAccessService,
    private readonly businessClock: BusinessClockService,
    private readonly locationService: AttendanceLocationService,
    private readonly calendarService: AttendanceCalendarService,
    private readonly checkInPolicyService: AttendanceCheckInPolicyService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async correctAttendance(
    studentId: string,
    attendanceDate: string,
    dto: CorrectAttendanceRecordDto,
    access: HrAccessContext,
  ): Promise<CorrectAttendanceRecordResponse> {
    this.validateAttendanceDate(attendanceDate);

    const now = this.businessClock.now();
    const today = this.businessClock.getBusinessDate(now);

    if (attendanceDate > today) {
      throw new BadRequestException('只能更正今天或过去日期的考勤');
    }

    // 权限校验必须先于记录读取，普通 HR 不能探测其他 HR 的学生考勤。
    const student = await this.accessService.getAccessibleStudent(
      studentId,
      access,
    );
    this.assertWithinInternship(
      attendanceDate,
      student.onboardingStartAt,
      student.onboardingEndAt,
    );

    const location = await this.locationService.findEffectiveLocation(
      studentId,
      attendanceDate,
    );

    if (!location) {
      throw new BadRequestException('该日期缺少有效工作地点安排');
    }

    const workday = await this.calendarService.isWorkday(
      attendanceDate,
      location.regionCode,
    );

    if (!workday.isWorkday) {
      throw new BadRequestException('该日期不是应出勤工作日');
    }

    const fields = this.buildCorrectionFields(
      dto,
      attendanceDate,
      location,
      now,
    );
    const studentObjectId = new Types.ObjectId(studentId);
    const existing = await this.findRecord(studentObjectId, attendanceDate);

    const writeResult = existing
      ? {
          before: existing,
          record: await this.updateExistingRecord(
            existing,
            fields,
            dto.reason,
            access,
            now,
          ),
        }
      : await this.createCorrectedRecord(
          studentObjectId,
          student.ownerHrId,
          attendanceDate,
          fields,
          dto.reason,
          access,
          now,
        );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      targetType: OperationTargetType.AttendanceRecord,
      targetId: writeResult.record._id.toString(),
      action: OperationAction.AttendanceRecordCorrected,
      changes: {
        attendanceDate,
        reason: dto.reason,
        before: writeResult.before
          ? this.toAuditSnapshot(writeResult.before)
          : null,
        after: this.toAuditSnapshot(writeResult.record),
      },
    });

    return {
      message: '考勤记录更正成功',
      record: this.serializeRecord(writeResult.record),
    };
  }

  private async createCorrectedRecord(
    studentId: Types.ObjectId,
    ownerHrId: string | null,
    attendanceDate: string,
    fields: CorrectionFields,
    reason: string,
    access: HrAccessContext,
    correctedAt: Date,
  ): Promise<CorrectionWriteResult> {
    if (!ownerHrId) {
      throw new InternalServerErrorException('学生缺少负责 HR');
    }

    try {
      const created = await this.attendanceRecordModel.create({
        studentId,
        ownerHrId: new Types.ObjectId(ownerHrId),
        attendanceDate,
        ...fields,
        source: AttendanceSource.HrCorrection,
        deviceIdHash: null,
        matchedOfficeNetworkId: null,
        ipMatchSucceeded: null,
        originalStatus: null,
        correctedByHrId: new Types.ObjectId(access.hrUserId),
        correctedAt,
        correctionReason: reason,
        correctionCount: 1,
      });

      return { before: null, record: created.toObject() };
    } catch (error) {
      // 并发更正可能在查询后先写入同一学生同一天；唯一索引仍决定只有一条记录。
      if (!this.isStudentDateDuplicate(error)) {
        throw error;
      }

      const existing = await this.findRecord(studentId, attendanceDate);

      if (!existing) {
        throw error;
      }

      return {
        before: existing,
        record: await this.updateExistingRecord(
          existing,
          fields,
          reason,
          access,
          correctedAt,
        ),
      };
    }
  }

  private async updateExistingRecord(
    existing: AttendanceRecordSnapshot,
    fields: CorrectionFields,
    reason: string,
    access: HrAccessContext,
    correctedAt: Date,
  ): Promise<AttendanceRecordSnapshot> {
    const updated = (await this.attendanceRecordModel
      .findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            ...fields,
            originalStatus: existing.originalStatus ?? existing.status,
            correctedByHrId: new Types.ObjectId(access.hrUserId),
            correctedAt,
            correctionReason: reason,
          },
          $inc: { correctionCount: 1 },
        },
        { new: true, runValidators: true },
      )
      .lean()
      .exec()) as AttendanceRecordSnapshot | null;

    if (!updated) {
      throw new InternalServerErrorException('考勤记录更正失败');
    }

    // 保留既有 source、deviceIdHash 和网络字段，HR 更正不会释放学生原先占用的设备名额。
    return updated;
  }

  private buildCorrectionFields(
    dto: CorrectAttendanceRecordDto,
    attendanceDate: string,
    location: AttendanceLocationResult,
    now: Date,
  ): CorrectionFields {
    if (dto.status === AttendanceStatus.Leave) {
      this.assertNoCheckInFields(dto, '更正为请假时不能填写签到信息');
      return this.emptyCheckInFields(dto.status, location);
    }

    if (dto.status === AttendanceStatus.OnTime) {
      if (dto.lateLevel !== undefined) {
        throw new BadRequestException('按时记录不能设置迟到级别');
      }

      return this.checkedInFields(dto, attendanceDate, location, now, null);
    }

    if (dto.status === AttendanceStatus.Late) {
      if (dto.lateLevel !== undefined && dto.lateLevel !== LateLevel.Normal) {
        throw new BadRequestException('迟到记录只能使用普通迟到级别');
      }

      return this.checkedInFields(
        dto,
        attendanceDate,
        location,
        now,
        LateLevel.Normal,
      );
    }

    const hasCheckInDetails =
      dto.checkInAt !== undefined ||
      dto.checkInMode !== undefined ||
      dto.checkInLocation !== undefined ||
      dto.lateLevel !== undefined;

    if (!hasCheckInDetails) {
      return this.emptyCheckInFields(dto.status, location);
    }

    if (dto.lateLevel !== undefined && dto.lateLevel !== LateLevel.Severe) {
      throw new BadRequestException('缺勤签到记录只能使用严重迟到级别');
    }

    return this.checkedInFields(
      dto,
      attendanceDate,
      location,
      now,
      LateLevel.Severe,
    );
  }

  private checkedInFields(
    dto: CorrectAttendanceRecordDto,
    attendanceDate: string,
    location: AttendanceLocationResult,
    now: Date,
    lateLevel: LateLevel | null,
  ): CorrectionFields {
    if (!dto.checkInAt || !dto.checkInMode) {
      throw new BadRequestException('该状态必须同时填写签到时间和签到方式');
    }

    const checkInAt = new Date(dto.checkInAt);

    if (Number.isNaN(checkInAt.getTime())) {
      throw new BadRequestException('签到时间无效');
    }

    if (checkInAt.getTime() > now.getTime()) {
      throw new BadRequestException('签到时间不能晚于当前时间');
    }

    if (this.businessClock.getBusinessDate(checkInAt) !== attendanceDate) {
      throw new BadRequestException('签到时间必须属于所更正的考勤日期');
    }

    this.checkInPolicyService.assertCheckInModeAllowed(
      location.workLocation,
      dto.checkInMode,
    );

    return {
      status: dto.status,
      lateLevel,
      checkInAt,
      checkInAttemptAt: null,
      assignedWorkLocation: location.workLocation,
      assignedWorkLocationAssignmentId: new Types.ObjectId(
        location.assignmentId,
      ),
      checkInMode: dto.checkInMode,
      checkInLocation:
        dto.checkInLocation ??
        (dto.checkInMode === CheckInMode.Online
          ? WorkLocation.Online
          : location.workLocation),
      leaveBatchId: null,
      leaveRegisteredAt: null,
    };
  }

  private emptyCheckInFields(
    status: AttendanceStatus,
    location: AttendanceLocationResult,
  ): CorrectionFields {
    return {
      status,
      lateLevel: null,
      checkInAt: null,
      checkInAttemptAt: null,
      assignedWorkLocation: location.workLocation,
      assignedWorkLocationAssignmentId: new Types.ObjectId(
        location.assignmentId,
      ),
      checkInMode: null,
      checkInLocation: null,
      leaveBatchId: null,
      leaveRegisteredAt: null,
    };
  }

  private assertNoCheckInFields(
    dto: CorrectAttendanceRecordDto,
    message: string,
  ): void {
    if (
      dto.checkInAt !== undefined ||
      dto.checkInMode !== undefined ||
      dto.checkInLocation !== undefined ||
      dto.lateLevel !== undefined
    ) {
      throw new BadRequestException(message);
    }
  }

  private assertWithinInternship(
    attendanceDate: string,
    onboardingStartAt: Date | null,
    onboardingEndAt: Date | null,
  ): void {
    if (!onboardingStartAt) {
      throw new BadRequestException('学生尚未设置实习开始日期');
    }

    const startDate = this.businessClock.getBusinessDate(onboardingStartAt);
    const endDate = onboardingEndAt
      ? this.businessClock.getBusinessDate(onboardingEndAt)
      : null;

    if (attendanceDate < startDate || (endDate && attendanceDate > endDate)) {
      throw new BadRequestException('更正日期不在学生实习日期范围内');
    }
  }

  private async findRecord(
    studentId: Types.ObjectId,
    attendanceDate: string,
  ): Promise<AttendanceRecordSnapshot | null> {
    return await this.attendanceRecordModel
      .findOne({ studentId, attendanceDate })
      .lean()
      .exec();
  }

  private serializeRecord(
    record: AttendanceRecordSnapshot,
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
      correction:
        record.correctedByHrId && record.correctedAt && record.correctionReason
          ? {
              correctedByHrId: record.correctedByHrId.toString(),
              correctedAt: record.correctedAt,
              reason: record.correctionReason,
              originalStatus: record.originalStatus ?? null,
              count: record.correctionCount ?? 1,
            }
          : null,
    };
  }

  private toAuditSnapshot(record: AttendanceRecordSnapshot) {
    return {
      status: record.status,
      lateLevel: record.lateLevel ?? null,
      source: record.source,
      checkInAt: record.checkInAt ?? null,
      assignedWorkLocation: record.assignedWorkLocation,
      checkInMode: record.checkInMode ?? null,
      checkInLocation: record.checkInLocation ?? null,
      originalStatus: record.originalStatus ?? null,
      correctionCount: record.correctionCount ?? 0,
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

  private isStudentDateDuplicate(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const mongoError = error as {
      code?: unknown;
      keyPattern?: Record<string, unknown>;
    };

    return (
      mongoError.code === 11000 &&
      mongoError.keyPattern?.studentId === 1 &&
      mongoError.keyPattern?.attendanceDate === 1
    );
  }
}
