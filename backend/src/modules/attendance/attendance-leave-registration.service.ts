import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceLeavePolicyService } from './attendance-leave-policy.service';
import type { CreateLeaveRegistrationDto } from './dto/create-leave-registration.dto';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type { LeaveRegistrationResponse } from './interfaces/leave-registration-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

const STUDENT_UNIQUE_INDEX = 'unique_student_attendance_date';

interface ExistingAttendanceSummary {
  attendanceDate: string;
  status: AttendanceStatus;
}

@Injectable()
export class AttendanceLeaveRegistrationService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly businessClock: BusinessClockService,
    private readonly eligibilityService: AttendanceEligibilityService,
    private readonly leavePolicyService: AttendanceLeavePolicyService,
  ) {}

  async register(
    studentId: string,
    dto: CreateLeaveRegistrationDto,
  ): Promise<LeaveRegistrationResponse> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    // 整个批次共用一个北京时间快照，避免校验和保存跨日。
    const now = this.businessClock.now();
    const dates = this.leavePolicyService.validateRequestedDates(
      dto.dates,
      now,
    );
    const eligibilityResults = await this.eligibilityService.evaluateMany(
      studentId,
      dates,
      now,
    );

    eligibilityResults.forEach((eligibility) =>
      this.leavePolicyService.assertCanRegisterLeave(eligibility),
    );

    const studentObjectId = new Types.ObjectId(studentId);
    const existingRecords = await this.findExistingRecords(
      studentObjectId,
      dates,
    );

    if (existingRecords.length > 0) {
      this.throwExistingRecordConflict(existingRecords);
    }

    const leaveBatchId = randomUUID();
    const records = eligibilityResults.map((eligibility) =>
      this.buildLeaveRecord(studentObjectId, eligibility, leaveBatchId, now),
    );

    try {
      // ordered 写入配合唯一索引；并发冲突时按 batchId 补偿清理已插入部分。
      await this.attendanceRecordModel.insertMany(records, { ordered: true });
    } catch (error: unknown) {
      if (!this.isStudentDuplicateKeyError(error)) {
        throw error;
      }

      await this.rollbackBatch(leaveBatchId);
      const conflictingRecords = await this.findExistingRecords(
        studentObjectId,
        dates,
      );
      this.throwExistingRecordConflict(conflictingRecords);
    }

    return {
      leaveBatchId,
      dates,
      registeredAt: now,
    };
  }

  private buildLeaveRecord(
    studentId: Types.ObjectId,
    eligibility: AttendanceEligibilityResult,
    leaveBatchId: string,
    registeredAt: Date,
  ): Record<string, unknown> {
    const { location, student } = eligibility;

    if (!location || !student.ownerHrId) {
      throw new InternalServerErrorException('学生请假基础数据不完整');
    }

    return {
      studentId,
      ownerHrId: new Types.ObjectId(student.ownerHrId),
      attendanceDate: eligibility.attendanceDate,
      status: AttendanceStatus.Leave,
      lateLevel: null,
      source: AttendanceSource.LeaveRegistration,
      checkInAt: null,
      checkInAttemptAt: null,
      assignedWorkLocation: location.workLocation,
      assignedWorkLocationAssignmentId: new Types.ObjectId(
        location.assignmentId,
      ),
      checkInMode: null,
      checkInLocation: null,
      deviceIdHash: null,
      matchedOfficeNetworkId: null,
      ipMatchSucceeded: null,
      leaveBatchId,
      leaveRegisteredAt: registeredAt,
    };
  }

  private async findExistingRecords(
    studentId: Types.ObjectId,
    dates: string[],
  ): Promise<ExistingAttendanceSummary[]> {
    return await this.attendanceRecordModel
      .find({
        studentId,
        attendanceDate: { $in: dates },
      })
      .select({ attendanceDate: 1, status: 1 })
      .lean()
      .exec();
  }

  private async rollbackBatch(leaveBatchId: string): Promise<void> {
    try {
      await this.attendanceRecordModel
        .deleteMany({
          leaveBatchId,
          source: AttendanceSource.LeaveRegistration,
        })
        .exec();
    } catch {
      throw new InternalServerErrorException(
        '请假登记发生并发冲突，批次清理失败',
      );
    }
  }

  private throwExistingRecordConflict(
    records: ExistingAttendanceSummary[],
  ): never {
    if (records.some((record) => record.status === AttendanceStatus.Leave)) {
      throw new ConflictException({
        code: AttendanceErrorCode.LeaveAlreadyRegistered,
        message: '选中日期中已有请假记录，不能重复登记',
      });
    }

    throw new ConflictException({
      code: AttendanceErrorCode.AttendanceAlreadyRecorded,
      message: '选中日期中已有出勤或缺勤记录，不能登记请假',
    });
  }

  private isStudentDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const mongoError = error as {
      code?: unknown;
      keyPattern?: Record<string, unknown>;
      message?: unknown;
    };

    if (mongoError.code !== 11000) {
      return false;
    }

    return (
      mongoError.keyPattern?.studentId === 1 ||
      (typeof mongoError.message === 'string' &&
        mongoError.message.includes(STUDENT_UNIQUE_INDEX))
    );
  }
}
