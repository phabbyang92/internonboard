import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import type { LeaveCancellationResponse } from './interfaces/leave-cancellation-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface LeaveCancellationRecord {
  _id: Types.ObjectId;
  status: AttendanceStatus;
  source: AttendanceSource;
  leaveBatchId: string | null;
}

@Injectable()
export class AttendanceLeaveCancellationService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly businessClock: BusinessClockService,
  ) {}

  async cancel(
    studentId: string,
    attendanceDate: string,
  ): Promise<LeaveCancellationResponse> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    this.validateAttendanceDate(attendanceDate);

    const now = this.businessClock.now();
    const today = this.businessClock.getBusinessDate(now);

    // 当天记录已进入考勤结算范围，仅允许撤销明天及以后的本人请假。
    if (attendanceDate <= today) {
      throw new BadRequestException({
        code: AttendanceErrorCode.LeaveCancellationDateNotFuture,
        message: '只能撤销晚于今天的请假记录',
      });
    }

    const studentObjectId = new Types.ObjectId(studentId);
    const record = await this.attendanceRecordModel
      .findOne({ studentId: studentObjectId, attendanceDate })
      .select({ status: 1, source: 1, leaveBatchId: 1 })
      .lean()
      .exec();

    if (!record) {
      throw this.leaveNotFoundException();
    }

    if (
      record.status !== AttendanceStatus.Leave ||
      record.source !== AttendanceSource.LeaveRegistration
    ) {
      throw new ConflictException({
        code: AttendanceErrorCode.LeaveNotCancellable,
        message: '该记录不是学生提交的请假，不能撤销',
      });
    }

    const cancellableRecord = record as LeaveCancellationRecord;
    const result = await this.attendanceRecordModel
      .deleteOne({
        _id: cancellableRecord._id,
        studentId: studentObjectId,
        attendanceDate,
        status: AttendanceStatus.Leave,
        source: AttendanceSource.LeaveRegistration,
      })
      .exec();

    if (result.deletedCount !== 1) {
      // 查询后记录可能被另一请求先撤销，返回稳定的幂等结果说明。
      throw this.leaveNotFoundException();
    }

    return {
      attendanceDate,
      leaveBatchId: cancellableRecord.leaveBatchId,
      cancelledAt: now,
    };
  }

  private validateAttendanceDate(attendanceDate: string): void {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      throw new BadRequestException({
        code: AttendanceErrorCode.InvalidLeaveDate,
        message: '请假日期格式必须为 YYYY-MM-DD',
      });
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException({
        code: AttendanceErrorCode.InvalidLeaveDate,
        message: '请假日期无效',
      });
    }
  }

  private leaveNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: AttendanceErrorCode.LeaveRecordNotFound,
      message: '未找到可撤销的请假记录',
    });
  }
}
