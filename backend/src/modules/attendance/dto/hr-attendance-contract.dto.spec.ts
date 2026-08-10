import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkLocation } from '../../student/enums/student.enums';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { CheckInMode } from '../enums/check-in-mode.enum';
import {
  HrAttendanceSummarySort,
  HrDailyAttendanceSort,
} from '../enums/hr-attendance-sort.enum';
import { LateLevel } from '../enums/late-level.enum';
import { CorrectAttendanceRecordDto } from './correct-attendance-record.dto';
import { GetHrStudentAttendanceQueryDto } from './get-hr-student-attendance-query.dto';
import { ListHrAttendanceSummaryQueryDto } from './list-hr-attendance-summary-query.dto';
import { ListHrDailyAttendanceQueryDto } from './list-hr-daily-attendance-query.dto';

const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';

describe('HR attendance API contract DTOs', () => {
  it('accepts and transforms the daily list query', async () => {
    const dto = plainToInstance(ListHrDailyAttendanceQueryDto, {
      date: '2026-08-07',
      page: '2',
      limit: '50',
      keyword: '  Student One  ',
      status: AttendanceStatus.Late,
      workLocation: WorkLocation.ShanghaiOffice,
      checkInMode: CheckInMode.Offline,
      ownerHrId: OWNER_HR_ID,
      sortBy: HrDailyAttendanceSort.CheckInAtAsc,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      page: 2,
      limit: 50,
      keyword: 'Student One',
      sortBy: HrDailyAttendanceSort.CheckInAtAsc,
    });
  });

  it('uses stable daily query defaults', async () => {
    const dto = plainToInstance(ListHrDailyAttendanceQueryDto, {
      date: '2026-08-07',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortBy).toBe(HrDailyAttendanceSort.StudentNameAsc);
  });

  it.each([
    [{ date: '2026/08/07' }, 'date'],
    [{ date: '2026-08-07', page: 0 }, 'page'],
    [{ date: '2026-08-07', limit: 101 }, 'limit'],
    [{ date: '2026-08-07', status: 'pending' }, 'status'],
    [{ date: '2026-08-07', ownerHrId: 'not-an-id' }, 'ownerHrId'],
  ])('rejects malformed daily query %#', async (payload, property) => {
    const dto = plainToInstance(ListHrDailyAttendanceQueryDto, payload);
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(property);
  });

  it('accepts the monthly summary query and its sort option', async () => {
    const dto = plainToInstance(ListHrAttendanceSummaryQueryDto, {
      month: '2026-08',
      sortBy: HrAttendanceSummarySort.TotalAttendanceDaysDesc,
      checkInMode: CheckInMode.Online,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.sortBy).toBe(HrAttendanceSummarySort.TotalAttendanceDaysDesc);
  });

  it.each(['2026-8', '2026-13', 'August'])(
    'rejects invalid month %s for HR queries',
    async (month) => {
      const summaryDto = plainToInstance(ListHrAttendanceSummaryQueryDto, {
        month,
      });
      const detailDto = plainToInstance(GetHrStudentAttendanceQueryDto, {
        month,
      });

      await expect(validate(summaryDto)).resolves.not.toHaveLength(0);
      await expect(validate(detailDto)).resolves.not.toHaveLength(0);
    },
  );

  it('accepts a controlled attendance correction payload', async () => {
    const dto = plainToInstance(CorrectAttendanceRecordDto, {
      status: AttendanceStatus.Late,
      reason: '  HR confirmed the actual check-in time  ',
      checkInAt: '2026-08-07T02:12:00.000Z',
      checkInMode: CheckInMode.Offline,
      lateLevel: LateLevel.Normal,
      checkInLocation: '  上海办公室 - 会德丰  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reason).toBe('HR confirmed the actual check-in time');
    expect(dto.checkInLocation).toBe('上海办公室 - 会德丰');
  });

  it('rejects malformed correction values', async () => {
    const dto = plainToInstance(CorrectAttendanceRecordDto, {
      status: 'present',
      reason: '   ',
      checkInAt: 'not-a-date',
      checkInMode: 'office',
      lateLevel: 'extreme',
      checkInLocation: 'x'.repeat(101),
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'status',
        'reason',
        'checkInAt',
        'checkInMode',
        'lateLevel',
        'checkInLocation',
      ]),
    );
  });

  it('rejects correction fields controlled by the backend', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          status: AttendanceStatus.Leave,
          reason: '补录请假',
          studentId: '6a574ec45bd0f7b2a8b65a02',
          attendanceDate: '2026-08-07',
          deviceIdHash: 'controlled-by-backend',
          ipMatchSucceeded: true,
        },
        {
          type: 'body',
          metatype: CorrectAttendanceRecordDto,
        },
      ),
    ).rejects.toThrow();
  });
});
