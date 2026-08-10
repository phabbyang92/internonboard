import { ConfigService } from '@nestjs/config';
import { BusinessClockService } from './business-clock.service';

describe('BusinessClockService', () => {
  const createService = (now: string) => {
    const values: Record<string, string> = {
      ATTENDANCE_TIMEZONE: 'Asia/Shanghai',
      ATTENDANCE_ON_TIME_BEFORE: '10:01',
      ATTENDANCE_LATE_THROUGH: '10:30',
      ATTENDANCE_CHECK_IN_CLOSE_AFTER: '11:00',
    };

    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new BusinessClockService(config, () => new Date(now));
  };

  it('returns the business date in Asia/Shanghai', () => {
    const service = createService('2026-08-03T16:30:00.000Z');

    expect(service.getBusinessDate()).toBe('2026-08-04');
  });

  it.each([
    ['2026-08-05T02:00:59.000Z', 'on_time'],
    ['2026-08-05T02:01:00.000Z', 'late'],
    ['2026-08-05T02:30:00.000Z', 'late'],
    ['2026-08-05T02:30:01.000Z', 'severe'],
    ['2026-08-05T03:00:00.000Z', 'severe'],
    ['2026-08-05T03:00:01.000Z', 'closed'],
  ])('classifies %s as %s', (now, expected) => {
    const service = createService(now);

    expect(service.getAttendanceWindow()).toBe(expected);
  });

  it('handles the China new-year boundary', () => {
    const service = createService('2026-12-31T16:05:00.000Z');

    expect(service.getBusinessDate()).toBe('2027-01-01');
  });
});
