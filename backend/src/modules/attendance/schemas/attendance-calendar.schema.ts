import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { ATTENDANCE_DATE_PATTERN } from '../attendance.constants';
import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { CalendarExceptionType } from '../enums/calendar-exception-type.enum';
import { RegionCode } from '../enums/region-code.enum';

export type AttendanceCalendarDocument = HydratedDocument<AttendanceCalendar>;

@Schema({
  collection: 'attendance_calendar',
  timestamps: true,
  versionKey: false,
})
export class AttendanceCalendar extends BaseSchema {
  @Prop({
    type: String,
    required: true,
    match: ATTENDANCE_DATE_PATTERN,
  })
  date!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({
    type: String,
    enum: Object.values(CalendarExceptionType),
    required: true,
  })
  type!: CalendarExceptionType;

  @Prop({
    type: String,
    enum: Object.values(AttendanceCalendarScope),
    required: true,
  })
  scope!: AttendanceCalendarScope;

  @Prop({
    type: String,
    enum: Object.values(RegionCode),
    default: null,
  })
  regionCode!: RegionCode | null;

  @Prop({ type: String, trim: true, default: null })
  reason!: string | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
  })
  createdByHrId!: Types.ObjectId;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
  })
  updatedByHrId!: Types.ObjectId;
}

export const AttendanceCalendarSchema =
  SchemaFactory.createForClass(AttendanceCalendar);

// 全国假期不带地区；地区假期必须明确指定一个稳定地区代码。
AttendanceCalendarSchema.pre('validate', function () {
  if (
    this.scope === AttendanceCalendarScope.Global &&
    this.regionCode !== null
  ) {
    this.invalidate('regionCode', '全国假期不能指定地区');
  }

  if (
    this.scope === AttendanceCalendarScope.Region &&
    this.regionCode === null
  ) {
    this.invalidate('regionCode', '地区假期必须指定地区');
  }

  if (
    this.scope === AttendanceCalendarScope.Global &&
    this.type !== CalendarExceptionType.PublicHoliday
  ) {
    this.invalidate('type', '全国日历只能配置法定假期');
  }

  if (
    this.scope === AttendanceCalendarScope.Region &&
    this.type !== CalendarExceptionType.TemporaryHoliday
  ) {
    this.invalidate('type', '地区日历只能配置临时假期');
  }
});

// 软删除旧配置后，同一日期、作用范围和地区可以重新创建有效配置。
AttendanceCalendarSchema.index(
  { date: 1, scope: 1, regionCode: 1 },
  {
    unique: true,
    name: 'unique_active_attendance_calendar_region_date',
    partialFilterExpression: { isDeleted: false },
  },
);

AttendanceCalendarSchema.index({ isDeleted: 1, date: 1 });
AttendanceCalendarSchema.index({
  isDeleted: 1,
  regionCode: 1,
  date: 1,
});
