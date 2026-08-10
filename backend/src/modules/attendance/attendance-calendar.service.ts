import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { RegionCode } from './enums/region-code.enum';
import type { WorkdayResult } from './interfaces/workday-result.interface';
import {
  AttendanceCalendar,
  type AttendanceCalendarDocument,
} from './schemas/attendance-calendar.schema';

@Injectable()
export class AttendanceCalendarService {
  constructor(
    @InjectModel(AttendanceCalendar.name)
    private readonly calendarModel: Model<AttendanceCalendarDocument>,
    private readonly businessClock: BusinessClockService,
  ) {}

  async isWorkday(
    attendanceDate: string,
    regionCode: RegionCode,
  ): Promise<WorkdayResult> {
    const date = this.parseAttendanceDate(attendanceDate);
    const weekday = date.getUTCDay();

    if (weekday === 0 || weekday === 6) {
      return {
        attendanceDate,
        regionCode,
        isWorkday: false,
        reason: 'weekend',
        holiday: null,
      };
    }

    const holiday = await this.calendarModel
      .findOne({
        date: attendanceDate,
        isDeleted: false,
        $or: [
          {
            scope: AttendanceCalendarScope.Global,
            regionCode: null,
          },
          {
            scope: AttendanceCalendarScope.Region,
            regionCode,
          },
        ],
      })
      // 同一天同时存在全国和地区配置时，全国配置优先返回。
      .sort({ scope: 1 })
      .lean()
      .exec();

    if (holiday) {
      return {
        attendanceDate,
        regionCode,
        isWorkday: false,
        reason: holiday.type,
        holiday: {
          id: holiday._id.toString(),
          name: holiday.name,
          type: holiday.type,
          scope: holiday.scope,
          regionCode: holiday.regionCode,
        },
      };
    }

    return {
      attendanceDate,
      regionCode,
      isWorkday: true,
      reason: 'weekday',
      holiday: null,
    };
  }

  isTodayWorkday(regionCode: RegionCode): Promise<WorkdayResult> {
    return this.isWorkday(this.businessClock.getBusinessDate(), regionCode);
  }

  private parseAttendanceDate(attendanceDate: string): Date {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      throw new BadRequestException('考勤日期格式必须为 YYYY-MM-DD');
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // 正则只能限制数字范围，这里继续排除 2 月 30 日等无效日期。
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('考勤日期无效');
    }

    return date;
  }
}
