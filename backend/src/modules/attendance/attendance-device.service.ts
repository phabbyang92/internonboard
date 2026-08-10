import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import type { Model } from 'mongoose';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

const DEVICE_HASH_PATTERN = /^[a-f0-9]{64}$/;
const DEVICE_UNIQUE_INDEX = 'unique_check_in_device_attendance_date';

@Injectable()
export class AttendanceDeviceService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
  ) {}

  hashDeviceId(deviceId: string): string {
    // DTO 会先校验一次；Service 再校验可防止内部调用绕过 HTTP ValidationPipe。
    if (!isUUID(deviceId, '4')) {
      throw new BadRequestException({
        code: AttendanceErrorCode.InvalidDeviceId,
        message: '设备标识格式无效',
      });
    }

    // UUID 不区分大小写，先标准化可防止同一设备标识生成不同哈希。
    return createHash('sha256').update(deviceId.toLowerCase()).digest('hex');
  }

  async isDeviceUsedOnDate(
    deviceIdHash: string,
    attendanceDate: string,
  ): Promise<boolean> {
    this.validateDeviceHash(deviceIdHash);
    this.validateAttendanceDate(attendanceDate);

    const existingRecord = await this.attendanceRecordModel
      .exists({
        deviceIdHash,
        attendanceDate,
        source: AttendanceSource.CheckIn,
      })
      .exec();

    return existingRecord !== null;
  }

  async assertDeviceAvailable(
    deviceIdHash: string,
    attendanceDate: string,
  ): Promise<void> {
    if (await this.isDeviceUsedOnDate(deviceIdHash, attendanceDate)) {
      throw this.deviceAlreadyUsedException();
    }
  }

  throwIfDeviceAlreadyUsed(error: unknown): void {
    if (this.isDeviceDuplicateKeyError(error)) {
      throw this.deviceAlreadyUsedException();
    }
  }

  private isDeviceDuplicateKeyError(error: unknown): boolean {
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
      mongoError.keyPattern?.deviceIdHash === 1 ||
      (typeof mongoError.message === 'string' &&
        mongoError.message.includes(DEVICE_UNIQUE_INDEX))
    );
  }

  private deviceAlreadyUsedException(): ConflictException {
    return new ConflictException({
      code: AttendanceErrorCode.DeviceAlreadyUsed,
      message: '该设备今天已经用于其他出勤登记',
    });
  }

  private validateDeviceHash(deviceIdHash: string): void {
    if (!DEVICE_HASH_PATTERN.test(deviceIdHash)) {
      throw new BadRequestException('设备标识哈希格式无效');
    }
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
