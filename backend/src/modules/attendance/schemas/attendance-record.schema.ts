import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { ATTENDANCE_DATE_PATTERN } from '../attendance.constants';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { CheckInMode } from '../enums/check-in-mode.enum';
import { LateLevel } from '../enums/late-level.enum';

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;

@Schema({
  collection: 'attendance_records',
  timestamps: true,
  versionKey: false,
})
export class AttendanceRecord {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Student',
    required: true,
  })
  studentId!: Types.ObjectId;

  // 保存负责 HR 的快照，便于普通 HR 按权限查询历史考勤。
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
  })
  ownerHrId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    match: ATTENDANCE_DATE_PATTERN,
  })
  attendanceDate!: string;

  @Prop({
    type: String,
    enum: Object.values(AttendanceStatus),
    required: true,
  })
  status!: AttendanceStatus;

  @Prop({
    type: String,
    enum: Object.values(LateLevel),
    default: null,
  })
  lateLevel!: LateLevel | null;

  @Prop({
    type: String,
    enum: Object.values(AttendanceSource),
    required: true,
  })
  source!: AttendanceSource;

  @Prop({ type: Date, default: null })
  checkInAt!: Date | null;

  @Prop({ type: Date, default: null })
  checkInAttemptAt!: Date | null;

  // 地点和地点记录 ID 都保存快照，之后修改排班不会改写历史考勤。
  @Prop({ type: String, required: true, trim: true })
  assignedWorkLocation!: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'WorkLocationAssignment',
    default: null,
  })
  assignedWorkLocationAssignmentId!: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(CheckInMode),
    default: null,
  })
  checkInMode!: CheckInMode | null;

  @Prop({ type: String, trim: true, default: null })
  checkInLocation!: string | null;

  // 仅保存浏览器 UUID 的哈希，不保存前端提交的原始设备标识。
  @Prop({ type: String, default: null })
  deviceIdHash!: string | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'OfficeNetwork',
    default: null,
  })
  matchedOfficeNetworkId!: Types.ObjectId | null;

  @Prop({ type: Boolean, default: null })
  ipMatchSucceeded!: boolean | null;

  @Prop({ type: String, default: null })
  leaveBatchId!: string | null;

  @Prop({ type: Date, default: null })
  leaveRegisteredAt!: Date | null;

  // 当前记录第一次被 HR 更正前的状态；后续重复更正不覆盖该值。
  @Prop({
    type: String,
    enum: Object.values(AttendanceStatus),
    default: null,
  })
  originalStatus!: AttendanceStatus | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    default: null,
  })
  correctedByHrId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  correctedAt!: Date | null;

  @Prop({ type: String, trim: true, default: null, maxlength: 200 })
  correctionReason!: string | null;

  @Prop({ type: Number, min: 0, default: 0 })
  correctionCount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttendanceRecordSchema =
  SchemaFactory.createForClass(AttendanceRecord);

// 数据库索引负责最终的并发保护，Service 层查询不能替代唯一索引。
AttendanceRecordSchema.index(
  { studentId: 1, attendanceDate: 1 },
  { unique: true, name: 'unique_student_attendance_date' },
);

AttendanceRecordSchema.index({
  ownerHrId: 1,
  attendanceDate: 1,
  status: 1,
});

AttendanceRecordSchema.index({
  attendanceDate: 1,
  assignedWorkLocation: 1,
  checkInMode: 1,
  status: 1,
});

AttendanceRecordSchema.index({ studentId: 1, attendanceDate: -1 });

AttendanceRecordSchema.index(
  { deviceIdHash: 1, attendanceDate: 1 },
  {
    unique: true,
    name: 'unique_check_in_device_attendance_date',
    partialFilterExpression: {
      deviceIdHash: { $type: 'string' },
      source: AttendanceSource.CheckIn,
    },
  },
);
