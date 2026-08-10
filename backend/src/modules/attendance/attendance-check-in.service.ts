import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import {
  BusinessClockService,
  type AttendanceWindow,
} from '../../common/time/business-clock.service';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { AttendanceDeviceService } from './attendance-device.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import type { CreateAttendanceCheckInDto } from './dto/create-attendance-check-in.dto';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import type { AttendanceCheckInResponse } from './interfaces/attendance-check-in-response.interface';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import { OfficeNetworkService } from './office-network.service';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

const STUDENT_UNIQUE_INDEX = 'unique_student_attendance_date';

interface AttendanceClassification {
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  message: string;
}

@Injectable()
export class AttendanceCheckInService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly businessClock: BusinessClockService,
    private readonly eligibilityService: AttendanceEligibilityService,
    private readonly checkInPolicyService: AttendanceCheckInPolicyService,
    private readonly deviceService: AttendanceDeviceService,
    private readonly officeNetworkService: OfficeNetworkService,
  ) {}

  async checkIn(
    studentId: string,
    dto: CreateAttendanceCheckInDto,
    clientIp?: string,
  ): Promise<AttendanceCheckInResponse> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    // 同一次请求始终使用同一个后端时间快照，避免跨秒或跨日造成判断不一致。
    const now = this.businessClock.now();
    const attendanceDate = this.businessClock.getBusinessDate(now);
    const studentObjectId = new Types.ObjectId(studentId);

    const existingRecord = await this.attendanceRecordModel
      .findOne({ studentId: studentObjectId, attendanceDate })
      .lean()
      .exec();

    if (existingRecord) {
      this.throwExistingRecordConflict(existingRecord);
    }

    // DTO 和 Service 分别校验设备 UUID；数据库仅保存不可逆哈希。
    const deviceIdHash = this.deviceService.hashDeviceId(dto.deviceId);
    const eligibility = await this.eligibilityService.evaluate(
      studentId,
      attendanceDate,
      now,
    );
    this.assertEligible(eligibility);

    const location = eligibility.location;

    if (!location || !eligibility.student.ownerHrId) {
      throw new InternalServerErrorException('学生考勤基础数据不完整');
    }

    const policy = this.checkInPolicyService.assertCheckInModeAllowed(
      location.workLocation,
      dto.checkInMode,
    );
    const attendanceWindow = this.businessClock.getAttendanceWindow(now);

    if (attendanceWindow === 'closed') {
      await this.ensureClosedWindowAbsence(
        studentObjectId,
        eligibility.student.ownerHrId,
        attendanceDate,
        location.workLocation,
        location.assignmentId,
        now,
      );
      throw new ConflictException({
        code: AttendanceErrorCode.CheckInWindowClosed,
        message: '已过打卡时间，无法打卡，今日记缺勤',
      });
    }

    // 预检查提供明确错误；最终并发保护仍由 MongoDB 唯一索引负责。
    await this.deviceService.assertDeviceAvailable(
      deviceIdHash,
      attendanceDate,
    );

    const officeNetworkRequired = policy.officeNetworkRequiredFor.includes(
      dto.checkInMode,
    );
    const networkMatch = officeNetworkRequired
      ? await this.officeNetworkService.assertIpAllowed(
          location.workLocation,
          clientIp,
        )
      : null;
    const classification = this.classifyAttendance(attendanceWindow);
    const checkInLocation =
      dto.checkInMode === CheckInMode.Online
        ? WorkLocation.Online
        : location.workLocation;

    try {
      await this.attendanceRecordModel.create({
        studentId: studentObjectId,
        ownerHrId: new Types.ObjectId(eligibility.student.ownerHrId),
        attendanceDate,
        status: classification.status,
        lateLevel: classification.lateLevel,
        source: AttendanceSource.CheckIn,
        checkInAt: now,
        checkInAttemptAt: null,
        assignedWorkLocation: location.workLocation,
        assignedWorkLocationAssignmentId: new Types.ObjectId(
          location.assignmentId,
        ),
        checkInMode: dto.checkInMode,
        checkInLocation,
        deviceIdHash,
        matchedOfficeNetworkId: networkMatch
          ? new Types.ObjectId(networkMatch.matchedOfficeNetworkId)
          : null,
        ipMatchSucceeded: networkMatch?.ipMatchSucceeded ?? null,
        leaveBatchId: null,
        leaveRegisteredAt: null,
      });
    } catch (error: unknown) {
      // 两个唯一索引可能在并发请求中触发，转换为稳定的业务错误码。
      this.deviceService.throwIfDeviceAlreadyUsed(error);

      if (this.isStudentDuplicateKeyError(error)) {
        throw this.studentAlreadyCheckedInException();
      }

      throw error;
    }

    return {
      attendanceDate,
      status: classification.status,
      lateLevel: classification.lateLevel,
      message: classification.message,
      checkInAt: now,
      assignedWorkLocation: location.workLocation,
      checkInMode: dto.checkInMode,
      checkInLocation,
    };
  }

  private assertEligible(eligibility: AttendanceEligibilityResult): void {
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
        message: '当前不在有效实习期内，不能登记出勤',
      });
    }

    throw new BadRequestException({
      code: AttendanceErrorCode.AttendanceNotRequired,
      message:
        eligibility.reason === AttendanceEligibilityReason.NonWorkday
          ? '今天无需登记出勤'
          : '当前缺少有效出勤安排',
    });
  }

  private classifyAttendance(
    attendanceWindow: Exclude<AttendanceWindow, 'closed'>,
  ): AttendanceClassification {
    if (attendanceWindow === 'on_time') {
      return {
        status: AttendanceStatus.OnTime,
        lateLevel: null,
        message: '打卡成功',
      };
    }

    if (attendanceWindow === 'late') {
      return {
        status: AttendanceStatus.Late,
        lateLevel: LateLevel.Normal,
        message: '打卡成功，今日记为迟到',
      };
    }

    return {
      status: AttendanceStatus.Absent,
      lateLevel: LateLevel.Severe,
      message: '严重迟到，今日记缺勤',
    };
  }

  private async ensureClosedWindowAbsence(
    studentId: Types.ObjectId,
    ownerHrId: string,
    attendanceDate: string,
    assignedWorkLocation: string,
    assignmentId: string,
    attemptedAt: Date,
  ): Promise<void> {
    try {
      await this.attendanceRecordModel.create({
        studentId,
        ownerHrId: new Types.ObjectId(ownerHrId),
        attendanceDate,
        status: AttendanceStatus.Absent,
        lateLevel: null,
        source: AttendanceSource.AbsenceScheduler,
        checkInAt: null,
        checkInAttemptAt: attemptedAt,
        assignedWorkLocation,
        assignedWorkLocationAssignmentId: new Types.ObjectId(assignmentId),
        checkInMode: null,
        checkInLocation: null,
        deviceIdHash: null,
        matchedOfficeNetworkId: null,
        ipMatchSucceeded: null,
        leaveBatchId: null,
        leaveRegisteredAt: null,
      });
    } catch (error: unknown) {
      // 并发请求已经创建当天记录时无需重复写入，仍返回窗口关闭。
      if (!this.isStudentDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  private throwExistingRecordConflict(
    record: Pick<AttendanceRecord, 'source' | 'status'>,
  ): never {
    if (
      record.source === AttendanceSource.LeaveRegistration ||
      record.status === AttendanceStatus.Leave
    ) {
      throw new ConflictException({
        code: AttendanceErrorCode.LeaveAlreadyRegistered,
        message: '今天已经登记请假，不能重复打卡',
      });
    }

    throw this.studentAlreadyCheckedInException();
  }

  private studentAlreadyCheckedInException(): ConflictException {
    return new ConflictException({
      code: AttendanceErrorCode.StudentAlreadyCheckedIn,
      message: '今天已经存在出勤记录，不能重复打卡',
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
