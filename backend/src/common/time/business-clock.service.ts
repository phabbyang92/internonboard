import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BUSINESS_NOW_PROVIDER,
  type BusinessNowProvider,
} from './business-clock.constants';

export type AttendanceWindow = 'on_time' | 'late' | 'severe' | 'closed';

interface BusinessDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

@Injectable()
export class BusinessClockService {
  private readonly timeZone: string;
  private readonly onTimeBeforeSeconds: number;
  private readonly lateThroughSeconds: number;
  private readonly closeAfterSeconds: number;
  private readonly formatter: Intl.DateTimeFormat;

  constructor(
    private readonly config: ConfigService,
    @Inject(BUSINESS_NOW_PROVIDER)
    private readonly nowProvider: BusinessNowProvider,
  ) {
    this.timeZone =
      this.config.get<string>('ATTENDANCE_TIMEZONE') ?? 'Asia/Shanghai';

    this.onTimeBeforeSeconds = this.parseTime(
      this.config.get<string>('ATTENDANCE_ON_TIME_BEFORE') ?? '10:01',
    );
    this.lateThroughSeconds = this.parseTime(
      this.config.get<string>('ATTENDANCE_LATE_THROUGH') ?? '10:30',
    );
    this.closeAfterSeconds = this.parseTime(
      this.config.get<string>('ATTENDANCE_CHECK_IN_CLOSE_AFTER') ?? '11:00',
    );

    if (
      this.onTimeBeforeSeconds >= this.lateThroughSeconds ||
      this.lateThroughSeconds >= this.closeAfterSeconds
    ) {
      throw new Error('考勤时间配置顺序错误');
    }

    this.formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  }

  now(): Date {
    // 返回副本，避免调用方意外修改测试或系统提供的时间对象。
    return new Date(this.nowProvider().getTime());
  }

  getBusinessDate(date: Date = this.now()): string {
    const parts = this.getDateTimeParts(date);

    return [
      parts.year,
      String(parts.month).padStart(2, '0'),
      String(parts.day).padStart(2, '0'),
    ].join('-');
  }

  getAttendanceWindow(date: Date = this.now()): AttendanceWindow {
    const { hour, minute, second } = this.getDateTimeParts(date);
    const currentSeconds = hour * 3600 + minute * 60 + second;

    if (currentSeconds < this.onTimeBeforeSeconds) {
      return 'on_time';
    }

    if (currentSeconds <= this.lateThroughSeconds) {
      return 'late';
    }

    if (currentSeconds <= this.closeAfterSeconds) {
      return 'severe';
    }

    return 'closed';
  }

  getDateTimeParts(date: Date = this.now()): BusinessDateTimeParts {
    const parts = this.formatter.formatToParts(date);

    return {
      year: this.readNumberPart(parts, 'year'),
      month: this.readNumberPart(parts, 'month'),
      day: this.readNumberPart(parts, 'day'),
      hour: this.readNumberPart(parts, 'hour'),
      minute: this.readNumberPart(parts, 'minute'),
      second: this.readNumberPart(parts, 'second'),
    };
  }

  private parseTime(value: string): number {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

    if (!match) {
      throw new Error(`考勤时间格式错误: ${value}`);
    }

    return Number(match[1]) * 3600 + Number(match[2]) * 60;
  }

  private readNumberPart(
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): number {
    const value = parts.find((part) => part.type === type)?.value;

    if (value === undefined) {
      throw new Error(`无法读取北京时间字段: ${type}`);
    }

    return Number(value);
  }
}
