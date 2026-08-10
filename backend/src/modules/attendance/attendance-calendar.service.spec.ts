import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceCalendarDocument } from './schemas/attendance-calendar.schema';

function createService(holiday: Record<string, unknown> | null = null) {
  const exec = jest.fn().mockResolvedValue(holiday);
  const lean = jest.fn().mockReturnValue({ exec });
  const sort = jest.fn().mockReturnValue({ lean });
  const model = {
    findOne: jest.fn().mockReturnValue({ sort }),
  };
  const clock = {
    getBusinessDate: jest.fn().mockReturnValue('2026-08-05'),
  };

  return {
    model,
    clock,
    service: new AttendanceCalendarService(
      model as unknown as Model<AttendanceCalendarDocument>,
      clock as unknown as BusinessClockService,
    ),
  };
}

function holiday(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c20'),
    date: '2026-08-05',
    name: '临时休息日',
    type: CalendarExceptionType.TemporaryHoliday,
    scope: AttendanceCalendarScope.Region,
    regionCode: RegionCode.Shanghai,
    ...overrides,
  };
}

describe('AttendanceCalendarService', () => {
  it('treats a normal weekday as a workday', async () => {
    const { service } = createService();

    await expect(
      service.isWorkday('2026-08-05', RegionCode.Shanghai),
    ).resolves.toEqual({
      attendanceDate: '2026-08-05',
      regionCode: RegionCode.Shanghai,
      isWorkday: true,
      reason: 'weekday',
      holiday: null,
    });
  });

  it('treats Saturday and Sunday as non-workdays without querying MongoDB', async () => {
    const { service, model } = createService();

    const result = await service.isWorkday('2026-08-08', RegionCode.Shanghai);

    expect(result.reason).toBe('weekend');
    expect(result.isWorkday).toBe(false);
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('applies a global holiday to every region', async () => {
    const globalHoliday = holiday({
      name: '全国假期',
      type: CalendarExceptionType.PublicHoliday,
      scope: AttendanceCalendarScope.Global,
      regionCode: null,
    });
    const { service } = createService(globalHoliday);

    const result = await service.isWorkday('2026-08-05', RegionCode.Beijing);

    expect(result.isWorkday).toBe(false);
    expect(result.reason).toBe(CalendarExceptionType.PublicHoliday);
    expect(result.holiday).toEqual(
      expect.objectContaining({ name: '全国假期', regionCode: null }),
    );
  });

  it('queries only the global calendar and the requested region calendar', async () => {
    const { service, model } = createService();

    await service.isWorkday('2026-08-05', RegionCode.Online);

    expect(model.findOne).toHaveBeenCalledWith({
      date: '2026-08-05',
      isDeleted: false,
      $or: [
        { scope: AttendanceCalendarScope.Global, regionCode: null },
        {
          scope: AttendanceCalendarScope.Region,
          regionCode: RegionCode.Online,
        },
      ],
    });
  });

  it('returns the configured regional holiday details', async () => {
    const regionalHoliday = holiday();
    const { service } = createService(regionalHoliday);

    const result = await service.isWorkday('2026-08-05', RegionCode.Shanghai);

    expect(result.isWorkday).toBe(false);
    expect(result.reason).toBe(CalendarExceptionType.TemporaryHoliday);
    expect(result.holiday?.id).toBe(regionalHoliday._id.toString());
    expect(result.holiday?.scope).toBe(AttendanceCalendarScope.Region);
    expect(result.holiday?.regionCode).toBe(RegionCode.Shanghai);
  });

  it('uses the BusinessClock date for today checks', async () => {
    const { service, clock, model } = createService();

    await service.isTodayWorkday(RegionCode.Nanjing);

    expect(clock.getBusinessDate).toHaveBeenCalledTimes(1);
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-08-05' }),
    );
  });

  it.each(['2026-02-30', '2026/08/05', ''])(
    'rejects invalid attendance date: %s',
    async (attendanceDate) => {
      const { service } = createService();

      await expect(
        service.isWorkday(attendanceDate, RegionCode.Shanghai),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
